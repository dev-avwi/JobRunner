/**
 * JobPhasesSection — inline phases timeline for the job detail page.
 * Phases give large jobs (construction, engineering) a way to break work
 * into coded billable milestones (e.g., P01 Site Prep, P02 Footings).
 */
import { useState, useMemo } from "react";
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import {
  Plus, ChevronUp, ChevronDown, Pencil, Trash2, Check, X, Loader2, Layers, Crown, Users, Clock,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export type PhaseStatus = "not_started" | "in_progress" | "complete" | "invoiced";

// ─── Claim types (minimal, for cross-referencing) ─────────────────────────────
type ClaimStatus = "draft" | "submitted" | "approved" | "paid";

interface ClaimHeader {
  id: string;
  status: ClaimStatus;
  claimNumber: string;
}

interface ClaimLineItem {
  phaseId: string | null;
}

interface ClaimDetail {
  claim: ClaimHeader;
  lineItems: ClaimLineItem[];
}

const CLAIM_BADGE: Record<ClaimStatus, { label: string; className: string }> = {
  draft:     { label: "Draft Claim",     className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
  submitted: { label: "Claim Submitted", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  approved:  { label: "Claim Approved",  className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  paid:      { label: "Paid",            className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
};

export interface PhaseAssignedUser {
  id: string;
  name: string;
  isLead: boolean;
}

export interface JobPhase {
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
  /** All assigned members (from job_phase_assignments + legacy lead) */
  assignedUsers?: PhaseAssignedUser[];
  assignedUserIds?: string[];
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
  budgetedHours: "",
  status: "not_started" as PhaseStatus,
  notes: "",
  assignedUserId: "",
  assignedUserIds: [] as string[],
};

/** Build 1–2 character initials from a full name */
function initials(name?: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

/** Deterministic colour based on user id / name for avatar */
const AVATAR_COLORS = [
  "#4f7ddb", "#e07b39", "#5ba85f", "#9b59b6",
  "#e74c3c", "#16a085", "#d35400", "#2c3e50",
];
function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ─── Stacked avatar display for phase members ─────────────────────────────────
interface PhaseAssigneeStackProps {
  members: PhaseAssignedUser[];
  /** When provided, clicking the stack opens the member picker */
  onManage?: () => void;
  isTradie?: boolean;
}

function PhaseAssigneeStack({ members, onManage, isTradie }: PhaseAssigneeStackProps) {
  if (members.length === 0) return null;
  const MAX_SHOWN = 3;
  const shown = members.slice(0, MAX_SHOWN);
  const overflow = members.length - MAX_SHOWN;

  const stack = (
    <button
      type="button"
      onClick={onManage}
      disabled={isTradie || !onManage}
      className={`flex items-center gap-1 ${!isTradie && onManage ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
      title={members.map((m) => `${m.name}${m.isLead ? " (Lead)" : ""}`).join(", ")}
    >
      <div className="flex -space-x-1.5">
        {shown.map((m) => (
          <span
            key={m.id}
            className="relative inline-flex items-center justify-center w-5 h-5 rounded-full text-[8px] font-bold text-white border border-background ring-0"
            style={{ backgroundColor: avatarColor(m.id) }}
          >
            {initials(m.name)}
            {m.isLead && (
              <Crown
                className="absolute -top-1 -right-1 h-2.5 w-2.5 text-amber-400 drop-shadow"
                fill="currentColor"
              />
            )}
          </span>
        ))}
        {overflow > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[8px] font-bold text-muted-foreground bg-muted border border-background">
            +{overflow}
          </span>
        )}
      </div>
    </button>
  );

  return stack;
}

// ─── Inline member picker popover ─────────────────────────────────────────────
interface PhaseMemberPickerProps {
  phase: JobPhase;
  workers: { id: string; name: string }[];
  onSave: (assignedUserIds: string[], leadId: string | null) => void;
  isPending?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function PhaseMemberPicker({ phase, workers, onSave, isPending, open, onOpenChange, children }: PhaseMemberPickerProps) {
  const currentMembers = phase.assignedUsers ?? (phase.assignedUserId ? [{ id: phase.assignedUserId, name: phase.assignedUserName ?? "", isLead: true }] : []);
  const [selected, setSelected] = useState<string[]>(currentMembers.map((m) => m.id));
  const [leadId, setLeadId] = useState<string>(phase.assignedUserId ?? currentMembers[0]?.id ?? "");

  // Reset when popover opens
  const handleOpenChange = (o: boolean) => {
    if (o) {
      const ids = currentMembers.map((m) => m.id);
      setSelected(ids);
      setLeadId(phase.assignedUserId ?? ids[0] ?? "");
    }
    onOpenChange(o);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // If we removed the current lead, pick another
      if (!next.includes(leadId) && next.length > 0) setLeadId(next[0]);
      if (next.length === 0) setLeadId("");
      return next;
    });
  };

  const handleSave = () => {
    // Validate: if phase had members and we're clearing all, require at least one
    const hadMembers = currentMembers.length > 0;
    if (hadMembers && selected.length === 0) return; // UI prevents this with disabled Save
    const effectiveLead = selected.includes(leadId) ? leadId : (selected[0] ?? null);
    onSave(selected, effectiveLead);
  };

  const hadMembers = currentMembers.length > 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-3" align="start">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Assign team members</span>
        </div>

        {workers.length === 0 ? (
          <p className="text-xs text-muted-foreground">No workers assigned to this job yet.</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {workers.map((w) => (
              <label key={w.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/50 rounded px-1">
                <Checkbox
                  checked={selected.includes(w.id)}
                  onCheckedChange={() => toggle(w.id)}
                  id={`member-${phase.id}-${w.id}`}
                />
                <span className="flex-1 text-xs">{w.name}</span>
                {selected.includes(w.id) && selected.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setLeadId(w.id); }}
                    title="Set as lead"
                    className="ml-auto"
                  >
                    <Crown
                      className={`h-3 w-3 ${leadId === w.id ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-300"}`}
                      fill={leadId === w.id ? "currentColor" : "none"}
                    />
                  </button>
                )}
                {selected.includes(w.id) && selected.length === 1 && (
                  <Crown className="h-3 w-3 text-amber-400 ml-auto" fill="currentColor" />
                )}
              </label>
            ))}
          </div>
        )}

        {selected.length > 1 && (
          <p className="text-[10px] text-muted-foreground">
            Click <Crown className="inline h-2.5 w-2.5 text-muted-foreground" /> to set lead
          </p>
        )}

        <div className="flex gap-2 pt-1 border-t">
          <Button
            size="sm"
            className="flex-1 h-7 text-xs"
            disabled={isPending || (hadMembers && selected.length === 0)}
            onClick={handleSave}
            style={{ backgroundColor: "hsl(var(--trade))", color: "white" }}
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  jobId: string;
  isTradie?: boolean;
  /** Called when user accepts the "create claim" prompt after marking a phase complete */
  onCreateClaimForPhase?: (phase: JobPhase) => void;
  /** Called when user clicks a phase row to open the detail panel */
  onOpenDetail?: (phase: JobPhase) => void;
}

export function JobPhasesSection({ jobId, isTradie = false, onCreateClaimForPhase, onOpenDetail }: Props) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  // Phase-complete → claim prompt state
  const [claimPromptPhase, setClaimPromptPhase] = useState<JobPhase | null>(null);
  // Inline member picker state: which phase's popover is open
  const [memberPickerPhaseId, setMemberPickerPhaseId] = useState<string | null>(null);
  // Inline "Add Time Entry" state
  const [addTimePhaseId, setAddTimePhaseId] = useState<string | null>(null);
  const [timeForm, setTimeForm] = useState({ date: new Date().toISOString().substring(0, 10), hours: "", description: "" });

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

  // Fetch claims list then detail for each, to build phaseId → claimStatus map
  const { data: claims = [] } = useQuery<ClaimHeader[]>({
    queryKey: [`/api/jobs/${jobId}/claims`],
    enabled: !!jobId,
  });

  const claimDetailQueries = useQueries({
    queries: claims.map((claim) => ({
      queryKey: [`/api/jobs/${jobId}/claims/${claim.id}`],
      enabled: !!jobId,
    })),
  });

  const claimedPhaseMap = useMemo(() => {
    const map = new Map<string, ClaimStatus>();
    for (const q of claimDetailQueries) {
      const detail = q.data as ClaimDetail | undefined;
      if (!detail?.lineItems) continue;
      for (const li of detail.lineItems) {
        if (li.phaseId && !map.has(li.phaseId)) {
          map.set(li.phaseId, detail.claim.status);
        }
      }
    }
    return map;
  }, [claimDetailQueries]);

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

  // Quick-assign from the avatar popover (no form open)
  const assignMembersMutation = useMutation({
    mutationFn: ({ phaseId, assignedUserIds, assignedUserId }: {
      phaseId: string;
      assignedUserIds: string[];
      assignedUserId: string | null;
    }) =>
      apiRequest("PATCH", `/api/jobs/${jobId}/phases/${phaseId}`, { assignedUserIds, assignedUserId }),
    onSuccess: () => {
      invalidate();
      setMemberPickerPhaseId(null);
      toast({ title: "Team updated" });
    },
    onError: (e: any) => toast({ title: "Failed to update team", description: e.message, variant: "destructive" }),
  });

  const addTimeMutation = useMutation({
    mutationFn: ({ phaseId, date, hours, description }: { phaseId: string; date: string; hours: number; description: string }) => {
      const startTime = new Date(`${date}T08:00:00`);
      const endTime = new Date(startTime.getTime() + hours * 3600 * 1000);
      return apiRequest("POST", "/api/time-entries", {
        jobId,
        phaseId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        description: description || undefined,
      });
    },
    onSuccess: () => {
      invalidate();
      setAddTimePhaseId(null);
      setTimeForm({ date: new Date().toISOString().substring(0, 10), hours: "", description: "" });
      toast({ title: "Time entry added" });
    },
    onError: (e: any) => toast({ title: "Failed to add time entry", description: e.message, variant: "destructive" }),
  });

  const handleMove = (idx: number, direction: "up" | "down") => {

    const ids = sorted.map((p) => p.id);
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= ids.length) return;
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    reorderMutation.mutate(ids);
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
              onClick={() => { setShowAddForm(!showAddForm); }}
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
            const phaseMembers: PhaseAssignedUser[] = phase.assignedUsers
              ?? (phase.assignedUserId
                ? [{ id: phase.assignedUserId, name: phase.assignedUserName ?? "", isLead: true }]
                : []);

            return (
              <div
                key={phase.id}
                className="flex items-start gap-2 p-3 rounded-lg border bg-background hover:bg-muted/20 transition-colors"
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

                {/* Clickable summary area — opens the detail panel */}
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => onOpenDetail?.(phase)}
                >
                  {/* Phase code + name + badges row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="shrink-0 text-xs font-mono font-semibold px-1.5 py-0.5 rounded border"
                      style={{ borderColor: "hsl(var(--trade) / 0.4)", color: "hsl(var(--trade))" }}
                    >
                      {phase.phaseCode}
                    </span>
                    <span className="text-sm font-medium">{phase.name}</span>

                    {/* Claimed badge */}
                    {claimedPhaseMap.has(phase.id) && (() => {
                      const claimStatus = claimedPhaseMap.get(phase.id)!;
                      const badge = CLAIM_BADGE[claimStatus];
                      return (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      );
                    })()}

                    {/* Status badge (read-only in row — selector moved to actions) */}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.className}`}>
                      {cfg.label}
                    </span>

                    {/* Assignee avatar stack */}
                    {phaseMembers.length > 0 && (
                      <PhaseAssigneeStack members={phaseMembers} isTradie={true} />
                    )}
                  </div>

                  {/* Date + hours meta row */}
                  {(phase.scheduledStart || phase.scheduledEnd || phase.bookedHours || phase.budgetedHours) && (
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {(phase.scheduledStart || phase.scheduledEnd) && (
                        <span>
                          {fmtDate(phase.scheduledStart) ?? "?"}
                          {" → "}
                          {fmtDate(phase.scheduledEnd) ?? "?"}
                        </span>
                      )}
                      {(() => {
                        const budgeted = phase.budgetedHours ? parseFloat(phase.budgetedHours) : 0;
                        const actual = phase.actualHours ?? 0;
                        if (budgeted > 0) {
                          const pct = actual / budgeted;
                          const color = pct >= 1 ? "text-red-600 dark:text-red-400" : pct >= 0.8 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400";
                          return (
                            <span className="flex items-center gap-1">
                              <span className={color}>{actual.toFixed(1)} / {budgeted.toFixed(1)} hrs</span>
                              <span className={`text-[10px] font-medium ${color}`}>({Math.round(pct * 100)}%)</span>
                            </span>
                          );
                        }
                        if (phase.bookedHours && parseFloat(phase.bookedHours) > 0) {
                          return <span>{parseFloat(phase.bookedHours).toFixed(1)} hrs booked</span>;
                        }
                        return null;
                      })()}
                      {/* Add Time Entry inline action */}
                      <button
                        type="button"
                        onClick={() => {
                          setAddTimePhaseId(addTimePhaseId === phase.id ? null : phase.id);
                          setTimeForm({ date: new Date().toISOString().substring(0, 10), hours: "", description: "" });
                        }}
                        className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground ml-auto"
                        title="Add time entry to this phase"
                      >
                        <Clock className="h-3 w-3" />
                        <span>Add Time Entry</span>
                      </button>
                    </div>
                  )}

                  {/* Inline time entry form */}
                  {addTimePhaseId === phase.id && (
                    <div className="mt-2 p-2.5 rounded-md border bg-muted/30 space-y-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Log time for {phase.phaseCode} {phase.name}</p>
                      <div className="flex gap-2">
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] text-muted-foreground">Date</label>
                          <input
                            type="date"
                            value={timeForm.date}
                            onChange={(e) => setTimeForm((f) => ({ ...f, date: e.target.value }))}
                            className="w-full h-7 rounded border border-input bg-background px-2 text-xs"
                          />
                        </div>
                        <div className="w-20 space-y-1">
                          <label className="text-[10px] text-muted-foreground">Hours *</label>
                          <input
                            type="number"
                            min="0.25"
                            step="0.25"
                            placeholder="0.0"
                            value={timeForm.hours}
                            onChange={(e) => setTimeForm((f) => ({ ...f, hours: e.target.value }))}
                            className="w-full h-7 rounded border border-input bg-background px-2 text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">Description (optional)</label>
                        <input
                          type="text"
                          placeholder="What was done?"
                          value={timeForm.description}
                          onChange={(e) => setTimeForm((f) => ({ ...f, description: e.target.value }))}
                          className="w-full h-7 rounded border border-input bg-background px-2 text-xs"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          style={{ backgroundColor: "hsl(var(--trade))", color: "white" }}
                          disabled={!timeForm.hours || parseFloat(timeForm.hours) <= 0 || addTimeMutation.isPending}
                          onClick={() =>
                            addTimeMutation.mutate({
                              phaseId: phase.id,
                              date: timeForm.date,
                              hours: parseFloat(timeForm.hours),
                              description: timeForm.description,
                            })
                          }
                        >
                          {addTimeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setAddTimePhaseId(null)}
                          disabled={addTimeMutation.isPending}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {phase.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{phase.description}</p>
                  )}
                </button>

                {/* Row actions: status selector + delete (edit is now in the panel) */}
                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  {!isTradie && (
                    <Select
                      value={phase.status}
                      onValueChange={(v) =>
                        statusChangeMutation.mutate({ phaseId: phase.id, status: v as PhaseStatus })
                      }
                      disabled={statusChangeMutation.isPending}
                    >
                      <SelectTrigger className={`h-5 text-[10px] px-1.5 py-0.5 w-auto border-0 ${cfg.className}`} onClick={(e) => e.stopPropagation()}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                          <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!isTradie && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
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
                  )}
                </div>
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
  existingMembers?: PhaseAssignedUser[];
}

function PhaseForm({ form, setForm, onSubmit, onCancel, isPending, submitLabel, workers = [], existingMembers = [] }: PhaseFormProps) {
  const set = (field: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value });
  const setVal = (field: keyof typeof EMPTY_FORM) => (v: string) =>
    setForm({ ...form, [field]: v });

  // Multi-member selection helpers
  const selectedIds: string[] = form.assignedUserIds ?? [];
  const leadId = form.assignedUserId ?? selectedIds[0] ?? "";

  const toggleMember = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    // If removing the lead, promote another
    let newLead = leadId;
    if (!next.includes(newLead)) newLead = next[0] ?? "";
    setForm({ ...form, assignedUserIds: next, assignedUserId: newLead });
  };

  const setLead = (id: string) => {
    setForm({ ...form, assignedUserId: id });
  };

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

      <div className="grid grid-cols-4 gap-2">
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
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <span>Budgeted Hours</span>
          </Label>
          <Input
            placeholder="40"
            type="number"
            step="0.5"
            min="0"
            value={form.budgetedHours}
            onChange={set("budgetedHours")}
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

      {/* Multi-member picker — only shown when the job has assigned workers */}
      {workers.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            <Users className="h-3 w-3" />
            Team members
            {selectedIds.length > 0 && (
              <span className="text-muted-foreground font-normal">
                ({selectedIds.length} selected)
              </span>
            )}
          </Label>
          <div className="border rounded-md divide-y max-h-36 overflow-y-auto bg-background">
            {workers.map((w) => {
              const isSelected = selectedIds.includes(w.id);
              const isLead = leadId === w.id && isSelected;
              return (
                <label
                  key={w.id}
                  className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleMember(w.id)}
                    id={`form-member-${w.id}`}
                  />
                  <span className="flex-1 text-xs">{w.name}</span>
                  {isSelected && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); if (selectedIds.length > 1) setLead(w.id); }}
                      title={isLead ? "Lead member" : "Set as lead"}
                      className="ml-auto"
                      disabled={selectedIds.length <= 1}
                    >
                      <Crown
                        className={`h-3 w-3 ${isLead ? "text-amber-400" : "text-muted-foreground/30 hover:text-amber-300"}`}
                        fill={isLead ? "currentColor" : "none"}
                      />
                    </button>
                  )}
                </label>
              );
            })}
          </div>
          {selectedIds.length > 1 && (
            <p className="text-[10px] text-muted-foreground">
              Click <Crown className="inline h-2.5 w-2.5 text-muted-foreground" /> on a selected member to set them as lead
            </p>
          )}
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
