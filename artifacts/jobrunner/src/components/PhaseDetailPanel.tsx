/**
 * PhaseDetailPanel — right-side Sheet slide-over that shows everything
 * scoped to a single job phase: header, team, tasks (stub), documents (stub),
 * notes, and an inline Edit form when the Edit button is tapped.
 *
 * The panel does NOT navigate away — the URL stays stable, keeping the user's
 * position in the Phases list. Closing the panel returns them to the list.
 */
import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Pencil, X, Crown, Loader2, Layers, Users, FileText, StickyNote,
  CheckSquare, ChevronRight, Clock, ExternalLink, Upload, ArrowRightLeft,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient, getQueryFn, getAuthHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { JobPhase, PhaseAssignedUser, PhaseStatus } from "./JobPhasesSection";

// ─── Re-export for callers ────────────────────────────────────────────────────
export type { JobPhase };

// ─── Local constants ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<PhaseStatus, { label: string; className: string }> = {
  not_started: { label: "Not Started", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  in_progress:  { label: "In Progress",  className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  complete:     { label: "Complete",     className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  invoiced:     { label: "Invoiced",     className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
};

const EMPTY_FORM = {
  phaseCode: "",
  name: "",
  description: "",
  scheduledStart: "",
  scheduledEnd: "",
  bookedHours: "",
  budgetedHours: "",
  status: "not_started" as PhaseStatus,
  notes: "",
  assignedUserId: "",
  assignedUserIds: [] as string[],
};

// ─── Avatar helpers ───────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "#4f7ddb", "#e07b39", "#5ba85f", "#9b59b6",
  "#e74c3c", "#16a085", "#d35400", "#2c3e50",
];
function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name?: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

function fmtDate(d?: string | null): string | null {
  if (!d) return null;
  try { return format(new Date(d), "d MMM yy"); } catch { return null; }
}

// ─── Inline edit form (simplified — reuses field layout from JobPhasesSection) ─
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Check } from "lucide-react";

interface PhaseEditFormProps {
  form: typeof EMPTY_FORM;
  setForm: (f: typeof EMPTY_FORM) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
  workers: { id: string; name: string }[];
}

function PhaseEditForm({ form, setForm, onSubmit, onCancel, isPending, workers }: PhaseEditFormProps) {
  const set = (field: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [field]: e.target.value });
  const setVal = (field: keyof typeof EMPTY_FORM) => (v: string) =>
    setForm({ ...form, [field]: v });

  const selectedIds: string[] = form.assignedUserIds ?? [];
  const leadId = form.assignedUserId ?? selectedIds[0] ?? "";

  const toggleMember = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    let newLead = leadId;
    if (!next.includes(newLead)) newLead = next[0] ?? "";
    setForm({ ...form, assignedUserIds: next, assignedUserId: newLead });
  };

  return (
    <div className="space-y-4 p-1">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Phase Code *</Label>
          <Input placeholder="P01" value={form.phaseCode} onChange={set("phaseCode")} className="h-8 text-sm" />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Phase Name *</Label>
          <Input placeholder="Site Preparation" value={form.name} onChange={set("name")} className="h-8 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Start Date</Label>
          <Input type="date" value={form.scheduledStart} onChange={set("scheduledStart")} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End Date</Label>
          <Input type="date" value={form.scheduledEnd} onChange={set("scheduledEnd")} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Booked Hours</Label>
          <Input placeholder="40" type="number" step="0.5" min="0" value={form.bookedHours} onChange={set("bookedHours")} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Budgeted Hours</Label>
          <Input placeholder="40" type="number" step="0.5" min="0" value={form.budgetedHours} onChange={set("budgetedHours")} className="h-8 text-sm" />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Status</Label>
        <Select value={form.status} onValueChange={setVal("status")}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Input placeholder="Brief description" value={form.description} onChange={set("description")} className="h-8 text-sm" />
      </div>

      {workers.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            <Users className="h-3 w-3" />
            Team members
            {selectedIds.length > 0 && (
              <span className="text-muted-foreground font-normal">({selectedIds.length} selected)</span>
            )}
          </Label>
          <div className="border rounded-md divide-y max-h-36 overflow-y-auto bg-background">
            {workers.map((w) => {
              const isSelected = selectedIds.includes(w.id);
              const isLead = leadId === w.id && isSelected;
              return (
                <label key={w.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleMember(w.id)} />
                  <span className="flex-1 text-xs">{w.name}</span>
                  {isSelected && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); if (selectedIds.length > 1) setForm({ ...form, assignedUserId: w.id }); }}
                      disabled={selectedIds.length <= 1}
                      className="ml-auto"
                    >
                      <Crown className={`h-3 w-3 ${isLead ? "text-amber-400" : "text-muted-foreground/30 hover:text-amber-300"}`} fill={isLead ? "currentColor" : "none"} />
                    </button>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      <Textarea placeholder="Notes (optional)" value={form.notes} onChange={set("notes")} className="text-sm resize-none" rows={2} />

      <div className="flex gap-2 pt-1 border-t">
        <Button
          size="sm"
          disabled={!form.phaseCode.trim() || !form.name.trim() || isPending}
          onClick={onSubmit}
          style={{ backgroundColor: "hsl(var(--trade))", color: "white" }}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-semibold text-foreground">{title}</span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface PhaseDetailPanelProps {
  jobId: string;
  phase: JobPhase;
  workers: { id: string; name: string }[];
  isTradie?: boolean;
  onClose: () => void;
  /** Called after a successful update so the parent can refetch */
  onUpdated: () => void;
  onCreateClaim?: (phase: JobPhase) => void;
}

interface PhaseDocument {
  id: string;
  docNumber: string;
  title: string;
  category: string;
  currentRevision: string;
  latestRevision?: {
    fileName: string;
    mimeType?: string | null;
    fileUrl?: string | null;
  } | null;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PhaseDetailPanel({
  jobId,
  phase,
  workers,
  isTradie = false,
  onClose,
  onUpdated,
  onCreateClaim,
}: PhaseDetailPanelProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });

  // Fetch the phases list so the team section stays current when workers are
  // reassigned via ProjectTeamModal while the panel is open. Uses the same
  // string query key as JobPhasesSection so cache invalidations propagate here.
  const { data: livePhases = [] } = useQuery<Array<{
    id: string;
    phaseCode: string;
    name: string;
    assignedUsers?: PhaseAssignedUser[];
    assignedUserId?: string | null;
    assignedUserName?: string | null;
  }>>({
    queryKey: [`/api/jobs/${jobId}/phases`],
    staleTime: 0,
  });
  const livePhaseData = livePhases.find((p) => p.id === phase.id);

  // ── Move doc dialog state ──────────────────────────────────────────────────
  const [moveDocDialog, setMoveDocDialog] = useState<{ open: boolean; docId: string | null; selectedPhaseId: string }>({
    open: false, docId: null, selectedPhaseId: "__none__",
  });

  // ── Phase documents query ──────────────────────────────────────────────────
  const { data: phaseDocs, isLoading: docsLoading } = useQuery<PhaseDocument[]>({
    queryKey: [`/api/jobs/${jobId}/project-documents`, { phaseId: phase.id }],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!jobId && !!phase.id,
  });

  // ── Assign / move document to a phase (null = remove tag) ────────────────
  const assignDocPhaseMutation = useMutation({
    mutationFn: async ({ docId, phaseId }: { docId: string; phaseId: string | null }) => {
      const res = await fetch(`/api/jobs/${jobId}/project-documents/${docId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ phaseId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_, { phaseId }) => {
      // Invalidate the broad prefix so every phase-scoped variant (source, destination,
      // and the flat document register) refetches — avoids stale caches in destination panels.
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/project-documents`] });
      setMoveDocDialog({ open: false, docId: null, selectedPhaseId: "__none__" });
      toast({ title: phaseId ? "Document moved to phase" : "Document removed from phase" });
    },
    onError: (e: any) => toast({ title: "Failed to update document phase", description: e.message, variant: "destructive" }),
  });

  // ── Phase document upload ──────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const uploadMutation = useMutation({
    mutationFn: async ({ file, title }: { file: File; title: string }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title);
      fd.append("category", "Other");
      fd.append("revision", "A");
      fd.append("phaseId", phase.id);
      const res = await fetch(`/api/jobs/${jobId}/project-documents`, {
        method: "POST",
        body: fd,
        credentials: "include",
        headers: getAuthHeaders() as HeadersInit,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/project-documents`, { phaseId: phase.id }] });
      setUploadFile(null);
      setUploadTitle("");
      toast({ title: "Document attached to phase" });
    },
    onError: (e: any) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const cfg = STATUS_CONFIG[phase.status] ?? STATUS_CONFIG.not_started;
  // Prefer live data from cache/re-fetch; fall back to prop for instant display.
  const resolvedAssignedUsers = livePhaseData?.assignedUsers ?? phase.assignedUsers;
  const resolvedAssignedUserId = livePhaseData?.assignedUserId ?? phase.assignedUserId;
  const resolvedAssignedUserName = livePhaseData?.assignedUserName ?? phase.assignedUserName;
  const phaseMembers: PhaseAssignedUser[] = resolvedAssignedUsers
    ?? (resolvedAssignedUserId
      ? [{ id: resolvedAssignedUserId, name: resolvedAssignedUserName ?? "", isLead: true }]
      : []);

  const startEditing = () => {
    setEditForm({
      phaseCode: phase.phaseCode,
      name: phase.name,
      description: phase.description ?? "",
      scheduledStart: phase.scheduledStart ? phase.scheduledStart.substring(0, 10) : "",
      scheduledEnd: phase.scheduledEnd ? phase.scheduledEnd.substring(0, 10) : "",
      bookedHours: phase.bookedHours ?? "",
      budgetedHours: phase.budgetedHours ?? "",
      status: phase.status,
      notes: phase.notes ?? "",
      assignedUserId: phase.assignedUserId ?? "",
      assignedUserIds: phaseMembers.map((m) => m.id),
    });
    setIsEditing(true);
  };

  const updateMutation = useMutation({
    mutationFn: (data: Partial<typeof EMPTY_FORM>) =>
      apiRequest("PATCH", `/api/jobs/${jobId}/phases/${phase.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/phases`] });
      setIsEditing(false);
      onUpdated();
      toast({ title: "Phase updated" });
    },
    onError: (e: any) => toast({ title: "Failed to update phase", description: e.message, variant: "destructive" }),
  });

  const startStr = fmtDate(phase.scheduledStart);
  const endStr = fmtDate(phase.scheduledEnd);
  const budgeted = phase.budgetedHours ? parseFloat(phase.budgetedHours) : 0;
  const actual = phase.actualHours ?? 0;
  const pct = budgeted > 0 ? actual / budgeted : null;
  const barColor = pct === null ? "hsl(var(--primary))" : pct >= 1 ? "#dc2626" : pct >= 0.8 ? "#d97706" : "#16a34a";

  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 gap-0"
        hideClose
      >
        {/* ── Header bar ───────────────────────────────────────────── */}
        <SheetHeader className="flex-row items-center justify-between px-5 py-3 border-b shrink-0 space-y-0">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--trade))" }} />
            <SheetTitle className="text-sm font-medium truncate">Phase Detail</SheetTitle>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isTradie && !isEditing && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={startEditing}>
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 py-4 space-y-5">
            {isEditing ? (
              /* ── Inline edit form ────────────────────────────────── */
              <PhaseEditForm
                form={editForm}
                setForm={setEditForm}
                onSubmit={() => updateMutation.mutate(editForm)}
                onCancel={() => setIsEditing(false)}
                isPending={updateMutation.isPending}
                workers={workers}
              />
            ) : (
              <>
                {/* ── Phase header ──────────────────────────────────── */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded border"
                      style={{ borderColor: "hsl(var(--trade) / 0.4)", color: "hsl(var(--trade))" }}
                    >
                      {phase.phaseCode}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-foreground leading-tight">{phase.name}</h2>

                  {(startStr || endStr) && (
                    <p className="text-xs text-muted-foreground">
                      {startStr ?? "?"} → {endStr ?? "?"}
                    </p>
                  )}

                  {/* Hours progress bar */}
                  {budgeted > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {actual.toFixed(1)} / {budgeted.toFixed(1)} hrs
                        </span>
                        <span style={{ color: barColor }} className="font-medium">
                          {Math.round((pct ?? 0) * 100)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min((pct ?? 0) * 100, 100)}%`, backgroundColor: barColor }}
                        />
                      </div>
                    </div>
                  )}
                  {!budgeted && phase.bookedHours && parseFloat(phase.bookedHours) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {parseFloat(phase.bookedHours).toFixed(1)} hrs booked
                    </p>
                  )}
                </div>

                <Separator />

                {/* ── Team ─────────────────────────────────────────── */}
                <div className="space-y-2">
                  <SectionHeading icon={<Users className="h-3.5 w-3.5" />} title="Team" />
                  {phaseMembers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No team members assigned to this phase.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {phaseMembers.map((m) => (
                        <div key={m.id} className="flex items-center gap-2.5">
                          <span
                            className="relative inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold text-white shrink-0"
                            style={{ backgroundColor: avatarColor(m.id) }}
                          >
                            {initials(m.name)}
                            {m.isLead && (
                              <Crown
                                className="absolute -top-1 -right-1 h-3 w-3 text-amber-400 drop-shadow"
                                fill="currentColor"
                              />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-tight">{m.name}</p>
                            {m.isLead && (
                              <p className="text-[10px] text-muted-foreground">Lead</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* ── Tasks ────────────────────────────────────────── */}
                <div className="space-y-2">
                  <SectionHeading icon={<CheckSquare className="h-3.5 w-3.5" />} title="Tasks" />
                  <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30 text-xs text-muted-foreground">
                    <CheckSquare className="h-3.5 w-3.5 shrink-0" />
                    <span>Tasks linked to this phase will appear here.</span>
                  </div>
                </div>

                <Separator />

                {/* ── Documents ─────────────────────────────────────── */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <SectionHeading icon={<FileText className="h-3.5 w-3.5" />} title="Documents" />
                    {!isTradie && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] gap-1 px-2"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadMutation.isPending}
                      >
                        {uploadMutation.isPending
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Upload className="h-3 w-3" />}
                        Attach
                      </Button>
                    )}
                  </div>
                  {/* Hidden file input — stages a file for upload */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setUploadFile(f);
                      setUploadTitle(f.name.replace(/\.[^/.]+$/, ""));
                      e.target.value = "";
                    }}
                  />
                  {/* Inline title confirm row (appears when a file is staged) */}
                  {uploadFile && (
                    <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-[10px] text-muted-foreground truncate">{uploadFile.name}</p>
                        <input
                          className="w-full text-xs border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="Document title"
                          value={uploadTitle}
                          onChange={(e) => setUploadTitle(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          disabled={!uploadTitle.trim() || uploadMutation.isPending}
                          onClick={() => uploadMutation.mutate({ file: uploadFile, title: uploadTitle.trim() })}
                          style={{ backgroundColor: "hsl(var(--trade))", color: "white" }}
                        >
                          {uploadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Upload"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => { setUploadFile(null); setUploadTitle(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {docsLoading ? (
                    <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                      <span>Loading documents…</span>
                    </div>
                  ) : phaseDocs && phaseDocs.length > 0 ? (
                    <div className="space-y-1">
                      {phaseDocs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg border bg-background hover:bg-muted/40 transition-colors"
                        >
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{doc.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {doc.docNumber} · {doc.category} · Rev {doc.currentRevision}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {doc.latestRevision?.fileUrl ? (
                              <a
                                href={doc.latestRevision.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded hover:bg-muted transition-colors"
                                title="View document"
                              >
                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                              </a>
                            ) : null}
                            {!isTradie && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                title="Move to another phase or remove"
                                onClick={() => setMoveDocDialog({ open: true, docId: doc.id, selectedPhaseId: "__none__" })}
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span>No documents attached to this phase yet.</span>
                    </div>
                  )}
                </div>

                {/* ── Notes ────────────────────────────────────────── */}
                {phase.notes && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <SectionHeading icon={<StickyNote className="h-3.5 w-3.5" />} title="Notes" />
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{phase.notes}</p>
                    </div>
                  </>
                )}

                {/* ── Description ──────────────────────────────────── */}
                {phase.description && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <SectionHeading icon={<ChevronRight className="h-3.5 w-3.5" />} title="Description" />
                      <p className="text-sm text-muted-foreground leading-relaxed">{phase.description}</p>
                    </div>
                  </>
                )}

                {/* ── Create claim CTA ─────────────────────────────── */}
                {!isTradie && onCreateClaim && phase.status === "complete" && (
                  <>
                    <Separator />
                    <Button
                      className="w-full"
                      onClick={() => { onCreateClaim(phase); onClose(); }}
                      style={{ backgroundColor: "hsl(var(--trade))", color: "white" }}
                    >
                      Raise Progress Claim
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>

      {/* ── Move / Remove document phase dialog ──────────────────── */}
      <Dialog
        open={moveDocDialog.open}
        onOpenChange={(open) => {
          if (!open) setMoveDocDialog({ open: false, docId: null, selectedPhaseId: "__none__" });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move or Remove Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Pick a phase to move this document to, or choose "No phase" to remove the tag.
            </p>
            <div className="space-y-1">
              <Select
                value={moveDocDialog.selectedPhaseId}
                onValueChange={(v) => setMoveDocDialog((d) => ({ ...d, selectedPhaseId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No phase (remove tag)</SelectItem>
                  {livePhases
                    .filter((p) => p.id !== phase.id)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.phaseCode} — {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMoveDocDialog({ open: false, docId: null, selectedPhaseId: "__none__" })}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!moveDocDialog.docId) return;
                assignDocPhaseMutation.mutate({
                  docId: moveDocDialog.docId,
                  phaseId: moveDocDialog.selectedPhaseId === "__none__" ? null : moveDocDialog.selectedPhaseId,
                });
              }}
              disabled={assignDocPhaseMutation.isPending}
            >
              {assignDocPhaseMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {moveDocDialog.selectedPhaseId === "__none__" ? "Remove from Phase" : "Move to Phase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
