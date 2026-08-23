import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { Calendar } from "@/components/ui/calendar";
import { useTheme } from "@/components/ThemeProvider";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ChevronDown,
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Map as MapIcon,
  User,
  Users,
  GripVertical,
  Briefcase,
  Navigation,
  Phone,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  LayoutGrid,
  List,
  Timer,
  Sparkles,
  Loader2,
  Check,
  X,
  Plus,
  Wrench,
  Package,
  ArrowRight,
  CalendarDays,
  ExternalLink,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Truck,
  HardHat,
  CircleDot,
  Settings2,
  Columns3,
  Eye,
  Sun,
  Moon,
  Coffee,
  HelpCircle,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  format,
  addDays,
  subDays,
  startOfDay,
  isSameDay,
  parseISO,
  setHours,
  setMinutes,
  differenceInMinutes,
  addMinutes
} from "date-fns";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Job {
  id: string;
  title: string;
  status: string;
  scheduledAt?: string;
  scheduledTime?: string;
  estimatedDuration?: number;
  address?: string;
  clientId: string;
  clientName?: string;
  assignedTo?: string;
  priority?: string;
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
}

interface Client {
  id: string;
  name: string;
  phone?: string;
  address?: string;
}

const HOUR_HEIGHT = 80;

function buildWorkHours(startHour: number, endHour: number): number[] {
  const count = endHour - startHour + 1;
  return Array.from({ length: Math.max(count, 4) }, (_, i) => i + startHour);
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

function buildTimeSlots(startHour: number, endHour: number): Array<{ value: string; label: string; hour: number; minute: number }> {
  const slots: Array<{ value: string; label: string; hour: number; minute: number }> = [];
  for (let h = startHour; h <= endHour; h++) {
    for (const m of [0, 30]) {
      if (h === endHour && m === 30) break;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const label = `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
      const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      slots.push({ value, label, hour: h, minute: m });
    }
  }
  return slots;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300' },
  scheduled: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300' },
  in_progress: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300' },
  done: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-300' },
  invoiced: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300' },
};

function getStatusStyle(status: string) {
  const lower = status.toLowerCase().replace(' ', '_');
  return STATUS_COLORS[lower] || STATUS_COLORS.pending;
}

function formatTime(hour: number) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h}:00 ${ampm}`;
}

function parseJobTime(timeStr?: string | null, scheduledAt?: string | null): { hour: number; minute: number } {
  if (timeStr) {
    const parts = timeStr.split(':').map(Number);
    const h = isNaN(parts[0]) ? 9 : parts[0];
    const m = isNaN(parts[1]) ? 0 : parts[1];
    return { hour: h, minute: m };
  }
  if (scheduledAt) {
    try {
      const d = parseISO(scheduledAt);
      if (!isNaN(d.getTime())) {
        return { hour: d.getHours(), minute: d.getMinutes() };
      }
    } catch {
      const d = new Date(scheduledAt);
      if (!isNaN(d.getTime())) {
        return { hour: d.getHours(), minute: d.getMinutes() };
      }
    }
  }
  return { hour: 9, minute: 0 };
}

function formatScheduledTime(timeStr?: string | null, scheduledAt?: string | null): string {
  const { hour, minute } = parseJobTime(timeStr, scheduledAt);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h}:${minute.toString().padStart(2, '0')} ${ampm}`;
}

interface DraggedJob {
  job: Job;
  originMemberId: string | null;
}

interface SelectedJobForAssignment {
  job: Job;
  mode: 'assign' | 'reassign';
}

interface ScheduleSuggestion {
  jobId: string;
  jobTitle: string;
  clientName: string;
  suggestedDate: string;
  suggestedTime: string;
  suggestedAssignee?: string;
  suggestedAssigneeName?: string;
  reason: string;
  priority: number;
}

interface ScheduleSuggestionsResponse {
  suggestions: ScheduleSuggestion[];
  summary: string;
  optimizationNotes?: string[];
}

interface OpsHealth {
  todayJobCount: number;
  unassignedJobs: number;
  overdueJobs: number;
  overCapacityWorkers: number;
  conflicts: Array<{ memberId: string; memberName: string; jobs: Array<{ id: string; title: string; time: string }> }>;
  conflictCount: number;
  overdueInvoices: number;
  unpaidInvoiceTotal: number;
  activeWorkers: number;
  totalSeverity: number;
}

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
  notes?: string;
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
  latestPing?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    timestamp?: string;
  } | null;
}

function createJobIcon(status: string) {
  const colors: Record<string, string> = {
    scheduled: '#3b82f6',
    assigned: '#3b82f6',
    en_route: '#f59e0b',
    arrived: '#8b5cf6',
    in_progress: '#f97316',
    completed: '#22c55e',
    cancelled: '#ef4444',
  };
  const color = colors[status] || '#3b82f6';
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 32px; height: 32px; border-radius: 50% 50% 50% 0;
      background: ${color}; transform: rotate(-45deg);
      border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      display: flex; align-items: center; justify-content: center;
    "><div style="
      transform: rotate(45deg); color: white; font-size: 13px; font-weight: 700;
    "><svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5'><path d='M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z'/><circle cx='12' cy='10' r='3'/></svg></div></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

function createWorkerIcon(initials: string, color?: string) {
  const bg = color || '#22c55e';
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 36px; height: 36px; border-radius: 50%;
      background: ${bg}; border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      display: flex; align-items: center; justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
      animation: pulse-ring 2s ease-out infinite;
    "><span style="color: white; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">${initials}</span></div>
    <style>@keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 ${bg}60; } 70% { box-shadow: 0 0 0 8px ${bg}00; } 100% { box-shadow: 0 0 0 0 ${bg}00; } }</style>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

const KANBAN_COLUMNS = [
  { key: 'assigned', label: 'Assigned', color: 'bg-blue-500', bgLight: 'bg-blue-50 dark:bg-blue-900/20' },
  { key: 'en_route', label: 'En Route', color: 'bg-amber-500', bgLight: 'bg-amber-50 dark:bg-amber-900/20' },
  { key: 'arrived', label: 'Arrived', color: 'bg-purple-500', bgLight: 'bg-purple-50 dark:bg-purple-900/20' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-orange-500', bgLight: 'bg-orange-50 dark:bg-orange-900/20' },
  { key: 'completed', label: 'Completed', color: 'bg-green-500', bgLight: 'bg-green-50 dark:bg-green-900/20' },
] as const;

function getKanbanColumn(job: DispatchJob): string {
  const status = job.status?.toLowerCase() || '';
  const workerStatus = job.workerStatus?.toLowerCase() || '';
  const assignments = job.assignments || [];

  // Terminal job statuses take absolute priority — an invoiced, done, or
  // cancelled job always renders in the Completed column, regardless of any
  // workerStatus or assignment status that may have been set earlier.
  if (['done', 'completed', 'invoiced', 'cancelled'].includes(status)) return 'completed';

  // Terminal assignment states take next priority.
  if (assignments.some(a => a.assignmentStatus === 'done')) return 'completed';
  if (assignments.some(a => a.assignmentStatus === 'working')) return 'in_progress';

  // En-route / arrived are set via workerStatus when dragged from the kanban
  // (the assignment workflow status endpoint doesn't support these states from
  // the board). Check workerStatus BEFORE non-terminal assignment statuses so
  // a board drag persists correctly after the query refetches.
  if (workerStatus === 'on_my_way') return 'en_route';
  if (workerStatus === 'arrived') return 'arrived';

  // Fall back to assignment statuses for non-terminal states.
  if (assignments.some(a => a.assignmentStatus === 'arrived')) return 'arrived';
  if (assignments.some(a => a.assignmentStatus === 'en_route')) return 'en_route';
  if (assignments.some(a => ['assigned', 'accepted', 'invited'].includes(a.assignmentStatus))) return 'assigned';

  if (workerStatus === 'completed') return 'completed';
  if (workerStatus === 'in_progress') return 'in_progress';

  if (status === 'in_progress') return 'in_progress';
  if (['pending', 'scheduled'].includes(status)) return 'assigned';

  return 'assigned';
}

function getPriorityConfig(priority?: string) {
  switch (priority?.toLowerCase()) {
    case 'urgent': return { label: 'Urgent', color: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25' };
    case 'high': return { label: 'High', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25' };
    case 'low': return { label: 'Low', color: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/25' };
    default: return null;
  }
}

function getTimeElapsed(scheduledAt?: string, scheduledTime?: string): string | null {
  if (!scheduledAt) return null;
  try {
    let startDate: Date;
    if (scheduledTime) {
      const [h, m] = scheduledTime.split(':').map(Number);
      startDate = parseISO(scheduledAt);
      startDate.setHours(h, m, 0, 0);
    } else {
      startDate = parseISO(scheduledAt);
    }
    const now = new Date();
    if (startDate > now) return null;
    const mins = differenceInMinutes(now, startDate);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return remainMins > 0 ? `${hours}h ${remainMins}m ago` : `${hours}h ago`;
  } catch { return null; }
}

function KanbanBoard({ dispatchJobs, teamMembers: kanbanTeam }: { dispatchJobs: DispatchJob[]; teamMembers?: TeamMember[] }) {
  const [kanbanFilter, setKanbanFilter] = useState<string>('all');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [kanbanDrag, setKanbanDrag] = useState<{ jobId: string; fromColumn: string } | null>(null);
  const [kanbanDragOver, setKanbanDragOver] = useState<string | null>(null);
  const { toast } = useToast();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ jobId, status, workerStatus }: { jobId: string; status?: string; workerStatus?: string }) => {
      const payload: Record<string, string> = {};
      if (status !== undefined) payload.status = status;
      if (workerStatus !== undefined) payload.workerStatus = workerStatus;
      return apiRequest('PATCH', `/api/jobs/${jobId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dispatch/board'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Job status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const filteredJobs = useMemo(() => {
    if (kanbanFilter === 'all') return dispatchJobs;
    return dispatchJobs.filter(job => {
      const activeAssignment = job.assignments?.find(a => a.isActive);
      if (kanbanFilter === 'unassigned') return !activeAssignment;
      return activeAssignment?.memberId === kanbanFilter;
    });
  }, [dispatchJobs, kanbanFilter]);

  const columnJobs = useMemo(() => {
    const map: Record<string, DispatchJob[]> = {};
    KANBAN_COLUMNS.forEach(col => { map[col.key] = []; });
    filteredJobs.forEach(job => {
      const col = getKanbanColumn(job);
      if (map[col]) map[col].push(job);
    });
    return map;
  }, [filteredJobs]);

  // Job status to set when dropping to a column.
  // en_route and arrived are worker-status sub-stages of "scheduled" — the job
  // status stays unchanged and only the workerStatus is updated.
  const statusForColumn: Record<string, string | undefined> = {
    assigned: 'scheduled',
    en_route: undefined,   // worker en-route — job stays at current status
    arrived: undefined,    // worker on-site — job stays at current status
    in_progress: 'in_progress',
    completed: 'done',
  };

  const workerStatusForColumn: Record<string, string> = {
    assigned: 'assigned',
    en_route: 'on_my_way',
    arrived: 'arrived',
    in_progress: 'in_progress',
    completed: 'completed',
  };

  const handleKanbanDrop = (targetColumn: string) => {
    if (!kanbanDrag || kanbanDrag.fromColumn === targetColumn) {
      setKanbanDrag(null);
      setKanbanDragOver(null);
      return;
    }
    const newStatus = statusForColumn[targetColumn];
    const newWorkerStatus = workerStatusForColumn[targetColumn];
    // Always send at least workerStatus; only include job status when the column
    // has an explicit target (en_route / arrived leave it unchanged).
    updateStatusMutation.mutate({
      jobId: kanbanDrag.jobId,
      status: newStatus,
      workerStatus: newWorkerStatus,
    });
    setKanbanDrag(null);
    setKanbanDragOver(null);
  };

  const uniqueMembers = useMemo(() => {
    const memberMap = new Map<string, { id: string; name: string }>();
    dispatchJobs.forEach(job => {
      (job.assignments || []).forEach(a => {
        if (a.isActive && a.memberId && !memberMap.has(a.memberId)) {
          memberMap.set(a.memberId, {
            id: a.memberId,
            name: `${a.memberFirstName || ''} ${a.memberLastName || ''}`.trim(),
          });
        }
      });
    });
    return Array.from(memberMap.values());
  }, [dispatchJobs]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground">Filter:</span>
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            variant={kanbanFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setKanbanFilter('all')}
          >
            All ({dispatchJobs.length})
          </Button>
          {uniqueMembers.map(m => (
            <Button
              key={m.id}
              variant={kanbanFilter === m.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setKanbanFilter(kanbanFilter === m.id ? 'all' : m.id)}
            >
              {m.name || 'Unknown'}
            </Button>
          ))}
          <Button
            variant={kanbanFilter === 'unassigned' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setKanbanFilter(kanbanFilter === 'unassigned' ? 'all' : 'unassigned')}
          >
            Unassigned
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: '800px' }}>
          {KANBAN_COLUMNS.map(column => {
            const jobs = columnJobs[column.key] || [];
            const count = jobs.length;
            const totalHours = Math.round(jobs.reduce((sum, j) => sum + (j.estimatedDuration || 60), 0) / 60 * 10) / 10;
            const isDragTarget = kanbanDragOver === column.key && kanbanDrag?.fromColumn !== column.key;
            return (
              <div
                key={column.key}
                className="flex-1 min-w-[160px] flex flex-col"
                onDragOver={(e) => { e.preventDefault(); setKanbanDragOver(column.key); }}
                onDragLeave={() => setKanbanDragOver(null)}
                onDrop={(e) => { e.preventDefault(); handleKanbanDrop(column.key); }}
              >
                <div className={`h-[3px] rounded-full mb-2 ${column.color}`} />
                <div className="flex items-center gap-2 mb-2 px-1">
                  <h3 className="text-sm font-semibold">{column.label}</h3>
                  <Badge variant="secondary" className="tabular-nums">
                    {count}
                  </Badge>
                  {totalHours > 0 && (
                    <span className="text-[10px] text-muted-foreground ml-auto">{totalHours}h</span>
                  )}
                </div>
                <div className={`rounded-md p-1.5 space-y-1.5 min-h-[200px] max-h-[60vh] overflow-y-auto flex-1 transition-colors ${column.bgLight} ${isDragTarget ? 'ring-2 ring-primary/40 ring-dashed' : ''}`}>
                  {jobs.map(job => {
                    const firstAssignment = job.assignments?.find(a => a.isActive);
                    const colDef = KANBAN_COLUMNS.find(c => c.key === getKanbanColumn(job));
                    const isExpanded = expandedCard === job.id;
                    const durationStr = job.estimatedDuration
                      ? (job.estimatedDuration >= 60 ? `${Math.floor(job.estimatedDuration / 60)}h${job.estimatedDuration % 60 ? ` ${job.estimatedDuration % 60}m` : ''}` : `${job.estimatedDuration}m`)
                      : null;
                    const priorityCfg = getPriorityConfig(job.priority);
                    const elapsed = getTimeElapsed(job.scheduledAt, job.scheduledTime);
                    const kanbanCol = getKanbanColumn(job);
                    const isActive = ['en_route', 'arrived', 'in_progress'].includes(kanbanCol);
                    return (
                      <Card
                        key={job.id}
                        className={`hover-elevate overflow-visible cursor-pointer ${kanbanDrag?.jobId === job.id ? 'opacity-40' : ''}`}
                        draggable
                        onDragStart={() => setKanbanDrag({ jobId: job.id, fromColumn: getKanbanColumn(job) })}
                        onDragEnd={() => { setKanbanDrag(null); setKanbanDragOver(null); }}
                        onClick={() => setExpandedCard(isExpanded ? null : job.id)}
                      >
                        <CardContent className="p-2.5 flex gap-2">
                          <div className={`w-1 rounded-full flex-shrink-0 self-stretch ${colDef?.color || 'bg-muted'}`} />
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-sm font-medium leading-tight truncate">{job.title}</h4>
                              <div className="flex items-center gap-1 shrink-0">
                                {priorityCfg && (
                                  <Badge variant="outline" className={`text-[9px] px-1 py-0 no-default-hover-elevate no-default-active-elevate ${priorityCfg.color}`}>
                                    {priorityCfg.label}
                                  </Badge>
                                )}
                                {durationStr && (
                                  <Badge variant="secondary" className="text-[9px] px-1 py-0">
                                    {durationStr}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {job.client && (
                              <p className="text-xs text-muted-foreground truncate">
                                {job.client.name}
                              </p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                              {firstAssignment && (
                                <div className="flex items-center gap-1">
                                  <UserAvatar
                                    className="h-4 w-4"
                                    fallbackClassName="text-[8px]"
                                    user={{
                                      id: firstAssignment.memberId || `${firstAssignment.memberFirstName || ''} ${firstAssignment.memberLastName || ''}`.trim(),
                                      firstName: firstAssignment.memberFirstName,
                                      lastName: firstAssignment.memberLastName,
                                      email: firstAssignment.memberEmail,
                                    }}
                                  />
                                  <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
                                    {firstAssignment.memberFirstName}
                                  </span>
                                </div>
                              )}
                              {job.scheduledTime && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  {job.scheduledTime}
                                </span>
                              )}
                              {isActive && elapsed && (
                                <span className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: 'hsl(var(--trade))' }}>
                                  <Timer className="h-2.5 w-2.5" />
                                  {elapsed}
                                </span>
                              )}
                              {!firstAssignment && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Unassigned</span>
                              )}
                            </div>
                            {!isExpanded && job.address && (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                                <span className="truncate">{job.address}</span>
                              </div>
                            )}
                            {isExpanded && (
                              <div className="pt-1.5 mt-1 border-t space-y-1.5">
                                {job.address && (
                                  <div className="flex items-start gap-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                    <span>{job.address}</span>
                                  </div>
                                )}
                                {job.client?.phone && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Phone className="h-3 w-3 flex-shrink-0" />
                                    <span>{job.client.phone}</span>
                                  </div>
                                )}
                                {job.scheduledAt && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <CalendarIcon className="h-3 w-3 flex-shrink-0" />
                                    <span>{(() => { try { return format(parseISO(job.scheduledAt), 'EEE, MMM d, yyyy'); } catch { return job.scheduledAt; } })()}</span>
                                  </div>
                                )}
                                {job.notes && (
                                  <div className="flex items-start gap-1 text-xs text-muted-foreground">
                                    <Briefcase className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                    <span className="line-clamp-3">{job.notes}</span>
                                  </div>
                                )}
                                {(job.assignments || []).filter(a => a.isActive).length > 1 && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Users className="h-3 w-3 flex-shrink-0" />
                                    <span>{job.assignments!.filter(a => a.isActive).map(a => a.memberFirstName).join(', ')}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                                  <Badge variant="secondary" className="text-[10px]">
                                    {job.status}
                                  </Badge>
                                  {job.workerStatus && job.workerStatus !== job.status && (
                                    <Badge variant="outline" className="text-[10px]">
                                      {job.workerStatus}
                                    </Badge>
                                  )}
                                  {elapsed && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
                                      <Timer className="h-2.5 w-2.5" />
                                      Started {elapsed}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {count === 0 && (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      <div className={`w-6 h-6 rounded-full mx-auto mb-2 opacity-30 ${column.color}`} />
                      No {column.label.toLowerCase()} jobs
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function ThemeAwareTiles() {
  const { theme } = useTheme();
  const map = useMap();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const tileUrl = isDark ? TILE_DARK : TILE_LIGHT;
  
  useEffect(() => {
    const tileLayer = L.tileLayer(tileUrl, { attribution: TILE_ATTRIBUTION });
    tileLayer.addTo(map);
    return () => { map.removeLayer(tileLayer); };
  }, [tileUrl, map]);
  
  return null;
}

function DispatchMapView({ dispatchJobs }: { dispatchJobs: DispatchJob[] }) {
  const jobMarkers = useMemo(() => {
    return dispatchJobs.filter(job => {
      const lat = Number(job.latitude);
      const lng = Number(job.longitude);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    }).map(job => ({
      position: [Number(job.latitude), Number(job.longitude)] as [number, number],
      job,
    }));
  }, [dispatchJobs]);

  const workerMarkers = useMemo(() => {
    const markers: { position: [number, number]; assignment: DispatchAssignment; jobTitle: string }[] = [];
    dispatchJobs.forEach(job => {
      (job.assignments || []).forEach(assignment => {
        if (assignment.assignmentStatus === 'en_route' && assignment.latestPing) {
          const lat = Number(assignment.latestPing.latitude);
          const lng = Number(assignment.latestPing.longitude);
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            markers.push({
              position: [lat, lng],
              assignment,
              jobTitle: job.title,
            });
          }
        }
      });
    });
    return markers;
  }, [dispatchJobs]);

  const center = useMemo<[number, number]>(() => {
    const allPoints = [
      ...jobMarkers.map(m => m.position),
      ...workerMarkers.map(m => m.position),
    ];
    if (allPoints.length === 0) return [-16.92, 145.77];
    const avgLat = allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length;
    const avgLng = allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length;
    return [avgLat, avgLng];
  }, [jobMarkers, workerMarkers]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <MapIcon className="h-4 w-4" />
            Dispatch Map
          </CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {jobMarkers.length} jobs
            </span>
            <span className="flex items-center gap-1">
              <Navigation className="h-3 w-3" />
              {workerMarkers.length} en route
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
      <div className="rounded-b-lg overflow-hidden">
      <MapContainer
        center={center}
        zoom={jobMarkers.length + workerMarkers.length > 0 ? 11 : 4}
        className="h-[550px] w-full"
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <ThemeAwareTiles />
        {jobMarkers.map(({ position, job }) => {
          const statusColors: Record<string, { bg: string; text: string }> = {
            scheduled: { bg: '#dbeafe', text: '#1d4ed8' },
            assigned: { bg: '#dbeafe', text: '#1d4ed8' },
            en_route: { bg: '#fef3c7', text: '#b45309' },
            arrived: { bg: '#ede9fe', text: '#6d28d9' },
            in_progress: { bg: '#ffedd5', text: '#c2410c' },
            completed: { bg: '#dcfce7', text: '#15803d' },
          };
          const sc = statusColors[job.status] || statusColors.scheduled;
          return (
          <Marker key={`job-${job.id}`} position={position} icon={createJobIcon(job.status)}>
            <Popup>
              <div className="min-w-[200px] p-1">
                <p style={{ fontWeight: 600, fontSize: '13px', margin: '0 0 4px 0', color: '#1a1a1a' }}>{job.title}</p>
                {job.client && <p style={{ fontSize: '12px', color: '#666', margin: '0 0 2px 0' }}>{job.client.name}</p>}
                {job.address && <p style={{ fontSize: '11px', color: '#888', margin: '0 0 6px 0' }}>{job.address}</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: sc.bg, color: sc.text }}>{job.status.replace(/_/g, ' ')}</span>
                  {job.scheduledTime && <span style={{ fontSize: '11px', color: '#888' }}>{job.scheduledTime}</span>}
                </div>
              </div>
            </Popup>
          </Marker>
          );
        })}
        {workerMarkers.map(({ position, assignment, jobTitle }, index) => {
          const initials = ((assignment.memberFirstName?.[0] || '') + (assignment.memberLastName?.[0] || '')).toUpperCase() || '??';
          return (
          <Marker key={`worker-${assignment.id}-${index}`} position={position} icon={createWorkerIcon(initials)}>
            <Popup>
              <div className="min-w-[200px] p-1">
                <p style={{ fontWeight: 600, fontSize: '13px', margin: '0 0 4px 0', color: '#1a1a1a' }}>
                  {assignment.memberFirstName} {assignment.memberLastName}
                </p>
                <p style={{ fontSize: '12px', color: '#666', margin: '0 0 6px 0' }}>En route to: {jobTitle}</p>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#dcfce7', color: '#15803d' }}>En Route</span>
              </div>
            </Popup>
          </Marker>
          );
        })}
      </MapContainer>
      </div>
      </CardContent>
    </Card>
  );
}

function DispatchBoardSkeleton() {
  const cols = 4;
  return (
    <div data-testid="dispatch-board-skeleton" className="flex gap-3 overflow-x-auto pb-2">
      {Array.from({ length: cols }).map((_, ci) => (
        <div key={ci} className="flex-shrink-0 w-64 rounded-lg border bg-muted/20 p-3 space-y-3">
          {/* Column header */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-16" />
            </div>
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
          {/* Job card placeholders */}
          {Array.from({ length: ci === 0 ? 3 : ci === 1 ? 2 : ci === 2 ? 4 : 1 }).map((_, ji) => (
            <div key={ji} className="rounded-md border bg-background p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-10 rounded-full" />
              </div>
              <Skeleton className="h-2.5 w-32" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DispatchMapSkeleton() {
  return (
    <div data-testid="dispatch-map-skeleton" className="rounded-lg border overflow-hidden" style={{ height: 420 }}>
      <Skeleton className="h-full w-full rounded-none" />
    </div>
  );
}

function DispatchScheduleSkeleton() {
  const cols = 4;
  const rows = 8;
  const hourHeight = 80;
  return (
    <div className="relative">
      <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
        <table className="border-collapse" style={{ minWidth: `${48 + cols * 140}px` }}>
          <thead>
            <tr className="bg-muted/30 sticky top-0 z-20">
              <th className="sticky left-0 z-30 bg-muted/30 w-12 min-w-[48px] p-1 border-b border-r border-border" />
              {Array.from({ length: cols }).map((_, ci) => (
                <th key={ci} className="border-b border-l border-border p-2 text-left" style={{ minWidth: 140 }}>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-2 w-14" />
                    </div>
                  </div>
                  <Skeleton className="mt-1.5 h-1.5 w-full rounded-full" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, ri) => (
              <tr key={ri}>
                <td
                  className="sticky left-0 z-10 bg-background w-12 min-w-[48px] px-1.5 py-1 border-b border-r border-border align-top"
                  style={{ height: hourHeight }}
                >
                  <Skeleton className="h-2.5 w-8 mt-0.5" />
                </td>
                {Array.from({ length: cols }).map((_, ci) => (
                  <td
                    key={ci}
                    className="border-b border-l border-border"
                    style={{ height: hourHeight, minWidth: 140 }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpsHealthBanner({ opsHealth, opsHealthError }: { opsHealth?: OpsHealth; opsHealthError?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const { data: jobAgingData } = useQuery<{ totalAging: number; criticalCount: number; agingJobs: any[] }>({
    queryKey: ['/api/ops/job-aging'],
  });

  if (opsHealthError) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 mb-3 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
        <span>Ops health could not be loaded</span>
      </div>
    );
  }

  if (!opsHealth) return null;

  const agingCount = jobAgingData?.totalAging || 0;
  const hasIssues = opsHealth.conflictCount > 0 || opsHealth.overdueJobs > 0 ||
    opsHealth.unassignedJobs > 0 || opsHealth.overCapacityWorkers > 0 || opsHealth.overdueInvoices > 0 || agingCount > 0;

  if (!hasIssues) return null;

  const severity = opsHealth.conflictCount > 0 ? 'critical' :
    (opsHealth.overdueJobs > 0 || opsHealth.overCapacityWorkers > 0 || (jobAgingData?.criticalCount || 0) > 0) ? 'warning' : 'info';

  return (
    <div className={`rounded-lg border px-3 py-2 mb-3 ${
      severity === 'critical' ? 'bg-destructive/5 border-destructive/20' :
      severity === 'warning' ? 'bg-amber-500/5 border-amber-500/20' :
      'bg-muted/50 border-border'
    }`}>
      <div
        className="flex items-center gap-3 cursor-pointer flex-wrap"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {severity === 'critical' ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          )}
          <span className={`text-xs font-semibold ${
            severity === 'critical' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'
          }`}>
            Ops Alert
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-1">
          {opsHealth.conflictCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-destructive/10 text-destructive">
              <AlertCircle className="h-3 w-3" />
              {opsHealth.conflictCount} Conflicts
            </span>
          )}
          {opsHealth.overdueJobs > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-3 w-3" />
              {opsHealth.overdueJobs} Overdue
            </span>
          )}
          {opsHealth.unassignedJobs > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Briefcase className="h-3 w-3" />
              {opsHealth.unassignedJobs} Unassigned
            </span>
          )}
          {opsHealth.overCapacityWorkers > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Users className="h-3 w-3" />
              {opsHealth.overCapacityWorkers} Over Capacity
            </span>
          )}
          {opsHealth.overdueInvoices > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" />
              {opsHealth.overdueInvoices} Overdue Invoices
            </span>
          )}
          {agingCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" 
              style={{ backgroundColor: (jobAgingData?.criticalCount ?? 0) > 0 ? 'hsl(var(--destructive) / 0.1)' : 'hsl(45 100% 50% / 0.15)', color: (jobAgingData?.criticalCount ?? 0) > 0 ? 'hsl(var(--destructive))' : 'hsl(45 80% 35%)' }}>
              <AlertTriangle className="h-3 w-3" />
              {agingCount} Stale Jobs
            </span>
          )}
        </div>

        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {expanded && opsHealth.conflicts.length > 0 && (
        <div className="mt-2 pt-2 border-t space-y-1.5">
          <p className="text-xs font-medium text-destructive">Schedule Conflicts:</p>
          {opsHealth.conflicts.map((conflict, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <AlertCircle className="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium">{conflict.memberName}</span>
                <span className="text-muted-foreground"> has overlapping jobs: </span>
                {conflict.jobs.map((j, k) => (
                  <span key={j.id}>
                    {k > 0 && ', '}
                    <span className="font-medium">{j.title}</span>
                    <span className="text-muted-foreground"> ({j.time})</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {agingCount > 0 && expanded && (
        <div className="mt-2 space-y-1">
          <p className="text-xs font-medium">Stale Jobs (stuck too long in status):</p>
          {(jobAgingData?.agingJobs || []).slice(0, 5).map((j: any) => (
            <div key={j.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3" style={{ color: j.severity === 'critical' ? 'hsl(var(--destructive))' : 'hsl(45 80% 35%)' }} />
              <span className="font-medium">{j.title}</span>
              <Badge variant="outline" className="text-[10px] h-4">{j.status}</Badge>
              <span>{j.daysInStatus}d in status ({j.daysOverThreshold}d over)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function detectScheduleConflicts(jobs: Job[]): Set<string> {
  const conflictIds = new Set<string>();
  const jobsWithTimes = jobs
    .filter(j => j.scheduledAt && j.scheduledTime)
    .map(j => {
      const { hour, minute } = parseJobTime(j.scheduledTime, j.scheduledAt);
      const startMinutes = hour * 60 + minute;
      const duration = j.estimatedDuration || 60;
      const endMinutes = startMinutes + duration;
      return { ...j, startMinutes, endMinutes };
    });

  const byAssignee: Record<string, typeof jobsWithTimes> = {};
  jobsWithTimes.forEach(j => {
    const key = j.assignedTo || 'owner';
    if (!byAssignee[key]) byAssignee[key] = [];
    byAssignee[key].push(j);
  });

  Object.values(byAssignee).forEach(memberJobs => {
    memberJobs.sort((a, b) => a.startMinutes - b.startMinutes);
    for (let i = 0; i < memberJobs.length; i++) {
      for (let k = i + 1; k < memberJobs.length; k++) {
        if (memberJobs[i].endMinutes > memberJobs[k].startMinutes) {
          conflictIds.add(memberJobs[i].id);
          conflictIds.add(memberJobs[k].id);
        }
      }
    }
  });

  return conflictIds;
}

export default function DispatchBoard() {
  const [topView, setTopView] = useState<'schedule' | 'board' | 'map'>('schedule');
  const [opsPanelOpen, setOpsPanelOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [unscheduledDrawerOpen, setUnscheduledDrawerOpen] = useState(false);
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [equipmentTab, setEquipmentTab] = useState('all');
  const [showAllEquipment, setShowAllEquipment] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scheduleScrollRef = useRef<HTMLDivElement>(null);
  const [currentDate, setCurrentDate] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    if (dateParam) {
      const parsed = parseISO(dateParam);
      if (!isNaN(parsed.getTime())) return startOfDay(parsed);
    }
    const saved = sessionStorage.getItem('dispatch-board-date');
    if (saved) {
      const parsed = parseISO(saved);
      if (!isNaN(parsed.getTime())) return startOfDay(parsed);
    }
    return startOfDay(new Date());
  });
  const [viewMode, setViewMode] = useState<'day' | '3day' | 'week'>('day');
  const [hiddenWorkerIds, setHiddenWorkerIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('dispatch-hidden-workers');
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const toggleWorkerColumn = useCallback((id: string) => {
    setHiddenWorkerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const [draggedJob, setDraggedJob] = useState<DraggedJob | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [selectedJob, setSelectedJob] = useState<SelectedJobForAssignment | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('owner');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('09:00');
  const [quickAssignJob, setQuickAssignJob] = useState<Job | null>(null);
  const [quickAssignMember, setQuickAssignMember] = useState<string>('');
  const [quickAssignTimeSlot, setQuickAssignTimeSlot] = useState<string>('09:00');
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: businessSettings } = useQuery<any>({
    queryKey: ['/api/business-settings'],
  });

  const scheduleStartHour = businessSettings?.scheduleStartHour ?? 6;
  const scheduleEndHour = businessSettings?.scheduleEndHour ?? 20;
  const WORK_HOURS = useMemo(() => buildWorkHours(scheduleStartHour, scheduleEndHour), [scheduleStartHour, scheduleEndHour]);
  const timeSlots = useMemo(() => buildTimeSlots(scheduleStartHour, scheduleEndHour), [scheduleStartHour, scheduleEndHour]);

  const updateScheduleHoursMutation = useMutation({
    mutationFn: async (data: { scheduleStartHour?: number; scheduleEndHour?: number }) => {
      return apiRequest('PATCH', '/api/business-settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
    },
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: teamMembers = [], isLoading: teamMembersLoading } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
  });

  const { data: workerStatesData = [] } = useQuery<any[]>({
    queryKey: ['/api/team/worker-states'],
  });

  const { data: dispatchJobs = [], isLoading: dispatchLoading } = useQuery<DispatchJob[]>({
    queryKey: ['/api/dispatch/board'],
    enabled: topView === 'board' || topView === 'map',
  });

  // AI Scheduling Suggestions
  const { 
    data: aiSuggestions, 
    isLoading: suggestionsLoading,
    refetch: refetchSuggestions 
  } = useQuery<ScheduleSuggestionsResponse>({
    queryKey: ['/api/ai/schedule-suggestions', format(currentDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/ai/schedule-suggestions', {
        targetDate: format(currentDate, 'yyyy-MM-dd')
      });
      return response.json();
    },
    enabled: showAISuggestions,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: opsHealth, isError: opsHealthError } = useQuery<OpsHealth>({
    queryKey: ['/api/ops/health'],
  });

  const { data: dispatchResources, isError: dispatchResourcesError } = useQuery<{
    deployedEquipment: Array<{assignmentId: string; equipmentId: string; equipmentName: string; category: string; categoryId?: string; serialNumber: string; model?: string; manufacturer?: string; jobId: string; jobTitle: string; jobStatus: string; notes?: string; assignedToName?: string | null}>;
    allEquipment: Array<{id: string; name: string; description: string; model: string; serialNumber: string; manufacturer: string; categoryId: string | null; categoryName: string; status: string; location: string; assignedTo: string | null; assignedToName: string | null; isDeployed: boolean; deployedJobTitle: string | null; deployedJobId: string | null; deployedJobStatus: string | null}>;
    categories: Array<{id: string; name: string}>;
    materialsNeeded: Array<{id: string; name: string; quantity: string; unit: string; status: string; supplier?: string; jobId: string; jobTitle: string}>;
    totalEquipment: number;
    availableEquipment: number;
  }>({
    queryKey: ['/api/dispatch/resources'],
  });

  // Apply AI suggestion mutation
  const applySuggestionMutation = useMutation({
    mutationFn: async (suggestion: ScheduleSuggestion) => {
      const scheduledAt = new Date(`${suggestion.suggestedDate}T${suggestion.suggestedTime}:00`);
      return apiRequest('PATCH', `/api/jobs/${suggestion.jobId}`, {
        scheduledAt: scheduledAt.toISOString(),
        scheduledTime: suggestion.suggestedTime,
        assignedTo: suggestion.suggestedAssignee === 'owner' ? null : suggestion.suggestedAssignee,
        status: 'scheduled'
      });
    },
    onSuccess: (_, suggestion) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setAppliedSuggestions(prev => new Set(prev).add(suggestion.jobId));
      toast({
        title: "Job scheduled",
        description: `${suggestion.jobTitle} scheduled for ${suggestion.suggestedTime}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to schedule",
        description: error.message || "Could not apply the suggestion",
        variant: "destructive",
      });
    },
  });

  const clientsMap = useMemo(() => 
    new Map(clients.map(c => [c.id, c])), 
    [clients]
  );

  const rescheduleJobMutation = useMutation({
    mutationFn: async ({ 
      jobId, 
      scheduledAt, 
      scheduledTime,
      assignedTo 
    }: { 
      jobId: string; 
      scheduledAt: string;
      scheduledTime?: string;
      assignedTo: string | null;
    }) => {
      return apiRequest('PATCH', `/api/jobs/${jobId}`, {
        scheduledAt,
        scheduledTime,
        assignedTo,
        status: 'scheduled'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Job rescheduled",
        description: "The job has been moved to the new time slot",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reschedule",
        description: error.message || "Could not move the job",
        variant: "destructive",
      });
    },
  });

  const unscheduleJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest('PATCH', `/api/jobs/${jobId}`, {
        scheduledAt: null,
        scheduledTime: null,
        assignedTo: null,
        status: 'pending'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Job unscheduled",
        description: "The job has been removed from the schedule",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to unschedule",
        description: error.message || "Could not unschedule the job",
        variant: "destructive",
      });
    },
  });

  const jobsWithClients = useMemo(() => 
    jobs.map(job => ({
      ...job,
      clientName: clientsMap.get(job.clientId)?.name || 'Unknown Client',
      clientPhone: clientsMap.get(job.clientId)?.phone,
    })),
    [jobs, clientsMap]
  );

  const scheduledJobsForDate = useMemo(() => {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    return jobsWithClients.filter(job => {
      if (!job.scheduledAt) return false;
      const jobDate = format(parseISO(job.scheduledAt), 'yyyy-MM-dd');
      return jobDate === dateStr;
    }).sort((a, b) => {
      const aTime = parseJobTime(a.scheduledTime, a.scheduledAt);
      const bTime = parseJobTime(b.scheduledTime, b.scheduledAt);
      return (aTime.hour * 60 + aTime.minute) - (bTime.hour * 60 + bTime.minute);
    });
  }, [jobsWithClients, currentDate]);

  const unscheduledJobs = useMemo(() => 
    jobsWithClients.filter(job => 
      !job.scheduledAt && 
      ['pending', 'scheduled'].includes(job.status.toLowerCase())
    ),
    [jobsWithClients]
  );

  const teamMembersWithJobs = useMemo(() => {
    const ownerMember = {
      id: 'owner',
      memberId: 'owner',
      firstName: 'Me',
      lastName: '(Owner)',
      email: '',
      roleName: 'Owner',
      profileImageUrl: undefined as string | undefined,
      isActive: true,
    };

    const allMembers = [ownerMember, ...teamMembers.filter(m => m.isActive)];
    
    const claimedJobIds = new Set<string>();
    
    return allMembers.map(member => {
      const memberJobs = scheduledJobsForDate.filter(job => {
        if (claimedJobIds.has(job.id)) return false;
        const match = job.assignedTo === member.memberId || 
          job.assignedTo === member.id ||
          (!job.assignedTo && member.id === 'owner');
        if (match) claimedJobIds.add(job.id);
        return match;
      });

      const totalMinutes = memberJobs.reduce((sum, job) => 
        sum + (job.estimatedDuration || 60), 0
      );

      return {
        ...member,
        jobs: memberJobs,
        totalHours: Math.round(totalMinutes / 60 * 10) / 10,
        capacity: 8,
      };
    });
  }, [teamMembers, scheduledJobsForDate]);

  useEffect(() => {
    try {
      localStorage.setItem('dispatch-hidden-workers', JSON.stringify(Array.from(hiddenWorkerIds)));
    } catch {}
  }, [hiddenWorkerIds]);

  const visibleMembers = useMemo(
    () => teamMembersWithJobs.filter(m => !hiddenWorkerIds.has(m.id)),
    [teamMembersWithJobs, hiddenWorkerIds]
  );

  const columnPicker = teamMembersWithJobs.length > 0 ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-column-picker">
          <Columns3 className="h-4 w-4" />
          Workers
          {hiddenWorkerIds.size > 0 && (
            <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px]">
              {visibleMembers.length}/{teamMembersWithJobs.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Show worker columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {teamMembersWithJobs.map(member => (
          <DropdownMenuCheckboxItem
            key={member.id}
            checked={!hiddenWorkerIds.has(member.id)}
            onCheckedChange={() => toggleWorkerColumn(member.id)}
            onSelect={(e) => e.preventDefault()}
            data-testid={`toggle-worker-${member.id}`}
          >
            {member.firstName} {member.lastName?.[0] ? member.lastName[0] + '.' : ''}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => setHiddenWorkerIds(new Set())}
          disabled={hiddenWorkerIds.size === 0}
          data-testid="button-show-all-workers"
        >
          <Eye className="h-4 w-4 mr-2" /> Show all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const getBestFitWorker = useCallback(() => {
    const available = teamMembersWithJobs.filter(m => m.totalHours < m.capacity);
    if (available.length === 0) return null;
    return available.reduce((best, curr) => 
      (curr.totalHours / curr.capacity) < (best.totalHours / best.capacity) ? curr : best
    );
  }, [teamMembersWithJobs]);

  const handleScheduleScroll = useCallback(() => {
    const el = scheduleScrollRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  }, []);

  useEffect(() => {
    const timer = setTimeout(handleScheduleScroll, 100);
    return () => clearTimeout(timer);
  }, [handleScheduleScroll, opsPanelOpen, teamMembersWithJobs.length]);

  useEffect(() => {
    sessionStorage.setItem('dispatch-board-date', format(currentDate, 'yyyy-MM-dd'));
  }, [currentDate]);

  useEffect(() => {
    const el = scheduleScrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(handleScheduleScroll);
    obs.observe(el);
    return () => obs.disconnect();
  }, [handleScheduleScroll]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (unscheduledDrawerOpen) setUnscheduledDrawerOpen(false);
        else setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen, unscheduledDrawerOpen]);

  const conflictJobIds = useMemo(() => 
    detectScheduleConflicts(scheduledJobsForDate),
    [scheduledJobsForDate]
  );

  const handleDragStart = (e: React.DragEvent, job: Job, memberId: string | null) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    setDraggedJob({ job, originMemberId: memberId });
  };

  const lastDragOverSlotRef = useRef<string | null>(null);
  const handleDragOver = (e: React.DragEvent, slotId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (lastDragOverSlotRef.current !== slotId) {
      lastDragOverSlotRef.current = slotId;
      setDragOverSlot(slotId);
    }
  };

  const handleDragLeave = () => {
    lastDragOverSlotRef.current = null;
    setDragOverSlot(null);
  };

  const handleDrop = (e: React.DragEvent, memberId: string, hour: number) => {
    e.preventDefault();
    setDragOverSlot(null);

    if (!draggedJob) return;

    const scheduledDate = new Date(currentDate);
    scheduledDate.setHours(hour, 0, 0, 0);
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;

    const mutationPayload = {
      jobId: draggedJob.job.id,
      scheduledAt: scheduledDate.toISOString(),
      scheduledTime: timeStr,
      assignedTo: memberId === 'owner' ? null : memberId,
    };

    const existingJobsForMember = scheduledJobsForDate.filter(j => 
      ((memberId === 'owner' ? !j.assignedTo : (j.assignedTo === memberId)) || (!j.assignedTo && memberId === 'owner')) &&
      j.id !== draggedJob.job.id
    );
    const newJobStart = hour * 60;
    const newJobEnd = newJobStart + (draggedJob.job.estimatedDuration || 60);
    const hasConflict = existingJobsForMember.some(j => {
      if (!j.scheduledTime) return false;
      const { hour: jHour, minute: jMin } = parseJobTime(j.scheduledTime, j.scheduledAt);
      const jStart = jHour * 60 + jMin;
      const jEnd = jStart + (j.estimatedDuration || 60);
      return newJobStart < jEnd && newJobEnd > jStart;
    });

    if (hasConflict) {
      toast({
        title: "Schedule conflict",
        description: `This time overlaps with another job for this worker. The job was still assigned - review the schedule.`,
        variant: "destructive",
      });
    }

    rescheduleJobMutation.mutate(mutationPayload);

    setDraggedJob(null);
  };

  const handleUnscheduledDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedJob) return;

    unscheduleJobMutation.mutate(draggedJob.job.id);
    setDraggedJob(null);
  };

  // Click-based assignment for mobile support
  // This enters "selection mode" - user can then tap a slot OR open the dialog
  const handleJobClick = (job: Job, mode: 'assign' | 'reassign') => {
    setSelectedJob({ job, mode });
    setSelectedMemberId(job.assignedTo || 'owner');
    const parsed = parseJobTime(job.scheduledTime, job.scheduledAt);
    const minute = job.scheduledTime ? parseInt(job.scheduledTime.split(':')[1] || '0') : 0;
    const roundedMin = minute >= 15 && minute < 45 ? 30 : 0;
    setSelectedTimeSlot(`${parsed.hour.toString().padStart(2, '0')}:${roundedMin.toString().padStart(2, '0')}`);
    // Don't open dialog immediately - let user tap a slot or use "Assign with Dialog" button
  };

  const handleAssignJob = () => {
    if (!selectedJob || rescheduleJobMutation.isPending) return;

    const [slotH, slotM] = selectedTimeSlot.split(':').map(Number);
    const scheduledDate = new Date(currentDate);
    scheduledDate.setHours(slotH, slotM, 0, 0);
    const timeStr = selectedTimeSlot;

    const mutationPayload = {
      jobId: selectedJob.job.id,
      scheduledAt: scheduledDate.toISOString(),
      scheduledTime: timeStr,
      assignedTo: selectedMemberId === 'owner' ? null : selectedMemberId,
    };

    rescheduleJobMutation.mutate(mutationPayload, {
      onSuccess: () => {
        setAssignDialogOpen(false);
        setSelectedJob(null);
      },
    });
  };

  const handleSlotClick = (memberId: string, hour: number) => {
    if (!selectedJob || rescheduleJobMutation.isPending) return;
    
    const scheduledDate = new Date(currentDate);
    scheduledDate.setHours(hour, 0, 0, 0);
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;

    const mutationPayload = {
      jobId: selectedJob.job.id,
      scheduledAt: scheduledDate.toISOString(),
      scheduledTime: timeStr,
      assignedTo: memberId === 'owner' ? null : memberId,
    };

    rescheduleJobMutation.mutate(mutationPayload, {
      onSuccess: () => {
        setSelectedJob(null);
      },
    });
  };

  const cancelJobSelection = () => {
    setSelectedJob(null);
    setAssignDialogOpen(false);
  };

  const getJobPosition = (job: Job) => {
    const { hour, minute } = parseJobTime(job.scheduledTime, job.scheduledAt);
    const startHour = WORK_HOURS[0];
    const endHour = WORK_HOURS[WORK_HOURS.length - 1];
    const safeHour = isNaN(hour) ? 9 : hour;
    const safeMinute = isNaN(minute) ? 0 : minute;
    const clampedHour = Math.max(startHour, Math.min(endHour, safeHour));
    const clampedMinute = clampedHour === endHour ? 0 : safeMinute;
    const totalGridHeight = WORK_HOURS.length * HOUR_HEIGHT;
    let top = (clampedHour - startHour) * HOUR_HEIGHT + (clampedMinute / 60) * HOUR_HEIGHT;
    top = Math.max(0, Math.min(top, totalGridHeight - 40));
    const duration = job.estimatedDuration || 60;
    const maxHeight = totalGridHeight - top;
    const height = Math.min(Math.max((duration / 60) * HOUR_HEIGHT, 40), maxHeight);
    return { top, height };
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'next' ? addDays(prev, 1) : subDays(prev, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  const getWeekDays = useCallback(() => {
    const startOfCurrentWeek = new Date(currentDate);
    const day = startOfCurrentWeek.getDay();
    const diff = startOfCurrentWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfCurrentWeek.setDate(diff);
    return Array.from({ length: 7 }, (_, i) => addDays(startOfCurrentWeek, i));
  }, [currentDate]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'next' ? addDays(prev, 7) : subDays(prev, 7));
  };

  const weekDays = useMemo(() => getWeekDays(), [getWeekDays]);

  const jobsByDate = useMemo(() => {
    const map: Record<string, typeof jobsWithClients> = {};
    weekDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      map[dateStr] = jobsWithClients.filter(job => {
        if (!job.scheduledAt) return false;
        return format(parseISO(job.scheduledAt), 'yyyy-MM-dd') === dateStr;
      }).sort((a, b) => {
        const aTime = parseJobTime(a.scheduledTime, a.scheduledAt);
        const bTime = parseJobTime(b.scheduledTime, b.scheduledAt);
        return (aTime.hour * 60 + aTime.minute) - (bTime.hour * 60 + bTime.minute);
      });
    });
    return map;
  }, [weekDays, jobsWithClients]);

  const threeDayDates = useMemo(() => {
    return Array.from({ length: 3 }, (_, i) => addDays(currentDate, i));
  }, [currentDate]);

  const jobsByThreeDay = useMemo(() => {
    const map: Record<string, typeof jobsWithClients> = {};
    threeDayDates.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      map[dateStr] = jobsWithClients.filter(job => {
        if (!job.scheduledAt) return false;
        return format(parseISO(job.scheduledAt), 'yyyy-MM-dd') === dateStr;
      }).sort((a, b) => {
        const aTime = parseJobTime(a.scheduledTime, a.scheduledAt);
        const bTime = parseJobTime(b.scheduledTime, b.scheduledAt);
        return (aTime.hour * 60 + aTime.minute) - (bTime.hour * 60 + bTime.minute);
      });
    });
    return map;
  }, [threeDayDates, jobsWithClients]);

  const isToday = isSameDay(currentDate, new Date());

  return (
    <PageShell data-testid="dispatch-board">
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <PageHeader
            title="Dispatch Board"
            subtitle="Live operations center"
            leading={<Navigation className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/team-operations')}
            className="gap-1.5"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Team Management
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-md bg-muted/40 border px-3 py-2">
          <div className="flex items-center gap-1 bg-background rounded-md p-0.5">
            <Button
              variant={topView === 'schedule' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTopView('schedule')}
            >
              <CalendarIcon className="h-4 w-4 mr-1.5" />
              Schedule
            </Button>
            <Button
              variant={topView === 'board' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTopView('board')}
            >
              <LayoutGrid className="h-4 w-4 mr-1.5" />
              Board
            </Button>
            <Button
              variant={topView === 'map' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTopView('map')}
            >
              <MapIcon className="h-4 w-4 mr-1.5" />
              Map
            </Button>
          </div>

          {topView === 'schedule' && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => viewMode === 'week' ? navigateWeek('prev') : viewMode === '3day' ? setCurrentDate(prev => subDays(prev, 3)) : navigateDate('prev')} data-testid="button-prev-day-bar">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant={isToday ? "default" : "outline"} size="sm" onClick={goToToday} data-testid="button-today-bar">
                Today
              </Button>
              <span className="text-sm font-semibold hidden md:inline-flex items-center gap-1.5">
                {viewMode === 'week'
                  ? `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d, yyyy')}`
                  : <>
                      {isToday && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'hsl(var(--trade))' }} /><span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'hsl(var(--trade))' }} /></span>}
                      {format(currentDate, 'EEE, MMM d')}
                    </>
                }
              </span>
              <Button variant="outline" size="icon" onClick={() => viewMode === 'week' ? navigateWeek('next') : viewMode === '3day' ? setCurrentDate(prev => addDays(prev, 3)) : navigateDate('next')} data-testid="button-next-day-bar">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs font-medium flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--trade))' }} />
              <span className="font-semibold tabular-nums" style={{ color: 'hsl(var(--trade))' }}>{scheduledJobsForDate.length}</span>
              <span className="text-muted-foreground">Scheduled</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="font-semibold tabular-nums text-orange-600">{scheduledJobsForDate.filter(j => j.status === 'in_progress').length}</span>
              <span className="text-muted-foreground">Active</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="font-semibold tabular-nums text-amber-600">{unscheduledJobs.length}</span>
              <span className="text-muted-foreground">Unscheduled</span>
            </div>
          </div>
        </div>
      </div>

      <OpsHealthBanner opsHealth={opsHealth} opsHealthError={opsHealthError} />

      {topView === 'board' && (
        dispatchLoading ? (
          <DispatchBoardSkeleton />
        ) : (
          <KanbanBoard dispatchJobs={dispatchJobs} teamMembers={teamMembers} />
        )
      )}

      {topView === 'map' && (
        dispatchLoading ? (
          <DispatchMapSkeleton />
        ) : (
          <DispatchMapView dispatchJobs={dispatchJobs} />
        )
      )}

      {topView === 'schedule' && selectedJob && !assignDialogOpen && (
        <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {rescheduleJobMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                <span className="text-sm font-medium">
                  Assigning <span className="text-primary">"{selectedJob.job.title}"</span>...
                </span>
              </>
            ) : (
              <>
                <Briefcase className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  Tap a time slot to assign <span className="text-primary">"{selectedJob.job.title}"</span>
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setAssignDialogOpen(true)}
              disabled={rescheduleJobMutation.isPending}
              data-testid="button-assign-with-dialog"
            >
              <Users className="h-4 w-4 mr-1" />
              Assign with Dialog
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={cancelJobSelection}
              disabled={rescheduleJobMutation.isPending}
              data-testid="button-cancel-job-selection"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {topView === 'schedule' && !isFullscreen && (
      <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <div className={`flex-1 min-w-0 ${opsPanelOpen ? 'lg:max-w-[75%]' : ''}`}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
                    <Button
                      variant={viewMode === 'day' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('day')}
                      data-testid="button-view-day"
                    >
                      Day
                    </Button>
                    <Button
                      variant={viewMode === '3day' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('3day')}
                      data-testid="button-view-3day"
                    >
                      3 Day
                    </Button>
                    <Button
                      variant={viewMode === 'week' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('week')}
                      data-testid="button-view-week"
                    >
                      Week
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {viewMode === 'day' && isToday && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'hsl(var(--trade))' }} />
                      <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'hsl(var(--trade))' }} />
                    </span>
                  )}
                  <h2 className="text-sm font-semibold">
                    {viewMode === 'week'
                      ? `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d, yyyy')}`
                      : viewMode === '3day'
                        ? `${format(threeDayDates[0], 'MMM d')} - ${format(threeDayDates[2], 'MMM d, yyyy')}`
                        : format(currentDate, 'EEEE, MMMM d, yyyy')
                    }
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {viewMode === 'week'
                      ? `${Object.values(jobsByDate).reduce((sum, jobs) => sum + jobs.length, 0)} jobs`
                      : viewMode === '3day'
                        ? `${Object.values(jobsByThreeDay).reduce((sum, jobs) => sum + jobs.length, 0)} jobs`
                        : `${scheduledJobsForDate.length} job${scheduledJobsForDate.length !== 1 ? 's' : ''}`
                    }
                  </span>
                  {viewMode === 'day' && teamMembersWithJobs.length > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {teamMembersWithJobs.length} crew
                      {canScrollRight && (
                        <span className="text-[10px] text-muted-foreground/70 ml-0.5">
                          — scroll for more
                        </span>
                      )}
                    </span>
                  )}
                  {viewMode === 'day' && columnPicker}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid="button-schedule-settings">
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64" align="end">
                      <div className="space-y-3">
                        <p className="text-sm font-medium">Schedule Hours</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs text-muted-foreground">Start</Label>
                            <Select
                              value={String(scheduleStartHour)}
                              onValueChange={(val) => {
                                const v = Number(val);
                                if (v < scheduleEndHour) updateScheduleHoursMutation.mutate({ scheduleStartHour: v });
                              }}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {HOUR_OPTIONS.filter(h => h < scheduleEndHour).map(h => (
                                  <SelectItem key={h} value={String(h)}>{formatTime(h)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <span className="text-muted-foreground text-xs pt-5">to</span>
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs text-muted-foreground">End</Label>
                            <Select
                              value={String(scheduleEndHour)}
                              onValueChange={(val) => {
                                const v = Number(val);
                                if (v > scheduleStartHour) updateScheduleHoursMutation.mutate({ scheduleEndHour: v });
                              }}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {HOUR_OPTIONS.filter(h => h > scheduleStartHour).map(h => (
                                  <SelectItem key={h} value={String(h)}>{formatTime(h)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {[
                            { label: 'Early (5a–3p)', start: 5, end: 15 },
                            { label: 'Standard (6a–6p)', start: 6, end: 18 },
                            { label: 'Extended (6a–9p)', start: 6, end: 21 },
                            { label: 'Night (6p–6a)', start: 18, end: 6 },
                            { label: '24 Hours', start: 0, end: 23 },
                          ].map(p => (
                            <Button
                              key={p.label}
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => updateScheduleHoursMutation.mutate({
                                scheduleStartHour: p.start,
                                scheduleEndHour: p.start < p.end ? p.end : 23,
                              })}
                            >
                              {p.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setIsFullscreen(true); setOpsPanelOpen(false); }}
                    data-testid="button-fullscreen-toggle"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {(jobsLoading || teamMembersLoading) ? (
                <DispatchScheduleSkeleton />
              ) : viewMode === 'week' ? (
                <div className="relative">
                  <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
                    <table className="border-collapse" style={{ minWidth: `${48 + 7 * 130}px` }}>
                      <thead>
                        <tr className="bg-muted/30 sticky top-0 z-20">
                          <th className="sticky left-0 z-30 bg-muted/30 w-12 min-w-[48px] p-1 text-left text-[10px] font-medium text-muted-foreground border-b border-r border-border">
                            Time
                          </th>
                          {weekDays.map(day => {
                            const isDayToday = isSameDay(day, new Date());
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const dayJobs = jobsByDate[dateStr] || [];
                            return (
                              <th
                                key={dateStr}
                                className={`border-b border-l border-border p-2 text-center cursor-pointer transition-colors ${isDayToday ? 'bg-muted/50' : ''}`}
                                style={{ minWidth: 130 }}
                                onClick={() => { setCurrentDate(day); setViewMode('day'); }}
                              >
                                <p className={`text-[10px] font-medium ${isDayToday ? '' : 'text-muted-foreground'}`}>{format(day, 'EEE')}</p>
                                <p className="text-base font-bold tabular-nums" style={isDayToday ? { color: 'hsl(var(--trade))' } : undefined}>
                                  {format(day, 'd')}
                                </p>
                                {dayJobs.length > 0 && (
                                  <div className="flex items-center justify-center gap-1 mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(var(--trade))' }} />
                                    <span className="text-[10px] text-muted-foreground">{dayJobs.length}</span>
                                  </div>
                                )}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {WORK_HOURS.map(hour => (
                          <tr key={hour}>
                            <td className="sticky left-0 z-10 bg-background w-12 min-w-[48px] px-1.5 py-1 text-[11px] text-muted-foreground font-medium border-b border-r border-border align-top" style={{ height: HOUR_HEIGHT }}>
                              {formatTime(hour)}
                            </td>
                            {weekDays.map(day => {
                              const dateStr = format(day, 'yyyy-MM-dd');
                              const dayJobs = jobsByDate[dateStr] || [];
                              const isTodayCol = isSameDay(day, new Date());
                              return (
                                <td
                                  key={dateStr}
                                  className={`border-b border-l border-border relative hover:bg-muted/20 ${isTodayCol ? 'bg-muted/10' : ''}`}
                                  style={{ height: HOUR_HEIGHT, minWidth: 130, padding: 0 }}
                                >
                                  {hour === WORK_HOURS[0] && (
                                    <div className="absolute inset-0 pointer-events-none" style={{ height: WORK_HOURS.length * HOUR_HEIGHT }}>
                                      {dayJobs.map(job => {
                                        const { top, height } = getJobPosition(job);
                                        const statusStyle = getStatusStyle(job.status);
                                        return (
                                          <div
                                            key={job.id}
                                            className={`pointer-events-auto absolute left-0 right-0 mx-0.5 rounded-md border cursor-pointer overflow-hidden transition-shadow hover:shadow-md ${statusStyle.bg} ${statusStyle.border}`}
                                            style={{ top: top + 1, height: height - 2, zIndex: 10 }}
                                            onClick={() => handleJobClick(job, 'reassign')}
                                            data-testid={`week-job-${job.id}`}
                                          >
                                            <div className="p-1 h-full flex flex-col">
                                              <span className={`text-[10px] font-semibold ${statusStyle.text} truncate`}>
                                                {formatScheduledTime(job.scheduledTime, job.scheduledAt)}
                                              </span>
                                              <span className={`text-[10px] font-medium truncate ${statusStyle.text}`}>
                                                {job.title}
                                              </span>
                                              {height > 50 && (
                                                <span className="text-[9px] text-muted-foreground truncate">{job.clientName}</span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : viewMode === '3day' ? (
                <div className="relative">
                  <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
                    <table className="border-collapse w-full">
                      <thead>
                        <tr className="bg-muted/30 sticky top-0 z-20">
                          <th className="sticky left-0 z-30 bg-muted/30 w-12 min-w-[48px] p-1 text-left text-[10px] font-medium text-muted-foreground border-b border-r border-border">
                            Time
                          </th>
                          {threeDayDates.map(day => {
                            const isDayToday = isSameDay(day, new Date());
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const dayJobs = jobsByThreeDay[dateStr] || [];
                            return (
                              <th
                                key={dateStr}
                                className={`border-b border-l border-border p-2 text-center cursor-pointer transition-colors ${isDayToday ? 'bg-muted/50' : ''}`}
                                onClick={() => { setCurrentDate(day); setViewMode('day'); }}
                              >
                                <p className={`text-xs font-medium ${isDayToday ? '' : 'text-muted-foreground'}`}>{format(day, 'EEEE')}</p>
                                <p className="text-xl font-bold tabular-nums" style={isDayToday ? { color: 'hsl(var(--trade))' } : undefined}>
                                  {format(day, 'd')}
                                </p>
                                <p className="text-xs text-muted-foreground">{format(day, 'MMM')}</p>
                                {dayJobs.length > 0 && (
                                  <div className="flex items-center justify-center gap-1 mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'hsl(var(--trade))' }} />
                                    <span className="text-xs text-muted-foreground">{dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}</span>
                                  </div>
                                )}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {WORK_HOURS.map(hour => (
                          <tr key={hour}>
                            <td className="sticky left-0 z-10 bg-background w-12 min-w-[48px] px-1.5 py-1 text-[11px] text-muted-foreground font-medium border-b border-r border-border align-top" style={{ height: HOUR_HEIGHT }}>
                              {formatTime(hour)}
                            </td>
                            {threeDayDates.map(day => {
                              const dateStr = format(day, 'yyyy-MM-dd');
                              const dayJobs = jobsByThreeDay[dateStr] || [];
                              const isTodayCol = isSameDay(day, new Date());
                              return (
                                <td
                                  key={dateStr}
                                  className={`border-b border-l border-border relative hover:bg-muted/20 ${isTodayCol ? 'bg-muted/10' : ''}`}
                                  style={{ height: HOUR_HEIGHT, padding: 0 }}
                                >
                                  {hour === WORK_HOURS[0] && (
                                    <div className="absolute inset-0 pointer-events-none" style={{ height: WORK_HOURS.length * HOUR_HEIGHT }}>
                                      {dayJobs.map(job => {
                                        const { top, height } = getJobPosition(job);
                                        const statusStyle = getStatusStyle(job.status);
                                        const assignedMember = teamMembersWithJobs.find(m =>
                                          m.memberId === job.assignedTo || m.id === job.assignedTo || (!job.assignedTo && m.id === 'owner')
                                        );
                                        return (
                                          <div
                                            key={job.id}
                                            className={`pointer-events-auto absolute left-0 right-0 mx-1 rounded-md border cursor-pointer overflow-hidden transition-shadow hover:shadow-md ${statusStyle.bg} ${statusStyle.border}`}
                                            style={{ top: top + 1, height: height - 2, zIndex: 10 }}
                                            onClick={() => handleJobClick(job, 'reassign')}
                                            data-testid={`3day-job-${job.id}`}
                                          >
                                            <div className="p-1.5 h-full flex flex-col">
                                              <div className="flex items-center gap-1">
                                                <span className={`text-[11px] font-semibold ${statusStyle.text}`}>
                                                  {formatScheduledTime(job.scheduledTime, job.scheduledAt)}
                                                </span>
                                                {job.estimatedDuration && (
                                                  <span className="text-[10px] text-muted-foreground">
                                                    ({job.estimatedDuration >= 60 ? `${Math.round(job.estimatedDuration / 60)}h` : `${job.estimatedDuration}m`})
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-1.5 mt-0.5">
                                                {assignedMember && (
                                                  <UserAvatar
                                                    className="h-4 w-4 flex-shrink-0"
                                                    fallbackClassName="text-[7px]"
                                                    user={{
                                                      id: assignedMember.memberId || assignedMember.id,
                                                      firstName: assignedMember.firstName,
                                                      lastName: assignedMember.lastName,
                                                      email: assignedMember.email,
                                                      photoUrl: assignedMember.profileImageUrl,
                                                    }}
                                                  />
                                                )}
                                                <span className={`text-xs font-medium truncate ${statusStyle.text}`}>
                                                  {job.title}
                                                </span>
                                              </div>
                                              {height > 55 && (
                                                <span className="text-[10px] text-muted-foreground truncate mt-0.5">{job.clientName}</span>
                                              )}
                                              {height > 75 && job.address && (
                                                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                                                  <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                                                  <span className="truncate">{job.address}</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
              <div className="relative">
                <div className="overflow-auto" ref={scheduleScrollRef} onScroll={handleScheduleScroll} style={{ maxHeight: 'calc(100vh - 240px)' }}>
                  <table className="border-collapse" style={{ minWidth: `${48 + visibleMembers.length * 140}px` }}>
                    <thead>
                      <tr className="bg-muted/30 sticky top-0 z-20">
                        <th className="sticky left-0 z-30 bg-muted/30 w-12 min-w-[48px] p-1 text-left text-[10px] font-medium text-muted-foreground border-b border-r border-border">
                          Time
                        </th>
                        {visibleMembers.map(member => (
                          <th key={member.id} className="border-b border-l border-border p-2 text-left" style={{ minWidth: 140 }}>
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                className="h-7 w-7 flex-shrink-0"
                                fallbackClassName="text-[10px]"
                                user={{
                                  id: member.memberId || member.id,
                                  firstName: member.firstName,
                                  lastName: member.lastName,
                                  email: member.email,
                                  photoUrl: member.profileImageUrl,
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {member.firstName} {member.lastName?.[0] ? member.lastName[0] + '.' : ''}
                                </p>
                                <span className="text-[10px] text-muted-foreground font-normal">
                                  {member.totalHours}h/{member.capacity}h
                                </span>
                              </div>
                            </div>
                            <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div 
                                className="h-full rounded-full transition-all"
                                style={{ 
                                  width: `${Math.min((member.totalHours / member.capacity) * 100, 100)}%`,
                                  backgroundColor: member.totalHours > member.capacity 
                                    ? 'hsl(var(--destructive))' 
                                    : 'hsl(var(--trade))'
                                }}
                              />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {WORK_HOURS.map(hour => (
                        <tr key={hour}>
                          <td className="sticky left-0 z-10 bg-background w-12 min-w-[48px] px-1.5 py-1 text-[11px] text-muted-foreground font-medium border-b border-r border-border align-top" style={{ height: HOUR_HEIGHT }}>
                            {formatTime(hour)}
                          </td>
                          {visibleMembers.map(member => {
                            const slotId = `${member.id}-${hour}`;
                            const dropSlotHour = dragOverSlot?.startsWith(`${member.id}-`) 
                              ? parseInt(dragOverSlot.split('-').pop() || '0') 
                              : null;
                            const dragDuration = draggedJob?.job.estimatedDuration || 60;
                            const dragSlots = Math.max(1, Math.ceil(dragDuration / 60));
                            const isInDropRange = dropSlotHour !== null && hour >= dropSlotHour && hour < dropSlotHour + dragSlots;
                            const isClickable = !!selectedJob;
                            return (
                              <td
                                key={slotId}
                                className={`border-b border-l border-border relative transition-colors ${
                                  isInDropRange ? 'bg-primary/10' : ''
                                } ${isClickable ? 'cursor-pointer hover:bg-primary/20 bg-primary/5' : 'hover:bg-muted/20'}`}
                                style={{ height: HOUR_HEIGHT, minWidth: 140, padding: 0 }}
                                onDragOver={(e) => handleDragOver(e, slotId)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, member.memberId, hour)}
                                onClick={() => selectedJob && handleSlotClick(member.memberId, hour)}
                                data-testid={`slot-${member.id}-${hour}`}
                              >
                                {hour === WORK_HOURS[0] && (
                                  <div className="absolute inset-0 pointer-events-none" style={{ height: WORK_HOURS.length * HOUR_HEIGHT }}>
                                    {dropSlotHour !== null && (
                                      <div
                                        className="absolute left-0 right-0 mx-1 border-2 border-dashed border-primary rounded-lg flex items-center justify-center"
                                        style={{
                                          top: (dropSlotHour - WORK_HOURS[0]) * HOUR_HEIGHT + 2,
                                          height: Math.min(dragSlots * HOUR_HEIGHT - 4, (WORK_HOURS.length * HOUR_HEIGHT) - ((dropSlotHour - WORK_HOURS[0]) * HOUR_HEIGHT) - 4),
                                          zIndex: 5,
                                          backgroundColor: 'hsl(var(--primary) / 0.08)',
                                        }}
                                      >
                                        <div className="flex flex-col items-center gap-0.5">
                                          <span className="text-xs text-primary font-medium">Drop here</span>
                                          <span className="text-[10px] text-primary/70">{formatTime(dropSlotHour)} — {Math.round(dragDuration / 60)}h</span>
                                        </div>
                                      </div>
                                    )}

                                    {member.jobs.map(job => {
                                      const { top, height } = getJobPosition(job);
                                      const statusStyle = getStatusStyle(job.status);
                                      const isSelected = selectedJob?.job.id === job.id;

                                      return (
                                        <div
                                          key={job.id}
                                          draggable
                                          className={`pointer-events-auto absolute left-0 right-0 mx-1 rounded-lg border cursor-pointer active:cursor-grabbing overflow-hidden transition-shadow hover:shadow-md ${statusStyle.bg} ${statusStyle.border} ${isSelected ? 'ring-2 ring-primary ring-offset-2' : conflictJobIds.has(job.id) ? 'ring-2 ring-destructive/60 ring-offset-1' : ''}`}
                                          style={{
                                            top: top + 1,
                                            height: height - 2,
                                            zIndex: draggedJob?.job.id === job.id ? 50 : 10,
                                            opacity: draggedJob?.job.id === job.id ? 0.5 : 1,
                                          }}
                                          onDragStart={(e) => handleDragStart(e, job, member.memberId)}
                                          onDragEnd={() => setDraggedJob(null)}
                                          onClick={(e) => { e.stopPropagation(); handleJobClick(job, 'reassign'); }}
                                          data-testid={`scheduled-job-${job.id}`}
                                        >
                                          <div className="p-2 h-full flex flex-col">
                                            <div className="flex items-center gap-1.5">
                                              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                              {conflictJobIds.has(job.id) && (
                                                <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                                              )}
                                              <span className={`text-xs font-semibold ${statusStyle.text} whitespace-nowrap`}>
                                                {formatScheduledTime(job.scheduledTime, job.scheduledAt)}
                                              </span>
                                              {job.estimatedDuration && (
                                                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                                  {job.estimatedDuration >= 60 
                                                    ? `${Math.round(job.estimatedDuration / 60)}h`
                                                    : `${job.estimatedDuration}m`}
                                                </span>
                                              )}
                                            </div>
                                            <h4 className={`font-medium text-sm truncate min-w-0 ml-5 mt-0.5 ${statusStyle.text}`}>
                                              {job.title}
                                            </h4>
                                            {height > 55 && (
                                              <p className="text-xs text-muted-foreground truncate ml-5 mt-0.5">
                                                {job.clientName}
                                              </p>
                                            )}
                                            {height > 90 && job.address && (
                                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 ml-5">
                                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                                <span className="truncate">{job.address}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {canScrollRight && (
                  <div className="absolute right-0 top-0 bottom-0 w-10 pointer-events-none z-10 bg-gradient-to-l from-card to-transparent flex items-center justify-end pr-1">
                    <div className="pointer-events-auto animate-pulse">
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
              )}
            </CardContent>
          </Card>

        </div>

        <div className={`flex flex-col gap-3 transition-all ${opsPanelOpen ? 'lg:w-[25%] lg:min-w-[320px]' : 'lg:w-10'}`}>
          <div className="flex items-center gap-2 px-1">
            <Button 
              size="icon" 
              variant="ghost"
              onClick={() => setOpsPanelOpen(!opsPanelOpen)}
              data-testid="toggle-ops-panel"
            >
              {opsPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
            {opsPanelOpen && (
              <>
                <div className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </div>
                <h2 className="text-base font-semibold">Operations Centre</h2>
                <div className="flex items-center gap-1.5 ml-auto text-xs text-muted-foreground">
                  <span>{scheduledJobsForDate.length} jobs</span>
                  <span className="text-muted-foreground/40">|</span>
                  <span>{teamMembersWithJobs.length} crew</span>
                </div>
              </>
            )}
          </div>

          {opsPanelOpen && (
          <ScrollArea className="lg:h-[calc(100vh-240px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3 pr-1">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Unscheduled Jobs
                <Badge variant="secondary" className="ml-auto">{unscheduledJobs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent 
              className="p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleUnscheduledDrop}
            >
              <ScrollArea className="h-[200px]">
                {unscheduledJobs.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">All jobs scheduled!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unscheduledJobs.map(job => {
                      const statusStyle = getStatusStyle(job.status);
                      const isSelected = selectedJob?.job.id === job.id;
                      return (
                        <div
                          key={job.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, job, null)}
                          onDragEnd={() => setDraggedJob(null)}
                          className={`p-3 rounded-lg border cursor-grab active:cursor-grabbing hover-elevate ${statusStyle.bg} ${statusStyle.border} ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''} ${draggedJob?.job.id === job.id ? 'opacity-50' : ''}`}
                          data-testid={`unscheduled-job-${job.id}`}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-1">
                                <h4 className={`font-medium text-sm ${statusStyle.text}`}>
                                  {job.title}
                                </h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setQuickAssignJob(job);
                                    setQuickAssignMember('');
                                    setQuickAssignTimeSlot('09:00');
                                  }}
                                  data-testid={`quick-assign-btn-${job.id}`}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Assign
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {job.clientName}
                              </p>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                                <Clock className="h-3 w-3 flex-shrink-0" />
                                <span className="italic">No time set — drag to schedule or tap Assign</span>
                              </div>
                              {job.address && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate">{job.address}</span>
                                </div>
                              )}
                              {(() => {
                                const bestFit = getBestFitWorker();
                                if (!bestFit) return null;
                                return (
                                  <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-dashed">
                                    <Sparkles className="h-3 w-3 flex-shrink-0" style={{ color: 'hsl(var(--trade))' }} />
                                    <span className="text-[10px] text-muted-foreground">Available:</span>
                                    <UserAvatar
                                      className="h-3.5 w-3.5"
                                      fallbackClassName="text-[7px]"
                                      user={{
                                        id: (bestFit as any).memberId || bestFit.id,
                                        firstName: bestFit.firstName,
                                        lastName: bestFit.lastName,
                                        email: bestFit.email,
                                        photoUrl: bestFit.profileImageUrl,
                                      }}
                                    />
                                    <span className="text-[10px] font-medium truncate">
                                      {bestFit.firstName}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      ({bestFit.totalHours}h/{bestFit.capacity}h)
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team Capacity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="space-y-3">
                {teamMembersWithJobs.map(member => {
                  const memberWs = workerStatesData.find((ws: any) => ws.userId === (member as any).userId || ws.userId === (member as any).memberId);
                  const wsState = memberWs?.state || 'available';
                  const wsConfig: Record<string, { color: string; bg: string; label: string; Icon: any }> = {
                    available: { color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Available', Icon: CircleDot },
                    on_job: { color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30', label: 'On Job', Icon: Briefcase },
                    travelling: { color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Travelling', Icon: Truck },
                    break: { color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', label: 'Break', Icon: Coffee },
                    delayed: { color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Delayed', Icon: AlertTriangle },
                    needs_help: { color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Help', Icon: HelpCircle },
                  };
                  const wc = wsConfig[wsState] || wsConfig.available;
                  const WsIcon = wc.Icon;
                  const stateHexColors: Record<string, string> = {
                    available: '#22c55e', on_job: '#f97316', travelling: '#3b82f6',
                    break: '#9ca3af', delayed: '#eab308', needs_help: '#ef4444',
                  };
                  return (
                  <div key={member.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <UserAvatar
                            className="h-6 w-6"
                            fallbackClassName="text-[10px]"
                            user={{
                              id: (member as any).memberId || (member as any).userId || member.id,
                              firstName: member.firstName,
                              lastName: member.lastName,
                              email: member.email,
                              photoUrl: member.profileImageUrl,
                            }}
                          />
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background"
                            style={{ backgroundColor: stateHexColors[wsState] || '#22c55e' }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {member.firstName} {member.lastName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className={`text-xs ${wc.bg} ${wc.color} gap-0.5`}>
                          <WsIcon className="h-2.5 w-2.5" />
                          {wc.label}
                        </Badge>
                        <Badge 
                          variant={member.totalHours > member.capacity ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {member.jobs.length} jobs
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${Math.min((member.totalHours / member.capacity) * 100, 100)}%`,
                            backgroundColor: member.totalHours > member.capacity 
                              ? 'hsl(var(--destructive))' 
                              : 'hsl(var(--trade))'
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-16 text-right tabular-nums">
                        {member.totalHours}h / {member.capacity}h
                      </span>
                    </div>
                  </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* AI Scheduling Suggestions */}
          <Card className="border-2" style={{ borderColor: showAISuggestions ? 'hsl(var(--trade))' : undefined }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                AI Scheduling
                {unscheduledJobs.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">{unscheduledJobs.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {!showAISuggestions ? (
                <div className="text-center py-4">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Let AI suggest optimal times and assignments for your unscheduled jobs
                  </p>
                  <Button 
                    onClick={() => setShowAISuggestions(true)}
                    disabled={unscheduledJobs.length === 0}
                    className="w-full"
                    data-testid="button-get-ai-suggestions"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Get AI Suggestions
                  </Button>
                  {unscheduledJobs.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      No unscheduled jobs to optimize
                    </p>
                  )}
                </div>
              ) : suggestionsLoading ? (
                <div className="text-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" style={{ color: 'hsl(var(--trade))' }} />
                  <p className="text-sm text-muted-foreground">
                    Analyzing jobs and team availability...
                  </p>
                </div>
              ) : aiSuggestions?.suggestions && aiSuggestions.suggestions.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{aiSuggestions.summary}</p>
                  <ScrollArea className="h-[180px]">
                    <div className="space-y-2 pr-2">
                      {aiSuggestions.suggestions.map((suggestion, index) => {
                        const isApplied = appliedSuggestions.has(suggestion.jobId);
                        return (
                          <div
                            key={suggestion.jobId}
                            className={`p-3 rounded-lg border transition-all ${
                              isApplied 
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-300' 
                                : 'bg-muted/30 hover:bg-muted/50'
                            }`}
                            data-testid={`ai-suggestion-${suggestion.jobId}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                                  <h4 className="font-medium text-sm truncate">{suggestion.jobTitle}</h4>
                                </div>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {suggestion.clientName}
                                </p>
                              </div>
                              {isApplied ? (
                                <Badge variant="default" className="bg-green-500 text-white">
                                  <Check className="h-3 w-3 mr-1" />
                                  Applied
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => applySuggestionMutation.mutate(suggestion)}
                                  disabled={applySuggestionMutation.isPending}
                                  data-testid={`button-apply-suggestion-${suggestion.jobId}`}
                                >
                                  {applySuggestionMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>Apply</>
                                  )}
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-xs">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span>{suggestion.suggestedTime}</span>
                              </div>
                              {suggestion.suggestedAssigneeName && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span>{suggestion.suggestedAssigneeName}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 italic">
                              {suggestion.reason}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  
                  {aiSuggestions.optimizationNotes && aiSuggestions.optimizationNotes.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium mb-1">Optimization notes:</p>
                      {aiSuggestions.optimizationNotes.map((note, i) => (
                        <p key={i} className="text-xs text-muted-foreground">• {note}</p>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setShowAISuggestions(false);
                        setAppliedSuggestions(new Set());
                      }}
                      data-testid="button-close-ai-suggestions"
                    >
                      Close
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => refetchSuggestions()}
                      data-testid="button-refresh-ai-suggestions"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Refresh
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {aiSuggestions?.summary || 'No suggestions needed - all jobs are scheduled!'}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="mt-2"
                    onClick={() => setShowAISuggestions(false)}
                  >
                    Close
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Navigation className="h-4 w-4" />
                Live Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--trade))' }} />
                    <span className="text-sm text-muted-foreground">Scheduled</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums" style={{ color: 'hsl(var(--trade))' }}>
                    {scheduledJobsForDate.length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    <span className="text-sm text-muted-foreground">In Progress</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums text-orange-500">
                    {scheduledJobsForDate.filter(j => j.status === 'in_progress').length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm text-muted-foreground">Completed</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums text-green-500">
                    {scheduledJobsForDate.filter(j => j.status === 'done').length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-sm text-muted-foreground">Unscheduled</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums text-amber-500">
                    {unscheduledJobs.length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Equipment Out</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums">
                    {dispatchResources?.deployedEquipment?.length ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Package className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Materials Pending</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums">
                    {dispatchResources?.materialsNeeded?.length ?? 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Wrench className="h-4 w-4" />
                Equipment
                {dispatchResourcesError ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-destructive/10 text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    Failed to load
                  </span>
                ) : dispatchResources?.totalEquipment ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    {dispatchResources.deployedEquipment.length} deployed / {dispatchResources.totalEquipment} total
                  </span>
                ) : null}
                <Button
                  variant={showAllEquipment ? 'secondary' : 'outline'}
                  size="sm"
                  className="ml-auto text-xs gap-1"
                  onClick={() => setShowAllEquipment(!showAllEquipment)}
                >
                  {showAllEquipment ? 'Deployed' : 'Show All'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              {showAllEquipment && (
                <div className="mb-3 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search equipment..."
                      value={equipmentSearch}
                      onChange={(e) => setEquipmentSearch(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <Button
                      variant={equipmentTab === 'all' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="text-[11px] h-7 px-2"
                      onClick={() => setEquipmentTab('all')}
                    >
                      All
                    </Button>
                    {(dispatchResources?.categories || []).map(cat => (
                      <Button
                        key={cat.id}
                        variant={equipmentTab === cat.id ? 'secondary' : 'ghost'}
                        size="sm"
                        className="text-[11px] h-7 px-2"
                        onClick={() => setEquipmentTab(cat.id)}
                      >
                        {cat.name}
                      </Button>
                    ))}
                    <Button
                      variant={equipmentTab === 'uncategorized' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="text-[11px] h-7 px-2"
                      onClick={() => setEquipmentTab('uncategorized')}
                    >
                      Other
                    </Button>
                  </div>
                </div>
              )}

              {showAllEquipment ? (
                (() => {
                  const allEq = (dispatchResources?.allEquipment || [])
                    .filter(eq => {
                      if (equipmentTab !== 'all' && equipmentTab !== 'uncategorized' && eq.categoryId !== equipmentTab) return false;
                      if (equipmentTab === 'uncategorized' && eq.categoryId) return false;
                      if (equipmentSearch) {
                        const q = equipmentSearch.toLowerCase();
                        return eq.name.toLowerCase().includes(q) || eq.model.toLowerCase().includes(q) || eq.serialNumber.toLowerCase().includes(q) || eq.manufacturer.toLowerCase().includes(q) || (eq.assignedToName || '').toLowerCase().includes(q);
                      }
                      return true;
                    });
                  const statusIcon = (status: string) => {
                    if (status === 'active') return <CircleDot className="h-2.5 w-2.5 text-green-500" />;
                    if (status === 'maintenance') return <Wrench className="h-2.5 w-2.5 text-yellow-500" />;
                    return <CircleDot className="h-2.5 w-2.5 text-muted-foreground" />;
                  };
                  return allEq.length === 0 ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      {equipmentSearch ? 'No equipment matches your search' : 'No equipment in this category'}
                    </div>
                  ) : (
                    <ScrollArea className="h-[280px]">
                      <div className="space-y-2">
                        {allEq.map(eq => (
                          <div key={eq.id} className={`flex items-start gap-3 p-3 rounded-md ${eq.isDeployed ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30'}`}>
                            <div className="mt-1 flex-shrink-0">{statusIcon(eq.status)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium truncate">{eq.name}</p>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                                {eq.model && <span>{eq.model}</span>}
                                {eq.serialNumber && <span className="opacity-60">SN: {eq.serialNumber}</span>}
                              </div>
                              {eq.assignedToName && (
                                <div className="flex items-center gap-1 text-[11px] mt-0.5">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">{eq.assignedToName}</span>
                                </div>
                              )}
                              {eq.isDeployed && eq.deployedJobTitle && (
                                <div className="flex items-center gap-1 text-[11px] mt-0.5">
                                  <Briefcase className="h-3 w-3" style={{ color: 'hsl(var(--trade))' }} />
                                  <span style={{ color: 'hsl(var(--trade))' }}>{eq.deployedJobTitle}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <Badge variant="secondary" className="text-[10px]">
                                {eq.categoryName}
                              </Badge>
                              {eq.isDeployed && (
                                <Badge variant="default" className="text-[10px]">
                                  In Use
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  );
                })()
              ) : (
                !dispatchResources?.deployedEquipment?.length ? (
                  <div className="text-center py-4">
                    <Wrench className="h-8 w-8 text-muted-foreground/25 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No equipment deployed today</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {dispatchResources?.totalEquipment 
                        ? `${dispatchResources.availableEquipment} of ${dispatchResources.totalEquipment} available`
                        : 'Assign equipment from job details'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dispatchResources.totalEquipment > 0 && (
                      <div className="flex items-center gap-3 mb-1">
                        <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(((dispatchResources.totalEquipment - dispatchResources.availableEquipment) / dispatchResources.totalEquipment) * 100, 100)}%`,
                              backgroundColor: 'hsl(var(--trade))',
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {dispatchResources.totalEquipment - dispatchResources.availableEquipment}/{dispatchResources.totalEquipment} in use
                        </span>
                      </div>
                    )}
                    <ScrollArea className="h-[180px]">
                      <div className="space-y-2">
                        {dispatchResources.deployedEquipment.map((eq) => (
                          <div key={eq.assignmentId} className="flex items-start gap-3 p-3 rounded-md bg-muted/30">
                            <Wrench className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{eq.equipmentName}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                                <span className="truncate">{eq.jobTitle}</span>
                                {eq.assignedToName && (
                                  <span className="flex items-center gap-1 flex-shrink-0">
                                    <User className="h-3 w-3" />
                                    {eq.assignedToName}
                                  </span>
                                )}
                              </div>
                              {eq.serialNumber && (
                                <span className="text-[11px] text-muted-foreground opacity-60 mt-0.5 inline-block">SN: {eq.serialNumber}</span>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                              {eq.jobStatus === 'in_progress' ? 'Active' : 'Assigned'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Materials Needed
                {(dispatchResources?.materialsNeeded?.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {dispatchResources!.materialsNeeded.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {!dispatchResources?.materialsNeeded?.length ? (
                <div className="text-center py-4">
                  <Package className="h-8 w-8 text-muted-foreground/25 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No outstanding materials</p>
                  <p className="text-xs text-muted-foreground mt-1">All materials received or no materials tracked</p>
                </div>
              ) : (
                <ScrollArea className="h-[160px]">
                  <div className="space-y-1.5">
                    {dispatchResources.materialsNeeded.map((mat) => {
                      const statusColors: Record<string, string> = {
                        needed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
                        ordered: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
                        shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
                      };
                      return (
                        <div key={mat.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
                          <Package className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{mat.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                              <span>{mat.quantity} {mat.unit}</span>
                              {mat.supplier && <span>from {mat.supplier}</span>}
                              <span className="truncate">{mat.jobTitle}</span>
                            </div>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColors[mat.status] || statusColors.needed}`}>
                            {mat.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
        </ScrollArea>
        )}
        </div>
      </div>
      )}

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Job</DialogTitle>
            <DialogDescription>
              {selectedJob?.mode === 'assign' ? 'Assign' : 'Reassign'} "{selectedJob?.job.title}" to a team member and time slot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="button-assign-date">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(currentDate, 'EEE, MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={currentDate}
                    onSelect={(date) => { if (date) setCurrentDate(startOfDay(date)); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Team Member</label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger data-testid="select-team-member">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembersWithJobs.map(member => (
                    <SelectItem key={member.memberId} value={member.memberId}>
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          className="h-5 w-5"
                          fallbackClassName="text-[10px]"
                          user={{
                            id: member.memberId,
                            firstName: member.firstName,
                            lastName: member.lastName,
                            email: member.email,
                            photoUrl: member.profileImageUrl,
                          }}
                        />
                        {member.firstName} {member.lastName}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Time</label>
              <Select value={selectedTimeSlot} onValueChange={setSelectedTimeSlot}>
                <SelectTrigger data-testid="select-time">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  {timeSlots.map(slot => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              data-testid="button-cancel-assign"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignJob}
              disabled={rescheduleJobMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {rescheduleJobMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Assign
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!quickAssignJob} onOpenChange={(open) => { if (!open) setQuickAssignJob(null); }}>
        <DialogContent className="max-w-sm" data-testid="dialog-dispatch-quick-assign">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Quick Assign
            </DialogTitle>
            <DialogDescription>
              {quickAssignJob && (
                <>Assign <strong>{quickAssignJob.title}</strong> to a team member</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Team Member</label>
              <Select value={quickAssignMember} onValueChange={setQuickAssignMember}>
                <SelectTrigger data-testid="select-quick-member">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5" />
                      Me (Owner)
                    </div>
                  </SelectItem>
                  {teamMembers.filter(m => m.isActive).map(member => (
                    <SelectItem key={member.memberId} value={member.memberId}>
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          className="h-4 w-4"
                          fallbackClassName="text-[7px]"
                          user={{
                            id: member.memberId,
                            firstName: member.firstName,
                            lastName: member.lastName,
                            email: member.email,
                            photoUrl: member.profileImageUrl,
                          }}
                        />
                        {member.firstName} {member.lastName}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="button-quick-assign-date">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(currentDate, 'EEE, MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={currentDate}
                    onSelect={(date) => { if (date) setCurrentDate(startOfDay(date)); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Time</label>
              <Select value={quickAssignTimeSlot} onValueChange={setQuickAssignTimeSlot}>
                <SelectTrigger data-testid="select-quick-time">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  {timeSlots.map(slot => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setQuickAssignJob(null)}>Cancel</Button>
            <Button
              disabled={!quickAssignMember || rescheduleJobMutation.isPending}
              onClick={() => {
                if (!quickAssignJob || !quickAssignMember) return;
                const [qH, qM] = quickAssignTimeSlot.split(':').map(Number);
                const scheduledDate = new Date(currentDate);
                scheduledDate.setHours(qH, qM, 0, 0);
                const timeStr = quickAssignTimeSlot;
                rescheduleJobMutation.mutate({
                  jobId: quickAssignJob.id,
                  scheduledAt: scheduledDate.toISOString(),
                  scheduledTime: timeStr,
                  assignedTo: quickAssignMember === 'owner' ? null : quickAssignMember,
                }, {
                  onSuccess: () => {
                    setQuickAssignJob(null);
                    toast({ title: "Job assigned", description: `${quickAssignJob.title} has been scheduled` });
                  },
                });
              }}
              data-testid="button-quick-assign-confirm"
            >
              {rescheduleJobMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Assigning...</>
              ) : (
                <><Check className="h-4 w-4 mr-2" />Assign</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isFullscreen && topView === 'schedule' && createPortal(
        <div className="fixed inset-0 bg-background flex flex-col p-5" style={{ zIndex: 9999 }}>
          <div className="flex items-center justify-between gap-3 px-4 py-2 border border-border flex-shrink-0 rounded-t-lg bg-muted/40">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Dispatch Board</h2>
            </div>
            <div className="flex items-center gap-2">
              {viewMode === 'day' && isToday && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'hsl(var(--trade))' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'hsl(var(--trade))' }} />
                </span>
              )}
              <h2 className="text-sm font-semibold">
                {format(currentDate, 'EEEE, MMMM d, yyyy')}
              </h2>
              <span className="text-xs text-muted-foreground">
                {scheduledJobsForDate.length} job{scheduledJobsForDate.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {teamMembersWithJobs.length} crew
              </span>
              {viewMode === 'day' && columnPicker}
              {!unscheduledDrawerOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setUnscheduledDrawerOpen(true)}
                  data-testid="button-unscheduled-drawer"
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  Unscheduled
                  {unscheduledJobs.length > 0 && (
                    <Badge variant="secondary">{unscheduledJobs.length}</Badge>
                  )}
                </Button>
              )}
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                  Today
                </Button>
                <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end" style={{ zIndex: 10001 }}>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Schedule Hours</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-muted-foreground">Start</Label>
                        <Select
                          value={String(scheduleStartHour)}
                          onValueChange={(val) => {
                            const v = Number(val);
                            if (v < scheduleEndHour) updateScheduleHoursMutation.mutate({ scheduleStartHour: v });
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent style={{ zIndex: 10002 }}>
                            {HOUR_OPTIONS.filter(h => h < scheduleEndHour).map(h => (
                              <SelectItem key={h} value={String(h)}>{formatTime(h)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <span className="text-muted-foreground text-xs pt-5">to</span>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-muted-foreground">End</Label>
                        <Select
                          value={String(scheduleEndHour)}
                          onValueChange={(val) => {
                            const v = Number(val);
                            if (v > scheduleStartHour) updateScheduleHoursMutation.mutate({ scheduleEndHour: v });
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent style={{ zIndex: 10002 }}>
                            {HOUR_OPTIONS.filter(h => h > scheduleStartHour).map(h => (
                              <SelectItem key={h} value={String(h)}>{formatTime(h)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        { label: 'Early (5a–3p)', start: 5, end: 15 },
                        { label: 'Standard (6a–6p)', start: 6, end: 18 },
                        { label: 'Extended (6a–9p)', start: 6, end: 21 },
                        { label: 'Night (6p–6a)', start: 18, end: 6 },
                        { label: '24 Hours', start: 0, end: 23 },
                      ].map(p => (
                        <Button
                          key={p.label}
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => updateScheduleHoursMutation.mutate({
                            scheduleStartHour: p.start,
                            scheduleEndHour: p.start < p.end ? p.end : 23,
                          })}
                        >
                          {p.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" onClick={() => { setIsFullscreen(false); setUnscheduledDrawerOpen(false); }} data-testid="button-exit-fullscreen">
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex rounded-b-lg overflow-hidden border border-t-0 border-border bg-background">
            <div className={`flex-1 min-w-0 relative transition-all ${unscheduledDrawerOpen ? 'mr-80' : ''}`}>
              <div className="overflow-auto absolute inset-0" ref={scheduleScrollRef} onScroll={handleScheduleScroll}>
                <table className="border-collapse" style={{ minWidth: `${56 + visibleMembers.length * 160}px` }}>
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="sticky left-0 z-10 bg-muted/30 w-14 min-w-[56px] p-1.5 text-left text-[11px] font-medium text-muted-foreground border-b border-r border-border">
                        Time
                      </th>
                      {visibleMembers.map(member => (
                        <th key={member.id} className="border-b border-l border-border p-2 text-left" style={{ minWidth: 160 }}>
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              className="h-7 w-7 flex-shrink-0"
                              fallbackClassName="text-[10px]"
                              user={{
                                id: member.memberId || member.id,
                                firstName: member.firstName,
                                lastName: member.lastName,
                                email: member.email,
                                photoUrl: member.profileImageUrl,
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {member.firstName} {member.lastName?.[0] ? member.lastName[0] + '.' : ''}
                              </p>
                              <span className="text-[10px] text-muted-foreground font-normal">
                                {member.totalHours}h/{member.capacity}h
                              </span>
                            </div>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all"
                              style={{ 
                                width: `${Math.min((member.totalHours / member.capacity) * 100, 100)}%`,
                                backgroundColor: member.totalHours > member.capacity 
                                  ? 'hsl(var(--destructive))' 
                                  : 'hsl(var(--trade))'
                              }}
                            />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {WORK_HOURS.map(hour => (
                      <tr key={hour}>
                        <td className="sticky left-0 z-10 bg-background w-14 min-w-[56px] px-1.5 py-1 text-[11px] text-muted-foreground font-medium border-b border-r border-border align-top" style={{ height: HOUR_HEIGHT }}>
                          {formatTime(hour)}
                        </td>
                        {visibleMembers.map((member, colIdx) => {
                          const slotId = `${member.id}-${hour}`;
                          const dropSlotHour = dragOverSlot?.startsWith(`${member.id}-`) 
                            ? parseInt(dragOverSlot.split('-').pop() || '0') 
                            : null;
                          const dragDuration = draggedJob?.job.estimatedDuration || 60;
                          const dragSlots = Math.max(1, Math.ceil(dragDuration / 60));
                          const isInDropRange = dropSlotHour !== null && hour >= dropSlotHour && hour < dropSlotHour + dragSlots;
                          const isClickable = !!selectedJob;
                          return (
                            <td
                              key={slotId}
                              className={`border-b border-l border-border relative transition-colors ${
                                isInDropRange ? 'bg-primary/10' : ''
                              } ${isClickable ? 'cursor-pointer hover:bg-primary/20 bg-primary/5' : 'hover:bg-muted/20'}`}
                              style={{ height: HOUR_HEIGHT, minWidth: 160, padding: 0 }}
                              onDragOver={(e) => handleDragOver(e, slotId)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, member.memberId, hour)}
                              onClick={() => selectedJob && handleSlotClick(member.memberId, hour)}
                            >
                              {hour === WORK_HOURS[0] && (
                                <div className="absolute inset-0 pointer-events-none" style={{ height: WORK_HOURS.length * HOUR_HEIGHT }}>
                                  {dropSlotHour !== null && (
                                    <div
                                      className="absolute left-0 right-0 mx-1 border-2 border-dashed border-primary rounded-lg flex items-center justify-center"
                                      style={{
                                        top: (dropSlotHour - WORK_HOURS[0]) * HOUR_HEIGHT + 2,
                                        height: Math.min(dragSlots * HOUR_HEIGHT - 4, (WORK_HOURS.length * HOUR_HEIGHT) - ((dropSlotHour - WORK_HOURS[0]) * HOUR_HEIGHT) - 4),
                                        zIndex: 5,
                                        backgroundColor: 'hsl(var(--primary) / 0.08)',
                                      }}
                                    >
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-xs text-primary font-medium">Drop here</span>
                                        <span className="text-[10px] text-primary/70">{formatTime(dropSlotHour)} — {Math.round(dragDuration / 60)}h</span>
                                      </div>
                                    </div>
                                  )}

                                  {member.jobs.map(job => {
                                    const { top, height } = getJobPosition(job);
                                    const statusStyle = getStatusStyle(job.status);
                                    const isSelected = selectedJob?.job.id === job.id;

                                    return (
                                      <div
                                        key={job.id}
                                        draggable
                                        className={`pointer-events-auto absolute left-0 right-0 mx-1 rounded-lg border cursor-pointer active:cursor-grabbing overflow-hidden transition-shadow hover:shadow-md ${statusStyle.bg} ${statusStyle.border} ${isSelected ? 'ring-2 ring-primary ring-offset-2' : conflictJobIds.has(job.id) ? 'ring-2 ring-destructive/60 ring-offset-1' : ''}`}
                                        style={{
                                          top: top + 1,
                                          height: height - 2,
                                          zIndex: draggedJob?.job.id === job.id ? 50 : 10,
                                          opacity: draggedJob?.job.id === job.id ? 0.5 : 1,
                                        }}
                                        onDragStart={(e) => handleDragStart(e, job, member.memberId)}
                                        onDragEnd={() => setDraggedJob(null)}
                                        onClick={(e) => { e.stopPropagation(); handleJobClick(job, 'reassign'); }}
                                      >
                                        <div className="p-2 h-full flex flex-col">
                                          <div className="flex items-center gap-1.5">
                                            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            <span className={`text-xs font-semibold ${statusStyle.text} whitespace-nowrap`}>
                                              {formatScheduledTime(job.scheduledTime, job.scheduledAt)}
                                            </span>
                                            {job.estimatedDuration && (
                                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                                {job.estimatedDuration >= 60 
                                                  ? `${Math.round(job.estimatedDuration / 60)}h`
                                                  : `${job.estimatedDuration}m`}
                                              </span>
                                            )}
                                          </div>
                                          <h4 className={`font-medium text-sm truncate min-w-0 ml-5 mt-0.5 ${statusStyle.text}`}>
                                            {job.title}
                                          </h4>
                                          {height > 55 && (
                                            <p className="text-xs text-muted-foreground truncate ml-5 mt-0.5">
                                              {job.clientName}
                                            </p>
                                          )}
                                          {height > 90 && job.address && (
                                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 ml-5">
                                              <MapPin className="h-3 w-3 flex-shrink-0" />
                                              <span className="truncate">{job.address}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {canScrollRight && (
                <div className="absolute right-0 top-0 bottom-0 w-10 pointer-events-none bg-gradient-to-l from-background to-transparent flex items-center justify-end pr-1" style={{ zIndex: 15 }}>
                  <div className="pointer-events-auto animate-pulse">
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            {unscheduledDrawerOpen && (
              <div className="fixed right-0 top-0 bottom-0 w-80 bg-card border-l border-border shadow-2xl flex flex-col" style={{ zIndex: 10001 }}>
                <div className="flex items-center justify-between p-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    <h3 className="text-sm font-semibold">Unscheduled Jobs</h3>
                    <Badge variant="secondary">{unscheduledJobs.length}</Badge>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setUnscheduledDrawerOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {unscheduledJobs.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      All jobs are scheduled
                    </div>
                  ) : (
                    unscheduledJobs.map(job => {
                      const statusStyle = getStatusStyle(job.status);
                      const isSelected = selectedJob?.job.id === job.id;
                      return (
                        <div
                          key={job.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, job, null)}
                          onDragEnd={() => setDraggedJob(null)}
                          className={`p-3 rounded-lg border cursor-grab active:cursor-grabbing hover-elevate ${statusStyle.bg} ${statusStyle.border} ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''} ${draggedJob?.job.id === job.id ? 'opacity-50' : ''}`}
                          onClick={() => handleJobClick(job, 'assign')}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <h4 className={`text-sm font-medium truncate ${statusStyle.text}`}>{job.title}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground truncate ml-6">{job.clientName}</p>
                          {job.estimatedDuration && (
                            <p className="text-[10px] text-muted-foreground ml-6 mt-0.5">
                              {job.estimatedDuration >= 60 ? `${Math.round(job.estimatedDuration / 60)}h` : `${job.estimatedDuration}m`}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="p-3 border-t border-border text-[10px] text-muted-foreground text-center">
                  Drag jobs onto the schedule or tap to assign
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </PageShell>
  );
}
