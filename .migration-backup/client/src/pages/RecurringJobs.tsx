import { SearchableSelect } from "@/components/ui/searchable-select";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import {
  Plus,
  MoreVertical,
  Repeat,
  User,
  Calendar as CalendarIcon,
  Play,
  Pause,
  Trash2,
  Edit,
  Clock,
  CheckCircle,
  AlertCircle,
  Zap,
} from "lucide-react";
import { PageShell, PageHeader, SectionGrid } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { RecurringContract, Client } from "@shared/schema";

type FrequencyType = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

const frequencyLabels: Record<FrequencyType, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success',
  paused: 'bg-warning/10 text-warning',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
};

interface RecurringContractWithClient extends RecurringContract {
  clientName?: string;
}

export default function RecurringJobs() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<RecurringContract | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    clientId: '',
    frequency: 'monthly' as FrequencyType,
    startDate: new Date(),
    endDate: null as Date | null,
    contractValue: '',
  });

  const { data: contracts = [], isLoading } = useQuery<RecurringContractWithClient[]>({
    queryKey: ['/api/recurring-contracts'],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/recurring-contracts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recurring-contracts'] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: 'Recurring job created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create recurring job', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest('PUT', `/api/recurring-contracts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recurring-contracts'] });
      setEditingContract(null);
      resetForm();
      toast({ title: 'Recurring job updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update recurring job', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/recurring-contracts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recurring-contracts'] });
      toast({ title: 'Recurring job deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete recurring job', variant: 'destructive' });
    },
  });

  const generateJobMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/recurring-contracts/${id}/generate-job`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recurring-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: 'Job generated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to generate job', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      clientId: '',
      frequency: 'monthly',
      startDate: new Date(),
      endDate: null,
      contractValue: '',
    });
  };

  const openEditDialog = (contract: RecurringContract) => {
    setEditingContract(contract);
    setFormData({
      title: contract.title,
      description: contract.description || '',
      clientId: contract.clientId,
      frequency: contract.frequency as FrequencyType,
      startDate: new Date(contract.startDate),
      endDate: contract.endDate ? new Date(contract.endDate) : null,
      contractValue: contract.contractValue || '',
    });
  };

  const handleSubmit = () => {
    const payload = {
      title: formData.title,
      description: formData.description || null,
      clientId: formData.clientId,
      frequency: formData.frequency,
      startDate: formData.startDate,
      endDate: formData.endDate,
      nextJobDate: formData.startDate,
      contractValue: formData.contractValue || null,
    };

    if (editingContract) {
      updateMutation.mutate({ id: editingContract.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    updateMutation.mutate({ id, data: { status: newStatus } });
  };

  const getStatusBadge = (status: string | null) => {
    const s = status || 'active';
    return (
      <Badge className={`${statusColors[s]} no-default-hover-elevate`}>
        {s === 'active' && <Play className="h-3 w-3 mr-1" />}
        {s === 'paused' && <Pause className="h-3 w-3 mr-1" />}
        {s === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
        {s === 'cancelled' && <AlertCircle className="h-3 w-3 mr-1" />}
        {s.charAt(0).toUpperCase() + s.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader
          title="Recurring Jobs"
          subtitle="Manage scheduled recurring work"
          leading={<Repeat className="h-5 w-5 text-primary" />}
        />
        <SectionGrid columns={3}>
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 space-y-3">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </SectionGrid>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Recurring Jobs"
        subtitle="Manage scheduled recurring work"
        leading={<Repeat className="h-5 w-5 text-primary" />}
        action={
          <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-recurring-job">
            <Plus className="h-4 w-4 mr-2" />
            New Recurring Job
          </Button>
        }
      />

      {contracts.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring jobs yet"
          description="Set up recurring jobs for regular maintenance, inspections, or any work that repeats on a schedule."
          action={
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-recurring-job">
              <Plus className="h-4 w-4 mr-2" />
              Create Recurring Job
            </Button>
          }
        />
      ) : (
        <SectionGrid columns={3}>
          {contracts.map((contract) => (
            <Card key={contract.id} className="hover-elevate active-elevate-2">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate" data-testid={`text-recurring-job-title-${contract.id}`}>
                      {contract.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                      <User className="h-3.5 w-3.5" />
                      <span className="truncate">{clientMap.get(contract.clientId) || 'Unknown Client'}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" data-testid={`button-recurring-job-menu-${contract.id}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(contract)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {contract.status === 'active' && (
                        <DropdownMenuItem onClick={() => handleStatusChange(contract.id, 'paused')}>
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </DropdownMenuItem>
                      )}
                      {contract.status === 'paused' && (
                        <DropdownMenuItem onClick={() => handleStatusChange(contract.id, 'active')}>
                          <Play className="h-4 w-4 mr-2" />
                          Resume
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => generateJobMutation.mutate(contract.id)}>
                        <Zap className="h-4 w-4 mr-2" />
                        Generate Job Now
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => deleteMutation.mutate(contract.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-wrap gap-2">
                  {getStatusBadge(contract.status)}
                  <Badge variant="secondary" className="no-default-hover-elevate">
                    <Clock className="h-3 w-3 mr-1" />
                    {frequencyLabels[contract.frequency as FrequencyType] || contract.frequency}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  <span>Next job: {format(new Date(contract.nextJobDate), 'dd MMM yyyy')}</span>
                </div>

                {contract.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{contract.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </SectionGrid>
      )}

      <Dialog open={createDialogOpen || !!editingContract} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          setEditingContract(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContract ? 'Edit Recurring Job' : 'Create Recurring Job'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Monthly AC Maintenance"
                data-testid="input-recurring-job-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <SearchableSelect
                value={formData.clientId}
                onValueChange={(v) => setFormData({ ...formData, clientId: v })}
                placeholder="Select a client"
                searchPlaceholder="Search clients..."
                emptyMessage="No clients found."
                options={clients.map((client) => ({ value: client.id, label: client.name }))}
                data-testid="select-recurring-job-client"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v as FrequencyType })}>
                <SelectTrigger data-testid="select-recurring-job-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(frequencyLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="button-recurring-job-start-date">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {formData.startDate ? format(formData.startDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.startDate}
                    onSelect={(date) => date && setFormData({ ...formData, startDate: date })}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="button-recurring-job-end-date">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {formData.endDate ? format(formData.endDate, 'PPP') : 'No end date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.endDate || undefined}
                    onSelect={(date) => setFormData({ ...formData, endDate: date || null })}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractValue">Contract Value (Optional)</Label>
              <Input
                id="contractValue"
                type="number"
                value={formData.contractValue}
                onChange={(e) => setFormData({ ...formData, contractValue: e.target.value })}
                placeholder="e.g., 500.00"
                data-testid="input-recurring-job-value"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Job details, notes, or special instructions..."
                rows={3}
                data-testid="input-recurring-job-description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateDialogOpen(false);
              setEditingContract(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!formData.title || !formData.clientId || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-recurring-job"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingContract ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
