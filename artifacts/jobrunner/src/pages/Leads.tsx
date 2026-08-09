import { useState, useMemo } from "react";
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
  DropdownMenuSeparator,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  MoreVertical,
  Phone,
  Mail,
  Globe,
  UserPlus,
  MessageSquare,
  Calendar as CalendarIcon,
  Trash2,
  Edit,
  DollarSign,
  ArrowRight,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Briefcase,
  Bot,
  Sparkles,
  TrendingUp,
  PhoneIncoming,
  Loader2,
  AlertCircle,
  Filter,
  Percent,
} from "lucide-react";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, isBefore, isToday, startOfDay } from "date-fns";
import type { Lead } from "@shared/schema";

type LeadSource = 'phone' | 'email' | 'website' | 'referral' | 'booking_page' | 'ai_receptionist' | 'other';
type LeadStatus = 'new' | 'contacted' | 'quoted' | 'won' | 'lost';

const sourceLabels: Record<LeadSource, string> = {
  phone: 'Phone Call',
  email: 'Email',
  website: 'Website',
  referral: 'Referral',
  booking_page: 'Booking Page',
  ai_receptionist: 'AI Receptionist',
  other: 'Other',
};

const sourceIcons: Record<LeadSource, typeof Phone> = {
  phone: Phone,
  email: Mail,
  website: Globe,
  referral: UserPlus,
  booking_page: CalendarIcon,
  ai_receptionist: Bot,
  other: MessageSquare,
};

const statusLabels: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quoted',
  won: 'Won',
  lost: 'Lost',
};

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-primary/10 text-primary',
  contacted: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  quoted: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  won: 'bg-green-500/10 text-green-600 dark:text-green-400',
  lost: 'bg-destructive/10 text-destructive',
};

const statusFlow: LeadStatus[] = ['new', 'contacted', 'quoted', 'won'];

export default function Leads() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    source: 'other' as LeadSource,
    status: 'new' as LeadStatus,
    description: '',
    estimatedValue: '',
    notes: '',
    followUpDate: null as Date | null,
  });
  const [convertOptions, setConvertOptions] = useState({
    createJob: true,
    createQuote: false,
    createInspection: false,
  });

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
  });

  const filteredLeads = useMemo(() => {
    let result = leads.filter((lead) => {
      const matchesSearch = searchQuery === '' ||
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
      return matchesSearch && matchesStatus && matchesSource;
    });
    result.sort((a, b) => {
      const statusOrder: Record<string, number> = { new: 0, contacted: 1, quoted: 2, won: 3, lost: 4 };
      const today = startOfDay(new Date());
      const aOverdue = a.followUpDate && isBefore(new Date(a.followUpDate), today) && a.status !== 'won' && a.status !== 'lost';
      const bOverdue = b.followUpDate && isBefore(new Date(b.followUpDate), today) && b.status !== 'won' && b.status !== 'lost';
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      const aStat = statusOrder[a.status || 'new'] ?? 5;
      const bStat = statusOrder[b.status || 'new'] ?? 5;
      if (aStat !== bStat) return aStat - bStat;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
    return result;
  }, [leads, searchQuery, statusFilter, sourceFilter]);

  const stats = useMemo(() => {
    const activeLeads = leads.filter(l => l.status !== 'won' && l.status !== 'lost');
    const newLeads = leads.filter(l => l.status === 'new').length;
    const contacted = leads.filter(l => l.status === 'contacted').length;
    const quoted = leads.filter(l => l.status === 'quoted').length;
    const won = leads.filter(l => l.status === 'won').length;
    const lost = leads.filter(l => l.status === 'lost').length;
    const pipelineValue = activeLeads.reduce((sum, l) => sum + (l.estimatedValue ? parseFloat(l.estimatedValue) : 0), 0);
    const total = leads.length;
    const decided = won + lost;
    const conversionRate = decided > 0 ? Math.round((won / decided) * 100) : 0;
    const today = startOfDay(new Date());
    const overdueCount = activeLeads.filter(l => l.followUpDate && isBefore(new Date(l.followUpDate), today)).length;

    const sourceCounts: Record<string, number> = {};
    leads.forEach(l => {
      const src = l.source || 'other';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });

    return { newLeads, contacted, quoted, won, total, conversionRate, pipelineValue, overdueCount, sourceCounts };
  }, [leads]);

  const activeSources = useMemo(() => {
    const validSources = new Set(Object.keys(sourceLabels));
    const sources = new Set(leads.map(l => {
      const src = l.source || 'other';
      return validSources.has(src) ? src : 'other';
    }));
    return Array.from(sources) as LeadSource[];
  }, [leads]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/leads', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      setCreateDialogOpen(false);
      resetForm();
      toast({ title: 'Lead created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create lead', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PUT', `/api/leads/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      setEditingLead(null);
      resetForm();
      toast({ title: 'Lead updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update lead', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({ title: 'Lead deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete lead', variant: 'destructive' });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async ({ id, createJob, createQuote, createInspection }: { id: string; createJob: boolean; createQuote: boolean; createInspection: boolean }) => {
      const res = await apiRequest('POST', `/api/leads/${id}/convert`, { createJob, createQuote, createInspection });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      setConvertDialogOpen(false);
      setLeadToConvert(null);
      setConvertOptions({ createJob: true, createQuote: false, createInspection: false });
      toast({ title: 'Lead converted successfully' });
      if (data?.client?.id) {
        navigate(`/clients/${data.client.id}`);
      }
    },
    onError: () => {
      toast({ title: 'Failed to convert lead', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '', email: '', phone: '', source: 'other', status: 'new',
      description: '', estimatedValue: '', notes: '', followUpDate: null,
    });
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      estimatedValue: formData.estimatedValue ? parseFloat(formData.estimatedValue).toFixed(2) : null,
      followUpDate: formData.followUpDate?.toISOString() || null,
    };
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (lead: Lead) => {
    setFormData({
      name: lead.name,
      email: lead.email || '',
      phone: lead.phone || '',
      source: (lead.source || 'other') as LeadSource,
      status: (lead.status || 'new') as LeadStatus,
      description: lead.description || '',
      estimatedValue: lead.estimatedValue || '',
      notes: lead.notes || '',
      followUpDate: lead.followUpDate ? new Date(lead.followUpDate) : null,
    });
    setEditingLead(lead);
  };

  const handleStatusChange = (lead: Lead, newStatus: LeadStatus) => {
    updateMutation.mutate({ id: lead.id, data: { status: newStatus } });
  };

  const handleConvert = (lead: Lead) => {
    setLeadToConvert(lead);
    setConvertOptions({ createJob: true, createQuote: false, createInspection: false });
    setConvertDialogOpen(true);
  };

  const confirmConvert = () => {
    if (!leadToConvert) return;
    convertMutation.mutate({
      id: leadToConvert.id,
      createJob: convertOptions.createJob,
      createQuote: convertOptions.createQuote,
      createInspection: convertOptions.createInspection,
    });
  };

  const formatCurrency = (value: string | number | null | undefined) => {
    if (!value) return null;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-AU', {
      style: 'currency', currency: 'AUD', minimumFractionDigits: 0,
    }).format(num);
  };

  const getNextStatus = (current: LeadStatus): LeadStatus | null => {
    const idx = statusFlow.indexOf(current);
    if (idx === -1 || idx >= statusFlow.length - 1) return null;
    return statusFlow[idx + 1];
  };

  const hasActiveFilters = statusFilter !== 'all' || sourceFilter !== 'all' || searchQuery !== '';

  const LeadCard = ({ lead }: { lead: Lead }) => {
    const SourceIcon = sourceIcons[(lead.source || 'other') as LeadSource] || MessageSquare;
    const status = (lead.status || 'new') as LeadStatus;
    const todayStart = startOfDay(new Date());
    const isOverdue = lead.followUpDate && isBefore(new Date(lead.followUpDate), todayStart) && status !== 'won' && status !== 'lost';
    const isFollowUpToday = lead.followUpDate && isToday(new Date(lead.followUpDate));
    const timeAgo = lead.createdAt ? formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true }) : '';
    const nextStatus = getNextStatus(status);
    const isTerminal = status === 'won' || status === 'lost';

    return (
      <Card
        className={`hover-elevate active-elevate-2 transition-all ${isOverdue ? 'border-destructive/40' : ''}`}
        data-testid={`card-lead-${lead.id}`}
      >
        <CardContent className="p-0">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: 'hsl(var(--trade) / 0.1)' }}>
                  <SourceIcon className="w-4.5 h-4.5" style={{ color: 'hsl(var(--trade))' }} />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm leading-tight">{lead.name}</span>
                  <Badge className={`${statusColors[status]} text-xs`}>
                    {statusLabels[status]}
                  </Badge>
                  {lead.source === 'ai_receptionist' && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Bot className="w-3 h-3" />
                      AI
                    </Badge>
                  )}
                </div>

                {lead.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {lead.description}
                  </p>
                )}

                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mt-2">
                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      className="flex items-center gap-1 hover-elevate rounded-md px-1.5 py-0.5 -ml-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="w-3 h-3" />
                      {lead.phone}
                    </a>
                  )}
                  {lead.email && (
                    <a
                      href={`mailto:${lead.email}`}
                      className="flex items-center gap-1 hover-elevate rounded-md px-1.5 py-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Mail className="w-3 h-3" />
                      <span className="truncate max-w-[140px]">{lead.email}</span>
                    </a>
                  )}
                  {lead.estimatedValue && (
                    <span className="flex items-center gap-1 font-medium" style={{ color: 'hsl(var(--trade))' }}>
                      <DollarSign className="w-3 h-3" />
                      {formatCurrency(lead.estimatedValue)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!isTerminal && (
                  <Button
                    size="sm"
                    onClick={() => handleConvert(lead)}
                    data-testid={`button-convert-${lead.id}`}
                  >
                    <Briefcase className="w-3.5 h-3.5 mr-1.5" />
                    Convert
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`button-lead-menu-${lead.id}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(lead)} data-testid={`menu-edit-lead-${lead.id}`}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Details
                    </DropdownMenuItem>
                    {!isTerminal && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleConvert(lead)}>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Convert to Client & Job
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    {(['new', 'contacted', 'quoted', 'won', 'lost'] as LeadStatus[]).filter(s => s !== lead.status).map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => handleStatusChange(lead, s)}
                        data-testid={`menu-status-${s}-${lead.id}`}
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Move to {statusLabels[s]}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => deleteMutation.mutate(lead.id)}
                      data-testid={`menu-delete-lead-${lead.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <div className="border-t px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {isOverdue && (
                <span className="flex items-center gap-1 text-destructive font-medium">
                  <AlertCircle className="w-3 h-3" />
                  Overdue {format(new Date(lead.followUpDate!), 'MMM d')}
                </span>
              )}
              {isFollowUpToday && !isOverdue && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                  <Clock className="w-3 h-3" />
                  Follow up today
                </span>
              )}
              {lead.followUpDate && !isOverdue && !isFollowUpToday && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  Follow up {format(new Date(lead.followUpDate), 'MMM d')}
                </span>
              )}
              <span className="flex items-center gap-1">
                <SourceIcon className="w-3 h-3" />
                {sourceLabels[(lead.source || 'other') as LeadSource]}
              </span>
              <span>{timeAgo}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {!isTerminal && nextStatus && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStatusChange(lead, nextStatus)}
                  data-testid={`button-next-status-${lead.id}`}
                >
                  <ArrowRight className="w-3.5 h-3.5 mr-1" />
                  {statusLabels[nextStatus]}
                </Button>
              )}
              {status === 'lost' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStatusChange(lead, 'new')}
                >
                  Reopen
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader
          title="Leads"
          subtitle="Track enquiries and convert them to jobs"
          leading={<PhoneIncoming className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />}
        />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-6">
          {[...Array(5)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
        <div className="space-y-3 mt-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Leads"
        subtitle="Track enquiries and convert them to jobs"
        leading={<PhoneIncoming className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />}
        action={
          <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-add-lead">
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-6">
        <Card
          className={`${statusFilter === 'new' ? 'ring-2 ring-primary' : 'hover-elevate cursor-pointer'}`}
          onClick={() => setStatusFilter(statusFilter === 'new' ? 'all' : 'new')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground font-medium">New</p>
                <p className="text-2xl font-bold">{stats.newLeads}</p>
              </div>
              <div className="w-9 h-9 rounded-md flex items-center justify-center bg-primary/10">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${statusFilter === 'contacted' ? 'ring-2 ring-primary' : 'hover-elevate cursor-pointer'}`}
          onClick={() => setStatusFilter(statusFilter === 'contacted' ? 'all' : 'contacted')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Contacted</p>
                <p className="text-2xl font-bold">{stats.contacted}</p>
              </div>
              <div className="w-9 h-9 rounded-md flex items-center justify-center bg-blue-500/10">
                <Phone className="w-4 h-4 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${statusFilter === 'quoted' ? 'ring-2 ring-primary' : 'hover-elevate cursor-pointer'}`}
          onClick={() => setStatusFilter(statusFilter === 'quoted' ? 'all' : 'quoted')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Quoted</p>
                <p className="text-2xl font-bold">{stats.quoted}</p>
              </div>
              <div className="w-9 h-9 rounded-md flex items-center justify-center bg-amber-500/10">
                <FileText className="w-4 h-4 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${statusFilter === 'won' ? 'ring-2 ring-primary' : 'hover-elevate cursor-pointer'}`}
          onClick={() => setStatusFilter(statusFilter === 'won' ? 'all' : 'won')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Won</p>
                <p className="text-2xl font-bold">{stats.won}</p>
              </div>
              <div className="w-9 h-9 rounded-md flex items-center justify-center bg-green-500/10">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Pipeline</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.pipelineValue) || '$0'}</p>
              </div>
              <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: 'hsl(var(--trade) / 0.1)' }}>
                <DollarSign className="w-4 h-4" style={{ color: 'hsl(var(--trade))' }} />
              </div>
            </div>
            {stats.conversionRate > 0 && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                <Percent className="w-3 h-3" />
                <span>{stats.conversionRate}% win rate</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-leads"
          />
        </div>
        {activeSources.length > 1 && (
          <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as LeadSource | 'all')}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-source-filter">
              <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {activeSources.map((src) => {
                const SrcIcon = sourceIcons[src];
                return (
                  <SelectItem key={src} value={src}>
                    <span className="flex items-center gap-2">
                      <SrcIcon className="w-3.5 h-3.5" />
                      {sourceLabels[src]}
                      {stats.sourceCounts[src] ? ` (${stats.sourceCounts[src]})` : ''}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={() => { setStatusFilter('all'); setSourceFilter('all'); setSearchQuery(''); }}>
            <XCircle className="w-3.5 h-3.5 mr-1.5" />
            Clear
          </Button>
        )}
      </div>

      {stats.overdueCount > 0 && statusFilter === 'all' && (
        <div className="mt-3 flex items-center gap-2 text-sm text-destructive bg-destructive/5 rounded-md px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{stats.overdueCount} lead{stats.overdueCount !== 1 ? 's' : ''} overdue for follow-up</span>
        </div>
      )}

      {leads.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={PhoneIncoming}
            title="No leads yet"
            description="Leads from your AI Receptionist, website, and manual entries will appear here. Convert them to jobs when you're ready."
            action={
              <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-add-first-lead">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Lead
              </Button>
            }
          />
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={Search}
            title="No matching leads"
            description="Try adjusting your search or filter"
          />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground mb-1">
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
            {hasActiveFilters ? ' matching filters' : ''}
          </p>
          {filteredLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}

      <Dialog open={createDialogOpen || !!editingLead} onOpenChange={(open) => {
        if (!open) { setCreateDialogOpen(false); setEditingLead(null); resetForm(); }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Lead name"
                data-testid="input-lead-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                  data-testid="input-lead-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0400 000 000"
                  data-testid="input-lead-phone"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source</Label>
                <Select
                  value={formData.source}
                  onValueChange={(v) => setFormData({ ...formData, source: v as LeadSource })}
                >
                  <SelectTrigger data-testid="select-lead-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(sourceLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as LeadStatus })}
                >
                  <SelectTrigger data-testid="select-lead-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the enquiry..."
                rows={2}
                data-testid="textarea-lead-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimatedValue">Estimated Value ($)</Label>
                <Input
                  id="estimatedValue"
                  type="number"
                  value={formData.estimatedValue}
                  onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
                  placeholder="0.00"
                  data-testid="input-lead-value"
                />
              </div>
              <div className="space-y-2">
                <Label>Follow-up Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start" data-testid="button-lead-followup">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {formData.followUpDate ? format(formData.followUpDate, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.followUpDate || undefined}
                      onSelect={(date) => setFormData({ ...formData, followUpDate: date || null })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
                data-testid="textarea-lead-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); setEditingLead(null); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-lead"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingLead ? 'Update Lead' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />
              Convert Lead
            </DialogTitle>
          </DialogHeader>

          {leadToConvert && (
            <div className="py-4 space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{leadToConvert.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {sourceLabels[(leadToConvert.source || 'other') as LeadSource]}
                      </Badge>
                    </div>
                    {leadToConvert.phone && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" /> {leadToConvert.phone}
                      </p>
                    )}
                    {leadToConvert.email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" /> {leadToConvert.email}
                      </p>
                    )}
                    {leadToConvert.description && (
                      <p className="text-sm text-muted-foreground mt-1">{leadToConvert.description}</p>
                    )}
                    {leadToConvert.estimatedValue && (
                      <p className="text-sm font-medium flex items-center gap-1.5 mt-1" style={{ color: 'hsl(var(--trade))' }}>
                        <DollarSign className="w-3.5 h-3.5" /> {formatCurrency(leadToConvert.estimatedValue)}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div>
                <p className="text-sm font-medium mb-3">A client record will be created and the lead marked as won. What else would you like to create?</p>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="createInspection"
                      checked={convertOptions.createInspection}
                      onCheckedChange={(checked) => setConvertOptions({
                        ...convertOptions,
                        createInspection: !!checked,
                        createJob: !!checked ? false : convertOptions.createJob,
                        createQuote: !!checked ? false : convertOptions.createQuote
                      })}
                      data-testid="checkbox-create-inspection"
                    />
                    <Label htmlFor="createInspection" className="flex items-center gap-2 cursor-pointer">
                      <Search className="w-4 h-4" />
                      Book an inspection first
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="createJob"
                      checked={convertOptions.createJob}
                      onCheckedChange={(checked) => setConvertOptions({
                        ...convertOptions,
                        createJob: !!checked,
                        createInspection: !!checked ? false : convertOptions.createInspection
                      })}
                      data-testid="checkbox-create-job"
                      disabled={convertOptions.createInspection}
                    />
                    <Label htmlFor="createJob" className="flex items-center gap-2 cursor-pointer">
                      <Briefcase className="w-4 h-4" />
                      Create a job
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="createQuote"
                      checked={convertOptions.createQuote}
                      onCheckedChange={(checked) => setConvertOptions({ ...convertOptions, createQuote: !!checked })}
                      data-testid="checkbox-create-quote"
                      disabled={convertOptions.createInspection}
                    />
                    <Label htmlFor="createQuote" className="flex items-center gap-2 cursor-pointer">
                      <FileText className="w-4 h-4" />
                      Create a quote
                    </Label>
                  </div>
                </div>

                {convertOptions.createInspection && (
                  <p className="text-xs text-muted-foreground mt-3 pl-7">
                    An inspection job will be created. After completing the inspection, you'll be prompted to create a quote.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setConvertDialogOpen(false); setLeadToConvert(null); }}>
              Cancel
            </Button>
            <Button
              onClick={confirmConvert}
              disabled={convertMutation.isPending}
              data-testid="button-confirm-convert"
            >
              {convertMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Convert Lead
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
