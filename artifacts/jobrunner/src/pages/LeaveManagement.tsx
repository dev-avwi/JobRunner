import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Users,
  BarChart3,
} from "lucide-react";

interface TeamMember {
  id: string;
  memberId: string | null;
  firstName: string | null;
  lastName: string | null;
  inviteStatus: string;
}

interface TimeOff {
  id: string;
  teamMemberId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  notes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  approverComment: string | null;
  createdAt: string;
}

interface LeaveBalance {
  id: string;
  teamMemberId: string;
  year: number;
  leaveType: string;
  accrued: string;
  taken: string;
}

const LEAVE_TYPES = [
  { value: "annual_leave", label: "Annual Leave" },
  { value: "sick_leave", label: "Sick Leave" },
  { value: "personal", label: "Personal Leave" },
  { value: "public_holiday", label: "Public Holiday" },
  { value: "other", label: "Other" },
] as const;

function leaveTypeLabel(reason: string) {
  return LEAVE_TYPES.find((t) => t.value === reason)?.label ?? reason.replace(/_/g, " ");
}

function statusBadge(status: string) {
  if (status === "approved")
    return <Badge className="bg-green-600 text-white gap-1"><CheckCircle2 className="h-3 w-3" />Approved</Badge>;
  if (status === "rejected")
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Declined</Badge>;
  return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
}

function diffDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function initials(member: TeamMember | undefined): string {
  if (!member) return "?";
  return `${(member.firstName || "?")[0]}${(member.lastName || "?")[0]}`.toUpperCase();
}

// ─── Leave Calendar ────────────────────────────────────────────────────────

function LeaveCalendar({
  members,
  timeOff,
}: {
  members: TeamMember[];
  timeOff: TimeOff[];
}) {
  const [offset, setOffset] = useState(0);
  const baseDate = new Date();
  baseDate.setDate(1);
  baseDate.setMonth(baseDate.getMonth() + offset);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = baseDate.toLocaleString("en-AU", { month: "long", year: "numeric" });

  const accepted = members.filter((m) => m.inviteStatus === "accepted");
  const approved = timeOff.filter((t) => t.status === "approved");

  function hasLeave(memberId: string, day: number): boolean {
    const date = new Date(year, month, day);
    return approved.some((t) => {
      if (t.teamMemberId !== memberId) return false;
      const start = new Date(t.startDate);
      const end = new Date(t.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    });
  }

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const today = new Date().getDate();
  const todayMonth = new Date().getMonth();
  const todayYear = new Date().getFullYear();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{monthName}</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOffset(0)}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 w-32 font-medium text-muted-foreground sticky left-0 bg-background z-10">
                Worker
              </th>
              {days.map((d) => {
                const isToday = d === today && month === todayMonth && year === todayYear;
                const dayOfWeek = new Date(year, month, d).getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                return (
                  <th
                    key={d}
                    className={`text-center p-1 w-8 font-normal ${
                      isToday ? "bg-primary text-primary-foreground rounded" : ""
                    } ${isWeekend ? "text-muted-foreground/60" : "text-muted-foreground"}`}
                  >
                    {d}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {accepted.map((member) => (
              <tr key={member.id} className="border-t">
                <td className="p-2 sticky left-0 bg-background z-10 font-medium truncate max-w-[8rem]">
                  {`${member.firstName || ""} ${member.lastName || ""}`.trim() || "Unknown"}
                </td>
                {days.map((d) => {
                  const on = hasLeave(member.id, d);
                  const dayOfWeek = new Date(year, month, d).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  return (
                    <td key={d} className={`text-center p-1 ${isWeekend ? "bg-muted/30" : ""}`}>
                      {on && (
                        <div className="w-5 h-5 mx-auto rounded-sm bg-blue-500" title="On leave" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {accepted.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No accepted team members</p>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="w-4 h-4 rounded-sm bg-blue-500" />
        <span>Approved leave</span>
      </div>
    </div>
  );
}

// ─── Leave Balances ────────────────────────────────────────────────────────

function LeaveBalancesTab({
  members,
  balances,
  onEdit,
}: {
  members: TeamMember[];
  balances: LeaveBalance[];
  onEdit: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    teamMemberId: "",
    year: new Date().getFullYear().toString(),
    leaveType: "annual_leave",
    accrued: "",
  });
  const { toast } = useToast();
  const qc = useQueryClient();

  const accepted = members.filter((m) => m.inviteStatus === "accepted");
  const memberMap: Record<string, TeamMember> = {};
  for (const m of accepted) memberMap[m.id] = m;

  const upsertMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/team/leave-balances", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/team/leave-balances"] });
      toast({ title: "Leave balance updated" });
      setEditOpen(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Group balances by member and year
  const currentYear = new Date().getFullYear();
  const yearBalances = balances.filter((b) => b.year === currentYear);

  const memberBalances: Record<string, Record<string, LeaveBalance>> = {};
  for (const b of yearBalances) {
    if (!memberBalances[b.teamMemberId]) memberBalances[b.teamMemberId] = {};
    memberBalances[b.teamMemberId][b.leaveType] = b;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Leave balances for <strong>{currentYear}</strong>. Set accrued days for each worker and type.
        </p>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Set Balance
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Worker</TableHead>
              {LEAVE_TYPES.filter((t) => t.value !== "public_holiday" && t.value !== "other").map(
                (t) => (
                  <TableHead key={t.value} className="text-center">
                    {t.label}
                  </TableHead>
                )
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {accepted.map((member) => {
              const mb = memberBalances[member.id] || {};
              return (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {`${member.firstName || ""} ${member.lastName || ""}`.trim() || "Unknown"}
                  </TableCell>
                  {LEAVE_TYPES.filter(
                    (t) => t.value !== "public_holiday" && t.value !== "other"
                  ).map((t) => {
                    const bal = mb[t.value];
                    const accrued = parseFloat(bal?.accrued || "0");
                    const taken = parseFloat(bal?.taken || "0");
                    const remaining = accrued - taken;
                    return (
                      <TableCell key={t.value} className="text-center">
                        {bal ? (
                          <div className="space-y-0.5">
                            <p className="font-semibold text-sm">
                              {remaining.toFixed(1)}d
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {taken.toFixed(1)} / {accrued.toFixed(1)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
            {accepted.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No accepted team members
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Taken days are automatically updated when leave is approved. Accrued days are set manually.
      </p>

      {/* Set Balance Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Leave Balance</DialogTitle>
            <DialogDescription>
              Manually set accrued leave days for a team member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Worker</Label>
              <Select
                value={editForm.teamMemberId}
                onValueChange={(v) => setEditForm((f) => ({ ...f, teamMemberId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select worker..." />
                </SelectTrigger>
                <SelectContent>
                  {accepted.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {`${m.firstName || ""} ${m.lastName || ""}`.trim() || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select
                  value={editForm.leaveType}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, leaveType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Accrued Days</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 20"
                  value={editForm.accrued}
                  onChange={(e) => setEditForm((f) => ({ ...f, accrued: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                type="number"
                value={editForm.year}
                onChange={(e) => setEditForm((f) => ({ ...f, year: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() =>
                upsertMutation.mutate({
                  teamMemberId: editForm.teamMemberId,
                  year: editForm.year,
                  leaveType: editForm.leaveType,
                  accrued: parseFloat(editForm.accrued || "0"),
                })
              }
              disabled={upsertMutation.isPending || !editForm.teamMemberId || !editForm.accrued}
            >
              Save Balance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function LeaveManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [actioningRequest, setActioningRequest] = useState<TimeOff | null>(null);
  const [approverComment, setApproverComment] = useState("");
  const [pendingAction, setPendingAction] = useState<"approved" | "rejected" | null>(null);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    teamMemberId: "",
    startDate: "",
    endDate: "",
    reason: "annual_leave",
    notes: "",
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team/members"],
  });

  const { data: timeOff = [], isLoading: timeOffLoading } = useQuery<TimeOff[]>({
    queryKey: ["/api/team/time-off"],
  });

  const { data: balances = [] } = useQuery<LeaveBalance[]>({
    queryKey: ["/api/team/leave-balances"],
  });

  const accepted = useMemo(() => members.filter((m) => m.inviteStatus === "accepted"), [members]);
  const memberMap = useMemo(() => {
    const map: Record<string, TeamMember> = {};
    for (const m of accepted) map[m.id] = m;
    return map;
  }, [accepted]);

  const getMemberName = (id: string) => {
    const m = memberMap[id];
    return m ? `${m.firstName || ""} ${m.lastName || ""}`.trim() || "Unknown" : "Unknown";
  };

  const pending = useMemo(
    () =>
      timeOff
        .filter((t) => t.status === "pending")
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [timeOff]
  );

  const approved = useMemo(
    () =>
      timeOff
        .filter((t) => t.status === "approved")
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
    [timeOff]
  );

  const all = useMemo(
    () =>
      [...timeOff].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [timeOff]
  );

  const actionMutation = useMutation({
    mutationFn: ({ id, status, approverComment }: { id: string; status: string; approverComment?: string }) =>
      apiRequest("PATCH", `/api/team/time-off/${id}`, { status, approverComment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/team/time-off"] });
      qc.invalidateQueries({ queryKey: ["/api/team/leave-balances"] });
      toast({ title: pendingAction === "approved" ? "Leave approved" : "Leave declined" });
      setApproveDialogOpen(false);
      setActioningRequest(null);
      setApproverComment("");
      setPendingAction(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/team/time-off/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/team/time-off"] });
      toast({ title: "Leave request deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/team/time-off", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/team/time-off"] });
      toast({ title: "Leave request added" });
      setAddDialogOpen(false);
      setAddForm({ teamMemberId: "", startDate: "", endDate: "", reason: "annual_leave", notes: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openAction(req: TimeOff, action: "approved" | "rejected") {
    setActioningRequest(req);
    setPendingAction(action);
    setApproverComment("");
    setApproveDialogOpen(true);
  }

  function confirmAction() {
    if (!actioningRequest || !pendingAction) return;
    actionMutation.mutate({
      id: actioningRequest.id,
      status: pendingAction,
      approverComment: approverComment || undefined,
    });
  }

  const isLoading = membersLoading || timeOffLoading;

  function RequestRow({ req }: { req: TimeOff }) {
    const member = memberMap[req.teamMemberId];
    const days = diffDays(req.startDate, req.endDate);
    return (
      <Card className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="text-sm bg-primary/10 text-primary">
              {initials(member)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="font-semibold">{getMemberName(req.teamMemberId)}</p>
                <p className="text-sm text-muted-foreground">
                  {leaveTypeLabel(req.reason)} · {days} day{days !== 1 ? "s" : ""}
                </p>
              </div>
              {statusBadge(req.status)}
            </div>
            <p className="text-sm mt-1">
              <CalendarDays className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
              {new Date(req.startDate).toLocaleDateString("en-AU")} →{" "}
              {new Date(req.endDate).toLocaleDateString("en-AU")}
            </p>
            {req.notes && (
              <p className="text-sm text-muted-foreground mt-1 italic">"{req.notes}"</p>
            )}
            {req.approverComment && (
              <p className="text-sm text-muted-foreground mt-1">
                Manager note: <span className="italic">"{req.approverComment}"</span>
              </p>
            )}
            {req.status === "pending" && (
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white gap-1"
                  onClick={() => openAction(req, "approved")}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 gap-1"
                  onClick={() => openAction(req, "rejected")}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Decline
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-muted-foreground"
                  onClick={() => deleteMutation.mutate(req.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Leave Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage leave requests, view the team calendar, and track leave balances
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Request
        </Button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{pending.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{approved.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{timeOff.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="requests">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="requests" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Requests
            {pending.length > 0 && (
              <Badge className="ml-1 bg-orange-500 text-white text-xs h-4 px-1">
                {pending.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="balances" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Balances
          </TabsTrigger>
        </TabsList>

        {/* Requests Tab */}
        <TabsContent value="requests" className="mt-4 space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Pending Approval ({pending.length})
                  </h3>
                  {pending.map((req) => <RequestRow key={req.id} req={req} />)}
                </div>
              )}

              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-1.5">
                  All Requests ({all.length})
                </h3>
                {all.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>No leave requests yet</p>
                    </CardContent>
                  </Card>
                ) : (
                  all
                    .filter((r) => r.status !== "pending")
                    .map((req) => <RequestRow key={req.id} req={req} />)
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <LeaveCalendar members={members} timeOff={timeOff} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balances Tab */}
        <TabsContent value="balances" className="mt-4">
          <Card>
            <CardContent className="p-6">
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <LeaveBalancesTab
                  members={members}
                  balances={balances}
                  onEdit={() => {}}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approve/Decline Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction === "approved" ? "Approve Leave" : "Decline Leave"}
            </DialogTitle>
            <DialogDescription>
              {actioningRequest && (
                <>
                  {getMemberName(actioningRequest.teamMemberId)}'s{" "}
                  {leaveTypeLabel(actioningRequest.reason)} from{" "}
                  {new Date(actioningRequest.startDate).toLocaleDateString("en-AU")} to{" "}
                  {new Date(actioningRequest.endDate).toLocaleDateString("en-AU")}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Comment (optional)</Label>
            <Textarea
              placeholder={
                pendingAction === "approved"
                  ? "e.g. Approved. Enjoy your break!"
                  : "e.g. We're short-staffed that week. Please discuss alternatives."
              }
              value={approverComment}
              onChange={(e) => setApproverComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              disabled={actionMutation.isPending}
              className={
                pendingAction === "approved"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
            >
              {pendingAction === "approved" ? "Approve" : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Request Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Leave Request</DialogTitle>
            <DialogDescription>
              Create a leave request on behalf of a team member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Team Member *</Label>
              <Select
                value={addForm.teamMemberId}
                onValueChange={(v) => setAddForm((f) => ({ ...f, teamMemberId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select worker..." />
                </SelectTrigger>
                <SelectContent>
                  {accepted.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {`${m.firstName || ""} ${m.lastName || ""}`.trim() || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Leave Type *</Label>
              <Select
                value={addForm.reason}
                onValueChange={(v) => setAddForm((f) => ({ ...f, reason: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={addForm.startDate}
                  onChange={(e) => setAddForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={addForm.endDate}
                  onChange={(e) => setAddForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes..."
                value={addForm.notes}
                onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addMutation.mutate(addForm)}
              disabled={
                addMutation.isPending ||
                !addForm.teamMemberId ||
                !addForm.startDate ||
                !addForm.endDate
              }
            >
              Add Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
