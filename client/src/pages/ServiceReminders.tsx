import { SearchableSelect } from "@/components/ui/searchable-select";
import JobPicker from "@/components/JobPicker";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  MoreVertical,
  Bell,
  User,
  Calendar as CalendarIcon,
  Check,
  Trash2,
  Edit,
  Clock,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, isBefore, isAfter, addDays } from "date-fns";
import type { ServiceReminder, Client, Job } from "@shared/schema";

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  sent: "bg-info/10 text-info",
  completed: "bg-success/10 text-success",
  cancelled: "bg-muted text-muted-foreground",
};

const intervalLabels: Record<number, string> = {
  1: "Monthly",
  3: "Quarterly",
  6: "6 Monthly",
  12: "Yearly",
  24: "2 Years",
};

interface ServiceReminderWithClient extends ServiceReminder {
  clientName?: string;
}

export default function ServiceRemindersPage() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ServiceReminder | null>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completingReminder, setCompletingReminder] = useState<ServiceReminder | null>(null);
  const [activeTab, setActiveTab] = useState("upcoming");

  const [formData, setFormData] = useState({
    serviceType: "",
    clientId: "",
    jobId: "",
    nextDueDate: new Date(),
    intervalMonths: 12,
    reminderDays: 14,
    notes: "",
  });

  const { data: reminders = [], isLoading } = useQuery<ServiceReminderWithClient[]>({
    queryKey: ["/api/service-reminders"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/service-reminders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-reminders"] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: "Service reminder created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create service reminder", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/service-reminders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-reminders"] });
      setEditingReminder(null);
      resetForm();
      toast({ title: "Service reminder updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update service reminder", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/service-reminders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-reminders"] });
      toast({ title: "Service reminder deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete service reminder", variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ id, scheduleNext }: { id: string; scheduleNext: boolean }) => {
      return apiRequest("POST", `/api/service-reminders/${id}/complete`, { scheduleNext });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-reminders"] });
      setCompleteDialogOpen(false);
      setCompletingReminder(null);
      toast({
        title: variables.scheduleNext
          ? "Service completed and next reminder scheduled"
          : "Service marked as completed",
      });
    },
    onError: () => {
      toast({ title: "Failed to complete service reminder", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      serviceType: "",
      clientId: "",
      jobId: "",
      nextDueDate: new Date(),
      intervalMonths: 12,
      reminderDays: 14,
      notes: "",
    });
  };

  const handleCreate = () => {
    const data = {
      ...formData,
      nextDueDate: formData.nextDueDate.toISOString(),
      jobId: formData.jobId || null,
    };
    createMutation.mutate(data);
  };

  const handleUpdate = () => {
    if (!editingReminder) return;
    const data = {
      ...formData,
      nextDueDate: formData.nextDueDate.toISOString(),
      jobId: formData.jobId || null,
    };
    updateMutation.mutate({ id: editingReminder.id, data });
  };

  const openEdit = (reminder: ServiceReminder) => {
    setEditingReminder(reminder);
    setFormData({
      serviceType: reminder.serviceType,
      clientId: reminder.clientId,
      jobId: reminder.jobId || "",
      nextDueDate: new Date(reminder.nextDueDate),
      intervalMonths: reminder.intervalMonths || 12,
      reminderDays: reminder.reminderDays || 14,
      notes: reminder.notes || "",
    });
  };

  const openComplete = (reminder: ServiceReminder) => {
    setCompletingReminder(reminder);
    setCompleteDialogOpen(true);
  };

  const getDueDateStatus = (dueDate: Date): "overdue" | "due-soon" | "upcoming" => {
    const now = new Date();
    const due = new Date(dueDate);
    const soonThreshold = addDays(now, 14);

    if (isBefore(due, now)) return "overdue";
    if (isBefore(due, soonThreshold)) return "due-soon";
    return "upcoming";
  };

  const getDueDateColor = (status: "overdue" | "due-soon" | "upcoming") => {
    switch (status) {
      case "overdue":
        return "text-destructive";
      case "due-soon":
        return "text-warning";
      case "upcoming":
        return "text-success";
    }
  };

  const filteredReminders = reminders.filter((r) => {
    if (activeTab === "upcoming") {
      return r.status === "pending" || r.status === "sent";
    }
    if (activeTab === "completed") {
      return r.status === "completed";
    }
    return true;
  });

  const sortedReminders = [...filteredReminders].sort((a, b) => {
    return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
  });

  const commonServiceTypes = [
    "Annual AC Service",
    "Fire Safety Check",
    "Pool Maintenance",
    "Electrical Safety Inspection",
    "Plumbing Maintenance",
    "HVAC Filter Replacement",
    "Gutter Cleaning",
    "Smoke Alarm Testing",
    "Hot Water System Service",
    "Solar Panel Cleaning",
  ];

  const ReminderCard = ({ reminder }: { reminder: ServiceReminderWithClient }) => {
    const dueDateStatus = getDueDateStatus(new Date(reminder.nextDueDate));
    const isActive = reminder.status === "pending" || reminder.status === "sent";

    return (
      <Card className="hover-elevate">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Bell className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium truncate">{reminder.serviceType}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span className="truncate">{clientMap.get(reminder.clientId) || "Unknown Client"}</span>
                </div>
              </div>
              <Badge className={statusColors[reminder.status || "pending"]}>
                {reminder.status || "pending"}
              </Badge>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className={`flex items-center gap-2 text-sm ${isActive ? getDueDateColor(dueDateStatus) : "text-muted-foreground"}`}>
                <CalendarIcon className="h-4 w-4" />
                <span>
                  {format(new Date(reminder.nextDueDate), "dd MMM yyyy")}
                  {isActive && dueDateStatus === "overdue" && (
                    <span className="ml-1 font-medium">(Overdue)</span>
                  )}
                  {isActive && dueDateStatus === "due-soon" && (
                    <span className="ml-1 font-medium">(Due Soon)</span>
                  )}
                </span>
              </div>

              {reminder.intervalMonths && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <RefreshCw className="h-3 w-3" />
                  <span>{intervalLabels[reminder.intervalMonths] || `${reminder.intervalMonths}mo`}</span>
                </div>
              )}
            </div>

            {reminder.notes && (
              <p className="text-sm text-muted-foreground line-clamp-2">{reminder.notes}</p>
            )}

            <div className="flex items-center gap-2 pt-2 border-t">
              {isActive && (
                <Button size="sm" variant="default" onClick={() => openComplete(reminder)}>
                  <Check className="h-4 w-4 mr-1" />
                  Complete
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(reminder)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => deleteMutation.mutate(reminder.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <PageShell>
      <PageHeader
        title="Service Reminders"
        subtitle="Track recurring maintenance and service schedules"
        action={
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Reminder
          </Button>
        }
      />

      <div className="px-4 pb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming">
              <Clock className="h-4 w-4 mr-2" />
              Upcoming
            </TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="completed">
              <Check className="h-4 w-4 mr-2" />
              Completed
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : sortedReminders.length === 0 ? (
              <EmptyState
                icon={Bell}
                title={activeTab === "completed" ? "No completed reminders" : "No service reminders yet"}
                description={
                  activeTab === "completed"
                    ? "Completed service reminders will appear here"
                    : "Create your first service reminder to track recurring maintenance"
                }
                action={
                  activeTab !== "completed" ? (
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Reminder
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {sortedReminders.map((reminder) => (
                  <ReminderCard key={reminder.id} reminder={reminder} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={createDialogOpen || !!editingReminder} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          setEditingReminder(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingReminder ? "Edit Service Reminder" : "New Service Reminder"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="serviceType">Service Type</Label>
              <Select
                value={formData.serviceType}
                onValueChange={(v) => setFormData({ ...formData, serviceType: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select or type service type" />
                </SelectTrigger>
                <SelectContent>
                  {commonServiceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Or enter custom service type"
                value={formData.serviceType}
                onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="clientId">Client</Label>
              <SearchableSelect
                value={formData.clientId}
                onValueChange={(v) => setFormData({ ...formData, clientId: v })}
                placeholder="Select client"
                searchPlaceholder="Search clients..."
                emptyMessage="No clients found."
                options={clients.map((client) => ({ value: client.id, label: client.name }))}
                data-testid="select-reminder-client"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="jobId">Related Job (Optional)</Label>
              <JobPicker
                value={formData.jobId}
                onChange={(jobId) => setFormData({ ...formData, jobId })}
                label={null}
              />
            </div>

            <div className="grid gap-2">
              <Label>Next Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.nextDueDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.nextDueDate}
                    onSelect={(date) => date && setFormData({ ...formData, nextDueDate: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="intervalMonths">Repeat Interval</Label>
                <Select
                  value={String(formData.intervalMonths)}
                  onValueChange={(v) => setFormData({ ...formData, intervalMonths: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Monthly</SelectItem>
                    <SelectItem value="3">Quarterly</SelectItem>
                    <SelectItem value="6">6 Monthly</SelectItem>
                    <SelectItem value="12">Yearly</SelectItem>
                    <SelectItem value="24">2 Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reminderDays">Remind Before</Label>
                <Select
                  value={String(formData.reminderDays)}
                  onValueChange={(v) => setFormData({ ...formData, reminderDays: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">1 week</SelectItem>
                    <SelectItem value="14">2 weeks</SelectItem>
                    <SelectItem value="30">1 month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setEditingReminder(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingReminder ? handleUpdate : handleCreate}
              disabled={!formData.serviceType || !formData.clientId}
            >
              {editingReminder ? "Update" : "Create"} Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete Service</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Mark "{completingReminder?.serviceType}" as completed?
            </p>
            {completingReminder?.intervalMonths && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  This service repeats every {intervalLabels[completingReminder.intervalMonths] || `${completingReminder.intervalMonths} months`}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                if (completingReminder) {
                  completeMutation.mutate({ id: completingReminder.id, scheduleNext: false });
                }
              }}
            >
              Complete Only
            </Button>
            {completingReminder?.intervalMonths && (
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  if (completingReminder) {
                    completeMutation.mutate({ id: completingReminder.id, scheduleNext: true });
                  }
                }}
              >
                Complete & Schedule Next
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
