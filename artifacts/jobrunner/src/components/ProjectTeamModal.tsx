/**
 * ProjectTeamModal — unified "Manage Team" modal for project jobs.
 *
 * Two-column layout:
 *   Left  — job-level workers: add/remove workers from the job assignment list,
 *            with availability indicators.
 *   Right — phase matrix: each phase is a row, each assigned job worker is a
 *            column; checkboxes indicate phase membership. Assigning a worker
 *            to a phase auto-adds them to the job.
 *
 * Removing a worker from all phases prompts to also remove them from the job.
 */
import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Users, Crown, Loader2, Check, ChevronsUpDown, X, CheckSquare, Square,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PhaseAssignedUser } from "./JobPhasesSection";

/**
 * Minimal phase shape required by ProjectTeamModal. Intentionally narrower than
 * the full JobPhase so callers can pass jobPhasesForPicker without a cast.
 */
export interface PhaseForTeamModal {
  id: string;
  phaseCode: string;
  name: string;
  sortOrder?: number;
  assignedUsers?: PhaseAssignedUser[];
  assignedUserId?: string | null;
  assignedUserName?: string | null;
}

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

// ─── Types ────────────────────────────────────────────────────────────────────
interface TeamMember {
  memberId: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  roleName?: string | null;
  isActive?: boolean;
}

interface JobAssignment {
  id: string;
  userId: string;
  isPrimary?: boolean;
  isActive?: boolean;
  workerDisplayNameSnapshot?: string | null;
  displayName?: string | null;
}

export interface ProjectTeamModalProps {
  jobId: string;
  phases: PhaseForTeamModal[];
  teamMembers: TeamMember[];
  activeAssignments: JobAssignment[];
  isWorkerOnOtherJob: (memberId: string) => boolean;
  getWorkerDisplayName: (member: TeamMember) => string;
  onClose: () => void;
  onRefresh: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ProjectTeamModal({
  jobId,
  phases,
  teamMembers,
  activeAssignments,
  isWorkerOnOtherJob,
  getWorkerDisplayName,
  onClose,
  onRefresh,
}: ProjectTeamModalProps) {
  const { toast } = useToast();
  const [workerPickerOpen, setWorkerPickerOpen] = useState(false);
  const [removeJobConfirm, setRemoveJobConfirm] = useState<{ workerId: string; name: string } | null>(null);

  const assignedUserIds = useMemo(
    () => new Set(activeAssignments.filter((a) => a.isActive !== false).map((a) => a.userId)),
    [activeAssignments],
  );

  const sorted = [...phases].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // Current phase membership per worker
  const phaseAssignedIds = useMemo(() => {
    const map = new Map<string, Set<string>>(); // phaseId → Set<workerId>
    for (const phase of phases) {
      const members: PhaseAssignedUser[] = phase.assignedUsers
        ?? (phase.assignedUserId ? [{ id: phase.assignedUserId, name: phase.assignedUserName ?? "", isLead: true }] : []);
      map.set(phase.id, new Set(members.map((m) => m.id)));
    }
    return map;
  }, [phases]);

  // ── Job-level assignment mutations ──────────────────────────────────────────
  const addWorkerMutation = useMutation({
    mutationFn: (userIds: string[]) =>
      apiRequest("POST", `/api/jobs/${jobId}/assignments`, { userIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/assignments`] });
      onRefresh();
      toast({ title: "Worker added to job" });
    },
    onError: (e: any) => toast({ title: "Failed to add worker", description: e.message, variant: "destructive" }),
  });

  const removeWorkerMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest("DELETE", `/api/jobs/${jobId}/assignments/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/assignments`] });
      onRefresh();
      toast({ title: "Worker removed from job" });
    },
    onError: (e: any) => toast({ title: "Failed to remove worker", description: e.message, variant: "destructive" }),
  });

  // ── Phase assignment mutation ────────────────────────────────────────────────
  const phaseAssignMutation = useMutation({
    mutationFn: ({ phaseId, assignedUserIds, assignedUserId }: {
      phaseId: string;
      assignedUserIds: string[];
      assignedUserId: string | null;
    }) =>
      apiRequest("PATCH", `/api/jobs/${jobId}/phases/${phaseId}`, { assignedUserIds, assignedUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/phases`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/assignments`] });
      onRefresh();
    },
    onError: (e: any) => toast({ title: "Phase assignment failed", description: e.message, variant: "destructive" }),
  });

  const busy = addWorkerMutation.isPending || removeWorkerMutation.isPending || phaseAssignMutation.isPending;

  const handleTogglePhaseWorker = async (phase: PhaseForTeamModal, workerId: string) => {
    const currentSet = phaseAssignedIds.get(phase.id) ?? new Set<string>();
    const isOnPhase = currentSet.has(workerId);
    const next = new Set(currentSet);
    if (isOnPhase) {
      next.delete(workerId);
    } else {
      next.add(workerId);
      // Auto-add to job if not already assigned
      if (!assignedUserIds.has(workerId)) {
        await addWorkerMutation.mutateAsync([workerId]);
      }
    }

    const ids = [...next];
    // Determine lead: keep existing lead if still in set, else pick first
    const currentMembers: PhaseAssignedUser[] = phase.assignedUsers
      ?? (phase.assignedUserId ? [{ id: phase.assignedUserId, name: "", isLead: true }] : []);
    const currentLead = currentMembers.find((m) => m.isLead)?.id ?? currentMembers[0]?.id ?? null;
    const newLead = ids.includes(currentLead ?? "") ? currentLead : (ids[0] ?? null);

    phaseAssignMutation.mutate({ phaseId: phase.id, assignedUserIds: ids, assignedUserId: newLead });
  };

  const handleRemoveWorkerFromJob = (assignment: JobAssignment) => {
    const name = assignment.workerDisplayNameSnapshot || assignment.displayName || "Worker";
    // Check if worker is on any phases
    const onAnyPhase = sorted.some((p) => phaseAssignedIds.get(p.id)?.has(assignment.userId));
    if (onAnyPhase) {
      setRemoveJobConfirm({ workerId: assignment.userId, name });
    } else {
      removeWorkerMutation.mutate(assignment.userId);
    }
  };

  const confirmRemoveWithPhases = async () => {
    if (!removeJobConfirm) return;
    const { workerId } = removeJobConfirm;
    // Remove from all phases first
    for (const phase of sorted) {
      const currentSet = phaseAssignedIds.get(phase.id) ?? new Set<string>();
      if (currentSet.has(workerId)) {
        const ids = [...currentSet].filter((id) => id !== workerId);
        const members: PhaseAssignedUser[] = phase.assignedUsers
          ?? (phase.assignedUserId ? [{ id: phase.assignedUserId, name: "", isLead: true }] : []);
        const lead = members.find((m) => m.isLead && m.id !== workerId)?.id ?? ids[0] ?? null;
        await phaseAssignMutation.mutateAsync({ phaseId: phase.id, assignedUserIds: ids, assignedUserId: lead });
      }
    }
    removeWorkerMutation.mutate(workerId);
    setRemoveJobConfirm(null);
  };

  const eligibleWorkers = teamMembers.filter(
    (m) => m.isActive && m.roleName?.toLowerCase() !== "administrator" && m.memberId,
  );

  const activeAssignmentsList = activeAssignments.filter((a) => a.isActive !== false);

  return (
    <>
      <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="px-5 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" style={{ color: "hsl(var(--trade))" }} />
              Manage Team
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-1 min-h-0 divide-x">
            {/* ── Left column: Job workers ──────────────────────────── */}
            <div className="w-64 shrink-0 flex flex-col">
              <div className="px-4 py-2.5 bg-muted/40 border-b">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job Workers</p>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {/* Add worker popover */}
                  <Popover open={workerPickerOpen} onOpenChange={setWorkerPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start gap-1" disabled={busy}>
                        <ChevronsUpDown className="h-3 w-3" />
                        Add worker
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search..." />
                        <CommandEmpty>No worker found.</CommandEmpty>
                        <CommandList>
                          <CommandGroup>
                            {eligibleWorkers.map((member) => {
                              const onOtherJob = isWorkerOnOtherJob(member.memberId!);
                              const assigned = assignedUserIds.has(member.memberId!);
                              return (
                                <CommandItem
                                  key={member.memberId}
                                  value={`${getWorkerDisplayName(member)} ${member.roleName}`}
                                  onSelect={() => {
                                    if (busy || !member.memberId) return;
                                    if (!assigned) addWorkerMutation.mutate([member.memberId]);
                                    setWorkerPickerOpen(false);
                                  }}
                                  disabled={assigned}
                                >
                                  <Check className={`mr-2 h-3.5 w-3.5 ${assigned ? "opacity-100" : "opacity-0"}`} />
                                  <span className="flex-1 text-xs">{getWorkerDisplayName(member)}</span>
                                  {onOtherJob && !assigned && (
                                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 ml-1">On job</Badge>
                                  )}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {activeAssignmentsList.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No workers assigned yet.</p>
                  )}

                  {activeAssignmentsList.map((assignment) => {
                    const member = teamMembers.find((m) => m.memberId === assignment.userId);
                    const name = assignment.workerDisplayNameSnapshot
                      || (member ? getWorkerDisplayName(member) : assignment.displayName || "Worker");
                    const phasesOnCount = sorted.filter((p) => phaseAssignedIds.get(p.id)?.has(assignment.userId)).length;
                    return (
                      <div key={assignment.id} className="flex items-center gap-2 p-2 rounded-md border bg-background">
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold text-white shrink-0"
                          style={{ backgroundColor: avatarColor(assignment.userId) }}
                        >
                          {initials(name)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{name}</p>
                          {assignment.isPrimary && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Crown className="h-2.5 w-2.5 text-amber-400" fill="currentColor" />
                              Lead
                            </p>
                          )}
                          {phasesOnCount > 0 && (
                            <p className="text-[10px] text-muted-foreground">{phasesOnCount} phase{phasesOnCount !== 1 ? "s" : ""}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveWorkerFromJob(assignment)}
                          disabled={busy}
                          className="text-muted-foreground hover:text-destructive p-0.5 shrink-0"
                          title="Remove from job"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* ── Right column: Phase matrix ────────────────────────── */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="px-4 py-2.5 bg-muted/40 border-b">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phase Assignment</p>
              </div>
              <ScrollArea className="flex-1">
                {sorted.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
                    No phases on this project.
                  </div>
                ) : activeAssignmentsList.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
                    Add workers on the left to assign them to phases.
                  </div>
                ) : (
                  <div className="p-3">
                    {/* Matrix header: worker names */}
                    <div className="flex gap-2 mb-2 pl-[140px]">
                      {activeAssignmentsList.map((assignment) => {
                        const member = teamMembers.find((m) => m.memberId === assignment.userId);
                        const name = assignment.workerDisplayNameSnapshot
                          || (member ? getWorkerDisplayName(member) : "Worker");
                        return (
                          <div
                            key={assignment.id}
                            className="w-10 flex items-end justify-center"
                            title={name}
                          >
                            <span
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[9px] font-bold text-white shrink-0"
                              style={{ backgroundColor: avatarColor(assignment.userId) }}
                            >
                              {initials(name)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Phase rows */}
                    <div className="space-y-1">
                      {sorted.map((phase) => {
                        const phaseSet = phaseAssignedIds.get(phase.id) ?? new Set<string>();
                        return (
                          <div
                            key={phase.id}
                            className="flex items-center gap-2 py-2 px-2 rounded-md hover:bg-muted/30 border border-transparent hover:border-border"
                          >
                            {/* Phase label */}
                            <div className="w-[140px] shrink-0 flex items-center gap-1.5 min-w-0">
                              <span
                                className="text-[10px] font-mono font-semibold px-1 py-0.5 rounded border shrink-0"
                                style={{ borderColor: "hsl(var(--trade) / 0.4)", color: "hsl(var(--trade))" }}
                              >
                                {phase.phaseCode}
                              </span>
                              <span className="text-xs truncate">{phase.name}</span>
                            </div>

                            {/* Worker checkboxes */}
                            {activeAssignmentsList.map((assignment) => {
                              const isAssigned = phaseSet.has(assignment.userId);
                              return (
                                <div key={assignment.id} className="w-10 flex items-center justify-center">
                                  <Checkbox
                                    checked={isAssigned}
                                    disabled={busy}
                                    onCheckedChange={() => handleTogglePhaseWorker(phase, assignment.userId)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-[10px] text-muted-foreground mt-3">
                      Checking a phase checkbox adds the worker to that phase. Assigning to a phase also adds them to the job if not already assigned.
                    </p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t shrink-0 flex justify-end">
            <Button size="sm" onClick={onClose}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove from job confirmation when worker is on phases */}
      <AlertDialog open={!!removeJobConfirm} onOpenChange={(o) => { if (!o) setRemoveJobConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeJobConfirm?.name} from job?</AlertDialogTitle>
            <AlertDialogDescription>
              This worker is assigned to one or more phases. Removing them from the job will also remove them from all phases on this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRemoveJobConfirm(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveWithPhases} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove from job and phases
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
