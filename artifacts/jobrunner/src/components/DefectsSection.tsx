import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus, Trash2, Loader2, CheckCircle2, Circle, Clock, AlertTriangle, UserCheck,
  ChevronDown, ChevronUp, Wrench, Image, Calendar, User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface DefectItem {
  id: string;
  jobId: string;
  description: string;
  photoUrl?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  dueDate?: string | null;
  status: "open" | "in_progress" | "resolved" | "client_approved";
  notes?: string | null;
  resolvedAt?: string | null;
  clientApprovedAt?: string | null;
  createdAt: string;
}

interface TeamMember {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  memberId?: string;
}

interface Props {
  jobId: string;
  isTradie?: boolean;
  teamMembers?: TeamMember[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open:            { label: "Open",            color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",   icon: <Circle className="h-3 w-3" /> },
  in_progress:     { label: "In Progress",     color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",       icon: <Clock className="h-3 w-3" /> },
  resolved:        { label: "Resolved",        color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",   icon: <CheckCircle2 className="h-3 w-3" /> },
  client_approved: { label: "Client Approved", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: <UserCheck className="h-3 w-3" /> },
};

const STATUS_OPTIONS = ["open", "in_progress", "resolved", "client_approved"] as const;

const EMPTY_FORM = {
  description: "",
  assignedTo: "",
  assignedToName: "",
  dueDate: undefined as Date | undefined,
  status: "open" as typeof STATUS_OPTIONS[number],
  notes: "",
};

export function DefectsSection({ jobId, isTradie = false, teamMembers = [] }: Props) {
  const { toast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DefectItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DefectItem | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [dueDateOpen, setDueDateOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery<DefectItem[]>({
    queryKey: ["/api/jobs", jobId, "defect-items"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${jobId}/defect-items`);
      return res.json();
    },
    enabled: !!jobId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "defect-items"] });
    queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "profitability"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof EMPTY_FORM) => {
      const body: Record<string, any> = {
        description: data.description.trim(),
        status: data.status,
        notes: data.notes || null,
        dueDate: data.dueDate ? format(data.dueDate, "yyyy-MM-dd") : null,
        assignedTo: data.assignedTo || null,
        assignedToName: data.assignedToName || null,
      };
      const res = await apiRequest("POST", `/api/jobs/${jobId}/defect-items`, body);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      closeDialog();
      toast({ title: "Defect item added" });
    },
    onError: (err: any) => toast({ title: "Failed to add", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof EMPTY_FORM> }) => {
      const body: Record<string, any> = { ...data };
      if (data.dueDate) body.dueDate = format(data.dueDate, "yyyy-MM-dd");
      else if (data.dueDate === undefined) body.dueDate = null;
      const res = await apiRequest("PATCH", `/api/jobs/${jobId}/defect-items/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      closeDialog();
      toast({ title: "Item updated" });
    },
    onError: (err: any) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/jobs/${jobId}/defect-items/${id}`);
    },
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast({ title: "Item removed" });
    },
    onError: (err: any) => toast({ title: "Failed to delete", description: err.message, variant: "destructive" }),
  });

  const quickStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/jobs/${jobId}/defect-items/${id}`, { status });
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: (err: any) => toast({ title: "Failed to update status", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (item: DefectItem) => {
    setEditingItem(item);
    setForm({
      description: item.description,
      assignedTo: item.assignedTo || "",
      assignedToName: item.assignedToName || "",
      dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
      status: item.status,
      notes: item.notes || "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleSubmit = () => {
    if (!form.description.trim()) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleAssigneeChange = (memberId: string) => {
    if (!memberId || memberId === "__none") {
      setForm(f => ({ ...f, assignedTo: "", assignedToName: "" }));
      return;
    }
    const member = teamMembers.find(m => m.id === memberId || m.memberId === memberId);
    const name = member?.name || [member?.firstName, member?.lastName].filter(Boolean).join(" ") || memberId;
    setForm(f => ({ ...f, assignedTo: memberId, assignedToName: name }));
  };

  const openCount = items.filter(i => i.status === "open" || i.status === "in_progress").length;
  const allCleared = items.length > 0 && items.every(i => i.status === "resolved" || i.status === "client_approved");

  return (
    <>
      <Card data-testid="card-defects">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4" style={{ color: "hsl(var(--trade))" }} />
              <CardTitle className="text-sm font-medium">Defects &amp; Punch List</CardTitle>
              {items.length > 0 && (
                <Badge variant="secondary" className="text-xs">{items.length}</Badge>
              )}
              {openCount > 0 && (
                <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-0">
                  {openCount} open
                </Badge>
              )}
              {allCleared && (
                <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  All cleared
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isTradie && (
                <Button size="sm" variant="outline" onClick={openCreate} className="h-7 px-2 text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  Add Item
                </Button>
              )}
              <button
                onClick={() => setCollapsed(c => !c)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={collapsed ? "Expand" : "Collapse"}
              >
                {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardHeader>

        {!collapsed && (
          <CardContent className="pt-0 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Wrench className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No defect items yet</p>
                {!isTradie && (
                  <p className="text-xs mt-1">Add items found during the defects inspection period</p>
                )}
              </div>
            ) : (
              items.map(item => {
                const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/20 transition-colors cursor-pointer"
                    onClick={() => !isTradie && openEdit(item)}
                  >
                    {/* Status icon / quick toggle */}
                    <button
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={e => {
                        e.stopPropagation();
                        if (isTradie) return;
                        const next = item.status === "open" ? "in_progress"
                          : item.status === "in_progress" ? "resolved"
                          : item.status === "resolved" ? "client_approved"
                          : "open";
                        quickStatusMutation.mutate({ id: item.id, status: next });
                      }}
                      title="Cycle status"
                    >
                      {cfg.icon}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium leading-tight">{item.description}</span>
                        <Badge className={`text-xs border-0 flex items-center gap-1 ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {item.assignedToName && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            {item.assignedToName}
                          </span>
                        )}
                        {item.dueDate && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(item.dueDate), "d MMM yyyy")}
                          </span>
                        )}
                        {item.photoUrl && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Image className="h-3 w-3" />
                            Photo attached
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.notes}</p>
                      )}
                    </div>

                    {!isTradie && (
                      <button
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={e => { e.stopPropagation(); setDeleteTarget(item); }}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}

            {allCleared && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                  All defects cleared — retention can be released
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Defect Item" : "Add Defect Item"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Textarea
                placeholder="Describe the defect or outstanding item…"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {teamMembers.length > 0 && (
              <div className="space-y-1.5">
                <Label>Assigned To</Label>
                <Select
                  value={form.assignedTo || "__none"}
                  onValueChange={handleAssigneeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Unassigned</SelectItem>
                    {teamMembers.map(m => {
                      const id = m.memberId || m.id;
                      const name = m.name || [m.firstName, m.lastName].filter(Boolean).join(" ") || id;
                      return (
                        <SelectItem key={id} value={id}>{name}</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                    {form.dueDate ? format(form.dueDate, "d MMM yyyy") : <span className="text-muted-foreground">Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarWidget
                    mode="single"
                    selected={form.dueDate}
                    onSelect={d => { setForm(f => ({ ...f, dueDate: d })); setDueDateOpen(false); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes or rectification instructions…"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {editingItem ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove defect item?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.description}" will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
