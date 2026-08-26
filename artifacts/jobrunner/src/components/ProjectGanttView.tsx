/**
 * ProjectGanttView — horizontal Gantt timeline for project phases.
 * Pure CSS/div implementation — no heavy chart libraries.
 * Shares the same React Query cache as JobPhasesSection so phases
 * load once and both components stay in sync.
 */
import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, addDays, differenceInDays, startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Layers, Download, X, Check, Crown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { JobPhase, PhaseStatus, PhaseAssignedUser } from "./JobPhasesSection";

// ── Status colour palette (matches JobPhasesSection STATUS_CONFIG) ──────────
const STATUS_COLORS: Record<PhaseStatus, { bar: string; text: string; border: string }> = {
  not_started: { bar: "#E5E7EB",               text: "#374151", border: "#D1D5DB" },
  in_progress:  { bar: "hsl(var(--primary))",   text: "white",   border: "hsl(var(--primary))" },
  complete:     { bar: "#10B981",               text: "white",   border: "#059669" },
  invoiced:     { bar: "#8B5CF6",               text: "white",   border: "#7C3AED" },
};

// ── Zoom config ──────────────────────────────────────────────────────────────
type Zoom = "week" | "month" | "quarter";

const DAY_WIDTH_PX: Record<Zoom, number> = { week: 48, month: 18, quarter: 8 };
const TICK_STEP_DAYS: Record<Zoom, number>  = { week: 1,  month: 7, quarter: 14 };
const TICK_FORMAT: Record<Zoom, string>     = { week: "d MMM", month: "d MMM", quarter: "d MMM" };
const LABEL_COL_W = 188;   // px — fixed left column
const ROW_H       = 44;    // px per phase row
const HEADER_H    = 32;    // px for date tick header

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Build 1–2 character initials from a full name */
function initials(name?: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

/** Deterministic colour based on user id for avatar — matches JobPhasesSection */
const AVATAR_COLORS = [
  "#4f7ddb", "#e07b39", "#5ba85f", "#9b59b6",
  "#e74c3c", "#16a085", "#d35400", "#2c3e50",
];
function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ── Read-only stacked avatars for Gantt bars ──────────────────────────────────
interface GanttAvatarStackProps {
  members: PhaseAssignedUser[];
}

function GanttAvatarStack({ members }: GanttAvatarStackProps) {
  if (members.length === 0) return null;
  const MAX_SHOWN = 3;
  const shown = members.slice(0, MAX_SHOWN);
  const overflow = members.length - MAX_SHOWN;

  return (
    <div
      className="flex -space-x-1"
      title={members.map((m) => `${m.name}${m.isLead ? " (Lead)" : ""}`).join(", ")}
    >
      {shown.map((m) => (
        <span
          key={m.id}
          className="relative inline-flex items-center justify-center w-4 h-4 rounded-full text-[7px] font-bold text-white border border-background"
          style={{ backgroundColor: avatarColor(m.id) }}
        >
          {initials(m.name)}
          {m.isLead && (
            <Crown
              className="absolute -top-1 -right-0.5 h-2 w-2 text-amber-400 drop-shadow"
              fill="currentColor"
            />
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[7px] font-bold text-muted-foreground bg-muted border border-background">
          +{overflow}
        </span>
      )}
    </div>
  );
}

/**
 * Parse a schedule date string as a LOCAL calendar date.
 * Phase dates arrive as "YYYY-MM-DD" or ISO timestamps (UTC midnight).
 * `new Date("2024-04-10T00:00:00Z")` is UTC midnight, which becomes Apr 9
 * in UTC-offset zones.  We extract the first 10 chars and construct a
 * local Date(y, m, d) so bar placement is always correct regardless of TZ.
 */
function parseScheduleDate(s: string): Date {
  const parts = s.substring(0, 10).split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

const dayStart = (d: Date | string): Date =>
  typeof d === 'string' ? parseScheduleDate(d) : startOfDay(d);
const dayDiff  = (a: Date, b: Date) => differenceInDays(dayStart(a), dayStart(b));

function computeRange(phases: JobPhase[]): { rangeStart: Date; totalDays: number } {
  const today = startOfDay(new Date()); // today is always local
  const allDates: Date[] = [];
  for (const p of phases) {
    if (p.scheduledStart) allDates.push(parseScheduleDate(p.scheduledStart));
    if (p.scheduledEnd)   allDates.push(parseScheduleDate(p.scheduledEnd));
  }
  if (allDates.length === 0) {
    return { rangeStart: addDays(today, -7), totalDays: 60 };
  }
  const earliest = new Date(Math.min(...allDates.map(d => d.getTime())));
  const latest   = new Date(Math.max(...allDates.map(d => d.getTime())));
  const start = addDays(earliest, -7);
  const end   = addDays(latest, 14);
  // always show today
  const effectiveStart = start > today ? addDays(today, -7) : start;
  const effectiveEnd   = end   < today ? addDays(today, 14) : end;
  return {
    rangeStart: dayStart(effectiveStart),
    totalDays:  Math.max(dayDiff(effectiveEnd, effectiveStart) + 1, 30),
  };
}

// ── Sub-component: minimal date-edit dialog ──────────────────────────────────
interface EditDatesDialogProps {
  phase: JobPhase | null;
  jobId: string;
  onClose: () => void;
}

function EditDatesDialog({ phase, jobId, onClose }: EditDatesDialogProps) {
  const { toast } = useToast();
  const [startVal, setStartVal] = useState(phase?.scheduledStart?.substring(0, 10) ?? "");
  const [endVal,   setEndVal]   = useState(phase?.scheduledEnd?.substring(0, 10)   ?? "");
  const [bookedHours, setBookedHours] = useState(phase?.bookedHours ?? "");

  // Reset when phase changes
  const prevId = useRef<string | undefined>(undefined);
  if (phase?.id !== prevId.current) {
    prevId.current = phase?.id;
  }

  const updateMutation = useMutation({
    mutationFn: (data: { scheduledStart?: string | null; scheduledEnd?: string | null; bookedHours?: string | null }) =>
      apiRequest("PATCH", `/api/jobs/${jobId}/phases/${phase!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/phases`] });
      toast({ title: "Phase updated" });
      onClose();
    },
    onError: (e: any) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  if (!phase) return null;

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Edit Schedule — {phase.phaseCode} {phase.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Start Date</Label>
              <Input
                type="date"
                value={startVal}
                onChange={e => setStartVal(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <Input
                type="date"
                value={endVal}
                onChange={e => setEndVal(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Booked Hours</Label>
            <Input
              type="number"
              placeholder="0"
              min="0"
              step="0.5"
              value={bookedHours}
              onChange={e => setBookedHours(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={updateMutation.isPending}>
            <X className="h-3.5 w-3.5 mr-1" /> Cancel
          </Button>
          <Button
            size="sm"
            disabled={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({
                scheduledStart: startVal   || null,
                scheduledEnd:   endVal     || null,
                bookedHours:    bookedHours || null,
              })
            }
            style={{ backgroundColor: "hsl(var(--trade))", color: "white" }}
          >
            {updateMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Check className="h-3.5 w-3.5 mr-1" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  jobId: string;
  isTradie?: boolean;
}

export function ProjectGanttView({ jobId, isTradie = false }: Props) {
  const [zoom, setZoom]             = useState<Zoom>("month");
  const [editingPhase, setEditingPhase] = useState<JobPhase | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const { data: phases = [], isLoading } = useQuery<JobPhase[]>({
    queryKey: [`/api/jobs/${jobId}/phases`],
    enabled: !!jobId,
  });

  const sorted = useMemo(() => [...phases].sort((a, b) => a.sortOrder - b.sortOrder), [phases]);
  const { rangeStart, totalDays } = useMemo(() => computeRange(sorted), [sorted]);

  const dayW      = DAY_WIDTH_PX[zoom];
  const gridWidth = totalDays * dayW;
  const today     = dayStart(new Date());
  const todayOff  = dayDiff(today, rangeStart);

  const ticks = useMemo(() => {
    const step = TICK_STEP_DAYS[zoom];
    const fmt  = TICK_FORMAT[zoom];
    const out: { label: string; offset: number }[] = [];
    for (let i = 0; i < totalDays; i += step) {
      out.push({ label: format(addDays(rangeStart, i), fmt), offset: i });
    }
    return out;
  }, [rangeStart, totalDays, zoom]);

  function getBar(phase: JobPhase) {
    const hasStart = !!phase.scheduledStart;
    const hasEnd   = !!phase.scheduledEnd;
    if (!hasStart && !hasEnd) return null;
    const s = hasStart ? Math.max(0, dayDiff(dayStart(phase.scheduledStart!), rangeStart)) : 0;
    const e = hasEnd
      ? Math.min(totalDays, dayDiff(dayStart(phase.scheduledEnd!), rangeStart) + 1)
      : s + 3;
    return { left: s * dayW, width: Math.max(e - Math.max(0, s), 1) * dayW };
  }

  function handleExport() {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const win = window.open("", "_blank");
    if (!win) return;

    // Build document with DOM APIs — never interpolate user data as raw HTML
    const doc = win.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>Project Timeline</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px;color:#111}
  h2{margin:0 0 6px;font-size:18px}p{margin:0 0 20px;color:#666;font-size:13px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #e5e7eb;padding:9px 14px;text-align:left;font-size:13px}
  th{background:#f9fafb;font-weight:600}tr:nth-child(even){background:#f9fafb}
  @media print{body{padding:16px}}
</style></head><body>
<h2>Project Timeline</h2>
<p>Exported ${esc(format(new Date(), "d MMMM yyyy"))}</p>
<table id="t"><thead><tr><th>Code</th><th>Phase</th><th>Status</th><th>Start</th><th>End</th><th>Booked</th></tr></thead><tbody id="b"></tbody></table>
<script>
(function(){
  var rows=${
    // Escape < as \u003c so a phase name/code containing "</script>" cannot
    // break out of this script context. Standard practice used by React/Next.js.
    JSON.stringify(sorted.map(p => ({
      code:   p.phaseCode,
      name:   p.name,
      status: p.status.replace(/_/g, " "),
      start:  p.scheduledStart ? format(parseScheduleDate(p.scheduledStart), "d MMM yyyy") : "—",
      end:    p.scheduledEnd   ? format(parseScheduleDate(p.scheduledEnd),   "d MMM yyyy") : "—",
      hrs:    p.bookedHours    ? parseFloat(p.bookedHours).toFixed(1) + " hrs"    : "—",
    }))).replace(/</g, "\\u003c")
  };
  var tbody=document.getElementById('b');
  rows.forEach(function(r){
    var tr=document.createElement('tr');
    [r.code,r.name,r.status,r.start,r.end,r.hrs].forEach(function(v){
      var td=document.createElement('td');
      td.textContent=v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  window.print();
})();
<\/script>
</body></html>`);
    doc.close();
  }

  // Don't render if loading or there are no phases (keeps the phases tab clean)
  if (isLoading || sorted.length === 0) return null;

  return (
    <>
      <Card>
        {/* ── Header ── */}
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4" style={{ color: "hsl(var(--trade))" }} />
              <CardTitle className="text-sm font-medium">Project Timeline</CardTitle>
              <Badge variant="secondary" className="text-xs">{sorted.length} phases</Badge>
            </div>
            <div className="flex items-center gap-2">
              {/* Zoom toggle */}
              <div className="flex rounded-md border text-xs overflow-hidden">
                {(["week", "month", "quarter"] as Zoom[]).map(z => (
                  <button
                    key={z}
                    onClick={() => setZoom(z)}
                    className={`px-2.5 py-1 capitalize transition-colors select-none ${
                      zoom === z
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {z}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={handleExport}
              >
                <Download className="h-3 w-3" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* ── Gantt body ── */}
        <CardContent className="pt-0 pb-3">
          <div
            className="flex border rounded-md overflow-hidden"
            style={{ minHeight: HEADER_H + sorted.length * ROW_H }}
          >
            {/* ── Fixed label column ── */}
            <div
              className="shrink-0 border-r bg-muted/30 z-10"
              style={{ width: LABEL_COL_W }}
            >
              {/* header spacer */}
              <div
                className="border-b bg-muted/50"
                style={{ height: HEADER_H }}
              />
              {sorted.map((phase, idx) => {
                const cfg = STATUS_COLORS[phase.status] ?? STATUS_COLORS.not_started;
                return (
                  <div
                    key={phase.id}
                    className="flex items-center gap-1.5 px-2 border-b last:border-b-0 overflow-hidden"
                    style={{ height: ROW_H }}
                  >
                    <span
                      className="shrink-0 text-[9px] font-mono font-bold px-1 py-0.5 rounded border"
                      style={{ color: "hsl(var(--trade))", borderColor: "hsl(var(--trade) / 0.4)" }}
                    >
                      {phase.phaseCode}
                    </span>
                    <span className="text-xs font-medium truncate leading-tight">
                      {phase.name}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── Scrollable grid ── */}
            <div className="flex-1 overflow-x-auto" ref={gridRef}>
              <div className="relative" style={{ width: gridWidth }}>
                {/* ── Tick header ── */}
                <div
                  className="relative border-b bg-muted/50 overflow-hidden"
                  style={{ height: HEADER_H }}
                >
                  {ticks.map(tick => (
                    <div
                      key={tick.offset}
                      className="absolute top-0 h-full flex items-center pl-1 border-r"
                      style={{
                        left: tick.offset * dayW,
                        width: TICK_STEP_DAYS[zoom] * dayW,
                      }}
                    >
                      <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                        {tick.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* ── Today line ── */}
                {todayOff >= 0 && todayOff < totalDays && (
                  <div
                    className="absolute pointer-events-none z-20"
                    style={{
                      top: HEADER_H,
                      bottom: 0,
                      left: todayOff * dayW + dayW / 2 - 1,
                      width: 2,
                      background: "hsl(var(--primary) / 0.55)",
                    }}
                  />
                )}

                {/* ── Phase rows ── */}
                {sorted.map(phase => {
                  const bar = getBar(phase);
                  const cfg = STATUS_COLORS[phase.status] ?? STATUS_COLORS.not_started;

                  return (
                    <div
                      key={phase.id}
                      className="relative border-b last:border-b-0 overflow-hidden"
                      style={{ height: ROW_H }}
                    >
                      {/* Subtle alternating row */}
                      <div className="absolute inset-0 even:bg-muted/10" />

                      {/* Vertical grid lines at ticks */}
                      {ticks.map(tick => (
                        <div
                          key={tick.offset}
                          className="absolute top-0 bottom-0 border-r border-border/40"
                          style={{ left: tick.offset * dayW }}
                        />
                      ))}

                      {bar ? (
                        <button
                          className="absolute rounded transition-opacity group"
                          style={{
                            top: 8, bottom: 8,
                            left: bar.left + 2,
                            width: Math.max(bar.width - 4, 4),
                            backgroundColor: cfg.bar,
                            border: `1px solid ${cfg.border}`,
                            cursor: isTradie ? "default" : "pointer",
                          }}
                          onClick={() => !isTradie && setEditingPhase(phase)}
                          title={`${phase.phaseCode} ${phase.name}${isTradie ? "" : " — click to edit dates"}`}
                          disabled={isTradie}
                        >
                          {(() => {
                            const members: PhaseAssignedUser[] =
                              phase.assignedUsers && phase.assignedUsers.length > 0
                                ? phase.assignedUsers
                                : phase.assignedUserId
                                  ? [{ id: phase.assignedUserId, name: phase.assignedUserName ?? "", isLead: true }]
                                  : [];
                            const shownCount = Math.min(members.length, 3) + (members.length > 3 ? 1 : 0);
                            // Each avatar w-4 (16px) with -space-x-1 (4px overlap after first)
                            const stackW = shownCount > 0 ? 16 + (shownCount - 1) * 12 + 4 : 0;
                            return (
                              <>
                                {bar.width > 56 && (
                                  <span
                                    className="absolute inset-0 flex items-center px-1.5 text-[9px] font-semibold leading-none overflow-hidden whitespace-nowrap"
                                    style={{
                                      color: cfg.text,
                                      paddingRight: members.length > 0 && bar.width > 20 ? `${stackW + 6}px` : undefined,
                                    }}
                                  >
                                    {bar.width > 96 ? `${phase.phaseCode} ${phase.name}` : phase.phaseCode}
                                  </span>
                                )}
                                {/* Stacked team avatars — right end of bar */}
                                {members.length > 0 && bar.width > 20 && (
                                  <span className="absolute right-1 top-1/2 -translate-y-1/2">
                                    <GanttAvatarStack members={members} />
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </button>
                      ) : (
                        <button
                          className="absolute inset-0 flex items-center pl-2 text-[10px] italic text-muted-foreground"
                          style={{ cursor: isTradie ? "default" : "pointer" }}
                          onClick={() => !isTradie && setEditingPhase(phase)}
                          disabled={isTradie}
                        >
                          {!isTradie ? "Set dates →" : "No dates"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Legend ── */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {(Object.entries(STATUS_COLORS) as [PhaseStatus, { bar: string; text: string; border: string }][]).map(
              ([status, { bar }]) => (
                <div key={status} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <div
                    className="w-3 h-2 rounded-sm border"
                    style={{ backgroundColor: bar, borderColor: STATUS_COLORS[status].border }}
                  />
                  <span className="capitalize">{status.replace(/_/g, " ")}</span>
                </div>
              )
            )}
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <div
                className="w-0.5 h-3 rounded"
                style={{ background: "hsl(var(--primary) / 0.55)" }}
              />
              <span>today</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Edit-dates dialog ── */}
      {editingPhase && (
        <EditDatesDialog
          phase={editingPhase}
          jobId={jobId}
          onClose={() => setEditingPhase(null)}
        />
      )}
    </>
  );
}

export default ProjectGanttView;
