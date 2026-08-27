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
import { useTheme } from "@/components/ThemeProvider";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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
  Map as MapIcon,
  Navigation,
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
  AlertTriangle,
  Filter,
  LayoutGrid,
  CalendarDays,
  Columns3,
  Loader2,
  RotateCcw,
  Locate,
  X,
  Zap,
  Timer,
  Maximize2,
  Minimize2,
  CalendarCheck,
  Layers,
  GripVertical,
  ExternalLink,
  UserPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  isValid,
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
  latitude?: string | number | null;
  longitude?: string | number | null;
  clientId: string;
  priority?: string;
  jobType?: string;
  notes?: string;
  /** Legacy direct-assignment field; updated by PATCH and used as primary assignee key */
  assignedTo?: string | null;
  client?: { id: string; name: string; phone?: string } | null;
  assignments?: DispatchAssignment[];
  /** Equipment assigned to this job (enriched by dispatch board) */
  equipment?: { equipmentId: string; equipmentName: string }[];
}

interface DispatchAssignment {
  id: string;
  assignmentStatus: string;
  memberId?: string;
  memberFirstName?: string;
  memberLastName?: string;
  memberEmail?: string;
  isActive: boolean;
  latestPing?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    timestamp?: string;
  } | null;
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

interface DispatchPhaseUser {
  id: string;
  name: string;
  isLead: boolean;
}
interface OpsHealth {
  todayJobCount: number;
  unassignedJobs: number;
  overdueJobs: number;
  overCapacityWorkers: number;
  conflictCount: number;
  conflicts: Array<{ memberId: string; memberName: string; jobs: Array<{ id: string; title: string; time: string }> }>;
  overdueInvoices: number;
  unpaidInvoiceTotal: number;
  activeWorkers: number;
  totalSeverity: number;
}

interface WorkerState {
  /** The team member's user ID — matches the `userId` field returned by /api/team/worker-states */
  userId: string;
  state: string; // 'available' | 'on_job' | 'travelling' | 'break' | 'delayed' | 'help'
  jobId?: string | null;
  jobTitle?: string | null;
  updatedAt?: string | null;
}

interface DispatchPhase {
  id: string;

  jobId: string;

  jobTitle: string;

  jobType: string;

  phaseCode?: string;

  name: string;

  description?: string | null;

  scheduledStart?: string | null;

  scheduledEnd?: string | null;

  bookedHours?: string | number | null;

  status: string;

  sortOrder?: number;

  assignedUserId?: string | null;

  assignedUserName?: string | null;
  /** Enriched by /api/dispatch/phases via enrichPhasesWithAssignees */

  assignedUserIds?: string[];

  assignedUsers?: Array<{ id: string; name: string; isLead?: boolean }>;

  notes?: string | null;
}
const TIMELINE_START = 6;   // 6 AM
const TIMELINE_END = 20;    // 8 PM
const HOUR_HEIGHT = 72;     // px per hour
const GUTTER_WIDTH = 64;    // px — wider gutter for time labels

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

/**
 * Extract the calendar-date string (YYYY-MM-DD) from a leave ISO timestamp.
 * Leave records are persisted at midnight UTC (e.g. "2026-08-25T00:00:00.000Z"),
 * so slicing the first 10 characters always yields the correct calendar date
 * regardless of the client timezone.
 */
function leaveDateStr(isoOrDate: string): string {
  return isoOrDate.slice(0, 10); // "YYYY-MM-DD"
}
/**
 * Returns true when any approved leave record covers this memberId on the given date.
 * Compares YYYY-MM-DD strings rather than millisecond timestamps so the result is
 * stable in every timezone, including UTC-negative offsets where a midnight-UTC
 * end date would otherwise fall before the local day start.
 */
function workerOnLeaveForDate(leaveRecords: LeaveRecord[], memberId: string, date: Date): boolean {
  const dateStr = format(date, "yyyy-MM-dd");
  return leaveRecords.some(r => {
    if (r.memberId !== memberId) return false;
    return leaveDateStr(r.startDate) <= dateStr && leaveDateStr(r.endDate) >= dateStr;
  });
}

/** Returns true when the worker has approved leave on ANY day in [rangeStart, rangeEnd]. */
function workerOnLeaveInRange(leaveRecords: LeaveRecord[], memberId: string, rangeStart: Date, rangeEnd: Date): boolean {
  const startStr = format(rangeStart, "yyyy-MM-dd");
  const endStr   = format(rangeEnd,   "yyyy-MM-dd");
  return leaveRecords.some(r => {
    if (r.memberId !== memberId) return false;
    // Overlap: leave.start <= rangeEnd AND leave.end >= rangeStart
    return leaveDateStr(r.startDate) <= endStr && leaveDateStr(r.endDate) >= startStr;
  });
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

// ─── Ops Alert Bar ───────────────────────────────────────────────────────────

const WORKER_STATE_LABELS: Record<string, { label: string; color: string }> = {
  available:  { label: "Available",  color: "bg-green-500" },
  on_job:     { label: "On Job",     color: "bg-blue-500" },
  travelling: { label: "Travelling", color: "bg-amber-500" },
  break:      { label: "Break",      color: "bg-purple-500" },
  delayed:    { label: "Delayed",    color: "bg-orange-500" },
  help:       { label: "Help",       color: "bg-red-500" },
};

function OpsAlertBar() {
  const [expanded, setExpanded] = useState(false);

  const { data: opsHealth, isError: opsHealthError } = useQuery<OpsHealth>({ queryKey: ["/api/ops/health"] });
  const { data: jobAgingData } = useQuery<{ totalAging: number; criticalCount: number; agingJobs: any[] }>({
    queryKey: ["/api/ops/job-aging"],
  });

  if (opsHealthError) {
    return (
      <div className="border-b flex-shrink-0 px-4 py-1 bg-destructive/5">
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          Ops health could not be loaded
        </div>
      </div>
    );
  }

  if (!opsHealth) return null;

  const agingCount = jobAgingData?.totalAging ?? 0;
  const hasIssues =
    opsHealth.conflictCount > 0 ||
    opsHealth.overdueJobs > 0 ||
    opsHealth.unassignedJobs > 0 ||
    opsHealth.overCapacityWorkers > 0 ||
    opsHealth.overdueInvoices > 0 ||
    agingCount > 0;

  if (!hasIssues) return null;

  const severity =
    opsHealth.conflictCount > 0 ? "critical" :
    opsHealth.overdueJobs > 0 || opsHealth.overCapacityWorkers > 0 || (jobAgingData?.criticalCount ?? 0) > 0
      ? "warning" : "info";

  return (
    <div
      className={`border-b flex-shrink-0 px-4 py-1 ${
        severity === "critical"
          ? "bg-destructive/5 border-destructive/20"
          : severity === "warning"
          ? "bg-amber-500/5 border-amber-500/20"
          : "bg-muted/30"
      }`}
    >
      <div
        className="flex items-center gap-2 cursor-pointer flex-wrap"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {severity === "critical" ? (
            <AlertCircle className="h-3 w-3 text-destructive" />
          ) : (
            <AlertTriangle className="h-3 w-3 text-amber-500" />
          )}
          <span className={`text-[11px] font-semibold ${severity === "critical" ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}>
            Ops Alert
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {opsHealth.overdueJobs > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-2.5 w-2.5" />
              {opsHealth.overdueJobs} Overdue
            </span>
          )}
          {opsHealth.unassignedJobs > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Briefcase className="h-2.5 w-2.5" />
              {opsHealth.unassignedJobs} Unassigned
            </span>
          )}
          {opsHealth.overCapacityWorkers > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Users className="h-2.5 w-2.5" />
              {opsHealth.overCapacityWorkers} Over Capacity
            </span>
          )}
          {opsHealth.overdueInvoices > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-2.5 w-2.5" />
              {opsHealth.overdueInvoices} Overdue Invoices
            </span>
          )}
          {opsHealth.conflictCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive">
              <Zap className="h-2.5 w-2.5" />
              {opsHealth.conflictCount} Conflicts
            </span>
          )}
          {agingCount > 0 && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full text-[10px] font-medium"
              style={{
                backgroundColor: (jobAgingData?.criticalCount ?? 0) > 0 ? "hsl(var(--destructive)/0.1)" : "hsl(45 100% 50%/0.15)",
                color: (jobAgingData?.criticalCount ?? 0) > 0 ? "hsl(var(--destructive))" : "hsl(45 80% 35%)",
              }}
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {agingCount} Stale
            </span>
          )}
        </div>

        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
      </div>

      {expanded && (
        <div className="pt-1 pb-0.5 space-y-1">
          {opsHealth.conflicts.map((conflict, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              <AlertCircle className="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
              <span>
                <span className="font-medium">{conflict.memberName}</span>
                <span className="text-muted-foreground"> has overlapping jobs: </span>
                {conflict.jobs.map((j, k) => (
                  <span key={j.id}>
                    {k > 0 && ", "}
                    <span className="font-medium">{j.title}</span>
                    <span className="text-muted-foreground"> ({j.time})</span>
                  </span>
                ))}
              </span>
            </div>
          ))}
          {(jobAgingData?.agingJobs ?? []).slice(0, 4).map((j: any) => (
            <div key={j.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 flex-shrink-0" style={{ color: j.severity === "critical" ? "hsl(var(--destructive))" : "hsl(45 80% 35%)" }} />
              <span className="font-medium">{j.title}</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1">{j.status}</Badge>
              <span>{j.daysInStatus}d in status</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Unscheduled Queue Panel ──────────────────────────────────────────────────

function UnscheduledQueuePanel({
  jobs,
  workers,
  allDayJobs,
  onJobClick,
  onAssign,
}: {
  jobs: DispatchJob[];            // unscheduled jobs
  workers: TeamMember[];
  allDayJobs: DispatchJob[];      // all jobs on the selected date (for load calc)
  onJobClick: (id: string) => void;
  onAssign: (jobId: string, workerId: string, hour: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [assigningJob, setAssigningJob] = useState<DispatchJob | null>(null);
  const [assignWorkerId, setAssignWorkerId] = useState("");
  const [assignHour, setAssignHour] = useState("9");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Compute load per worker (minutes scheduled today)
  const workerLoadMap = useMemo(() => {
    const map = new Map<string, number>();
    workers.forEach(w => map.set(w.memberId || w.id, 0));
    allDayJobs.forEach(j => {
      const wid = j.assignedTo ?? primaryAssignment(j)?.memberId;
      if (wid && map.has(wid)) {
        map.set(wid, (map.get(wid) ?? 0) + (j.estimatedDuration ?? 60));
      }
    });
    return map;
  }, [workers, allDayJobs]);

  const bestFitWorker = useMemo(() => {
    if (workers.length === 0) return null;
    return workers.reduce((best, curr) => {
      const currLoad = workerLoadMap.get(curr.memberId || curr.id) ?? 0;
      const bestLoad = workerLoadMap.get(best.memberId || best.id) ?? 0;
      return currLoad < bestLoad ? curr : best;
    });
  }, [workers, workerLoadMap]);

  const openAssign = (job: DispatchJob) => {
    setAssigningJob(job);
    setAssignWorkerId(bestFitWorker ? (bestFitWorker.memberId || bestFitWorker.id) : (workers[0] ? (workers[0].memberId || workers[0].id) : ""));
    setAssignHour("9");
  };

  const handleAssignConfirm = () => {
    if (!assigningJob || !assignWorkerId) return;
    onAssign(assigningJob.id, assignWorkerId, parseInt(assignHour, 10));
    setAssigningJob(null);
  };

  return (
    <div className="border-b flex-shrink-0 bg-card">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors"
        onClick={() => setCollapsed(v => !v)}
      >
        <Timer className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-semibold flex-1 text-left">
          Unscheduled
          {jobs.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{jobs.length}</Badge>
          )}
        </span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${collapsed ? "" : "rotate-180"}`} />
      </button>

      {!collapsed && (
        <div className="overflow-y-auto max-h-64">
          {jobs.length === 0 ? (
            <div className="px-3 pb-3 text-xs text-muted-foreground text-center py-4">
              All jobs are scheduled
            </div>
          ) : (
            <div className="p-2 space-y-1.5">
              {jobs.map(job => {
                const sc = getStatusColor(job.status);
                const fit = bestFitWorker;
                return (
                  <div
                    key={job.id}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData("jobId", job.id);
                      e.dataTransfer.setData("offsetY", "0");
                      e.dataTransfer.setData("fromQueue", "true");
                      setDraggingId(job.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className={`rounded ${sc.bg} p-2 cursor-grab active:cursor-grabbing
                      ${draggingId === job.id ? "opacity-40" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sc.solid }} />
                        <button
                          className="text-[11px] font-medium truncate text-left flex-1 hover:underline"
                          onClick={() => onJobClick(job.id)}
                        >
                          {job.title}
                        </button>
                      </div>
                    </div>
                    {job.client?.name && (
                      <p className="text-[10px] text-muted-foreground truncate">{job.client.name}</p>
                    )}
                    {job.address && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                        <p className="text-[10px] text-muted-foreground truncate">{job.address}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">No time set</span>
                      {fit && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                          Best: {memberName(fit)}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-5 text-[10px] mt-1.5"
                      onClick={() => openAssign(job)}
                    >
                      Assign
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Quick assign dialog */}
      <Dialog open={!!assigningJob} onOpenChange={open => { if (!open) setAssigningJob(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Assign Job</DialogTitle>
          </DialogHeader>
          {assigningJob && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{assigningJob.title}</p>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Worker</label>
                <Select value={assignWorkerId} onValueChange={setAssignWorkerId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select worker" />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map(w => {
                      const wid = w.memberId || w.id;
                      const loadMin = workerLoadMap.get(wid) ?? 0;
                      const loadH = Math.round(loadMin / 60 * 10) / 10;
                      return (
                        <SelectItem key={wid} value={wid} className="text-xs">
                          {memberName(w)} ({loadH}h booked)
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Start time</label>
                <Select value={assignHour} onValueChange={setAssignHour}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 14 }, (_, i) => i + 6).map(h => {
                      const ampm = h >= 12 ? "PM" : "AM";
                      const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
                      return (
                        <SelectItem key={h} value={String(h)} className="text-xs">
                          {display}:00 {ampm}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setAssigningJob(null)}>Cancel</Button>
            <Button size="sm" onClick={handleAssignConfirm}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Empty Cell Job Picker Popover ───────────────────────────────────────────

function EmptyCellPopover({
  open,
  onClose,
  anchorStyle,
  allJobs,
  onSelectJob,
  onCreateJob,
}: {
  open: boolean;
  onClose: () => void;
  anchorStyle: React.CSSProperties;
  allJobs: DispatchJob[];
  onSelectJob: (jobId: string) => void;
  onCreateJob: () => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = allJobs.filter(j => !TERMINAL_STATUSES.includes(j.status?.toLowerCase() ?? ""));
    if (!q) return base.slice(0, 15);
    return base.filter(j =>
      j.title.toLowerCase().includes(q) ||
      j.client?.name?.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [allJobs, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute bg-popover border rounded-lg shadow-xl overflow-hidden"
        style={{ ...anchorStyle, width: 260, zIndex: 50 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-2 py-2 border-b bg-muted/30">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Assign existing job or create new</p>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs..."
              className="w-full pl-6 pr-2 py-1 text-xs rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <div className="overflow-y-auto max-h-56">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No jobs found</p>
          ) : (
            filtered.map(j => {
              const sc = getStatusColor(j.status);
              return (
                <button
                  key={j.id}
                  onClick={() => { onSelectJob(j.id); onClose(); }}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-2 border-b border-border/30 last:border-0"
                >
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc.solid }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{j.title}</p>
                    {j.client?.name && (
                      <p className="text-[10px] text-muted-foreground truncate">{j.client.name}</p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
        <button
          onClick={() => { onCreateJob(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-primary hover:bg-primary/5 border-t"
        >
          <Plus className="h-3.5 w-3.5" />
          Create new job
        </button>
      </div>
    </div>
  );
}

// ─── Day View ────────────────────────────────────────────────────────────────

function DayView({
  date,
  jobs,
  allJobs,
  workers,
  resources,
  selectedWorkerIds,
  overCapacityWorkerIds,
  leaveRecords,
  onJobClick,
  onCreateJob,
  onReschedule,
  onAssignJobToSlot,
  showMaterials,
  onEquipmentAssign,
  jobEquipmentMap,
}: {
  date: Date;
  jobs: DispatchJob[];
  allJobs: DispatchJob[];
  workers: TeamMember[];
  resources?: DispatchResources;
  selectedWorkerIds: string[];
  overCapacityWorkerIds?: Set<string>;
  leaveRecords: LeaveRecord[];
  onJobClick: (id: string) => void;
  onCreateJob: (memberId?: string, hour?: number) => void;
  onReschedule: (jobId: string, memberId: string, hour: number, minute: number) => void;
  onAssignJobToSlot: (jobId: string, memberId: string, hour: number) => void;
  showMaterials: boolean;
  onEquipmentAssign?: (equipmentId: string, jobId: string) => void;
  jobEquipmentMap?: Map<string, DeployedEquipmentItem[]>;
}) {
  const { toast } = useToast();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const [dragOverCell, setDragOverCell] = useState<{ memberId: string; hour: number } | null>(null);
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
  const [equipDragOverJobId, setEquipDragOverJobId] = useState<string | null>(null);

  // Empty cell popover
  const [cellPopover, setCellPopover] = useState<{ memberId: string; hour: number; style: React.CSSProperties } | null>(null);

  const todayJobs = useMemo(() => jobs.filter(j => jobOnDate(j, date)), [jobs, date]);

  const filteredWorkers = useMemo(() => {
    if (selectedWorkerIds.length === 0) return workers;
    return workers.filter(w => selectedWorkerIds.includes(w.memberId || w.id));
  }, [workers, selectedWorkerIds]);

  // Worker load map for capacity indicator in header
  const workerLoadMap = useMemo(() => {
    const map = new Map<string, number>();
    filteredWorkers.forEach(w => map.set(w.memberId || w.id, 0));
    todayJobs.forEach(j => {
      const wid = j.assignedTo ?? primaryAssignment(j)?.memberId;
      if (wid && map.has(wid)) {
        map.set(wid, (map.get(wid) ?? 0) + (j.estimatedDuration ?? 60));
      }
    });
    return map;
  }, [filteredWorkers, todayJobs]);

  const hours = Array.from({ length: TIMELINE_END - TIMELINE_START }, (_, i) => TIMELINE_START + i);
  const totalHeight = hours.length * HOUR_HEIGHT;

  const showNowLine = isToday(date) && now.getHours() >= TIMELINE_START && now.getHours() < TIMELINE_END;
  const nowTop = (now.getHours() - TIMELINE_START) * HOUR_HEIGHT + (now.getMinutes() / 60) * HOUR_HEIGHT;

  const jobsByMember = useMemo(() => {
    const map = new Map<string, DispatchJob[]>();
    filteredWorkers.forEach(w => map.set(w.memberId || w.id, []));
    map.set("unassigned", []);
    todayJobs.forEach(job => {
      const wid = job.assignedTo ?? primaryAssignment(job)?.memberId;
      if (wid && map.has(wid)) {
        map.get(wid)!.push(job);
      } else if (!wid) {
        map.get("unassigned")!.push(job);
      }
    });
    return map;
  }, [todayJobs, filteredWorkers]);

  const handleDrop = useCallback((memberId: string, hour: number, e: React.DragEvent) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("jobId");
    const equipmentId = e.dataTransfer.getData("equipmentId");

    if (equipmentId) {
      // Equipment dropped onto a time slot — find the job in that slot
      const slotJobs = jobsByMember.get(memberId) ?? [];
      const targetJob = slotJobs.find(j => {
        const { hour: jh } = parseJobTime(j.scheduledTime, j.scheduledAt);
        return Math.abs(jh - hour) <= 1;
      }) ?? slotJobs[0];
      if (targetJob && onEquipmentAssign) {
        onEquipmentAssign(equipmentId, targetJob.id);
      }
      setDragOverCell(null);
      return;
    }

    if (jobId) {
      const offsetY = e.dataTransfer.getData("offsetY");
      const minuteOffset = Math.round((parseInt(offsetY || "0") / HOUR_HEIGHT) * 60);
      const minute = Math.round(minuteOffset / 30) * 30;
      if (workerOnLeaveForDate(leaveRecords, memberId, date)) {
        const worker = workers.find(w => (w.memberId || w.id) === memberId);
        const name = worker ? memberName(worker) : "This worker";
        toast({
          title: `${name} is on leave`,
          description: "Job assigned, but this worker has approved leave for today.",
          variant: "destructive",
        });
      }
      onReschedule(jobId, memberId, hour, Math.min(minute, 30));
    }
    setDragOverCell(null);
    setDraggingJobId(null);
  }, [onReschedule, leaveRecords, date, workers, toast, jobsByMember, onEquipmentAssign]);

  const handleJobBlockDrop = useCallback((jobId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const equipmentId = e.dataTransfer.getData("equipmentId");
    if (equipmentId && onEquipmentAssign) {
      onEquipmentAssign(equipmentId, jobId);
    }
    setEquipDragOverJobId(null);
  }, [onEquipmentAssign]);

  const materialsNeeded = resources?.materialsNeeded ?? [];
  const [checkedMaterials, setCheckedMaterials] = useState<Set<string>>(new Set());

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Timeline grid */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="flex min-w-[700px]">
            {/* Hour gutter */}
            <div className="flex-shrink-0 relative" style={{ width: GUTTER_WIDTH, height: totalHeight + 48 }}>
              <div className="h-12" />
              {hours.map(h => (
                <div key={h} className="absolute left-0 right-0 flex items-center justify-end pr-2 pointer-events-none"
                  style={{ top: (h - TIMELINE_START) * HOUR_HEIGHT + 48, height: HOUR_HEIGHT }}>
                  <span className="text-[10px] font-medium text-muted-foreground/60 -translate-y-1/2 whitespace-nowrap">{formatHourLabel(h)}</span>
                </div>
              ))}
            </div>

            {/* Worker columns */}
            <div className="flex flex-1 border-l relative">
              {/* Now line spanning all worker columns */}
              {showNowLine && (
                <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                  style={{ top: nowTop + 48 }}>
                  <div className="absolute -left-1 flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />
                  </div>
                  <div className="flex-1 border-t-2 border-red-500 shadow-[0_0_4px_rgba(239,68,68,0.4)]" />
                  <span className="absolute right-1 -translate-y-full text-[9px] font-bold text-red-500 bg-background/80 px-1 rounded">
                    {format(now, "h:mm a")}
                  </span>
                </div>
              )}

              {filteredWorkers.map(worker => {
                const wid = worker.memberId || worker.id;
                const workerJobs = jobsByMember.get(wid) ?? [];
                const isOverCapacity = overCapacityWorkerIds?.has(wid) ?? false;
                const onLeave = workerOnLeaveForDate(leaveRecords, wid, date);
                const leaveLabel = onLeave ? workerLeaveLabel(leaveRecords, wid, date) : null;
                const loadMin = workerLoadMap.get(wid) ?? 0;
                const loadH = Math.round(loadMin / 60 * 10) / 10;
                const loadPct = Math.min((loadMin / 60 / 8) * 100, 100);
                return (
                  <div key={wid} className={`flex-1 min-w-[140px] border-r last:border-r-0 ${isOverCapacity ? "ring-1 ring-inset ring-red-500/40" : ""} ${onLeave ? "opacity-60" : ""}`}>
                    {/* Worker header */}
                    <div className={`h-12 flex flex-col justify-center gap-0.5 px-2 border-b sticky top-0 z-10 overflow-hidden ${onLeave ? "bg-slate-100 dark:bg-slate-800/60" : isOverCapacity ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/30"}`}>
                      <div className="flex items-center gap-1.5">
                        <UserAvatar
                          user={{ id: wid, firstName: worker.firstName, lastName: worker.lastName, photoUrl: worker.profileImageUrl, themeColor: worker.themeColor }}
                          className="h-5 w-5 text-[8px] flex-shrink-0"
                        />
                        <span className="text-[11px] font-semibold truncate flex-1">{memberName(worker)}</span>
                        {onLeave && (
                          <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 whitespace-nowrap flex-shrink-0">
                            {leaveLabel ?? "Leave"}
                          </span>
                        )}
                        {isOverCapacity && !onLeave && (
                          <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 whitespace-nowrap flex-shrink-0">
                            Full
                          </span>
                        )}
                      </div>
                      {/* Load bar */}
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isOverCapacity ? "bg-red-500" : loadPct > 75 ? "bg-amber-500" : "bg-primary/60"}`}
                            style={{ width: `${loadPct}%` }}
                          />
                        </div>
                        <span className="text-[8px] text-muted-foreground/70 flex-shrink-0">{loadH}h</span>
                      </div>
                    </div>

                    {/* Hour cells + job blocks */}
                    <div className="relative" style={{ height: totalHeight }}>
                      {/* Leave hatch overlay */}
                      {onLeave && (
                        <div className="absolute inset-0 z-10 pointer-events-none"
                          style={{ background: "repeating-linear-gradient(135deg,transparent,transparent 6px,rgba(148,163,184,0.12) 6px,rgba(148,163,184,0.12) 12px)" }}
                        />
                      )}
                      {/* Hour grid lines */}
                      {hours.map(h => (
                        <div key={h}
                          className={`absolute left-0 right-0 border-t transition-colors group ${
                            dragOverCell?.memberId === wid && dragOverCell?.hour === h
                              ? "bg-primary/10 border-t-primary"
                              : "border-border/30 hover:bg-muted/20 cursor-pointer"
                          }`}
                          style={{ top: (h - TIMELINE_START) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                          onDragOver={e => { e.preventDefault(); setDragOverCell({ memberId: wid, hour: h }); }}
                          onDragLeave={() => setDragOverCell(null)}
                          onDrop={e => handleDrop(wid, h, e)}
                          onClick={e => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const top = Math.min(e.clientY + 8, window.innerHeight - 340);
                            const left = Math.min(e.clientX + 8, window.innerWidth - 276);
                            setCellPopover({ memberId: wid, hour: h, style: { top, left } });
                          }}
                        >
                          {/* Half-hour marker */}
                          <div className="absolute left-0 right-0 border-t border-dashed border-border/15" style={{ top: HOUR_HEIGHT / 2 }} />
                          {/* + hint on hover */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <Plus className="h-3 w-3 text-muted-foreground/30" />
                          </div>
                        </div>
                      ))}

                      {/* Job blocks */}
                      {workerJobs.map(job => {
                        const { hour, minute } = parseJobTime(job.scheduledTime, job.scheduledAt);
                        const isOutOfViewTop = hour < TIMELINE_START;
                        const isOutOfViewBottom = hour >= TIMELINE_END;
                        const clampedHour = Math.max(TIMELINE_START, Math.min(TIMELINE_END - 1, hour));
                        const clampedMinute = (isOutOfViewTop || isOutOfViewBottom) ? 0 : minute;
                        const top = (clampedHour - TIMELINE_START) * HOUR_HEIGHT + (clampedMinute / 60) * HOUR_HEIGHT;
                        const durationHrs = (job.estimatedDuration ?? 60) / 60;
                        const height = Math.max(durationHrs * HOUR_HEIGHT - 4, 30);
                        const sc = getStatusColor(job.status);
                        const isBeingDragged = draggingJobId === job.id;
                        const isEquipDragOver = equipDragOverJobId === job.id;
                        const assignedWorker = worker;
                        const timeLabel = formatJobTime(job.scheduledTime, job.scheduledAt);
                        const endHour = hour + durationHrs;
                        const endMinute = Math.round((durationHrs % 1) * 60);
                        const endLabel = `${endHour > 12 ? endHour - 12 : endHour}:${endMinute.toString().padStart(2,"0")} ${endHour >= 12 ? "PM" : "AM"}`;

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
                            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setEquipDragOverJobId(job.id); }}
                            onDragLeave={() => setEquipDragOverJobId(null)}
                            onDrop={e => handleJobBlockDrop(job.id, e)}
                            onClick={e => { e.stopPropagation(); onJobClick(job.id); }}
                            className={`absolute left-1 right-1 rounded overflow-hidden cursor-pointer transition-all
                              ${sc.bg}
                              ${isBeingDragged ? "opacity-40" : "opacity-100"}
                              ${isEquipDragOver ? "ring-2 ring-blue-400 ring-inset" : "hover:brightness-95 active:scale-[0.98]"}`}
                            style={{ top: top + 2, height }}
                          >
                            <div className="px-1.5 py-1 flex flex-col h-full">
                              {(isOutOfViewTop || isOutOfViewBottom) && (
                                <div className="text-[9px] font-bold text-muted-foreground mb-0.5">
                                  {isOutOfViewTop ? "▲ before 6am" : "▼ after 8pm"}
                                </div>
                              )}
                              <p className="text-[11px] font-bold truncate leading-tight">{job.title}</p>
                              {height > 36 && job.client?.name && (
                                <p className={`text-[10px] font-medium truncate ${sc.text}`}>{job.client.name}</p>
                              )}
                              {height > 50 && (
                                <p className="text-[10px] text-muted-foreground/80 truncate mt-auto">{timeLabel}</p>
                              )}
                              {/* Equipment chips — sourced from resources.deployedEquipment map */}
                              {height > 60 && (jobEquipmentMap?.get(job.id)?.length ?? 0) > 0 && (
                                <div className="flex flex-wrap gap-0.5 mt-0.5">
                                  {(jobEquipmentMap!.get(job.id)!).slice(0, 2).map(eq => (
                                    <span key={eq.equipmentId} className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-black/10 dark:bg-white/10 text-[8px] font-medium truncate max-w-[70px]">
                                      <Truck className="h-2 w-2 flex-shrink-0" />
                                      {eq.equipmentName}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
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
                  <div className="h-12 flex items-center px-2 border-b bg-muted/10 sticky top-0 z-10">
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
                          className={`rounded px-2 py-1.5 cursor-pointer ${sc.bg} hover:brightness-95`}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: sc.solid }} />
                            <p className="text-[11px] font-semibold truncate">{job.title}</p>
                          </div>
                          <p className={`text-[10px] truncate ${sc.text} pl-3`}>{job.client?.name ?? "—"}</p>
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
        </div>
      </div>

      {/* Materials panel */}
      {showMaterials && (
        <div className="w-[220px] max-w-[220px] border-l flex flex-col flex-shrink-0">
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

      {/* Empty cell popover */}
      {cellPopover && (
        <EmptyCellPopover
          open={!!cellPopover}
          onClose={() => setCellPopover(null)}
          anchorStyle={cellPopover.style}
          allJobs={allJobs}
          onSelectJob={(jobId) => {
            onAssignJobToSlot(jobId, cellPopover.memberId, cellPopover.hour);
          }}
          onCreateJob={() => onCreateJob(cellPopover.memberId, cellPopover.hour)}
        />
      )}
    </div>
  );
}

/** Returns true if the phase is scheduled on the given day. */
function phaseOnDate(phase: DispatchPhase, day: Date): boolean {
  if (!phase.scheduledStart) return false;
  const start = startOfDay(parseISO(phase.scheduledStart));
  const end = phase.scheduledEnd ? startOfDay(parseISO(phase.scheduledEnd)) : start;
  const d = startOfDay(day);
  return d >= start && d <= end;
}

function WeekView({
  weekStart,
  jobs,
  allJobs,
  workers,
  selectedWorkerIds,
  leaveRecords,
  onJobClick,
  onCreateJob,
  onReschedule,
  onAssignJobToSlot,
  onEquipmentAssign,
}: {
  weekStart: Date;
  jobs: DispatchJob[];
  allJobs: DispatchJob[];
  workers: TeamMember[];
  selectedWorkerIds: string[];
  leaveRecords: LeaveRecord[];
  onJobClick: (id: string) => void;
  onCreateJob: (memberId?: string, date?: Date) => void;
  onReschedule: (jobId: string, memberId: string, date: Date) => void;
  onAssignJobToSlot: (jobId: string, memberId: string, date: Date) => void;
  onEquipmentAssign?: (equipmentId: string, jobId: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const [dragOverCell, setDragOverCell] = useState<{ wid: string; dayStr: string } | null>(null);
  const [draggingJobId, setDraggingJobId] = useState<string | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<DispatchPhase | null>(null);
  const [phasePopoverAnchor, setPhasePopoverAnchor] = useState<{ x: number; y: number } | null>(null);
  const [cellPopover, setCellPopover] = useState<{ wid: string; day: Date; style: React.CSSProperties } | null>(null);
  const [equipDragOverJobId, setEquipDragOverJobId] = useState<string | null>(null);

  const { data: phases = [] } = useQuery<DispatchPhase[]>({
    queryKey: ["/api/dispatch/phases"],
    staleTime: 2 * 60 * 1000,
  });

  const filteredWorkers = useMemo(() => {
    if (selectedWorkerIds.length === 0) return workers;
    return workers.filter(w => selectedWorkerIds.includes(w.memberId || w.id));
  }, [workers, selectedWorkerIds]);

  const handleWeekDrop = useCallback((wid: string, day: Date, e: React.DragEvent) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("jobId");
    const equipmentId = e.dataTransfer.getData("equipmentId");

    if (equipmentId) {
      // Equipment dropped into week cell — find a job in that day/worker slot
      const dayJobs = jobs.filter(j => {
        if (!jobOnDate(j, day)) return false;
        const assignee = j.assignedTo ?? primaryAssignment(j)?.memberId;
        return assignee === wid;
      });
      if (dayJobs.length > 0 && onEquipmentAssign) {
        onEquipmentAssign(equipmentId, dayJobs[0].id);
      }
      setDragOverCell(null);
      return;
    }

    if (jobId) onReschedule(jobId, wid, day);
    setDragOverCell(null);
    setDraggingJobId(null);
  }, [onReschedule, jobs, onEquipmentAssign]);

  const handlePhaseClick = useCallback((phase: DispatchPhase, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPhase(phase);
    setPhasePopoverAnchor({ x: e.clientX, y: e.clientY });
  }, []);

  const closePhasePopover = useCallback(() => {
    setSelectedPhase(null);
    setPhasePopoverAnchor(null);
  }, []);

  const phaseStatusLabel: Record<string, string> = {
    not_started: "Not started",
    in_progress: "In progress",
    complete: "Complete",
    on_hold: "On hold",
  };

  const WEEK_MAX_VISIBLE_CHIPS = 2;

  return (
    <ScrollArea className="flex-1">
      <div className="min-w-[900px]">
        {/* Day headers */}
        <div className="grid grid-cols-[160px_repeat(7,1fr)] border-b sticky top-0 z-10 bg-background">
          <div className="px-2 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Worker</div>
          {days.map(day => (
            <div key={day.toISOString()} className={`px-2 py-2 text-center border-l ${isToday(day) ? "bg-primary/5" : ""}`}>
              <p className={`text-xs font-bold ${isToday(day) ? "text-primary" : "text-foreground"}`}>
                {format(day, "EEE d")}
              </p>
              {isToday(day) && (
                <div className="mt-0.5 mx-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </div>
          ))}
        </div>

        {/* Worker rows */}
        {filteredWorkers.map(worker => {
          const wid = worker.memberId || worker.id;
          return (
            <div key={wid} className="grid grid-cols-[160px_repeat(7,1fr)] border-b" style={{ minHeight: 64 }}>
              {/* Worker label */}
              <div className="px-2 py-1.5 flex items-center gap-1.5 border-r bg-muted/10" style={{ width: 160 }}>
                <UserAvatar
                  user={{ id: wid, firstName: worker.firstName, lastName: worker.lastName, photoUrl: worker.profileImageUrl, themeColor: worker.themeColor }}
                  className="h-7 w-7 text-[10px] flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold truncate">{memberName(worker)}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{worker.roleName}</p>
                </div>
              </div>

              {/* Day cells */}
              {days.map(day => {
                const dayStr = day.toISOString();
                const isOver = dragOverCell?.wid === wid && dragOverCell?.dayStr === dayStr;
                const onLeave = workerOnLeaveForDate(leaveRecords, wid, day);
                const leaveLabel = onLeave ? workerLeaveLabel(leaveRecords, wid, day) : null;
                const dayJobs = jobs.filter(j => {
                  if (!jobOnDate(j, day)) return false;
                  const assignee = j.assignedTo ?? primaryAssignment(j)?.memberId;
                  return assignee === wid;
                });
                const dayPhases = phases.filter(p => phaseOnDate(p, day) && phaseForWorker(p, wid));
                const visibleChips = dayJobs.slice(0, WEEK_MAX_VISIBLE_CHIPS);
                const overflowCount = dayJobs.length - WEEK_MAX_VISIBLE_CHIPS;
                return (
                  <div
                    key={dayStr}
                    className={`border-l p-1 relative group transition-colors cursor-pointer ${
                      isToday(day) ? "bg-primary/[0.03]" : ""
                    } ${isOver ? "bg-primary/10 ring-inset ring-1 ring-primary/30" : "hover:bg-muted/20"} ${
                      onLeave ? "bg-slate-100/60 dark:bg-slate-800/30" : ""
                    }`}
                    style={{ minHeight: 64 }}
                    onDragOver={e => { e.preventDefault(); setDragOverCell({ wid, dayStr }); }}
                    onDragLeave={() => setDragOverCell(null)}
                    onDrop={e => handleWeekDrop(wid, day, e)}
                    onClick={e => {
                      if (dayJobs.length === 0 && dayPhases.length === 0) {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const top = Math.min(e.clientY + 8, window.innerHeight - 340);
                        const left = Math.min(e.clientX + 8, window.innerWidth - 276);
                        setCellPopover({ wid, day, style: { top, left } });
                      }
                    }}
                  >
                    {/* Leave indicator */}
                    {onLeave && (
                      <>
                        <div className="absolute inset-0 pointer-events-none"
                          style={{ background: "repeating-linear-gradient(135deg,transparent,transparent 6px,rgba(148,163,184,0.1) 6px,rgba(148,163,184,0.1) 12px)" }}
                        />
                        <div className="relative z-10 mb-0.5">
                          <span className="text-[8px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            {leaveLabel ?? "On Leave"}
                          </span>
                        </div>
                      </>
                    )}
                    {/* Job chips */}
                    {visibleChips.map(job => {
                      const sc = getStatusColor(job.status);
                      const timeLabel = formatJobTime(job.scheduledTime, job.scheduledAt);
                      return (
                        <div
                          key={job.id}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData("jobId", job.id);
                            setDraggingJobId(job.id);
                          }}
                          onDragEnd={() => setDraggingJobId(null)}
                          onDragOver={e => { e.preventDefault(); e.stopPropagation(); setEquipDragOverJobId(job.id); }}
                          onDragLeave={() => setEquipDragOverJobId(null)}
                          onDrop={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            const equipmentId = e.dataTransfer.getData("equipmentId");
                            if (equipmentId && onEquipmentAssign) {
                              onEquipmentAssign(equipmentId, job.id);
                            }
                            setEquipDragOverJobId(null);
                          }}
                          onClick={e => { e.stopPropagation(); onJobClick(job.id); }}
                          className={`rounded-sm mb-0.5 cursor-pointer overflow-hidden
                            ${sc.bg} hover:brightness-95
                            ${draggingJobId === job.id ? "opacity-40" : ""}
                            ${equipDragOverJobId === job.id ? "ring-1 ring-blue-400" : ""}`}
                          title={`${job.title}${job.client?.name ? ` — ${job.client.name}` : ""} ${timeLabel}`}
                        >
                          <div className="px-1.5 py-0.5">
                            <div className="flex items-center gap-1">
                              <p className="text-[10px] font-semibold truncate flex-1">{job.title}</p>
                            </div>
                            {job.client?.name && (
                              <p className="text-[9px] text-muted-foreground truncate">{job.client.name}</p>
                            )}
                            <p className={`text-[9px] truncate ${sc.text}`}>{timeLabel}</p>
                          </div>
                        </div>
                      );
                    })}
                    {overflowCount > 0 && (
                      <div
                        className="rounded px-1.5 py-0.5 bg-muted text-[10px] text-muted-foreground font-semibold cursor-pointer hover:bg-muted/80 text-center"
                        onClick={e => { e.stopPropagation(); onJobClick(dayJobs[WEEK_MAX_VISIBLE_CHIPS].id); }}
                      >
                        +{overflowCount} more
                      </div>
                    )}
                    {/* Phase blocks */}
                    {dayPhases.map(phase => (
                      <div
                        key={phase.id}
                        data-testid={`week-phase-${phase.id}`}
                        onClick={e => { e.stopPropagation(); handlePhaseClick(phase, e); }}
                        className="rounded-sm px-1.5 py-0.5 mb-0.5
                          bg-indigo-50 dark:bg-indigo-900/30 hover:brightness-95 cursor-pointer overflow-hidden"
                        title={`${phase.phaseCode}: ${phase.name} — ${phase.jobTitle}`}
                      >
                        <p className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide truncate">
                          Phase
                        </p>
                        <p className="text-[10px] font-semibold text-indigo-800 dark:text-indigo-200 truncate">
                          {phase.phaseCode ? `${phase.phaseCode}: ` : ""}{phase.name}
                        </p>
                        {(phase.assignedUsers?.length ?? 0) > 0 && (
                          <p className="text-[9px] text-indigo-600 dark:text-indigo-400 truncate">
                            {(phase.assignedUsers ?? []).map(u => u.name.split(" ")[0]).join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                    {/* Drop hint for empty cells */}
                    {dayJobs.length === 0 && dayPhases.length === 0 && !onLeave && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <Plus className="h-3.5 w-3.5 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Phase detail popover (fixed position, read-only) */}
      {selectedPhase && phasePopoverAnchor && (
        <div
          className="fixed inset-0 z-50"
          onClick={closePhasePopover}
        >
          <div
            className="absolute bg-popover border rounded-lg shadow-lg p-3 w-64 z-50"
            style={{
              top: Math.min(phasePopoverAnchor.y + 8, window.innerHeight - 220),
              left: Math.min(phasePopoverAnchor.x + 8, window.innerWidth - 272),
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                  Phase
                </p>
                <p className="text-sm font-semibold truncate">{selectedPhase.phaseCode}: {selectedPhase.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{selectedPhase.jobTitle}</p>
              </div>
              <button onClick={closePhasePopover} className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">
                  {phaseStatusLabel[selectedPhase.status] ?? selectedPhase.status.replace(/_/g, " ")}
                </span>
              </div>
              {selectedPhase.bookedHours && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Booked hours</span>
                  <span className="font-medium">{selectedPhase.bookedHours}h</span>
                </div>
              )}
              {selectedPhase.scheduledStart && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Start</span>
                  <span className="font-medium">{format(parseISO(selectedPhase.scheduledStart), "d MMM yyyy")}</span>
                </div>
              )}
              {selectedPhase.scheduledEnd && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">End</span>
                  <span className="font-medium">{format(parseISO(selectedPhase.scheduledEnd), "d MMM yyyy")}</span>
                </div>
              )}
              {(selectedPhase.assignedUsers?.length ?? 0) > 0 && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-muted-foreground flex-shrink-0">Assigned</span>
                  <span className="font-medium text-right truncate">
                    {(selectedPhase.assignedUsers ?? []).map(u => u.name).join(", ")}
                  </span>
                </div>
              )}
              {(selectedPhase.notes ?? selectedPhase.description) && (
                <p className="text-muted-foreground italic pt-1 border-t text-[11px] leading-relaxed line-clamp-3">
                  {selectedPhase.notes ?? selectedPhase.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty cell popover */}
      {cellPopover && (
        <EmptyCellPopover
          open={!!cellPopover}
          onClose={() => setCellPopover(null)}
          anchorStyle={cellPopover.style}
          allJobs={allJobs}
          onSelectJob={(jobId) => {
            onAssignJobToSlot(jobId, cellPopover.wid, cellPopover.day);
          }}
          onCreateJob={() => onCreateJob(cellPopover.wid, cellPopover.day)}
        />
      )}
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
        <div className="px-4 py-1.5 border-b flex items-center gap-2 bg-muted/10">
          <button
            onClick={onToggleTerminal}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
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
            className={`flex flex-col w-72 flex-shrink-0 rounded-lg border border-t-0 border-t-4 ${col.headerColor} ${
              dragOverCol === col.key ? "ring-2 ring-primary/30" : ""
            } overflow-hidden`}
            onDragOver={e => { e.preventDefault(); setDragOverCol(col.key); }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={() => handleDrop(col.key)}
          >
            {/* Column header */}
            <div className={`px-3 py-2.5 ${col.bg} border-b`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{col.label}</p>
                <Badge variant="secondary" className="text-xs h-5 ml-auto min-w-[1.25rem] text-center">{columnJobs[col.key]?.length ?? 0}</Badge>
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
                      className={`bg-card rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow overflow-hidden flex
                        ${dragState?.jobId === job.id ? "opacity-40" : ""}`}
                    >
                      {/* Left status stripe */}
                      <div className="w-1 flex-shrink-0" style={{ background: sc.solid }} />
                      {/* Card content */}
                      <div className="p-3 flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-bold leading-tight flex-1 truncate">{job.title}</p>
                          {job.priority && job.priority !== "normal" && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 capitalize flex-shrink-0">{job.priority}</Badge>
                          )}
                        </div>

                        {job.client?.name && (
                          <p className="text-[11px] text-muted-foreground mb-1.5 truncate font-medium">{job.client.name}</p>
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
                          <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/40">
                            <UserAvatar
                              user={{ id: worker.memberId || worker.id, firstName: worker.firstName, lastName: worker.lastName, photoUrl: worker.profileImageUrl, themeColor: worker.themeColor }}
                              className="h-5 w-5 text-[9px] flex-shrink-0"
                            />
                            <span className="text-[11px] text-muted-foreground truncate">{memberName(worker)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {(columnJobs[col.key] ?? []).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40 gap-2">
                    <CalendarCheck className="h-7 w-7" />
                    <p className="text-xs">No jobs</p>
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
  leaveRecords,
  leaveRangeStart,
  leaveRangeEnd,
  onWorkerToggle,
  onClose,
  allDayJobs,
  workerStates,
  embedded,
  defaultTab,
  onEquipmentUnassign,
}: {
  workers: TeamMember[];
  resources?: DispatchResources;
  selectedWorkerIds: string[];
  leaveRecords: LeaveRecord[];
  leaveRangeStart: Date;
  leaveRangeEnd: Date;
  onWorkerToggle: (id: string) => void;
  onClose: () => void;
  allDayJobs?: DispatchJob[];
  workerStates?: WorkerState[];
  embedded?: boolean;
  defaultTab?: "workers" | "equipment" | "materials" | "capacity";
  onEquipmentUnassign?: (assignmentId: string, jobId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"workers" | "equipment" | "materials" | "capacity">(defaultTab ?? "workers");
  const [draggingEquipId, setDraggingEquipId] = useState<string | null>(null);

  const workerStateMap = useMemo(() => {
    const m = new Map<string, WorkerState>();
    (workerStates ?? []).forEach(ws => m.set(ws.userId, ws));
    return m;
  }, [workerStates]);

  const workerLoadMap = useMemo(() => {
    const m = new Map<string, number>();
    workers.forEach(w => m.set(w.memberId || w.id, 0));
    (allDayJobs ?? []).forEach(j => {
      const wid = j.assignedTo ?? primaryAssignment(j)?.memberId;
      if (wid && m.has(wid)) {
        m.set(wid, (m.get(wid) ?? 0) + (j.estimatedDuration ?? 60));
      }
    });
    return m;
  }, [workers, allDayJobs]);

  const tabs = [
    { key: "workers" as const,   label: "Workers",   icon: Users },
    { key: "equipment" as const, label: "Equipment", icon: Wrench },
    { key: "materials" as const, label: "Materials", icon: Package },
    { key: "capacity" as const,  label: "Capacity",  icon: Timer },
  ];

  return (
    <div className={embedded ? "flex flex-col flex-1 overflow-hidden" : "w-64 border-l flex flex-col flex-shrink-0 bg-card"}>
      {/* Tab bar */}
      <div className="flex items-center border-b px-1 pt-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex flex-col items-center py-1.5 gap-0.5 text-[10px] font-medium rounded-t transition-colors
                ${activeTab === tab.key ? "bg-background text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
        <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground ml-1 flex-shrink-0">
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
              const onLeave = workerOnLeaveInRange(leaveRecords, wid, leaveRangeStart, leaveRangeEnd);
              const leaveLabel = onLeave ? workerLeaveLabel(leaveRecords, wid, leaveRangeStart) : null;
              return (
                <button
                  key={wid}
                  onClick={() => onWorkerToggle(wid)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-left
                    ${isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"}
                    ${onLeave ? "opacity-70" : ""}`}
                >
                  <UserAvatar
                    user={{ id: wid, firstName: worker.firstName, lastName: worker.lastName, photoUrl: worker.profileImageUrl, themeColor: worker.themeColor }}
                    className="h-6 w-6 text-[10px] flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{memberName(worker)}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      <p className="text-[10px] text-muted-foreground truncate">{worker.roleName}</p>
                      {onLeave && (
                        <span className="text-[9px] font-semibold px-1 py-0 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 flex-shrink-0">
                          {leaveLabel ?? "On Leave"}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check className="h-3 w-3 flex-shrink-0 text-primary" />}
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
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium truncate">{eq.equipmentName}</p>
                      {eq.jobTitle && (
                        <p className="text-[10px] text-muted-foreground truncate">{eq.jobTitle}</p>
                      )}
                    </div>
                    {eq.jobId && onEquipmentUnassign && (
                      <button
                        onClick={() => onEquipmentUnassign(eq.assignmentId, eq.jobId!)}
                        className="text-muted-foreground hover:text-destructive flex-shrink-0 p-0.5 rounded hover:bg-destructive/10"
                        title="Unlink from job"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Available — with drag handles */}
                {(resources?.allEquipment ?? []).filter(e => !e.isDeployed).length > 0 && (
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-2">
                    Available — drag onto a job
                  </p>
                )}
                {(resources?.allEquipment ?? []).filter(e => !e.isDeployed).map(eq => (
                  <div
                    key={eq.id}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData("equipmentId", eq.id);
                      e.dataTransfer.setData("equipmentName", eq.name);
                      setDraggingEquipId(eq.id);
                    }}
                    onDragEnd={() => setDraggingEquipId(null)}
                    className={`flex items-start gap-2 px-2 py-1.5 rounded bg-green-50 dark:bg-green-950/20 cursor-grab active:cursor-grabbing transition-opacity
                      ${draggingEquipId === eq.id ? "opacity-40" : ""}`}
                  >
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                    <div className="w-4 h-4 rounded bg-green-200 dark:bg-green-800 flex items-center justify-center flex-shrink-0 mt-0.5">
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

        {/* Capacity tab */}
        {activeTab === "capacity" && (
          <div className="p-2 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 pt-1">
              Team capacity today
            </p>
            {workers.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Users className="h-7 w-7 mb-2 opacity-30" />
                <p className="text-xs">No workers</p>
              </div>
            ) : (
              workers.map(worker => {
                const wid = worker.memberId || worker.id;
                const loadMin = workerLoadMap.get(wid) ?? 0;
                const loadH = Math.round(loadMin / 60 * 10) / 10;
                const capacityH = 8;
                const pct = Math.min((loadH / capacityH) * 100, 100);
                const isOver = loadH > capacityH;
                const jobCount = (allDayJobs ?? []).filter(j => {
                  const assignee = j.assignedTo ?? primaryAssignment(j)?.memberId;
                  return assignee === wid;
                }).length;
                const ws = workerStateMap.get(wid);
                const stateCfg = ws ? (WORKER_STATE_LABELS[ws.state] ?? { label: ws.state, color: "bg-muted-foreground" }) : null;

                return (
                  <div
                    key={wid}
                    className={`px-2 py-2 rounded border ${isOver ? "border-red-400/50 bg-red-50 dark:bg-red-950/20" : "border-transparent hover:bg-muted/30"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <UserAvatar
                        user={{ id: wid, firstName: worker.firstName, lastName: worker.lastName, photoUrl: worker.profileImageUrl, themeColor: worker.themeColor }}
                        className="h-5 w-5 text-[9px] flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium truncate">{memberName(worker)}</p>
                      </div>
                      {stateCfg && (
                        <span className={`flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium text-white ${stateCfg.color}`}>
                          {stateCfg.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground">{jobCount} job{jobCount !== 1 ? "s" : ""}</span>
                      <span className={`text-[10px] font-medium ${isOver ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                        {loadH}h / {capacityH}h
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

const MAP_TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

function phaseOnDay(phase: DispatchPhase, day: Date): boolean {
  if (!phase.scheduledStart || !phase.scheduledEnd) return false;
  const dayStr = format(day, "yyyy-MM-dd");
  const start = phase.scheduledStart.slice(0, 10);
  const end = phase.scheduledEnd.slice(0, 10);
  return dayStr >= start && dayStr <= end;
}
type ViewMode = "day" | "week" | "kanban" | "map" | "job";

export default function AdvancedDispatch() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // View state — initialise from URL params so deep links work.
  const [view, setView] = useState<ViewMode>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get("view");
      if (v === "job") return "job";
    } catch { /* ignore */ }
    return "day";
  });
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const dp = params.get("date");
      if (dp) {
        const parsed = parseISO(dp);
        if (isValid(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    return new Date();
  });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("jobId") ?? null;
    } catch { /* ignore */ }
    return null;
  });
  const [jobPickerSearch, setJobPickerSearch] = useState("");
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showMaterials, setShowMaterials] = useState(true);

  // ── Full-screen mode ──────────────────────────────────────────
  const [isFullScreen, setIsFullScreen] = useState<boolean>(() => {
    try { return sessionStorage.getItem("dispatch-fullscreen") === "1"; } catch { return false; }
  });

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => {
      const next = !prev;
      try { sessionStorage.setItem("dispatch-fullscreen", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, []);

  useEffect(() => {
    if (isFullScreen) {
      document.body.classList.add("dispatch-fullscreen");
    } else {
      document.body.classList.remove("dispatch-fullscreen");
    }
    return () => {
      document.body.classList.remove("dispatch-fullscreen");
    };
  }, [isFullScreen]);

  // F key shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "f" && e.key !== "F") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      toggleFullScreen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleFullScreen]);

  // Escape key exits full-screen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) toggleFullScreen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullScreen, toggleFullScreen]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [jobTypeFilter, setJobTypeFilter] = useState<"all" | "service" | "project">("all");
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Kanban completed-jobs toggle
  const [showKanbanTerminal, setShowKanbanTerminal] = useState(false);

  // Week navigation
  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);

  // ── Sync URL params when view / selectedJobId change ──────────
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (view === "job") {
        params.set("view", "job");
        if (selectedJobId) params.set("jobId", selectedJobId);
        else params.delete("jobId");
      } else {
        params.delete("view");
        params.delete("jobId");
      }
      const newSearch = params.toString();
      const newUrl = newSearch
        ? `${window.location.pathname}?${newSearch}`
        : window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    } catch { /* ignore */ }
  }, [view, selectedJobId]);

  // ── Data fetching ─────────────────────────────────────────────
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

  const { data: workerStates = [] } = useQuery<WorkerState[]>({
    queryKey: ["/api/team/worker-states"],
    refetchInterval: 30_000,
  });

  const { data: allPhases = [] } = useQuery<DispatchPhase[]>({
    queryKey: ["/api/dispatch/phases"],
    staleTime: 60_000,
    enabled: view === "job",
  });

  const leaveStartDate = (view === "week" || view === "job")
    ? format(weekStart, "yyyy-MM-dd")
    : format(currentDate, "yyyy-MM-dd");
  const leaveEndDate = (view === "week" || view === "job")
    ? format(addDays(weekStart, 6), "yyyy-MM-dd")
    : format(currentDate, "yyyy-MM-dd");

  const leaveUrl = `/api/dispatch/leave?startDate=${leaveStartDate}&endDate=${leaveEndDate}`;
  const { data: leaveRecords = [] } = useQuery<LeaveRecord[]>({
    queryKey: [leaveUrl],
    staleTime: 60_000,
  });

  // ── Mutations ─────────────────────────────────────────────────
  const updateJobMutation = useMutation({
    mutationFn: async (payload: { jobId: string; status?: string; workerStatus?: string; scheduledAt?: string; scheduledTime?: string; assignedTo?: string }) => {
      const { jobId, ...body } = payload;
      return apiRequest("PATCH", `/api/jobs/${jobId}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch/board"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job updated" });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const equipmentAssignMutation = useMutation({
    mutationFn: async ({ equipmentId, jobId }: { equipmentId: string; jobId: string }) => {
      return apiRequest("POST", `/api/jobs/${jobId}/equipment`, { equipmentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch/board"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch/resources"] });
      toast({ title: "Equipment assigned to job" });
    },
    onError: (err: any) => {
      toast({ title: "Equipment assignment failed", description: err.message, variant: "destructive" });
    },
  });

  const equipmentUnassignMutation = useMutation({
    mutationFn: async ({ assignmentId, jobId }: { assignmentId: string; jobId: string }) => {
      return apiRequest("DELETE", `/api/jobs/${jobId}/equipment/${assignmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch/board"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/dispatch/resources"] });
      toast({ title: "Equipment unlinked from job" });
    },
    onError: (err: any) => {
      toast({ title: "Unlink failed", description: err.message, variant: "destructive" });
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
      ...(memberId ? { assignedTo: memberId } : {}),
    });
  }, [currentDate, updateJobMutation]);

  const handleWeekReschedule = useCallback((jobId: string, memberId: string, date: Date) => {
    const job = dispatchJobs.find(j => j.id === jobId);
    const dateStr = format(date, "yyyy-MM-dd");
    updateJobMutation.mutate({
      jobId,
      scheduledAt: dateStr,
      ...(job?.scheduledTime ? { scheduledTime: job.scheduledTime } : {}),
      ...(memberId ? { assignedTo: memberId } : {}),
    });
  }, [dispatchJobs, updateJobMutation]);

  /** Assign an existing job to a day-view slot (from the empty-cell picker) */
  const handleAssignJobToSlotDay = useCallback((jobId: string, memberId: string, hour: number) => {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const timeStr = `${hour.toString().padStart(2, "0")}:00`;
    updateJobMutation.mutate({ jobId, scheduledAt: dateStr, scheduledTime: timeStr, assignedTo: memberId });
  }, [currentDate, updateJobMutation]);

  /** Assign an existing job to a week-view slot (from the empty-cell picker) */
  const handleAssignJobToSlotWeek = useCallback((jobId: string, memberId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    updateJobMutation.mutate({ jobId, scheduledAt: dateStr, assignedTo: memberId });
  }, [updateJobMutation]);

  const handleStatusChange = useCallback((jobId: string, status?: string, workerStatus?: string) => {
    updateJobMutation.mutate({ jobId, status, workerStatus });
  }, [updateJobMutation]);

  const handleWorkerToggle = useCallback((wid: string) => {
    setSelectedWorkerIds(prev =>
      prev.includes(wid) ? prev.filter(id => id !== wid) : [...prev, wid],
    );
  }, []);

  const handleEquipmentAssign = useCallback((equipmentId: string, jobId: string) => {
    equipmentAssignMutation.mutate({ equipmentId, jobId });
  }, [equipmentAssignMutation]);

  const handleEquipmentUnassign = useCallback((assignmentId: string, jobId: string) => {
    equipmentUnassignMutation.mutate({ assignmentId, jobId });
  }, [equipmentUnassignMutation]);

  // ── Navigation ────────────────────────────────────────────────
  const navPrev = () => {
    if (view === "day" || view === "map") setCurrentDate(d => subDays(d, 1));
    else if (view === "week" || view === "job") setCurrentDate(d => subWeeks(d, 1));
  };
  const navNext = () => {
    if (view === "day" || view === "map") setCurrentDate(d => addDays(d, 1));
    else if (view === "week" || view === "job") setCurrentDate(d => addWeeks(d, 1));
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
      result = result.filter(j => {
        const wid = j.assignedTo ?? primaryAssignment(j)?.memberId;
        return !!wid && selectedWorkerIds.includes(wid);
      });
    }
    return result;
  }, [dispatchJobs, searchQuery, jobTypeFilter, selectedWorkerIds, view]);

  // ── Period label ──────────────────────────────────────────────
  const periodLabel = useMemo(() => {
    if (view === "day" || view === "map") return format(currentDate, "EEEE, d MMMM yyyy");
    if (view === "week" || view === "job") return `${format(weekStart, "d MMM")} – ${format(addDays(weekStart, 6), "d MMM yyyy")}`;
    return "All jobs";
  }, [view, currentDate, weekStart]);

  // ── Unscheduled jobs + capacity computations ───────────────────
  const unscheduledJobs = useMemo(() =>
    dispatchJobs.filter(j =>
      !j.scheduledAt && ["pending", "scheduled"].includes(j.status?.toLowerCase() ?? "")
    ),
    [dispatchJobs],
  );

  const allDayJobs = useMemo(() => {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    return dispatchJobs.filter(j => {
      if (!j.scheduledAt) return false;
      try { return format(parseISO(j.scheduledAt), "yyyy-MM-dd") === dateStr; }
      catch { return false; }
    });
  }, [dispatchJobs, currentDate]);

  const overCapacityWorkerIds = useMemo(() => {
    const capacityH = 8;
    const loadMap = new Map<string, number>();
    workers.forEach(w => loadMap.set(w.memberId || w.id, 0));
    allDayJobs.forEach(j => {
      const wid = j.assignedTo ?? primaryAssignment(j)?.memberId;
      if (wid && loadMap.has(wid)) {
        loadMap.set(wid, (loadMap.get(wid) ?? 0) + (j.estimatedDuration ?? 60));
      }
    });
    const over = new Set<string>();
    loadMap.forEach((min, wid) => { if (min / 60 > capacityH) over.add(wid); });
    return over;
  }, [workers, allDayJobs]);

  /** Map from jobId → deployed equipment items (sourced from resources, not the board response) */
  const jobEquipmentMap = useMemo(() => {
    const m = new Map<string, DeployedEquipmentItem[]>();
    (resources?.deployedEquipment ?? []).forEach(eq => {
      if (eq.jobId) {
        const arr = m.get(eq.jobId) ?? [];
        arr.push(eq);
        m.set(eq.jobId, arr);
      }
    });
    return m;
  }, [resources?.deployedEquipment]);

  // ── Handle assign from unscheduled queue ──────────────────────
  const handleQueueAssign = useCallback((jobId: string, workerId: string, hour: number) => {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const timeStr = `${hour.toString().padStart(2, "0")}:00`;
    updateJobMutation.mutate({ jobId, scheduledAt: dateStr, scheduledTime: timeStr, assignedTo: workerId });
  }, [currentDate, updateJobMutation]);

  const isLoading = jobsLoading || workersLoading;

  const VIEW_BUTTONS: { key: ViewMode; label: string; icon: React.ElementType }[] = [
    { key: "day",    label: "Day",    icon: CalendarDays },
    { key: "week",   label: "Week",   icon: CalendarIcon },
    { key: "kanban", label: "Kanban", icon: Columns3 },
    { key: "map",    label: "Map",    icon: MapIcon },
    { key: "job",    label: "Job",    icon: Layers },
  ];

  // Job picker filtered list
  const jobPickerJobs = useMemo(() => {
    const q = jobPickerSearch.trim().toLowerCase();
    if (!q) return dispatchJobs.slice(0, 20);
    return dispatchJobs
      .filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.client?.name?.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [dispatchJobs, jobPickerSearch]);

  return (
    <div className="w-full max-w-full flex flex-col h-screen overflow-hidden bg-background" data-testid="dispatch-board">
      {/* Full-screen CSS: hide app sidebar + header when dispatch-fullscreen class is active */}
      <style>{`
        body.dispatch-fullscreen [data-app-sidebar],
        body.dispatch-fullscreen [data-app-header],
        body.dispatch-fullscreen nav[aria-label="sidebar"],
        body.dispatch-fullscreen aside[data-sidebar],
        body.dispatch-fullscreen [data-slot="sidebar"]:not([data-mobile="true"]),
        body.dispatch-fullscreen header:not([data-dispatch-toolbar]) {
          display: none !important;
        }
        body.dispatch-fullscreen [data-testid="dispatch-board"] {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: hsl(var(--background));
        }
      `}</style>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* ── Top bar ── */}
        <div className="border-b flex-shrink-0 px-3 py-1.5 flex items-center gap-2 flex-wrap bg-background/95 backdrop-blur-sm" data-dispatch-toolbar>
          <h1 className="sr-only">Dispatch</h1>

          {/* View tabs — pill strip */}
          <div className="flex items-center gap-0 rounded-lg border bg-muted/40 p-0.5 flex-shrink-0">
            {VIEW_BUTTONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all
                  ${view === key
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Date navigation */}
          {view !== "kanban" && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={navPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {view !== "map" ? (
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs font-medium px-2 gap-1.5 max-w-[260px] truncate">
                      <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{periodLabel}</span>
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
              ) : (
                <Button variant="ghost" size="sm" className="h-7 text-xs font-medium px-2 max-w-[260px] truncate">
                  {periodLabel}
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={navNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isToday(currentDate) && (
                <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 text-muted-foreground" onClick={navToday}>
                  Today
                </Button>
              )}
            </div>
          )}

          {view === "kanban" && (
            <span className="text-sm font-medium text-muted-foreground flex-shrink-0">All Jobs</span>
          )}

          {/* Job picker — shown only in Job view */}
          {view === "job" && (
            <Popover open={jobPickerOpen} onOpenChange={setJobPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 max-w-[220px]">
                  <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {selectedJobId
                      ? (dispatchJobs.find(j => j.id === selectedJobId)?.title ?? "Select job")
                      : "Select job"}
                  </span>
                  <ChevronDown className="h-3 w-3 flex-shrink-0 ml-auto" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="start">
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search jobs or clients..."
                    value={jobPickerSearch}
                    onChange={e => setJobPickerSearch(e.target.value)}
                    className="pl-7 h-7 text-xs"
                    autoFocus
                  />
                </div>
                <ScrollArea className="max-h-60">
                  {jobPickerJobs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No jobs found</p>
                  ) : (
                    <div className="space-y-0.5">
                      {jobPickerJobs.map(j => {
                        const sc = STATUS_COLORS[j.status?.toLowerCase().replace(" ", "_")] ?? STATUS_COLORS.pending;
                        return (
                          <button
                            key={j.id}
                            onClick={() => {
                              setSelectedJobId(j.id);
                              setJobPickerOpen(false);
                              setJobPickerSearch("");
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted/50 flex items-center gap-2
                              ${selectedJobId === j.id ? "bg-primary/10 text-primary" : ""}`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0`} style={{ backgroundColor: sc.solid }} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{j.title}</p>
                              {j.client?.name && (
                                <p className="text-[10px] text-muted-foreground truncate">{j.client.name}</p>
                              )}
                            </div>
                            <Badge variant="outline" className="text-[9px] h-3.5 px-1 capitalize flex-shrink-0">
                              {(j.jobType ?? "service") === "project" ? "Project" : "Service"}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}

          {/* On-Leave alert chip */}
          {view !== "kanban" && view !== "job" && (() => {
            const datesInView = (view === "week")
              ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
              : [currentDate];
            const onLeaveCount = workers.filter(w => {
              const wid = w.memberId || w.id;
              return datesInView.some(d => workerOnLeaveForDate(leaveRecords, wid, d));
            }).length;
            if (onLeaveCount === 0) return null;
            return (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold flex-shrink-0">
                <AlertCircle className="h-3 w-3" />
                {onLeaveCount} On Leave
              </div>
            );
          })()}

          <div className="flex-1" />

          {/* Search */}
          {view !== "job" && (
            <div className="relative flex-shrink-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-7 h-7 text-xs w-40"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Worker filter */}
          {view !== "job" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 flex-shrink-0">
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
          )}

          {/* Job type filter */}
          {view !== "job" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 flex-shrink-0">
                  <Filter className="h-3.5 w-3.5" />
                  {jobTypeFilter === "all" ? "All types" : jobTypeFilter === "service" ? "Service" : "Projects"}
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
          )}

          {/* Materials toggle (day view only) */}
          {view === "day" && (
            <Button
              variant={showMaterials ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs gap-1.5 flex-shrink-0"
              onClick={() => setShowMaterials(v => !v)}
            >
              <Package className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Resource sidebar toggle */}
          {view !== "job" && (
            <Button
              variant={showSidebar ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={() => setShowSidebar(v => !v)}
              title={showSidebar ? "Hide resources & queue" : "Show resources & queue"}
            >
              {showSidebar ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            </Button>
          )}

          {/* Full-screen toggle */}
          <Button
            variant={isFullScreen ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={toggleFullScreen}
            title={isFullScreen ? "Exit full screen (F / Esc)" : "Full screen (F)"}
          >
            {isFullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>

          {/* New job */}
          <Button size="sm" className="h-7 text-xs gap-1.5 flex-shrink-0" onClick={() => handleCreateJob()}>
            <Plus className="h-3.5 w-3.5" />
            New Job
          </Button>
        </div>

        {/* ── Ops alert bar (only when there are issues) ── */}
        <OpsAlertBar />

        {/* ── Main content area ── */}
        <div className="flex flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center" data-testid="dispatch-loading">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : view === "day" ? (
            <DayView
              date={currentDate}
              jobs={filteredJobs}
              allJobs={dispatchJobs}
              workers={workers}
              resources={resources}
              selectedWorkerIds={selectedWorkerIds}
              overCapacityWorkerIds={overCapacityWorkerIds}
              leaveRecords={leaveRecords}
              onJobClick={handleJobClick}
              onCreateJob={handleCreateJob}
              onReschedule={handleReschedule}
              onAssignJobToSlot={handleAssignJobToSlotDay}
              showMaterials={showMaterials}
              onEquipmentAssign={handleEquipmentAssign}
              jobEquipmentMap={jobEquipmentMap}
            />
          ) : view === "week" ? (
            <WeekView
              weekStart={weekStart}
              jobs={filteredJobs}
              allJobs={dispatchJobs}
              workers={workers}
              selectedWorkerIds={selectedWorkerIds}
              leaveRecords={leaveRecords}
              onJobClick={handleJobClick}
              onCreateJob={(mid, date) => handleCreateJob(mid, date ?? undefined)}
              onReschedule={handleWeekReschedule}
              onAssignJobToSlot={handleAssignJobToSlotWeek}
              onEquipmentAssign={handleEquipmentAssign}
            />
          ) : view === "map" ? (
            <MapView
              jobs={dispatchJobs}
              workers={workers}
              date={currentDate}
              selectedWorkerIds={selectedWorkerIds}
              onJobClick={handleJobClick}
              onWorkerToggle={handleWorkerToggle}
            />
          ) : view === "job" ? (
            <JobView
              weekStart={weekStart}
              selectedJobId={selectedJobId}
              allJobs={dispatchJobs}
              jobsLoading={jobsLoading}
              phases={allPhases}
              workers={workers}
              resources={resources}
              allDispatchJobs={dispatchJobs}
              onJobClick={handleJobClick}
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

          {/* Unscheduled queue panel (day view, right side) — hidden when sidebar is hidden */}
          {view === "day" && showSidebar && (
            <div className="w-64 flex-shrink-0 border-l flex flex-col bg-card overflow-hidden">
              <UnscheduledQueuePanel
                jobs={unscheduledJobs}
                workers={workers}
                allDayJobs={allDayJobs}
                onJobClick={handleJobClick}
                onAssign={handleQueueAssign}
              />
              {/* Resource sidebar content embedded in the same column */}
              {showSidebar && (
                <div className="flex-1 overflow-hidden flex flex-col border-t">
                  <ResourceSidebar
                    workers={workers}
                    resources={resources}
                    selectedWorkerIds={selectedWorkerIds}
                    leaveRecords={leaveRecords}
                    leaveRangeStart={currentDate}
                    leaveRangeEnd={currentDate}
                    onWorkerToggle={handleWorkerToggle}
                    onClose={() => setShowSidebar(false)}
                    allDayJobs={allDayJobs}
                    workerStates={workerStates}
                    embedded
                    onEquipmentUnassign={handleEquipmentUnassign}
                  />
                </div>
              )}
            </div>
          )}

          {/* Sidebar for week / kanban / map views */}
          {showSidebar && view !== "day" && view !== "job" && (
            <ResourceSidebar
              workers={workers}
              resources={resources}
              selectedWorkerIds={selectedWorkerIds}
              leaveRecords={leaveRecords}
              leaveRangeStart={view === "week" ? weekStart : currentDate}
              leaveRangeEnd={view === "week" ? addDays(weekStart, 6) : currentDate}
              onWorkerToggle={handleWorkerToggle}
              onClose={() => setShowSidebar(false)}
              allDayJobs={allDayJobs}
              workerStates={workerStates}
              defaultTab={view === "map" ? "capacity" : undefined}
              onEquipmentUnassign={handleEquipmentUnassign}
            />
          )}
        </div>
      </div>
    </div>
  );
}


function createWorkerMarkerIcon(initials: string, color?: string, stateColor?: string) {
  const bg = color || "#22c55e";
  const dot = stateColor || "#22c55e";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:38px;height:38px;">
      <div style="width:36px;height:36px;border-radius:50%;background:${bg};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;">
        <span style="color:white;font-size:12px;font-weight:700;">${initials}</span>
      </div>
      <div style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:${dot};border:1.5px solid white;"></div>
    </div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  });
}

interface LeaveRecord {
  id: string;
  teamMemberId: string;
  memberId: string | null;
  memberFirstName?: string | null;
  memberLastName?: string | null;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
}

function workerLeaveLabel(leaveRecords: LeaveRecord[], memberId: string, date: Date): string | null {
  const dateStr = format(date, "yyyy-MM-dd");
  const record = leaveRecords.find(r => {
    if (r.memberId !== memberId) return false;
    return leaveDateStr(r.startDate) <= dateStr && leaveDateStr(r.endDate) >= dateStr;
  });
  if (!record) return null;
  const reason = record.reason?.toLowerCase() ?? "";
  if (reason === "annual_leave") return "Annual Leave";
  if (reason === "sick_leave") return "Sick Leave";
  if (reason === "personal") return "Personal Leave";
  if (reason === "public_holiday") return "Public Holiday";
  return "On Leave";
}

const MAP_TILE_ATTR  = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Hook: fit map to all visible markers whenever positions change (by coordinate, not just count). */
function FitBounds({ positions, posKey }: { positions: [number, number][]; posKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(positions), { padding: [48, 48] });
    }
  // posKey is a stable string encoding all coordinates; it changes whenever any position changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posKey]);
  return null;
}

const MAP_TILE_DARK  = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

type MapStatusFilter = "all" | "scheduled" | "active" | "completed";

function createJobMarkerIcon(status: string) {
  const colors: Record<string, string> = {
    scheduled: "#3b82f6",
    assigned:  "#3b82f6",
    pending:   "#f59e0b",
    en_route:  "#f59e0b",
    arrived:   "#8b5cf6",
    in_progress: "#f97316",
    done:      "#22c55e",
    completed: "#22c55e",
    invoiced:  "#a855f7",
    cancelled: "#94a3b8",
  };
  const color = colors[status?.toLowerCase()] ?? "#3b82f6";
  return L.divIcon({
    className: "",
    html: `<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><div style="transform:rotate(45deg);color:white;font-size:13px;font-weight:700;"><svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5'><path d='M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z'/><circle cx='12' cy='10' r='3'/></svg></div></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

function MapView({
  jobs,
  workers,
  date,
  selectedWorkerIds,
  onJobClick,
  onWorkerToggle,
}: {
  jobs: DispatchJob[];
  workers: TeamMember[];
  date: Date;
  selectedWorkerIds: string[];
  onJobClick: (id: string) => void;
  onWorkerToggle: (id: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<MapStatusFilter>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [drawerJob, setDrawerJob] = useState<DispatchJob | null>(null);
  const { toast } = useToast();

  // Filter jobs for the selected date
  const dateJobs = useMemo(() => jobs.filter(j => jobOnDate(j, date)), [jobs, date]);

  // Apply worker filter if any selected
  const workerFilteredJobs = useMemo(() => {
    if (selectedWorkerIds.length === 0) return dateJobs;
    return dateJobs.filter(j => {
      const wid = j.assignedTo ?? primaryAssignment(j)?.memberId;
      return !!wid && selectedWorkerIds.includes(wid);
    });
  }, [dateJobs, selectedWorkerIds]);

  // Apply status filter
  const visibleJobs = useMemo(() => {
    if (statusFilter === "all") return workerFilteredJobs;
    if (statusFilter === "scheduled") return workerFilteredJobs.filter(j => ["pending", "scheduled", "assigned"].includes(j.status?.toLowerCase() ?? ""));
    if (statusFilter === "active") return workerFilteredJobs.filter(j => ["en_route", "arrived", "in_progress"].includes(j.status?.toLowerCase() ?? ""));
    if (statusFilter === "completed") return workerFilteredJobs.filter(j => ["done", "completed", "invoiced", "cancelled"].includes(j.status?.toLowerCase() ?? ""));
    return workerFilteredJobs;
  }, [workerFilteredJobs, statusFilter]);

  // Build job markers
  const jobMarkers = useMemo(() => visibleJobs.filter(j => {
    const lat = Number(j.latitude);
    const lng = Number(j.longitude);
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  }).map(j => ({
    position: [Number(j.latitude), Number(j.longitude)] as [number, number],
    job: j,
  })), [visibleJobs]);

  // Build worker markers (en-route or on-job workers with GPS pings)
  const workerMarkers = useMemo(() => {
    const markers: { position: [number, number]; assignment: DispatchAssignment; jobTitle: string; worker?: TeamMember }[] = [];
    const workerMap = new Map(workers.map(w => [w.memberId || w.id, w]));
    jobs.forEach(job => {
      (job.assignments ?? []).forEach(asgn => {
        if (!asgn.latestPing) return;
        if (!["en_route", "arrived", "working"].includes(asgn.assignmentStatus)) return;
        if (selectedWorkerIds.length > 0 && asgn.memberId && !selectedWorkerIds.includes(asgn.memberId)) return;
        const lat = Number(asgn.latestPing.latitude);
        const lng = Number(asgn.latestPing.longitude);
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          markers.push({
            position: [lat, lng],
            assignment: asgn,
            jobTitle: job.title,
            worker: asgn.memberId ? workerMap.get(asgn.memberId) : undefined,
          });
        }
      });
    });
    return markers;
  }, [jobs, workers, selectedWorkerIds]);

  const allPositions: [number, number][] = useMemo(
    () => [...jobMarkers.map(m => m.position), ...workerMarkers.map(m => m.position)],
    [jobMarkers, workerMarkers],
  );

  /** Stable string encoding every coordinate — changes whenever any position moves, not just the count. */
  const positionsKey = useMemo(
    () => allPositions.map(p => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join("|"),
    [allPositions],
  );

  const mapCenter: [number, number] = useMemo(() => {
    if (allPositions.length === 0) return [-25.27, 133.77];
    const avgLat = allPositions.reduce((s, p) => s + p[0], 0) / allPositions.length;
    const avgLng = allPositions.reduce((s, p) => s + p[1], 0) / allPositions.length;
    return [avgLat, avgLng];
  }, [refreshKey, positionsKey]);

  const noCoords = jobMarkers.length === 0 && workerMarkers.length === 0;

  const STATUS_FILTER_OPTIONS: { key: MapStatusFilter; label: string }[] = [
    { key: "all",       label: "All" },
    { key: "scheduled", label: "Scheduled" },
    { key: "active",    label: "Active" },
    { key: "completed", label: "Completed" },
  ];

  const drawerWorker = useMemo(() => {
    if (!drawerJob) return undefined;
    const asgn = primaryAssignment(drawerJob);
    return asgn?.memberId ? workers.find(w => (w.memberId || w.id) === asgn.memberId) : undefined;
  }, [drawerJob, workers]);

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Map fills full height */}
      <div className="flex-1 relative overflow-hidden">
        {noCoords ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3 z-10 pointer-events-none">
            <MapIcon className="h-12 w-12 opacity-20" />
            <div className="text-center">
              <p className="text-sm font-medium">No job locations to show</p>
              <p className="text-xs mt-1 opacity-70">Add addresses with coordinates to jobs to see them here.</p>
            </div>
          </div>
        ) : null}
        <MapContainer
          key={refreshKey}
          center={mapCenter}
          zoom={allPositions.length > 0 ? 11 : 4}
          className="h-full w-full"
          scrollWheelZoom
          zoomControl={false}
          style={{ height: "100%", width: "100%" }}
        >
          <ThemeAwareTiles />
          {allPositions.length > 0 && <FitBounds positions={allPositions} posKey={positionsKey} />}

          {/* Job markers */}
          {jobMarkers.map(({ position, job }) => {
            const asgn = primaryAssignment(job);
            const assignedWorker = asgn?.memberId
              ? workers.find(w => (w.memberId || w.id) === asgn.memberId)
              : undefined;
            return (
              <Marker
                key={`job-${job.id}`}
                position={position}
                icon={createJobMarkerIcon(job.status)}
                eventHandlers={{ click: () => setDrawerJob(job) }}
              >
                <Popup>
                  <div style={{ minWidth: 160, padding: "2px 0" }}>
                    <p style={{ fontWeight: 700, fontSize: 13, margin: "0 0 4px 0" }}>{job.title}</p>
                    {job.client?.name && (
                      <p style={{ fontSize: 11, color: "#666", margin: "0 0 4px 0" }}>{job.client.name}</p>
                    )}
                    <button
                      onClick={() => setDrawerJob(job)}
                      style={{ fontSize: 11, color: "#3b82f6", cursor: "pointer", background: "none", border: "none", padding: 0, textDecoration: "underline" }}
                    >
                      View details
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Worker markers */}
          {workerMarkers.map(({ position, assignment, jobTitle, worker }, idx) => {
            const initials = (
              (assignment.memberFirstName?.[0] ?? "") +
              (assignment.memberLastName?.[0] ?? "")
            ).toUpperCase() || "?";
            const color = worker?.themeColor;
            const stateColor = assignment.assignmentStatus === "working" ? "#f97316" : assignment.assignmentStatus === "arrived" ? "#8b5cf6" : "#f59e0b";
            const displayName = worker ? memberName(worker) : [assignment.memberFirstName, assignment.memberLastName].filter(Boolean).join(" ") || "Worker";
            const stateLabel = assignment.assignmentStatus === "en_route" ? "En route" : assignment.assignmentStatus === "arrived" ? "Arrived" : "Working";
            return (
              <Marker key={`worker-${assignment.id}-${idx}`} position={position} icon={createWorkerMarkerIcon(initials, color, stateColor)}>
                <Popup>
                  <div style={{ minWidth: 180, padding: "2px 0" }}>
                    <p style={{ fontWeight: 700, fontSize: 13, margin: "0 0 3px 0" }}>{displayName}</p>
                    <p style={{ fontSize: 12, color: "#555", margin: "0 0 4px 0" }}>{stateLabel} — {jobTitle}</p>
                    {assignment.latestPing?.timestamp && (
                      <p style={{ fontSize: 10, color: "#aaa" }}>
                        Updated {format(new Date(assignment.latestPing.timestamp), "h:mm a")}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Floating controls pill */}
        <div className="absolute top-3 left-3 z-[1000] flex items-center gap-1 bg-background/95 backdrop-blur-sm border rounded-full px-2 py-1 shadow-lg">
          {STATUS_FILTER_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors
                ${statusFilter === opt.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {opt.label}
            </button>
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/dispatch/board"], exact: false });
              setRefreshKey(k => k + 1);
              toast({ title: "Refreshing positions..." });
            }}
            className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
            title="Refresh"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              if (!navigator.geolocation) return;
              navigator.geolocation.getCurrentPosition(() => {}, () => {
                toast({ title: "Could not get your location", variant: "destructive" });
              });
            }}
            className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
            title="Locate me"
          >
            <Locate className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Stats pill */}
        <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2 bg-background/95 backdrop-blur-sm border rounded-full px-3 py-1 shadow-lg text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span>{jobMarkers.length} job{jobMarkers.length !== 1 ? "s" : ""}</span>
          {workerMarkers.length > 0 && (
            <>
              <Navigation className="h-3 w-3 ml-0.5" />
              <span>{workerMarkers.length} live</span>
            </>
          )}
        </div>
      </div>

      {/* Slide-in job drawer */}
      {drawerJob && (
        <div className="w-72 border-l flex flex-col flex-shrink-0 bg-card shadow-xl overflow-hidden animate-in slide-in-from-right-4 duration-200">
          {/* Drawer header */}
          <div className="px-3 py-2.5 border-b flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate">{drawerJob.title}</p>
              {drawerJob.client?.name && (
                <p className="text-[11px] text-muted-foreground truncate">{drawerJob.client.name}</p>
              )}
            </div>
            <button onClick={() => setDrawerJob(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {/* Status badge */}
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const sc = getStatusColor(drawerJob.status);
                  return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${sc.bg} ${sc.text}`}>
                      {drawerJob.status.replace(/_/g, " ")}
                    </span>
                  );
                })()}
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                  {(drawerJob.jobType ?? "service") === "project" ? "Project" : "Service Call"}
                </Badge>
              </div>

              {/* Time */}
              {drawerJob.scheduledAt && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span>{format(parseISO(drawerJob.scheduledAt), "EEEE d MMMM")} {formatJobTime(drawerJob.scheduledTime, drawerJob.scheduledAt)}</span>
                </div>
              )}

              {/* Address */}
              {drawerJob.address && (
                <div className="flex items-start gap-1.5 text-xs">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{drawerJob.address}</span>
                </div>
              )}

              {/* Assigned worker */}
              {drawerWorker && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <UserAvatar
                    user={{ id: drawerWorker.memberId || drawerWorker.id, firstName: drawerWorker.firstName, lastName: drawerWorker.lastName, photoUrl: drawerWorker.profileImageUrl, themeColor: drawerWorker.themeColor }}
                    className="h-7 w-7 text-[10px] flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{memberName(drawerWorker)}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{drawerWorker.roleName}</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          {/* Action buttons */}
          <div className="p-3 border-t space-y-2">
            <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={() => onJobClick(drawerJob.id)}>
              <ExternalLink className="h-3.5 w-3.5" />
              Open Job
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeAwareTiles() {
  const { theme } = useTheme();
  const map = useMap();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const tileUrl = isDark ? MAP_TILE_DARK : MAP_TILE_LIGHT;
  useEffect(() => {
    const layer = L.tileLayer(tileUrl, { attribution: MAP_TILE_ATTR });
    layer.addTo(map);
    return () => { map.removeLayer(layer); };
  }, [tileUrl, map]);
  return null;
}

function JobView({
  weekStart,
  selectedJobId,
  allJobs,
  jobsLoading,
  phases,
  workers,
  resources,
  allDispatchJobs,
  onJobClick,
}: {
  weekStart: Date;
  selectedJobId: string | null;
  allJobs: DispatchJob[];
  jobsLoading: boolean;
  phases: DispatchPhase[];
  workers: TeamMember[];
  resources?: DispatchResources;
  allDispatchJobs: DispatchJob[];
  onJobClick: (id: string) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const [selectedPhase, setSelectedPhase] = useState<DispatchPhase | null>(null);

  const selectedJob = useMemo(
    () => allJobs.find(j => j.id === selectedJobId) ?? null,
    [allJobs, selectedJobId],
  );

  const jobPhasesList = useMemo(
    () => (selectedJobId ? phases.filter(p => p.jobId === selectedJobId) : []),
    [phases, selectedJobId],
  );

  const jobWorkerIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedJob?.assignedTo) ids.add(selectedJob.assignedTo);
    (selectedJob?.assignments ?? []).forEach(a => { if (a.memberId) ids.add(a.memberId); });
    jobPhasesList.forEach(p => {
      if (p.assignedUserId) ids.add(p.assignedUserId);
      (p.assignedUsers ?? []).forEach(a => ids.add(a.id));
    });
    return ids;
  }, [selectedJob, jobPhasesList]);

  const jobWorkers = useMemo(
    () => workers.filter(w => jobWorkerIds.has(w.memberId || w.id)),
    [workers, jobWorkerIds],
  );

  const jobMaterials = useMemo(
    () => (resources?.materialsNeeded ?? []).filter(m => !m.jobId || m.jobId === selectedJobId),
    [resources, selectedJobId],
  );

  if (!selectedJobId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Layers className="h-12 w-12 opacity-20" />
        <p className="text-sm font-medium">Select a job to view its timeline</p>
        <p className="text-xs text-center px-8">Use the job picker in the toolbar above to choose a job or project</p>
      </div>
    );
  }

  if (!selectedJob) {
    if (jobsLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Briefcase className="h-12 w-12 opacity-20" />
        <p className="text-sm font-medium">Job not found</p>
        <p className="text-xs text-center px-8">
          This job may have been deleted or you may not have access to it.
          Try selecting a different job from the picker above.
        </p>
      </div>
    );
  }

  const isProject = (selectedJob.jobType ?? "service") === "project";
  const scJob = STATUS_COLORS[selectedJob.status?.toLowerCase().replace(" ", "_")] ?? STATUS_COLORS.pending;

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Job header — polished card */}
        <div className="border-b flex-shrink-0 px-4 py-3 bg-card">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {/* Status badge + type badge */}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${scJob.bg} ${scJob.text}`}>
                  {selectedJob.status.replace(/_/g, " ")}
                </span>
                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                  {isProject ? "Project" : "Service Call"}
                </Badge>
              </div>
              <h2 className="text-base font-bold truncate leading-tight">{selectedJob.title}</h2>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {selectedJob.client?.name && (
                  <span className="text-sm text-muted-foreground truncate">{selectedJob.client.name}</span>
                )}
                {selectedJob.scheduledAt && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    {format(parseISO(selectedJob.scheduledAt), "d MMM yyyy")}
                  </span>
                )}
                {selectedJob.address && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 truncate max-w-[200px]">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    {selectedJob.address}
                  </span>
                )}
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 flex-shrink-0" onClick={() => onJobClick(selectedJob.id)}>
              <ExternalLink className="h-3.5 w-3.5" />
              Open Job
            </Button>
          </div>
        </div>

        {/* Timeline grid */}
        <ScrollArea className="flex-1">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div className="grid grid-cols-[150px_repeat(7,1fr)] border-b sticky top-0 z-10 bg-background">
              <div className="px-2 py-2 text-[11px] font-semibold text-muted-foreground uppercase border-r">Worker</div>
              {days.map(day => (
                <div key={day.toISOString()} className={`px-2 py-2 text-center border-l ${isToday(day) ? "bg-primary/5" : ""}`}>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">{format(day, "EEE")}</p>
                  <p className={`text-sm font-bold ${isToday(day) ? "text-primary" : ""}`}>{format(day, "d")}</p>
                </div>
              ))}
            </div>

            {/* Worker rows */}
            {jobWorkers.length === 0 && !isProject ? (
              /* Service call with no team members — show a single job row */
              <div className="grid grid-cols-[150px_repeat(7,1fr)] border-b">
                <div className="px-2 py-2 border-r flex items-center text-[11px] text-muted-foreground italic">Job schedule</div>
                {days.map(day => {
                  const onDay = jobOnDate(selectedJob, day);
                  return (
                    <div key={day.toISOString()} className={`border-l min-h-[80px] p-1.5 ${isToday(day) ? "bg-primary/[0.03]" : ""}`}>
                      {onDay && (
                        <div className={`rounded px-1.5 py-1 ${scJob.bg}`}>
                          <p className="text-[10px] font-semibold truncate">{selectedJob.title}</p>
                          <p className={`text-[9px] ${scJob.text}`}>{formatJobTime(selectedJob.scheduledTime, selectedJob.scheduledAt)}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : jobWorkers.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
                <Users className="h-8 w-8 opacity-20" />
                <p className="text-xs">No crew assigned to this project yet</p>
              </div>
            ) : (
              jobWorkers.map(worker => {
                const wid = worker.memberId || worker.id;
                const isLead = jobPhasesList.some(p => p.assignedUserId === wid) || selectedJob?.assignedTo === wid;
                return (
                  <div key={wid} className="grid grid-cols-[150px_repeat(7,1fr)] border-b">
                    {/* Worker label */}
                    <div className="px-2 py-2 flex items-center gap-1.5 border-r bg-muted/5">
                      <UserAvatar
                        user={{ id: wid, firstName: worker.firstName, lastName: worker.lastName, photoUrl: worker.profileImageUrl, themeColor: worker.themeColor }}
                        className="h-7 w-7 text-[10px] flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold truncate">{memberName(worker)}</p>
                        <p className="text-[10px] text-muted-foreground truncate capitalize">{isLead ? "Lead" : "Member"}</p>
                      </div>
                    </div>

                    {/* Day cells */}
                    {days.map(day => {
                      const dayStr = day.toISOString();
                      const phaseBlocks = jobPhasesList.filter(p => phaseOnDay(p, day) && phaseForWorker(p, wid) !== null);
                      const conflictJobs = allDispatchJobs.filter(j => {
                        if (j.id === selectedJobId) return false;
                        if (!jobOnDate(j, day)) return false;
                        if (j.assignedTo === wid) return true;
                        return (j.assignments ?? []).some(a => a.memberId === wid && a.isActive);
                      });
                      return (
                        <div
                          key={dayStr}
                          className={`border-l min-h-[80px] p-1.5 ${isToday(day) ? "bg-primary/[0.03]" : ""}`}
                        >
                          {/* Conflict ghost blocks */}
                          {conflictJobs.map(cj => (
                            <div
                              key={cj.id}
                              title={`Conflict: ${cj.title}`}
                              onClick={() => onJobClick(cj.id)}
                              className="rounded px-1.5 py-0.5 mb-0.5 border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40 opacity-60 cursor-pointer hover:opacity-80 transition-opacity"
                            >
                              <p className="text-[9px] text-muted-foreground truncate">{cj.title}</p>
                              <p className="text-[8px] text-muted-foreground/70 truncate">{formatJobTime(cj.scheduledTime, cj.scheduledAt)}</p>
                            </div>
                          ))}

                          {/* Phase / job blocks */}
                          {isProject ? phaseBlocks.map(p => {
                            const role = phaseForWorker(p, wid);
                            const psc = STATUS_COLORS[p.status?.toLowerCase().replace(" ", "_")] ?? STATUS_COLORS.pending;
                            const assignedNames = (p.assignedUsers ?? []).map(u => u.name.split(" ")[0]).join(", ");
                            return (
                              <div
                                key={p.id}
                                onClick={() => setSelectedPhase(p)}
                                className={`rounded px-1.5 py-1 mb-0.5 cursor-pointer transition-all hover:brightness-95
                                  ${psc.bg}
                                  ${role === "lead" ? "ring-1 ring-inset ring-current/20" : "ml-1 opacity-70"}`}
                                title={`${p.name} — ${p.bookedHours ?? "?"} hrs`}
                              >
                                <p className="text-[10px] font-semibold truncate">{p.name}</p>
                                {role === "lead" && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className={`text-[9px] truncate capitalize ${psc.text}`}>{p.status?.replace(/_/g, " ")}</span>
                                    {p.bookedHours && (
                                      <span className="text-[9px] text-muted-foreground">{p.bookedHours}h</span>
                                    )}
                                  </div>
                                )}
                                {assignedNames && (
                                  <p className="text-[9px] text-muted-foreground truncate">{assignedNames}</p>
                                )}
                              </div>
                            );
                          }) : (
                            /* Service call: show the job block on its scheduled day */
                            jobOnDate(selectedJob, day) && (
                              <div className={`rounded px-1.5 py-1 ${scJob.bg}`}>
                                <p className="text-[10px] font-semibold truncate">{selectedJob.title}</p>
                                <p className={`text-[9px] ${scJob.text}`}>{formatJobTime(selectedJob.scheduledTime, selectedJob.scheduledAt)}</p>
                              </div>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right panel */}
      <JobViewSidebar
        job={selectedJob}
        phases={jobPhasesList}
        workers={jobWorkers}
        materials={jobMaterials}
      />

      {/* Phase detail dialog */}
      {selectedPhase && (
        <Dialog open={!!selectedPhase} onOpenChange={open => { if (!open) setSelectedPhase(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">{selectedPhase.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const psc = STATUS_COLORS[selectedPhase.status?.toLowerCase().replace(" ", "_")] ?? STATUS_COLORS.pending;
                  return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize ${psc.bg} ${psc.text}`}>
                      {selectedPhase.status?.replace(/_/g, " ")}
                    </span>
                  );
                })()}
                {selectedPhase.bookedHours && (
                  <span className="text-xs text-muted-foreground">{selectedPhase.bookedHours} booked hours</span>
                )}
              </div>
              {(selectedPhase.scheduledStart || selectedPhase.scheduledEnd) && (
                <div className="flex items-center gap-1.5 text-sm">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>
                    {selectedPhase.scheduledStart ? format(parseISO(selectedPhase.scheduledStart), "d MMM yyyy") : "—"}
                    {" to "}
                    {selectedPhase.scheduledEnd ? format(parseISO(selectedPhase.scheduledEnd), "d MMM yyyy") : "—"}
                  </span>
                </div>
              )}
              {(selectedPhase.assignedUsers?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-1.5">Assigned team</p>
                  <div className="space-y-1.5">
                    {(selectedPhase.assignedUsers ?? []).map(a => (
                      <div key={a.id} className="flex items-center gap-2">
                        <UserAvatar user={{ id: a.id }} className="h-6 w-6 text-[10px] flex-shrink-0" />
                        <span className="text-sm truncate">{a.name}</span>
                        {a.isLead && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 flex-shrink-0">Lead</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedPhase.description && (
                <p className="text-sm text-muted-foreground">{selectedPhase.description}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setSelectedPhase(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function JobViewSidebar({
  job,
  phases,
  workers,
  materials,
}: {
  job: DispatchJob | null;
  phases: DispatchPhase[];
  workers: TeamMember[];
  materials: MaterialItem[];
}) {
  const [activeTab, setActiveTab] = useState<"team" | "materials">("team");

  const workerHours = useMemo(() => {
    const map = new Map<string, number>();
    phases.forEach(p => {
      const hrs = parseFloat(String(p.bookedHours ?? "0")) || 0;
      if (p.assignedUserId) map.set(p.assignedUserId, (map.get(p.assignedUserId) ?? 0) + hrs);
      (p.assignedUsers ?? []).forEach(a => {
        if (a.id !== p.assignedUserId) {
          const share = hrs / Math.max(1, (p.assignedUsers?.length ?? 1) - 1);
          map.set(a.id, (map.get(a.id) ?? 0) + share);
        }
      });
    });
    return map;
  }, [phases]);

  const workerRole = useMemo(() => {
    const map = new Map<string, "lead" | "member">();
    phases.forEach(p => {
      if (p.assignedUserId) map.set(p.assignedUserId, "lead");
      (p.assignedUsers ?? []).forEach(a => {
        if (!map.has(a.id)) map.set(a.id, a.isLead ? "lead" : "member");
      });
    });
    if (job?.assignedTo && !map.has(job.assignedTo)) map.set(job.assignedTo, "lead");
    return map;
  }, [phases, job]);

  const sidebarTabs = [
    { key: "team" as const, label: "Team", icon: Users },
    { key: "materials" as const, label: "Materials", icon: Package },
  ];

  return (
    <div className="w-64 border-l flex flex-col flex-shrink-0 bg-card">
      <div className="flex items-center border-b px-1 pt-1">
        {sidebarTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex flex-col items-center py-1.5 gap-0.5 text-[10px] font-medium rounded-t transition-colors
                ${activeTab === tab.key ? "bg-background text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <ScrollArea className="flex-1">
        {activeTab === "team" && (
          <div className="p-2 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 py-1">
              Assigned crew ({workers.length})
            </p>
            {workers.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Users className="h-7 w-7 mb-2 opacity-30" />
                <p className="text-xs">No crew assigned</p>
              </div>
            ) : (
              workers.map(worker => {
                const wid = worker.memberId || worker.id;
                const role = workerRole.get(wid) ?? "member";
                const hrs = Math.round((workerHours.get(wid) ?? 0) * 10) / 10;
                return (
                  <div key={wid} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/30">
                    <UserAvatar
                      user={{ id: wid, firstName: worker.firstName, lastName: worker.lastName, photoUrl: worker.profileImageUrl, themeColor: worker.themeColor }}
                      className="h-7 w-7 text-[10px] flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold truncate">{memberName(worker)}</p>
                      <p className="text-[10px] text-muted-foreground">{worker.roleName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <Badge variant={role === "lead" ? "default" : "outline"} className="text-[9px] h-3.5 px-1 capitalize">
                        {role}
                      </Badge>
                      {hrs > 0 && (
                        <span className="text-[9px] text-muted-foreground">{hrs}h</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "materials" && (
          <div className="p-2 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 py-1">
              Materials
            </p>
            {materials.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Package className="h-7 w-7 mb-2 opacity-30" />
                <p className="text-xs">No materials listed</p>
              </div>
            ) : (
              materials.map(mat => (
                <div key={mat.id} className="px-2 py-1.5 rounded hover:bg-muted/30">
                  <p className="text-[11px] font-medium truncate">{mat.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {mat.quantity && (
                      <span className="text-[10px] text-muted-foreground">{mat.quantity} {mat.unit}</span>
                    )}
                    {mat.status && (
                      <Badge variant="outline" className="text-[9px] h-3.5 px-1 capitalize">{mat.status}</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/**
 * Returns "lead" | "member" | null for a worker on a phase.
 */
function phaseForWorker(phase: DispatchPhase, workerId: string): "lead" | "member" | null {
  if ((phase.assignedUserIds?.length ?? 0) > 0) {
    if (!phase.assignedUserIds!.includes(workerId)) return null;
    const user = (phase.assignedUsers ?? []).find(u => u.id === workerId);
    if (user?.isLead || phase.assignedUserId === workerId) return "lead";
    return "member";
  }
  if (phase.assignedUserId === workerId) return "lead";
  const user = (phase.assignedUsers ?? []).find(u => u.id === workerId);
  if (!user) return null;
  return user.isLead ? "lead" : "member";
}
