import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageShell } from "@/components/ui/page-shell";
import { UserAvatar } from "@/components/UserAvatar";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Briefcase,
  Plus,
  Search,
  Wrench,
  Package,
  Check,
  ChevronDown,
  PanelRightClose,
  PanelRightOpen,
  Truck,
  HardHat,
  AlertCircle,
  Filter,
  LayoutGrid,
  CalendarDays,
  Columns3,
  Loader2,
  X,
} from "lucide-react";
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  isSameDay,
  parseISO,
  differenceInMinutes,
  isToday,
  startOfDay,
} from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DispatchJob {
  id: string;
  title: string;
  status: string;
  workerStatus?: string;
  scheduledAt?: string;
  scheduledTime?: string;
  estimatedDuration?: number;
  address?: string;
  clientId: string;
  priority?: string;
  jobType?: string;
  notes?: string;
  /** Legacy direct-assignment field; updated by PATCH and used as primary assignee key */
  assignedTo?: string | null;
  client?: { id: string; name: string; phone?: string } | null;
  assignments?: DispatchAssignment[];
}

interface DispatchAssignment {
  id: string;
  assignmentStatus: string;
  memberId?: string;
  memberFirstName?: string;
  memberLastName?: string;
  memberEmail?: string;
  isActive: boolean;
}

interface TeamMember {
  id: string;
  memberId: string;
  firstName?: string;
  lastName?: string;
  email: string;
  roleName: string;
  profileImageUrl?: string;
  isActive: boolean;
  themeColor?: string;
}

/** Shape returned by /api/dispatch/resources deployedEquipment array */
interface DeployedEquipmentItem {
  assignmentId: string;
  equipmentId: string;
  equipmentName: string;
  category?: string;
  categoryId?: string | null;
  serialNumber?: string;
  jobId?: string;
  jobTitle?: string;
  jobStatus?: string;
  notes?: string;
  assignedToName?: string | null;
}

/** Shape returned by /api/dispatch/resources allEquipment array */
interface Equipment {
  id: string;
  name: string;
  description?: string;
  model?: string;
  serialNumber?: string;
  categoryId?: string | null;
  categoryName?: string;
  status?: string;
  location?: string;
  assignedTo?: string | null;
  assignedToName?: string | null;
  isDeployed?: boolean;
  deployedJobTitle?: string | null;
  deployedJobId?: string | null;
  deployedJobStatus?: string | null;
}

interface MaterialItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  status?: string;
  supplier?: string;
  jobId?: string;
  jobTitle?: string;
}

interface DispatchResources {
  deployedEquipment: DeployedEquipmentItem[];
  allEquipment: Equipment[];
  categories: { id: string; name: string }[];
  materialsNeeded: MaterialItem[];
  totalEquipment: number;
  availableEquipment: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TIMELINE_START = 6;   // 6 AM
const TIMELINE_END = 20;    // 8 PM
const HOUR_HEIGHT = 72;     // px per hour

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; solid: string }> = {
  pending:     { bg: "bg-amber-100 dark:bg-amber-900/30",  border: "border-amber-400", text: "text-amber-700 dark:text-amber-300",  solid: "#f59e0b" },
  scheduled:   { bg: "bg-blue-100 dark:bg-blue-900/30",    border: "border-blue-400",  text: "text-blue-700 dark:text-blue-300",    solid: "#3b82f6" },
  in_progress: { bg: "bg-orange-100 dark:bg-orange-900/30",border: "border-orange-400",text: "text-orange-700 dark:text-orange-300",solid: "#f97316" },
  done:        { bg: "bg-green-100 dark:bg-green-900/30",  border: "border-green-400", text: "text-green-700 dark:text-green-300",  solid: "#22c55e" },
  invoiced:    { bg: "bg-purple-100 dark:bg-purple-900/30",border: "border-purple-400",text: "text-purple-700 dark:text-purple-300",solid: "#a855f7" },
  cancelled:   { bg: "bg-slate-100 dark:bg-slate-800/50",  border: "border-slate-300", text: "text-slate-500",                      solid: "#94a3b8" },
};

function getStatusColor(status: string) {
  return STATUS_COLORS[status?.toLowerCase().replace(" ", "_")] ?? STATUS_COLORS.pending;
}

const KANBAN_COLUMNS = [
  { key: "assigned",    label: "Assigned",    headerColor: "border-t-blue-500",   bg: "bg-blue-50 dark:bg-blue-950/20" },
  { key: "en_route",   label: "En Route",    headerColor: "border-t-amber-500",  bg: "bg-amber-50 dark:bg-amber-950/20" },
  { key: "arrived",    label: "Arrived",     headerColor: "border-t-violet-500", bg: "bg-violet-50 dark:bg-violet-950/20" },
  { key: "in_progress",label: "In Progress", headerColor: "border-t-orange-500", bg: "bg-orange-50 dark:bg-orange-950/20" },
  { key: "completed",  label: "Completed",   headerColor: "border-t-green-500",  bg: "bg-green-50 dark:bg-green-950/20" },
] as const;

const TERMINAL_STATUSES = ["done", "completed", "invoiced", "cancelled"];

// ─── Utility helpers ─────────────────────────────────────────────────────────

function parseJobTime(scheduledTime?: string | null, scheduledAt?: string | null): { hour: number; minute: number } {
  if (scheduledTime) {
    const [h, m] = scheduledTime.split(":").map(Number);
    if (!isNaN(h)) return { hour: h, minute: isNaN(m) ? 0 : m };
  }
  if (scheduledAt) {
    try {
      const d = parseISO(scheduledAt);
      if (!isNaN(d.getTime())) return { hour: d.getHours(), minute: d.getMinutes() };
    } catch {
      const d = new Date(scheduledAt);
      if (!isNaN(d.getTime())) return { hour: d.getHours(), minute: d.getMinutes() };
    }
  }
  return { hour: 9, minute: 0 };
}

function formatHourLabel(hour: number) {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h} ${ampm}`;
}

function formatJobTime(scheduledTime?: string | null, scheduledAt?: string | null) {
  const { hour, minute } = parseJobTime(scheduledTime, scheduledAt);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h}:${minute.toString().padStart(2, "0")} ${ampm}`;
}

function memberName(m: TeamMember) {
  return [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email;
}

function memberInitials(m: TeamMember) {
  const f = m.firstName?.[0] ?? "";
  const l = m.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || m.email.slice(0, 2).toUpperCase();
}

function jobOnDate(job: DispatchJob, date: Date): boolean {
  if (!job.scheduledAt) return false;
  try {
    return isSameDay(parseISO(job.scheduledAt), date);
  } catch {
    return isSameDay(new Date(job.scheduledAt), date);
  }
}

function getKanbanColumn(job: DispatchJob): string {
  const status = job.status?.toLowerCase() ?? "";
  const workerStatus = job.workerStatus?.toLowerCase() ?? "";
  const assignments = job.assignments ?? [];

  if (TERMINAL_STATUSES.includes(status)) return "completed";
  if (assignments.some(a => a.assignmentStatus === "done")) return "completed";
  if (assignments.some(a => a.assignmentStatus === "working")) return "in_progress";
  if (workerStatus === "on_my_way") return "en_route";
  if (workerStatus === "arrived") return "arrived";
  if (assignments.some(a => a.assignmentStatus === "arrived")) return "arrived";
  if (assignments.some(a => a.assignmentStatus === "en_route")) return "en_route";
  if (assignments.some(a => ["assigned", "accepted", "invited"].includes(a.assignmentStatus))) return "assigned";
  if (workerStatus === "completed") return "completed";
  if (workerStatus === "in_progress") return "in_progress";
  if (status === "in_progress") return "in_progress";
  if (["pending", "scheduled"].includes(status)) return "assigned";
  return "assigned";
}

function primaryAssignment(job: DispatchJob): DispatchAssignment | undefined {
  return job.assignments?.find(a => a.isActive) ?? job.assignments?.[0];
}

// ─── Day View ────────────────────────────────────────────────────────────────

function DayView({
  date,
  jobs,
  workers,
  resources,
  selectedWorkerIds,
  onJobClick,
  onCreateJob,
  onReschedule,
  showMaterials,
}: {
  date: Date;
  jobs: DispatchJob[];
  workers: TeamMember[];
  resources?: DispatchResources;
  selectedWorkerIds: string[];
  onJobClick: (id: string) => void;
  onCreateJob: (memberId?: string, hour?: number) => void;
  onReschedule: (jobId: string, memberId: string, hour: number, minute: number) => void;
  showMaterials: boolean;
}) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const [dragOverCell, setDragOverCell] = useState<{ memberId: string; hour: number } | null>(null);
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);

  const todayJobs = useMemo(() => jobs.filter(j => jobOnDate(j, date)), [jobs, date]);

  const filteredWorkers = useMemo(() => {
    if (selectedWorkerIds.length === 0) return workers;
    return workers.filter(w => selectedWorkerIds.includes(w.memberId || w.id));
  }, [workers, selectedWorkerIds]);

  const hours = Array.from({ length: TIMELINE_END - TIMELINE_START }, (_, i) => TIMELINE_START + i);
  const totalHeight = hours.length * HOUR_HEIGHT;

  const showNowLine = isToday(date) && now.getHours() >= TIMELINE_START && now.getHours() < TIMELINE_END;
  const nowTop = (now.getHours() - TIMELINE_START) * HOUR_HEIGHT + (now.getMinutes() / 60) * HOUR_HEIGHT;

  // Group jobs by assigned member.
  // Use job.assignedTo (updated immediately by the reschedule PATCH) as the
  // primary key so drag-and-drop shows the move before the next API refetch.
  // Fall back to the assignment-record memberId for jobs assigned via the
  // team-assignment flow rather than the direct assignedTo field.
  const jobsByMember = useMemo(() => {
    const map = new Map<string, DispatchJob[]>();
    filteredWorkers.forEach(w => map.set(w.memberId || w.id, []));
    map.set("unassigned", []);
    todayJobs.forEach(job => {
      const wid = job.assignedTo ?? primaryAssignment(job)?.memberId;
      if (wid && map.has(wid)) {
        // Job belongs to a visible worker column
        map.get(wid)!.push(job);
      } else if (!wid) {
        // Genuinely unassigned — no worker at all; show in the unassigned column
        map.get("unassigned")!.push(job);
      }
      // Jobs assigned to excluded workers are intentionally omitted so the
      // "Unassigned" column only ever shows truly unassigned work.
    });
    return map;
  }, [todayJobs, filteredWorkers]);

  const handleDrop = useCallback((memberId: string, hour: number, e: React.DragEvent) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("jobId");
    const offsetY = e.dataTransfer.getData("offsetY");
    const minuteOffset = Math.round((parseInt(offsetY || "0") / HOUR_HEIGHT) * 60);
    const minute = Math.round(minuteOffset / 30) * 30;
    if (jobId) onReschedule(jobId, memberId, hour, Math.min(minute, 30));
    setDragOverCell(null);
    setDraggingJobId(null);
  }, [onReschedule]);

  const materialsNeeded = resources?.materialsNeeded ?? [];
  const [checkedMaterials, setCheckedMaterials] = useState<Set<string>>(new Set());

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Timeline grid */}
      <div className="flex flex-1 overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="flex min-w-[700px]">
            {/* Hour gutter */}
            <div className="w-16 flex-shrink-0 relative" style={{ height: totalHeight + 24 }}>
              <div className="h-6" /> {/* header spacer */}
              {hours.map(h => (
                <div key={h} className="absolute left-0 right-0 flex items-center justify-end pr-2 pointer-events-none"
                  style={{ top: (h - TIMELINE_START) * HOUR_HEIGHT + 24, height: HOUR_HEIGHT }}>
                  <span className="text-[11px] text-muted-foreground/70 -translate-y-1/2">{formatHourLabel(h)}</span>
                </div>
              ))}
            </div>

            {/* Worker columns */}
            <div className="flex flex-1 border-l">
              {filteredWorkers.map(worker => {
                const wid = worker.memberId || worker.id;
                const workerJobs = jobsByMember.get(wid) ?? [];
                return (
                  <div key={wid} className="flex-1 min-w-[140px] border-r last:border-r-0">
                    {/* Worker header */}
                    <div className="h-6 flex items-center gap-1.5 px-2 border-b bg-muted/30 sticky top-0 z-10">
                      <UserAvatar
                        user={{ id: wid, firstName: worker.firstName, lastName: worker.lastName, photoUrl: worker.profileImageUrl, themeColor: worker.themeColor }}
                        className="h-4 w-4 text-[8px]"
                      />
                      <span className="text-[11px] font-medium truncate">{memberName(worker)}</span>
                    </div>

                    {/* Hour cells + job blocks */}
                    <div className="relative" style={{ height: totalHeight }}>
                      {/* Hour grid lines */}
                      {hours.map(h => (
                        <div key={h}
                          className={`absolute left-0 right-0 border-t transition-colors cursor-pointer group ${
                            dragOverCell?.memberId === wid && dragOverCell?.hour === h
                              ? "bg-primary/10 border-t-primary"
                              : "border-border/30 hover:bg-muted/20"
                          }`}
                          style={{ top: (h - TIMELINE_START) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                          onDragOver={e => { e.preventDefault(); setDragOverCell({ memberId: wid, hour: h }); }}
                          onDragLeave={() => setDragOverCell(null)}
                          onDrop={e => handleDrop(wid, h, e)}
                          onClick={() => onCreateJob(wid, h)}
                        >
                          {/* Half-hour marker */}
                          <div className="absolute left-0 right-0 border-t border-dashed border-border/20" style={{ top: HOUR_HEIGHT / 2 }} />
                          {/* + hint on hover */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="h-3 w-3 text-muted-foreground/40" />
                          </div>
                        </div>
                      ))}

                      {/* Now line */}
                      {showNowLine && (
                        <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                          style={{ top: nowTop }}>
                          <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 -translate-y-1/2" />
                          <div className="flex-1 border-t-2 border-red-500" />
                        </div>
                      )}

                      {/* Job blocks */}
                      {workerJobs.map(job => {
                        const { hour, minute } = parseJobTime(job.scheduledTime, job.scheduledAt);
                        if (hour < TIMELINE_START || hour >= TIMELINE_END) return null;
                        const top = (hour - TIMELINE_START) * HOUR_HEIGHT + (minute / 60) * HOUR_HEIGHT;
                        const durationHrs = (job.estimatedDuration ?? 60) / 60;
                        const height = Math.max(durationHrs * HOUR_HEIGHT - 4, 36);
                        const sc = getStatusColor(job.status);
                        const isBeingDragged = draggingJobId === job.id;

                        return (
                          <div
                            key={job.id}
                            draggable
                            onDragStart={e => {
                              e.dataTransfer.setData("jobId", job.id);
                              const rect = (e.target as HTMLElement).getBoundingClientRect();
                              e.dataTransfer.setData("offsetY", String(e.clientY - rect.top));
                              setDraggingJobId(job.id);
                            }}
                            onDragEnd={() => setDraggingJobId(null)}
                            onClick={e => { e.stopPropagation(); onJobClick(job.id); }}
                            className={`absolute left-1 right-1 rounded px-1.5 py-1 cursor-pointer border-l-[3px] transition-all
                              ${sc.bg} ${sc.border} hover:brightness-95 active:scale-[0.98]
                              ${isBeingDragged ? "opacity-40" : "opacity-100"}`}
                            style={{ top: top + 2, height }}
                          >
                            <p className="text-[11px] font-semibold truncate">{job.title}</p>
                            {height > 40 && (
                              <p className={`text-[10px] truncate ${sc.text}`}>{job.client?.name ?? "—"}</p>
                            )}
                            {height > 56 && (
                              <p className="text-[10px] text-muted-foreground/70 truncate">{formatJobTime(job.scheduledTime, job.scheduledAt)}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Unassigned column */}
              {(jobsByMember.get("unassigned") ?? []).length > 0 && (
                <div className="flex-1 min-w-[140px] border-r border-dashed">
                  <div className="h-6 flex items-center px-2 border-b bg-muted/10 sticky top-0 z-10">
                    <span className="text-[11px] font-medium text-muted-foreground truncate">Unassigned</span>
                  </div>
                  <div className="p-1 space-y-1 mt-1">
                    {(jobsByMember.get("unassigned") ?? []).map(job => {
                      const sc = getStatusColor(job.status);
                      return (
                        <div key={job.id}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData("jobId", job.id);
                            e.dataTransfer.setData("offsetY", "0");
                            setDraggingJobId(job.id);
                          }}
                          onDragEnd={() => setDraggingJobId(null)}
                          onClick={() => onJobClick(job.id)}
                          className={`rounded px-2 py-1.5 cursor-pointer border-l-[3px] ${sc.bg} ${sc.border} hover:brightness-95`}
                        >
                          <p className="text-[11px] font-medium truncate">{job.title}</p>
                          <p className={`text-[10px] truncate ${sc.text}`}>{job.client?.name ?? "—"}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Equipment row */}
          {(resources?.deployedEquipment?.length ?? 0) > 0 && (
            <div className="border-t mt-2 pt-2">
              <div className="flex items-center gap-2 px-4 mb-2">
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Equipment Deployed Today</span>
              </div>
              <div className="flex gap-2 px-4 flex-wrap pb-3">
                {(resources?.deployedEquipment ?? []).map(eq => (
                  <div key={eq.equipmentId} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs bg-card">
                    <Wrench className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{eq.equipmentName}</span>
                    {eq.jobTitle && (
                      <span className="text-muted-foreground">→ {eq.jobTitle}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Materials panel */}
      {showMaterials && (
        <div className="w-64 border-l flex flex-col flex-shrink-0">
          <div className="px-3 py-2 border-b bg-muted/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Materials Needed Today</p>
          </div>
          <ScrollArea className="flex-1">
            {materialsNeeded.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Package className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">No materials needed</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {materialsNeeded.map(mat => (
                  <div key={mat.id} className={`flex items-start gap-2 p-2 rounded hover:bg-muted/30 ${checkedMaterials.has(mat.id) ? "opacity-50" : ""}`}>
                    <Checkbox
                      checked={checkedMaterials.has(mat.id)}
                      onCheckedChange={v => {
                        setCheckedMaterials(prev => {
                          const next = new Set(prev);
                          if (v) next.add(mat.id); else next.delete(mat.id);
                          return next;
                        });
                      }}
                      className="mt-0.5 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className={`text-xs font-medium truncate ${checkedMaterials.has(mat.id) ? "line-through" : ""}`}>{mat.name}</p>
                      {mat.quantity && (
                        <p className="text-[10px] text-muted-foreground">{mat.quantity} {mat.unit ?? ""}</p>
                      )}
                      {mat.jobTitle && (
                        <p className="text-[10px] text-muted-foreground truncate">For: {mat.jobTitle}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
            {checkedMaterials.size} of {materialsNeeded.length} prepared
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Week View ───────────────────────────────────────────────────────────────

function WeekView({
  weekStart,
  jobs,
  workers,
  selectedWorkerIds,
  onJobClick,
  onCreateJob,
  onReschedule,
}: {
  weekStart: Date;
  jobs: DispatchJob[];
  workers: TeamMember[];
  selectedWorkerIds: string[];
  onJobClick: (id: string) => void;
  onCreateJob: (memberId?: string, date?: Date) => void;
  onReschedule: (jobId: string, memberId: string, date: Date) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const [dragOverCell, setDragOverCell] = useState<{ wid: string; dayStr: string } | null>(null);
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);

  const filteredWorkers = useMemo(() => {
    if (selectedWorkerIds.length === 0) return workers;
    return workers.filter(w => selectedWorkerIds.includes(w.memberId || w.id));
  }, [workers, selectedWorkerIds]);

  const handleWeekDrop = useCallback((wid: string, day: Date, e: React.DragEvent) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("jobId");
    if (jobId) onReschedule(jobId, wid, day);
    setDragOverCell(null);
    setDraggingJobId(null);
  }, [onReschedule]);

  return (
    <ScrollArea className="flex-1">
      <div className="min-w-[900px]">
        {/* Day headers */}
        <div className="grid grid-cols-[120px_repeat(7,1fr)] border-b sticky top-0 z-10 bg-background">
          <div className="px-2 py-2 text-[11px] font-semibold text-muted-foreground uppercase">Worker</div>
          {days.map(day => (
            <div key={day.toISOString()} className={`px-2 py-2 text-center border-l ${isToday(day) ? "bg-primary/5" : ""}`}>
              <p className="text-[11px] font-medium text-muted-foreground">{format(day, "EEE")}</p>
              <p className={`text-sm font-bold ${isToday(day) ? "text-primary" : ""}`}>{format(day, "d")}</p>
            </div>
          ))}
        </div>

        {/* Worker rows */}
        {filteredWorkers.map(worker => {
          const wid = worker.memberId || worker.id;
          return (
            <div key={wid} className="grid grid-cols-[120px_repeat(7,1fr)] border-b">
              {/* Worker label */}
              <div className="px-2 py-2 flex items-center gap-1.5 border-r">
                <UserAvatar
                  user={{ id: wid, firstName: worker.firstName, lastName: worker.lastName, photoUrl: worker.profileImageUrl, themeColor: worker.themeColor }}
                  className="h-6 w-6 text-[10px] flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium truncate">{memberName(worker)}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{worker.roleName}</p>
                </div>
              </div>

              {/* Day cells */}
              {days.map(day => {
                const dayStr = day.toISOString();
                const isOver = dragOverCell?.wid === wid && dragOverCell?.dayStr === dayStr;
                const dayJobs = jobs.filter(j => {
                  if (!jobOnDate(j, day)) return false;
                  const assignee = j.assignedTo ?? primaryAssignment(j)?.memberId;
                  return assignee === wid;
                });
                return (
                  <div
                    key={dayStr}
                    className={`border-l min-h-[80px] p-1 relative group transition-colors
                      ${isToday(day) ? "bg-primary/[0.03]" : ""}
                      ${isOver ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : "hover:bg-muted/10"}`}
                    onDragOver={e => { e.preventDefault(); setDragOverCell({ wid, dayStr }); }}
                    onDragLeave={() => setDragOverCell(null)}
                    onDrop={e => handleWeekDrop(wid, day, e)}
                    onClick={() => onCreateJob(wid, day)}
                  >
                    {dayJobs.map(job => {
                      const sc = getStatusColor(job.status);
                      return (
                        <div
                          key={job.id}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData("jobId", job.id);
                            setDraggingJobId(job.id);
                          }}
                          onDragEnd={() => setDraggingJobId(null)}
                          onClick={e => { e.stopPropagation(); onJobClick(job.id); }}
                          className={`rounded px-1.5 py-0.5 mb-0.5 cursor-grab active:cursor-grabbing border-l-2
                            ${sc.bg} ${sc.border} hover:brightness-95
                            ${draggingJobId === job.id ? "opacity-40" : ""}`}
                          title={`${job.title} — ${job.client?.name ?? ""} ${formatJobTime(job.scheduledTime, job.scheduledAt)}`}
                        >
                          <p className="text-[10px] font-medium truncate">{job.title}</p>
                          <p className={`text-[10px] truncate ${sc.text}`}>{formatJobTime(job.scheduledTime, job.scheduledAt)}</p>
                        </div>
                      );
                    })}
                    {/* Drop hint */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <Plus className="h-3 w-3 text-muted-foreground/30" />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// ─── Kanban View ─────────────────────────────────────────────────────────────

function KanbanView({
  jobs,
  workers,
  showTerminal,
  terminalCount,
  onJobClick,
  onStatusChange,
  onToggleTerminal,
}: {
  jobs: DispatchJob[];
  workers: TeamMember[];
  showTerminal: boolean;
  terminalCount: number;
  onJobClick: (id: string) => void;
  onStatusChange: (jobId: string, status?: string, workerStatus?: string) => void;
  onToggleTerminal: () => void;
}) {
  const [dragState, setDragState] = useState<{ jobId: string; fromCol: string } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const activeJobs = useMemo(() =>
    showTerminal ? jobs : jobs.filter(j => !TERMINAL_STATUSES.includes(j.status?.toLowerCase() ?? "")),
    [jobs, showTerminal],
  );

  const columnJobs = useMemo(() => {
    const map: Record<string, DispatchJob[]> = {};
    KANBAN_COLUMNS.forEach(c => { map[c.key] = []; });
    activeJobs.forEach(j => {
      const col = getKanbanColumn(j);
      map[col]?.push(j);
    });
    return map;
  }, [activeJobs]);

  const statusForCol: Record<string, string | undefined> = {
    assigned: "scheduled", en_route: undefined, arrived: undefined,
    in_progress: "in_progress", completed: "done",
  };
  const workerStatusForCol: Record<string, string> = {
    assigned: "assigned", en_route: "on_my_way", arrived: "arrived",
    in_progress: "in_progress", completed: "completed",
  };

  const handleDrop = (targetCol: string) => {
    if (!dragState || dragState.fromCol === targetCol) { setDragState(null); setDragOverCol(null); return; }
    onStatusChange(dragState.jobId, statusForCol[targetCol], workerStatusForCol[targetCol]);
    setDragState(null);
    setDragOverCol(null);
  };

  const workerMap = useMemo(() => {
    const m = new Map<string, TeamMember>();
    workers.forEach(w => m.set(w.memberId || w.id, w));
    return m;
  }, [workers]);

  return (
    <div className="flex flex-1 overflow-hidden flex-col">
      {terminalCount > 0 && (
        <div className="px-4 py-1.5 border-b flex items-center gap-2">
          <button
            onClick={onToggleTerminal}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {showTerminal ? <X className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showTerminal ? "Hide" : "Show"} {terminalCount} completed job{terminalCount !== 1 ? "s" : ""}
          </button>
        </div>
      )}
      <div className="flex flex-1 overflow-x-auto overflow-y-hidden gap-3 p-3">
        {KANBAN_COLUMNS.map(col => (
          <div
            key={col.key}
            className={`flex flex-col w-72 flex-shrink-0 rounded-lg border-t-2 ${col.headerColor} ${
              dragOverCol === col.key ? "ring-2 ring-primary/30" : ""
            }`}
            onDragOver={e => { e.preventDefault(); setDragOverCol(col.key); }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={() => handleDrop(col.key)}
          >
            {/* Column header */}
            <div className={`px-3 py-2 rounded-t-sm ${col.bg}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{col.label}</p>
                <Badge variant="secondary" className="text-xs h-5">{columnJobs[col.key]?.length ?? 0}</Badge>
              </div>
            </div>

            {/* Cards */}
            <ScrollArea className={`flex-1 ${col.bg}`}>
              <div className="p-2 space-y-2">
                {(columnJobs[col.key] ?? []).map(job => {
                  const asgn = primaryAssignment(job);
                  const worker = asgn?.memberId ? workerMap.get(asgn.memberId) : undefined;
                  const sc = getStatusColor(job.status);

                  return (
                    <div
                      key={job.id}
                      draggable
                      onDragStart={e => {
                        e.dataTransfer.setData("jobId", job.id);
                        setDragState({ jobId: job.id, fromCol: col.key });
                      }}
                      onDragEnd={() => setDragState(null)}
                      onClick={() => onJobClick(job.id)}
                      className={`bg-card rounded-lg border shadow-sm p-3 cursor-pointer hover:shadow-md transition-shadow
                        ${dragState?.jobId === job.id ? "opacity-40" : ""}
                        ${sc.border} border-l-[3px]`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-semibold leading-tight flex-1">{job.title}</p>
                        {job.priority && job.priority !== "normal" && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 capitalize flex-shrink-0">{job.priority}</Badge>
                        )}
                      </div>

                      {job.client?.name && (
                        <p className="text-xs text-muted-foreground mb-1.5 truncate">{job.client.name}</p>
                      )}

                      {job.address && (
                        <div className="flex items-center gap-1 mb-1.5">
                          <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <p className="text-[11px] text-muted-foreground truncate">{job.address}</p>
                        </div>
                      )}

                      {job.scheduledAt && (
                        <div className="flex items-center gap-1 mb-2">
                          <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <p className="text-[11px] text-muted-foreground">
                            {format(parseISO(job.scheduledAt), "d MMM")} {formatJobTime(job.scheduledTime, job.scheduledAt)}
                          </p>
                        </div>
                      )}

                      {worker && (
                        <div className="flex items-center gap-1.5 pt-1.5 border-t">
                          <UserAvatar
                            user={{ id: worker.memberId || worker.id, firstName: worker.firstName, lastName: worker.lastName, photoUrl: worker.profileImageUrl, themeColor: worker.themeColor }}
                            className="h-5 w-5 text-[9px] flex-shrink-0"
                          />
                          <span className="text-[11px] text-muted-foreground truncate">{memberName(worker)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {(columnJobs[col.key] ?? []).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground/50 text-xs">
                    No jobs
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Resource Sidebar ────────────────────────────────────────────────────────

function ResourceSidebar({
  workers,
  resources,
  selectedWorkerIds,
  onWorkerToggle,
  onClose,
}: {
  workers: TeamMember[];
  resources?: DispatchResources;
  selectedWorkerIds: string[];
  onWorkerToggle: (id: string) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"workers" | "equipment" | "materials">("workers");

  const tabs = [
    { key: "workers" as const,   label: "Workers",   icon: Users },
    { key: "equipment" as const, label: "Equipment", icon: Wrench },
    { key: "materials" as const, label: "Materials", icon: Package },
  ];

  return (
    <div className="w-64 border-l flex flex-col flex-shrink-0 bg-card">
      {/* Tab bar */}
      <div className="flex items-center border-b px-1 pt-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-[10px] font-medium rounded-t transition-colors
                ${activeTab === tab.key ? "bg-background text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
        <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground ml-1">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        {/* Workers tab */}
        {activeTab === "workers" && (
          <div className="p-2 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 py-1">
              Filter by worker
            </p>
            {workers.map(worker => {
              const wid = worker.memberId || worker.id;
              const isSelected = selectedWorkerIds.includes(wid);
              return (
                <button
                  key={wid}
                  onClick={() => onWorkerToggle(wid)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-left
                    ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"}`}
                >
                  <UserAvatar
                    user={{ id: wid, firstName: worker.firstName, lastName: worker.lastName, photoUrl: worker.profileImageUrl, themeColor: worker.themeColor }}
                    className="h-6 w-6 text-[10px] flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{memberName(worker)}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{worker.roleName}</p>
                  </div>
                  {isSelected && <Check className="h-3 w-3 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Equipment tab */}
        {activeTab === "equipment" && (
          <div className="p-2 space-y-1">
            {(resources?.allEquipment?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Wrench className="h-7 w-7 mb-2 opacity-30" />
                <p className="text-xs">No equipment found</p>
              </div>
            ) : (
              <>
                {/* Deployed */}
                {(resources?.deployedEquipment?.length ?? 0) > 0 && (
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-1">Deployed</p>
                )}
                {(resources?.deployedEquipment ?? []).map(eq => (
                  <div key={eq.equipmentId} className="flex items-start gap-2 px-2 py-1.5 rounded bg-orange-50 dark:bg-orange-950/20">
                    <div className="w-5 h-5 rounded bg-orange-200 dark:bg-orange-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Truck className="h-2.5 w-2.5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium truncate">{eq.equipmentName}</p>
                      {eq.jobTitle && (
                        <p className="text-[10px] text-muted-foreground truncate">{eq.jobTitle}</p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Available */}
                {(resources?.allEquipment ?? []).filter(e => !e.isDeployed).length > 0 && (
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-2">Available</p>
                )}
                {(resources?.allEquipment ?? []).filter(e => !e.isDeployed).map(eq => (
                  <div key={eq.id} className="flex items-start gap-2 px-2 py-1.5 rounded bg-green-50 dark:bg-green-950/20">
                    <div className="w-5 h-5 rounded bg-green-200 dark:bg-green-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-2.5 w-2.5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium truncate">{eq.name}</p>
                      {eq.categoryName && <p className="text-[10px] text-muted-foreground">{eq.categoryName}</p>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Materials tab */}
        {activeTab === "materials" && (
          <div className="p-2 space-y-1">
            {(resources?.materialsNeeded?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Package className="h-7 w-7 mb-2 opacity-30" />
                <p className="text-xs">No materials needed</p>
              </div>
            ) : (
              (resources?.materialsNeeded ?? []).map(mat => (
                <div key={mat.id} className="px-2 py-1.5 rounded hover:bg-muted/30">
                  <p className="text-[11px] font-medium truncate">{mat.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {mat.quantity && (
                      <span className="text-[10px] text-muted-foreground">{mat.quantity} {mat.unit}</span>
                    )}
                    {mat.jobTitle && (
                      <span className="text-[10px] text-muted-foreground truncate">For: {mat.jobTitle}</span>
                    )}
                  </div>
                  {mat.status && (
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1 mt-0.5 capitalize">{mat.status}</Badge>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type ViewMode = "day" | "week" | "kanban";

export default function AdvancedDispatch() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // View state
  const [view, setView] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showSidebar, setShowSidebar] = useState(true);
  const [showMaterials, setShowMaterials] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  // NOTE: the persisted job type is "service" (not "service_call"); the API
  // validates only "service" | "project".  Use "service" for comparisons.
  const [jobTypeFilter, setJobTypeFilter] = useState<"all" | "service" | "project">("all");
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Kanban completed-jobs toggle (lifted here so the query can include terminal
  // jobs when needed — the board endpoint strips terminal by default)
  const [showKanbanTerminal, setShowKanbanTerminal] = useState(false);

  // Week navigation
  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);

  // ── Data fetching ─────────────────────────────────────────────
  // When Kanban's completed-jobs toggle is on, ask the endpoint to include
  // terminal-status jobs (completed / done / cancelled / archived).
  const boardUrl = view === "kanban" && showKanbanTerminal
    ? "/api/dispatch/board?includeTerminal=true"
    : "/api/dispatch/board";

  const { data: dispatchJobs = [], isLoading: jobsLoading } = useQuery<DispatchJob[]>({
    queryKey: [boardUrl],
    refetchInterval: 30_000,
  });

  const { data: workers = [], isLoading: workersLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team/members"],
  });

  const { data: resources, isLoading: resourcesLoading } = useQuery<DispatchResources>({
    queryKey: ["/api/dispatch/resources"],
    refetchInterval: 60_000,
  });

  // ── Mutations ─────────────────────────────────────────────────
  const updateJobMutation = useMutation({
    mutationFn: async (payload: { jobId: string; status?: string; workerStatus?: string; scheduledAt?: string; scheduledTime?: string; assignedTo?: string }) => {
      const { jobId, ...body } = payload;
      return apiRequest("PATCH", `/api/jobs/${jobId}`, body);
    },
    onSuccess: () => {
      // Invalidate both the base key and the includeTerminal variant
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch/board"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job updated" });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────
  const handleJobClick = useCallback((id: string) => {
    navigate(`/jobs/${id}`);
  }, [navigate]);

  const handleCreateJob = useCallback((memberId?: string, hourOrDate?: number | Date) => {
    const base = "/jobs/new";
    const params = new URLSearchParams();
    if (memberId) params.set("assignTo", memberId);
    if (typeof hourOrDate === "number") {
      const d = view === "day" ? currentDate : new Date();
      params.set("scheduledAt", format(d, "yyyy-MM-dd"));
      params.set("scheduledTime", `${hourOrDate.toString().padStart(2, "0")}:00`);
    } else if (hourOrDate instanceof Date) {
      params.set("scheduledAt", format(hourOrDate, "yyyy-MM-dd"));
    }
    navigate(`${base}?${params.toString()}`);
  }, [navigate, view, currentDate]);

  const handleReschedule = useCallback((jobId: string, memberId: string, hour: number, minute: number) => {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    updateJobMutation.mutate({
      jobId,
      scheduledAt: dateStr,
      scheduledTime: timeStr,
      // Include destination worker so cross-column drag reassigns correctly
      ...(memberId ? { assignedTo: memberId } : {}),
    });
  }, [currentDate, updateJobMutation]);

  // Week view drag-drop: preserve the existing scheduled time, change date + worker
  const handleWeekReschedule = useCallback((jobId: string, memberId: string, date: Date) => {
    const job = dispatchJobs.find(j => j.id === jobId);
    const dateStr = format(date, "yyyy-MM-dd");
    updateJobMutation.mutate({
      jobId,
      scheduledAt: dateStr,
      // Keep existing time if the job already has one, otherwise leave blank
      ...(job?.scheduledTime ? { scheduledTime: job.scheduledTime } : {}),
      ...(memberId ? { assignedTo: memberId } : {}),
    });
  }, [dispatchJobs, updateJobMutation]);

  const handleStatusChange = useCallback((jobId: string, status?: string, workerStatus?: string) => {
    updateJobMutation.mutate({ jobId, status, workerStatus });
  }, [updateJobMutation]);

  const handleWorkerToggle = useCallback((wid: string) => {
    setSelectedWorkerIds(prev =>
      prev.includes(wid) ? prev.filter(id => id !== wid) : [...prev, wid],
    );
  }, []);

  // ── Navigation ────────────────────────────────────────────────
  const navPrev = () => {
    if (view === "day") setCurrentDate(d => subDays(d, 1));
    else if (view === "week") setCurrentDate(d => subWeeks(d, 1));
  };
  const navNext = () => {
    if (view === "day") setCurrentDate(d => addDays(d, 1));
    else if (view === "week") setCurrentDate(d => addWeeks(d, 1));
  };
  const navToday = () => setCurrentDate(new Date());

  // ── Filtered jobs ─────────────────────────────────────────────
  const filteredJobs = useMemo(() => {
    let result = dispatchJobs;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.client?.name?.toLowerCase().includes(q) ||
        j.address?.toLowerCase().includes(q),
      );
    }
    if (jobTypeFilter !== "all") {
      result = result.filter(j => (j.jobType ?? "service") === jobTypeFilter);
    }
    if (selectedWorkerIds.length > 0 && view !== "day") {
      // In day/week views the filter is applied at render time; for kanban apply here too
      result = result.filter(j => {
        // Prefer assignedTo (updated immediately by the drag PATCH) then fall
        // back to the assignment-record memberId for team-assigned jobs.
        const wid = j.assignedTo ?? primaryAssignment(j)?.memberId;
        return !!wid && selectedWorkerIds.includes(wid);
      });
    }
    return result;
  }, [dispatchJobs, searchQuery, jobTypeFilter, selectedWorkerIds, view]);

  // ── Period label ──────────────────────────────────────────────
  const periodLabel = useMemo(() => {
    if (view === "day") return format(currentDate, "EEEE, d MMMM yyyy");
    if (view === "week") return `${format(weekStart, "d MMM")} – ${format(addDays(weekStart, 6), "d MMM yyyy")}`;
    return "All jobs";
  }, [view, currentDate, weekStart]);

  const isLoading = jobsLoading || workersLoading;

  const VIEW_BUTTONS: { key: ViewMode; label: string; icon: React.ElementType }[] = [
    { key: "day",    label: "Day",    icon: CalendarDays },
    { key: "week",   label: "Week",   icon: CalendarIcon },
    { key: "kanban", label: "Kanban", icon: Columns3 },
  ];

  return (
    <PageShell className="flex flex-col h-screen overflow-hidden">
      {/* ── Top bar ── */}
      <div className="border-b flex-shrink-0 px-4 py-2 flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold tracking-tight flex-shrink-0">Dispatch</h1>
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5">
            {VIEW_BUTTONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all
                  ${view === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Date navigation (not shown for kanban) */}
          {view !== "kanban" && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={navPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs font-medium px-2 gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {periodLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={currentDate}
                    onSelect={d => { if (d) { setCurrentDate(d); setCalendarOpen(false); } }}
                  />
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={navNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isToday(currentDate) && (
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={navToday}>
                  Today
                </Button>
              )}
            </div>
          )}

          {view === "kanban" && (
            <span className="text-sm font-medium text-muted-foreground">All Jobs</span>
          )}

          <div className="flex-1" />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search jobs or clients..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-7 h-7 text-xs w-48"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Worker filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Workers
                {selectedWorkerIds.length > 0 && (
                  <Badge className="h-4 text-[10px] px-1">{selectedWorkerIds.length}</Badge>
                )}
                <ChevronDown className="h-3 w-3 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs">Filter by worker</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {workers.map(w => {
                const wid = w.memberId || w.id;
                return (
                  <DropdownMenuCheckboxItem
                    key={wid}
                    checked={selectedWorkerIds.includes(wid)}
                    onCheckedChange={() => handleWorkerToggle(wid)}
                    className="text-xs"
                  >
                    {memberName(w)}
                  </DropdownMenuCheckboxItem>
                );
              })}
              {workers.length === 0 && <div className="text-xs text-muted-foreground px-2 py-1">No workers</div>}
              {selectedWorkerIds.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={false}
                    onCheckedChange={() => setSelectedWorkerIds([])}
                    className="text-xs text-muted-foreground"
                  >
                    Clear filter
                  </DropdownMenuCheckboxItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Job type filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                {jobTypeFilter === "all" ? "All types" : jobTypeFilter === "service" ? "Service calls" : "Projects"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(["all", "service", "project"] as const).map(t => (
                <DropdownMenuCheckboxItem key={t} checked={jobTypeFilter === t} onCheckedChange={() => setJobTypeFilter(t)} className="text-xs capitalize">
                  {t === "all" ? "All types" : t === "service" ? "Service calls" : "Projects"}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Materials toggle (day view only) */}
          {view === "day" && (
            <Button
              variant={showMaterials ? "secondary" : "outline"}
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => setShowMaterials(v => !v)}
            >
              <Package className="h-3.5 w-3.5" />
              Materials
            </Button>
          )}

          {/* Resource sidebar toggle */}
          <Button
            variant={showSidebar ? "secondary" : "outline"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowSidebar(v => !v)}
            title={showSidebar ? "Hide resources" : "Show resources"}
          >
            {showSidebar ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
          </Button>

          {/* New job */}
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => handleCreateJob()}>
            <Plus className="h-3.5 w-3.5" />
            New Job
          </Button>
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="flex flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : view === "day" ? (
          <DayView
            date={currentDate}
            jobs={filteredJobs}
            workers={workers}
            resources={resources}
            selectedWorkerIds={selectedWorkerIds}
            onJobClick={handleJobClick}
            onCreateJob={handleCreateJob}
            onReschedule={handleReschedule}
            showMaterials={showMaterials}
          />
        ) : view === "week" ? (
          <WeekView
            weekStart={weekStart}
            jobs={filteredJobs}
            workers={workers}
            selectedWorkerIds={selectedWorkerIds}
            onJobClick={handleJobClick}
            onCreateJob={(mid, date) => handleCreateJob(mid, date ?? undefined)}
            onReschedule={handleWeekReschedule}
          />
        ) : (
          <KanbanView
            jobs={filteredJobs}
            workers={workers}
            showTerminal={showKanbanTerminal}
            terminalCount={dispatchJobs.filter(j => TERMINAL_STATUSES.includes(j.status?.toLowerCase() ?? "")).length}
            onJobClick={handleJobClick}
            onStatusChange={handleStatusChange}
            onToggleTerminal={() => setShowKanbanTerminal(v => !v)}
          />
        )}

        {/* Resource sidebar */}
        {showSidebar && (
          <ResourceSidebar
            workers={workers}
            resources={resources}
            selectedWorkerIds={selectedWorkerIds}
            onWorkerToggle={handleWorkerToggle}
            onClose={() => setShowSidebar(false)}
          />
        )}
      </div>
    </PageShell>
  );
}
