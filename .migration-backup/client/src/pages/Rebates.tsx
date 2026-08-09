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
  DollarSign,
  Calendar as CalendarIcon,
  Check,
  Trash2,
  Edit,
  Send,
  Building2,
  Award,
  FileText,
  Briefcase,
} from "lucide-react";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Rebate, Client, Job, Invoice } from "@shared/schema";

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  submitted: "bg-info/10 text-info",
  approved: "bg-primary/10 text-primary",
  received: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

const rebateTypeLabels: Record<string, string> = {
  manufacturer: "Manufacturer",
  government: "Government",
  other: "Other",
};

const rebateTypeIcons: Record<string, typeof Building2> = {
  manufacturer: Building2,
  government: Award,
  other: FileText,
};

interface RebatesSummary {
  pending: number;
  submitted: number;
  approved: number;
  received: number;
  rejected: number;
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(num);
}

export default function RebatesPage() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingRebate, setEditingRebate] = useState<Rebate | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const [formData, setFormData] = useState({
    name: "",
    rebateType: "manufacturer",
    description: "",
    amount: "",
    clientId: "",
    jobId: "",
    invoiceId: "",
    referenceNumber: "",
    expiryDate: null as Date | null,
    notes: "",
  });

  const { data: rebates = [], isLoading } = useQuery<Rebate[]>({
    queryKey: ["/api/rebates"],
  });

  const { data: summary = { pending: 0, submitted: 0, approved: 0, received: 0, rejected: 0 } } = useQuery<RebatesSummary>({
    queryKey: ["/api/rebates/summary"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const clientMap = new Map(clients.map((c) => [c.id, c.name]));
  const jobMap = new Map(jobs.map((j) => [j.id, j.title]));
  const invoiceMap = new Map(invoices.map((i) => [i.id, i.number]));

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/rebates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rebates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rebates/summary"] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: "Rebate created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create rebate", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/rebates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rebates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rebates/summary"] });
      setEditingRebate(null);
      resetForm();
      toast({ title: "Rebate updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update rebate", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/rebates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rebates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rebates/summary"] });
      toast({ title: "Rebate deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete rebate", variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/rebates/${id}/submit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rebates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rebates/summary"] });
      toast({ title: "Rebate marked as submitted" });
    },
    onError: () => {
      toast({ title: "Failed to submit rebate", variant: "destructive" });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/rebates/${id}/receive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rebates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rebates/summary"] });
      toast({ title: "Rebate marked as received" });
    },
    onError: () => {
      toast({ title: "Failed to receive rebate", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      rebateType: "manufacturer",
      description: "",
      amount: "",
      clientId: "",
      jobId: "",
      invoiceId: "",
      referenceNumber: "",
      expiryDate: null,
      notes: "",
    });
  };

  const handleCreate = () => {
    const data = {
      ...formData,
      amount: formData.amount,
      clientId: formData.clientId || null,
      jobId: formData.jobId || null,
      invoiceId: formData.invoiceId || null,
      expiryDate: formData.expiryDate?.toISOString() || null,
    };
    createMutation.mutate(data);
  };

  const handleUpdate = () => {
    if (!editingRebate) return;
    const data = {
      ...formData,
      amount: formData.amount,
      clientId: formData.clientId || null,
      jobId: formData.jobId || null,
      invoiceId: formData.invoiceId || null,
      expiryDate: formData.expiryDate?.toISOString() || null,
    };
    updateMutation.mutate({ id: editingRebate.id, data });
  };

  const openEdit = (rebate: Rebate) => {
    setEditingRebate(rebate);
    setFormData({
      name: rebate.name,
      rebateType: rebate.rebateType,
      description: rebate.description || "",
      amount: rebate.amount,
      clientId: rebate.clientId || "",
      jobId: rebate.jobId || "",
      invoiceId: rebate.invoiceId || "",
      referenceNumber: rebate.referenceNumber || "",
      expiryDate: rebate.expiryDate ? new Date(rebate.expiryDate) : null,
      notes: rebate.notes || "",
    });
  };

  const filteredRebates = rebates.filter((rebate) => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return rebate.status === "pending";
    if (activeTab === "submitted") return rebate.status === "submitted" || rebate.status === "approved";
    if (activeTab === "received") return rebate.status === "received";
    return true;
  });

  const summaryCards = [
    { label: "Pending", amount: summary.pending, color: "text-muted-foreground" },
    { label: "Submitted", amount: summary.submitted + summary.approved, color: "text-info" },
    { label: "Received", amount: summary.received, color: "text-success" },
  ];

  const renderFormFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Rebate Name</Label>
          <Input
            id="name"
            placeholder="e.g., Daikin Cashback, Solar Rebate VIC"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rebateType">Type</Label>
          <Select
            value={formData.rebateType}
            onValueChange={(value) => setFormData({ ...formData, rebateType: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manufacturer">Manufacturer</SelectItem>
              <SelectItem value="government">Government</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="referenceNumber">Reference Number</Label>
          <Input
            id="referenceNumber"
            placeholder="Optional reference"
            value={formData.referenceNumber}
            onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Brief description of the rebate"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="clientId">Client (Optional)</Label>
          <SearchableSelect
            value={formData.clientId || "_none"}
            onValueChange={(value) => setFormData({ ...formData, clientId: value === "_none" ? "" : value })}
            placeholder="Select client"
            searchPlaceholder="Search clients..."
            emptyMessage="No clients found."
            options={[
              { value: "_none", label: "None" },
              ...clients.map((client) => ({ value: client.id, label: client.name })),
            ]}
            data-testid="select-rebate-client"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobId">Job (Optional)</Label>
          <JobPicker
            value={formData.jobId}
            onChange={(jobId) => setFormData({ ...formData, jobId })}
            label={null}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoiceId">Invoice (Optional)</Label>
          <Select
            value={formData.invoiceId}
            onValueChange={(value) => setFormData({ ...formData, invoiceId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select invoice" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {invoices.map((invoice) => (
                <SelectItem key={invoice.id} value={invoice.id}>
                  {invoice.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Expiry Date (Optional)</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formData.expiryDate ? format(formData.expiryDate, "PPP") : "Select date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={formData.expiryDate || undefined}
              onSelect={(date) => setFormData({ ...formData, expiryDate: date || null })}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Additional notes..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
        />
      </div>
    </div>
  );

  return (
    <PageShell>
      <PageHeader
        title="Rebates & Credits"
        subtitle="Track manufacturer rebates, government incentives, and credits"
        action={
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Rebate
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className={`text-2xl font-bold ${card.color}`}>
                    {formatCurrency(card.amount)}
                  </p>
                </div>
                <DollarSign className={`h-8 w-8 ${card.color} opacity-50`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="submitted">Submitted</TabsTrigger>
          <TabsTrigger value="received">Received</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredRebates.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No rebates found"
              description="Track manufacturer rebates and government incentives by adding your first rebate."
              action={
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Rebate
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredRebates.map((rebate) => {
                const TypeIcon = rebateTypeIcons[rebate.rebateType] || FileText;
                return (
                  <Card key={rebate.id} className="hover-elevate">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 p-2 bg-muted rounded-md">
                            <TypeIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium truncate">{rebate.name}</h3>
                              <Badge className={statusColors[rebate.status || "pending"]} size="sm">
                                {rebate.status}
                              </Badge>
                              <Badge variant="outline" size="sm">
                                {rebateTypeLabels[rebate.rebateType]}
                              </Badge>
                            </div>
                            <p className="text-2xl font-bold text-primary mt-1">
                              {formatCurrency(rebate.amount)}
                            </p>
                            {rebate.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                                {rebate.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                              {rebate.clientId && clientMap.get(rebate.clientId) && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {clientMap.get(rebate.clientId)}
                                </span>
                              )}
                              {rebate.jobId && jobMap.get(rebate.jobId) && (
                                <span className="flex items-center gap-1">
                                  <Briefcase className="h-3 w-3" />
                                  {jobMap.get(rebate.jobId)}
                                </span>
                              )}
                              {rebate.invoiceId && invoiceMap.get(rebate.invoiceId) && (
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {invoiceMap.get(rebate.invoiceId)}
                                </span>
                              )}
                              {rebate.referenceNumber && (
                                <span>Ref: {rebate.referenceNumber}</span>
                              )}
                              {rebate.expiryDate && (
                                <span className="flex items-center gap-1">
                                  <CalendarIcon className="h-3 w-3" />
                                  Expires: {format(new Date(rebate.expiryDate), "PP")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {rebate.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => submitMutation.mutate(rebate.id)}
                              disabled={submitMutation.isPending}
                            >
                              <Send className="mr-1 h-3 w-3" />
                              Submit
                            </Button>
                          )}
                          {(rebate.status === "submitted" || rebate.status === "approved") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => receiveMutation.mutate(rebate.id)}
                              disabled={receiveMutation.isPending}
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Received
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(rebate)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(rebate.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Rebate</DialogTitle>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.name || !formData.amount || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Rebate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingRebate} onOpenChange={() => setEditingRebate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Rebate</DialogTitle>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRebate(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formData.name || !formData.amount || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
