/**
 * JobPhasesSection — inline phases timeline for the job detail page.
 * Phases give large jobs (construction, engineering) a way to break work
 * into coded billable milestones (e.g., P01 Site Prep, P02 Footings).
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus, ChevronUp, ChevronDown, Pencil, Trash2, Check, X, Loader2, Layers, User,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export type PhaseStatus = "not_started" | "in_progress" | "complete" | "invoiced";

export interface JobPhase {
  id: string;
  jobId: string;
  phaseCode: string;
  name: string;
  description?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  bookedHours?: string | null;
  status: PhaseStatus;
  sortOrder: number;
  notes?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  createdAt: string;
}

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
  status: "not_started" as PhaseStatus,
  notes: "",
  assignedUserId: "",
};

/** Build 1–2 character initials from a full name */
function initials(name?: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

interface Props {
  jobId: string;
  isTradie?: boolean;
  /** Called when user accepts the "create claim" prompt after marking a phase complete */
  onCreateClaimForPhase?: (phase: JobPhase) => void;
}

export function JobPhasesSection({ jobId, isTradie = false, onCreateClaimForPhase }: Props) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  // Phase-complete → claim prompt state
  const [claimPromptPhase, setClaimPromptPhase] = useState<JobPhase | null>(null);

  const { data: phases = [], isLoading } = useQuery<JobPhase[]>({
    queryKey: [`/api/jobs/${jobId}/phases`],
    enabled: !!jobId,
  });

  // Fetch job's assigned workers so the phase form can offer an assignee picker.
  // Only needed for owners/managers; skip for tradies.
  const { data: assignments = [] } = useQuery<any[]>({
    queryKey: [`/api/jobs/${jobId}/assignments`],
    enabled: !!jobId && !isTradie,
  });
  const workers = assignments
    .filter((a: any) => a.isActive !== false)
    .map((a: any) => ({
      id: a.userId as string,
      name: (a.displayName || a.workerDisplayNameSnapshot || a.userId) as string,
    }));

  const sorted = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/phases`] });

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) =>
      apiRequest("POST", `/api/jobs/${jobId}/phases`, data),
    onSuccess: () => {
      invalidate();
      setShowAddForm(false);
      setForm({ ...EMPTY_FORM });
      toast({ title: "Phase added" });
    },
    onError: (e: any) => toast({ title: "Failed to add phase", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ phaseId, data }: { phaseId: string; data: Partial<typeof EMPTY_FORM> }) =>
      apiRequest("PATCH", `/api/jobs/${jobId}/phases/${phaseId}`, data),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      toast({ title: "Phase updated" });
    },
    onError: (e: any) => toast({ title: "Failed to update phase", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (phaseId: string) =>
      apiRequest("DELETE", `/api/jobs/${jobId}/phases/${phaseId}`),
    onSuccess: () => { invalidate(); toast({ title: "Phase removed" }); },
    onError: (e: any) => toast({ title: "Failed to remove phase", description: e.message, variant: "destructive" }),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiRequest("PATCH", `/api/jobs/${jobId}/phases/reorder`, { orderedIds }),
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Reorder failed", description: e.message, variant: "destructive" }),
  });

  const statusChangeMutation = useMutation({
    mutationFn: ({ phaseId, status }: { phaseId: string; status: PhaseStatus }) =>
      apiRequest("PATCH", `/api/jobs/${jobId}/phases/${phaseId}`, { status }),
    onSuccess: (_data, variables) => {
      invalidate();
      if (variables.status === "complete" && onCreateClaimForPhase) {
        const phase = sorted.find((p) => p.id === variables.phaseId) ?? null;
        if (phase) setClaimPromptPhase(phase);
      }
    },
    onError: (e: any) => toast({ title: "Status update failed", description: e.message, variant: "destructive" }),
  });

  const handleMove = (idx: number, direction: "up" | "down") => {
    const ids = sorted.map((p) => p.id);
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= ids.length) return;
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    reorderMutation.mutate(ids);
  };

  const startEdit = (phase: JobPhase) => {
    setEditingId(phase.id);
    setEditForm({
      phaseCode: phase.phaseCode,
      name: phase.name,
      description: phase.description ?? "",
      scheduledStart: phase.scheduledStart ? phase.scheduledStart.substring(0, 10) : "",
      scheduledEnd: phase.scheduledEnd ? phase.scheduledEnd.substring(0, 10) : "",
      bookedHours: phase.bookedHours ?? "",
      status: phase.status,
      notes: phase.notes ?? "",
      assignedUserId: phase.assignedUserId ?? "",
    });
  };

  const fmtDate = (d?: string | null) => {
    if (!d) return null;
    try { return format(new Date(d), "d MMM yy"); } catch { return null; }
  };

  return (
    <Card data-testid="card-job-phases">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" style={{ color: "hsl(var(--trade))" }} />
            <CardTitle className="text-sm font-medium">Job Phases</CardTitle>
            {phases.length > 0 && (
              <Badge variant="secondary" className="text-xs">{phases.length}</Badge>
            )}
          </div>
          {!isTradie && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); }}
              data-testid="button-add-phase"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Add form */}
        {showAddForm && !isTradie && (
          <PhaseForm
            form={form}
            setForm={setForm}
            onSubmit={() => createMutation.mutate(form)}
            onCancel={() => { setShowAddForm(false); setForm({ ...EMPTY_FORM }); }}
            isPending={createMutation.isPending}
            submitLabel="Add Phase"
            workers={workers}
          />
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading phases…
          </div>
        )}

        {!isLoading && sorted.length === 0 && !showAddForm && (
          <p className="text-sm text-muted-foreground py-2">
            No phases yet. Add phases to break this job into billable milestones.
          </p>
        )}

        {/* Phase list */}
        <div className="space-y-2">
          {sorted.map((phase, idx) => {
            const cfg = STATUS_CONFIG[phase.status] ?? STATUS_CONFIG.not_started;
            const isEditing = editingId === phase.id;

            if (isEditing && !isTradie) {
              return (
                <div key={phase.id} className="rounded-lg border bg-muted/30 p-3 space-y-3">
                  <PhaseForm
                    form={editForm}
                    setForm={setEditForm}
                    onSubmit={() => updateMutation.mutate({ phaseId: phase.id, data: editForm })}
                    onCancel={() => setEditingId(null)}
                    isPending={updateMutation.isPending}
                    submitLabel="Save"
                    workers={workers}
                  />
                </div>
              );
            }

            return (
              <div
                key={phase.id}
                className="flex items-start gap-2 p-3 rounded-lg border bg-background"
                data-testid={`phase-row-${phase.id}`}
              >
                {/* Reorder arrows */}
                {!isTradie && (
                  <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
                    <button
                      onClick={() => handleMove(idx, "up")}
                      disabled={idx === 0 || reorderMutation.isPending}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleMove(idx, "down")}
                      disabled={idx === sorted.length - 1 || reorderMutation.isPending}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Phase code badge */}
                <span
                  className="shrink-0 text-xs font-mono font-semibold px-1.5 py-0.5 rounded border mt-0.5"
                  style={{ borderColor: "hsl(var(--trade) / 0.4)", color: "hsl(var(--trade))" }}
                >
                  {phase.phaseCode}
                </span>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{phase.name}</span>
                    {/* Status selector or badge */}
                    {!isTradie ? (
                      <Select
                        value={phase.status}
                        onValueChange={(v) =>
                          statusChangeMutation.mutate({ phaseId: phase.id, status: v as PhaseStatus })
                        }
                        disabled={statusChangeMutation.isPending}
                      >
                        <SelectTrigger className={`h-5 text-[10px] px-1.5 py-0.5 w-auto border-0 ${cfg.className}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    )}
                    {/* Assignee initials badge */}
                    {phase.assignedUserName && (
                      <span
                        className="flex items-center gap-1 text-[10px] text-muted-foreground"
                        title={phase.assignedUserName}
                      >
                        <span
                          className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold text-white"
                          style={{ backgroundColor: "hsl(var(--trade))" }}
                        >
                          {initials(phase.assignedUserName)}
                        </span>
                        <span className="hidden sm:inline">{phase.assignedUserName}</span>
                      </span>
                    )}
                  </div>

                  {(phase.scheduledStart || phase.scheduledEnd || phase.bookedHours) && (
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {(phase.scheduledStart || phase.scheduledEnd) && (
                        <span>
                          {fmtDate(phase.scheduledStart) ?? "?"}
                          {" → "}
                          {fmtDate(phase.scheduledEnd) ?? "?"}
                        </span>
                      )}
                      {phase.bookedHours && parseFloat(phase.bookedHours) > 0 && (
                        <span>{parseFloat(phase.bookedHours).toFixed(1)} hrs booked</span>
                      )}
                    </div>
                  )}

                  {phase.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{phase.description}</p>
                  )}
                </div>

                {/* Actions */}
                {!isTradie && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(phase)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete phase "${phase.phaseCode} ${phase.name}"?`)) {
                          deleteMutation.mutate(phase.id);
                        }
                      }}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      title="Delete"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Phase complete → create claim prompt */}
      <AlertDialog open={!!claimPromptPhase} onOpenChange={(o) => !o && setClaimPromptPhase(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Phase complete — create a progress claim?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{claimPromptPhase?.phaseCode} {claimPromptPhase?.name}</strong> is now complete.
              Would you like to raise a progress claim for this phase now?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClaimPromptPhase(null)}>Not now</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (claimPromptPhase && onCreateClaimForPhase) {
                  onCreateClaimForPhase(claimPromptPhase);
                }
                setClaimPromptPhase(null);
              }}
            >
              Create Claim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

interface PhaseFormProps {
  form: typeof EMPTY_FORM;
  setForm: (f: typeof EMPTY_FORM) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
  workers?: { id: string; name: string }[];
}

function PhaseForm({ form, setForm, onSubmit, onCancel, isPending, submitLabel, workers = [] }: PhaseFormProps) {
  const set = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value });
  const setVal = (field: keyof typeof EMPTY_FORM) => (v: string) =>
    setForm({ ...form, [field]: v });

  return (
    <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Phase Code *</Label>
          <Input
            placeholder="P01"
            value={form.phaseCode}
            onChange={set("phaseCode")}
            className="h-8 text-sm"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Phase Name *</Label>
          <Input
            placeholder="Site Preparation"
            value={form.name}
            onChange={set("name")}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
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
          <Input
            placeholder="40"
            type="number"
            step="0.5"
            min="0"
            value={form.bookedHours}
            onChange={set("bookedHours")}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
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
          <Input
            placeholder="Brief description"
            value={form.description}
            onChange={set("description")}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Assignee picker — only shown when the job has assigned workers */}
      {workers.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">Assigned to</Label>
          <Select value={form.assignedUserId || "__none__"} onValueChange={(v) => setVal("assignedUserId")(v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="No assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No assignee</SelectItem>
              {workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Textarea
        placeholder="Notes (optional)"
        value={form.notes}
        onChange={set("notes")}
        className="text-sm resize-none"
        rows={2}
      />

      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!form.phaseCode.trim() || !form.name.trim() || isPending}
          onClick={onSubmit}
          style={{ backgroundColor: "hsl(var(--trade))", color: "white" }}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
          {submitLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default JobPhasesSection;
