import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Plus, 
  Briefcase, 
  Clock, 
  Play, 
  CheckCircle, 
  Receipt, 
  Calendar,
  Clipboard,
  User,
  MapPin,
  LayoutGrid,
  List,
  MoreVertical,
  Hourglass,
  AlertCircle,
  Archive,
  RotateCcw,
  Trash2,
  Search,
  ClipboardList,
  Check,
  X,
  Loader2,
  MessageSquare,
  Pencil,
  SlidersHorizontal,
  Save,
  ChevronDown,
  BookmarkCheck,
  Filter,
  Download,
  ExternalLink,
  FileText,
  Bot,
  Globe,
  Phone,
  Layers,
  Wrench
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { SearchBar, FilterChips } from "@/components/ui/filter-chips";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJobs, useUpdateJob, useArchiveJob, useUnarchiveJob, useDeleteJob } from "@/hooks/use-jobs";
import { useToast } from "@/hooks/use-toast";
import { useAppMode } from "@/hooks/use-app-mode";
import { useLocation, useSearch } from "wouter";
import { format, parseISO, isToday, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import PasteJobModal from "@/components/PasteJobModal";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

type JobStatus = 'pending' | 'quoted' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

interface Job {
  id: string;
  title: string;
  description?: string;
  clientId?: string;
  clientName?: string;
  address?: string;
  assignedTo?: string;
  scheduledAt?: string;
  status: JobStatus;
  jobType?: 'project' | 'service_call' | string | null;
  requiresInspection?: boolean;
  inspectionCompletedAt?: string;
  isXeroImport?: boolean;
  xeroJobId?: string;
  leadSource?: string | null;
}

interface AdvancedFilters {
  statuses: string[];
  dateFrom: string;
  dateTo: string;
  assignedTo: string;
  clientId: string;
  suburb: string;
}

const emptyAdvancedFilters: AdvancedFilters = {
  statuses: [],
  dateFrom: '',
  dateTo: '',
  assignedTo: '',
  clientId: '',
  suburb: '',
};

interface SavedFilter {
  id: string;
  name: string;
  filters: AdvancedFilters;
  entityType: string;
  createdAt: string;
}

interface WorkPageProps {
  onViewJob?: (id: string) => void;
  onCreateJob?: () => void;
  onShowQuoteModal?: (quoteId: string) => void;
  onShowInvoiceModal?: (invoiceId: string) => void;
}

function getLeadSourceBadge(source: string | null | undefined) {
  if (!source) return null;
  const config: Record<string, { label: string; icon: typeof Bot; className: string }> = {
    ai_receptionist: { label: 'AI Call', icon: Bot, className: 'bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400' },
    booking_page: { label: 'Booking', icon: Globe, className: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400' },
    website: { label: 'Website', icon: Globe, className: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:text-cyan-400' },
    phone: { label: 'Phone', icon: Phone, className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' },
    referral: { label: 'Referral', icon: User, className: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400' },
  };
  const c = config[source];
  if (!c) return null;
  const Icon = c.icon;
  return (
    <Badge className={cn("text-[10px] font-medium px-1.5 py-0 rounded-full gap-1", c.className)}>
      <Icon className="h-2.5 w-2.5" />
      {c.label}
    </Badge>
  );
}

export default function WorkPage({ 
  onViewJob, 
  onCreateJob,
}: WorkPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [pasteJobOpen, setPasteJobOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [pendingStatus, setPendingStatus] = useState<JobStatus | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(emptyAdvancedFilters);
  const [saveFilterName, setSaveFilterName] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [location, navigate] = useLocation();
  const searchParams = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const filterParam = params.get('filter');
    const validFilters = ['pending', 'quoted', 'scheduled', 'in_progress', 'done', 'invoiced', 'today', 'archived', 'inspection', 'requests'];
    if (filterParam && validFilters.includes(filterParam)) {
      setActiveFilter(filterParam);
    }
  }, [searchParams]);

  const showArchived = activeFilter === 'archived';
  const { data: jobs = [], isLoading } = useJobs({ archived: showArchived }) as { data: Job[], isLoading: boolean };
  const { toast } = useToast();
  const updateJobMutation = useUpdateJob();
  const archiveJobMutation = useArchiveJob();
  const unarchiveJobMutation = useUnarchiveJob();
  const deleteJobMutation = useDeleteJob();
  const { actionPermissions } = useAppMode();
  const canCreateJobs = actionPermissions?.canCreateJobs ?? true;

  const { data: clientsList = [] } = useQuery<any[]>({ queryKey: ['/api/clients'] });
  const { data: teamMembersList = [] } = useQuery<any[]>({ queryKey: ['/api/team/members'] });
  const { data: savedFiltersList = [], isLoading: savedFiltersLoading } = useQuery<SavedFilter[]>({ queryKey: ['/api/saved-filters'] });

  const saveFilterMutation = useMutation({
    mutationFn: async ({ name, filters }: { name: string; filters: AdvancedFilters }) => {
      const res = await apiRequest('POST', '/api/saved-filters', { name, filters, entityType: 'jobs' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-filters'] });
      toast({ title: "Filter Saved", description: `"${saveFilterName}" has been saved.` });
      setSaveDialogOpen(false);
      setSaveFilterName("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save filter", variant: "destructive" });
    },
  });

  const deleteFilterMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/saved-filters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-filters'] });
      toast({ title: "Filter Deleted" });
    },
  });

  const hasAdvancedFilters = useMemo(() => {
    const statuses = advancedFilters?.statuses || [];
    return statuses.length > 0 ||
      advancedFilters.dateFrom !== '' ||
      advancedFilters.dateTo !== '' ||
      advancedFilters.assignedTo !== '' ||
      advancedFilters.clientId !== '' ||
      advancedFilters.suburb !== '';
  }, [advancedFilters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if ((advancedFilters?.statuses || []).length > 0) count++;
    if (advancedFilters.dateFrom || advancedFilters.dateTo) count++;
    if (advancedFilters.assignedTo) count++;
    if (advancedFilters.clientId) count++;
    if (advancedFilters.suburb) count++;
    return count;
  }, [advancedFilters]);

  const handleClearAdvanced = useCallback(() => {
    setAdvancedFilters(emptyAdvancedFilters);
  }, []);

  const handleLoadSavedFilter = useCallback((sf: SavedFilter) => {
    const loaded = sf.filters || {};
    setAdvancedFilters({
      statuses: Array.isArray(loaded.statuses) ? loaded.statuses : [],
      dateFrom: loaded.dateFrom || '',
      dateTo: loaded.dateTo || '',
      assignedTo: loaded.assignedTo || '',
      clientId: loaded.clientId || '',
      suburb: loaded.suburb || '',
    });
    setAdvancedOpen(true);
    setActiveFilter('all');
  }, []);

  const handleSaveFilter = useCallback(() => {
    if (!saveFilterName.trim()) return;
    saveFilterMutation.mutate({ name: saveFilterName.trim(), filters: advancedFilters });
  }, [saveFilterName, advancedFilters]);

  const toggleStatus = useCallback((status: string) => {
    setAdvancedFilters(prev => {
      const statuses = Array.isArray(prev.statuses) ? prev.statuses : [];
      return {
        ...prev,
        statuses: statuses.includes(status)
          ? statuses.filter(s => s !== status)
          : [...statuses, status],
      };
    });
  }, []);

  const { data: jobRequests = [], isLoading: isLoadingRequests } = useQuery<any[]>({
    queryKey: ['/api/job-requests'],
  });
  const pendingRequests = useMemo(() => jobRequests.filter((r: any) => r.status === 'pending'), [jobRequests]);

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<any>(null);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [editRequestForm, setEditRequestForm] = useState({ title: '', description: '', preferredDate: '', clientNotes: '' });
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status, reviewNotes }: { id: string; status: string; reviewNotes?: string }) => {
      const res = await apiRequest('PATCH', `/api/job-requests/${id}`, { status, reviewNotes });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-requests'] });
      if (variables.status === 'accepted') {
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        toast({ title: "Request Accepted", description: "A new job has been created from this request." });
      } else {
        toast({ title: "Request Declined", description: "The job request has been declined." });
      }
      setRequestDialogOpen(false);
      setSelectedRequest(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update request", variant: "destructive" });
    },
    onSettled: () => {
      setAcceptingId(null);
      setDecliningId(null);
    },
  });

  const editRequestMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PATCH', `/api/job-requests/${id}`, data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/job-requests'] });
      toast({ title: "Request Updated", description: "The job request details have been updated." });
      setEditingRequestId(null);
      if (data) setSelectedRequest(data);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update request", variant: "destructive" });
    },
  });

  const startEditRequest = (request: any) => {
    setEditingRequestId(request.id);
    setEditRequestForm({
      title: request.title || '',
      description: request.description || '',
      preferredDate: request.preferredDate ? new Date(request.preferredDate).toISOString().split('T')[0] : '',
      clientNotes: request.clientNotes || '',
    });
  };

  const handleSaveRequest = () => {
    if (!editingRequestId || !editRequestForm.title.trim()) return;
    editRequestMutation.mutate({ id: editingRequestId, data: editRequestForm });
  };

  const handleAcceptRequest = async (request: any) => {
    setAcceptingId(request.id);
    updateRequestMutation.mutate({ id: request.id, status: 'accepted' });
  };

  const handleDeclineRequest = (request: any) => {
    setDeclineTarget(request);
    setDeclineDialogOpen(true);
  };

  const handleConfirmDecline = async () => {
    if (!declineTarget) return;
    setDecliningId(declineTarget.id);
    updateRequestMutation.mutate({ id: declineTarget.id, status: 'declined' });
    setDeclineDialogOpen(false);
    setDeclineTarget(null);
  };

  const [portalPreviewLoading, setPortalPreviewLoading] = useState(false);
  
  const handleViewInPortal = async (clientId: string | number) => {
    const newTab = window.open('about:blank', '_blank');
    setPortalPreviewLoading(true);
    try {
      const res = await apiRequest('POST', '/api/portal/admin-preview', { clientId });
      const data = await res.json();
      if (data.sessionToken) {
        const portalUrl = `${window.location.origin}/portal?preview_token=${data.sessionToken}`;
        if (newTab) {
          newTab.location.href = portalUrl;
        } else {
          window.open(portalUrl, '_blank');
        }
      } else {
        newTab?.close();
        toast({ title: "Unable to preview", description: data.error || "Could not generate portal preview", variant: "destructive" });
      }
    } catch (err: any) {
      newTab?.close();
      toast({ title: "Portal Preview Error", description: err.message || "Failed to open client portal", variant: "destructive" });
    } finally {
      setPortalPreviewLoading(false);
    }
  };

  const statusLabels: Record<JobStatus, string> = {
    pending: 'Pending',
    quoted: 'Quoted',
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    done: 'Completed',
    invoiced: 'Invoiced',
  };

  const stats = useMemo(() => ({
    total: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    quoted: jobs.filter(j => j.status === 'quoted').length,
    scheduled: jobs.filter(j => j.status === 'scheduled').length,
    inProgress: jobs.filter(j => j.status === 'in_progress').length,
    done: jobs.filter(j => j.status === 'done').length,
    invoiced: jobs.filter(j => j.status === 'invoiced').length,
    inspection: jobs.filter(j => j.requiresInspection && !j.inspectionCompletedAt).length,
    archived: showArchived ? jobs.length : undefined,
    requests: pendingRequests.length,
  }), [jobs, showArchived, pendingRequests]);

  const statusPriority: Record<string, number> = {
    in_progress: 0,
    scheduled: 1,
    pending: 2,
    done: 3,
    invoiced: 4,
  };

  const filteredJobs = useMemo(() => {
    const filtered = jobs.filter(job => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        (job.title || '').toLowerCase().includes(search) ||
        (job.clientName || '').toLowerCase().includes(search) ||
        (job.address || '').toLowerCase().includes(search);

      const matchesFilter = activeFilter === 'all' || activeFilter === 'archived'
        ? true
        : activeFilter === 'today'
        ? (job.scheduledAt && isToday(parseISO(job.scheduledAt)))
        : activeFilter === 'inspection'
        ? (job.requiresInspection && !job.inspectionCompletedAt)
        : job.status === activeFilter;

      if (hasAdvancedFilters) {
        const statuses = advancedFilters?.statuses || [];
        if (statuses.length > 0 && !statuses.includes(job.status)) return false;
        if (advancedFilters.dateFrom) {
          const from = new Date(advancedFilters.dateFrom);
          const d = job.scheduledAt ? new Date(job.scheduledAt) : null;
          if (!d || d < from) return false;
        }
        if (advancedFilters.dateTo) {
          const to = new Date(advancedFilters.dateTo);
          to.setHours(23, 59, 59, 999);
          const d = job.scheduledAt ? new Date(job.scheduledAt) : null;
          if (!d || d > to) return false;
        }
        if (advancedFilters.assignedTo && job.assignedTo !== advancedFilters.assignedTo) return false;
        if (advancedFilters.clientId && job.clientId !== advancedFilters.clientId) return false;
        if (advancedFilters.suburb) {
          const lower = advancedFilters.suburb.toLowerCase();
          if (!(job.address || '').toLowerCase().includes(lower)) return false;
        }
      }

      return matchesSearch && matchesFilter;
    });

    return filtered.sort((a, b) => {
      const aPriority = statusPriority[a.status] ?? 5;
      const bPriority = statusPriority[b.status] ?? 5;
      if (aPriority !== bPriority) return aPriority - bPriority;

      const aDate = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const bDate = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      if (aPriority <= 2) {
        if (!a.scheduledAt && b.scheduledAt) return 1;
        if (a.scheduledAt && !b.scheduledAt) return -1;
        return aDate - bDate;
      }
      return bDate - aDate;
    });
  }, [jobs, searchTerm, activeFilter, advancedFilters, hasAdvancedFilters]);

  const handleStatusChange = (job: Job, newStatus: JobStatus) => {
    setSelectedJob(job);
    setPendingStatus(newStatus);
    setStatusDialogOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!selectedJob || !pendingStatus) return;
    
    try {
      await updateJobMutation.mutateAsync({ id: selectedJob.id, data: { status: pendingStatus } });
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: `Job ${statusLabels[pendingStatus]}`,
        description: `${selectedJob.title || 'Job'} → ${statusLabels[pendingStatus]}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update job status",
        variant: "destructive",
      });
    }
  };

  const handleCreateInvoice = (jobId: string) => {
    navigate(`/invoices/new?jobId=${jobId}`);
  };

  const handleRestoreJob = async (job: Job) => {
    try {
      await unarchiveJobMutation.mutateAsync(job.id);
      toast({
        title: "Job Restored",
        description: `${job.title || 'Job'} has been restored`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to restore job",
        variant: "destructive",
      });
    }
  };

  const handleArchiveJob = (job: Job) => {
    setSelectedJob(job);
    setArchiveDialogOpen(true);
  };

  const handleConfirmArchiveJob = async () => {
    if (!selectedJob) return;
    try {
      await archiveJobMutation.mutateAsync(selectedJob.id);
      toast({
        title: "Job Archived",
        description: `${selectedJob.title || 'Job'} has been archived`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to archive job",
        variant: "destructive",
      });
    }
  };

  const handleDeleteJob = (job: Job) => {
    setSelectedJob(job);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDeleteJob = async () => {
    if (!selectedJob) return;
    try {
      await deleteJobMutation.mutateAsync(selectedJob.id);
      toast({
        title: "Job Deleted",
        description: `${selectedJob.title || 'Job'} has been deleted`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete job",
        variant: "destructive",
      });
    }
    setDeleteDialogOpen(false);
    setSelectedJob(null);
  };

  const getNextAction = (job: Job) => {
    if (showArchived) {
      return { label: 'Restore', action: () => handleRestoreJob(job), icon: RotateCcw };
    }
    // All status-related actions now navigate to job view so user can make informed decisions
    if (job.status === 'pending') return { label: 'View', action: () => onViewJob?.(job.id), icon: Briefcase };
    if (job.status === 'scheduled') return { label: 'View', action: () => onViewJob?.(job.id), icon: Briefcase };
    if (job.status === 'in_progress') return { label: 'View', action: () => onViewJob?.(job.id), icon: Briefcase };
    if (job.status === 'done') return { label: 'Invoice', action: () => handleCreateInvoice(job.id), icon: Receipt };
    return null;
  };

  const tableColumns: ColumnDef<Job>[] = [
    {
      id: "title",
      header: "Job",
      accessorKey: "title",
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium truncate">{row.title || 'Untitled Job'}</span>
            {getLeadSourceBadge(row.leadSource)}
          </div>
          {row.clientName && (
            <span className="text-xs text-muted-foreground truncate block">{row.clientName}</span>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: "scheduledAt",
      header: "Scheduled",
      accessorKey: "scheduledAt",
      sortable: true,
      hideOnMobile: true,
      cell: (row) => row.scheduledAt ? format(parseISO(row.scheduledAt), 'dd MMM, h:mm a') : '—',
    },
    {
      id: "address",
      header: "Address",
      accessorKey: "address",
      hideOnMobile: true,
      cell: (row) => (
        <span className="text-muted-foreground truncate max-w-[200px] block">
          {row.address || "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "w-10",
      cell: (row) => {
        const nextAction = getNextAction(row);
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => e.stopPropagation()}
                data-testid={`button-job-table-actions-${row.id}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" style={{ borderRadius: "12px" }}>
              <DropdownMenuItem onClick={() => onViewJob?.(row.id)}>
                <Briefcase className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              {nextAction && (
                <DropdownMenuItem onClick={nextAction.action}>
                  <nextAction.icon className="h-4 w-4 mr-2" />
                  {nextAction.label}
                </DropdownMenuItem>
              )}
              {!showArchived && (
                <DropdownMenuItem onClick={() => handleArchiveJob(row)}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={() => handleDeleteJob(row)}
                className="text-red-600 dark:text-red-400"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const JobCardItem = ({ job }: { job: Job }) => {
    const nextAction = getNextAction(job);
    const scheduledLabel = job.scheduledAt 
      ? format(parseISO(job.scheduledAt), 'EEE d MMM')
      : null;

    return (
      <Card 
        className="hover-elevate cursor-pointer relative overflow-visible"
        style={{ borderRadius: '12px' }}
        onClick={() => onViewJob?.(job.id)}
        data-testid={`job-card-${job.id}`}
      >
        {/* Xero Import Ribbon */}
        {job.isXeroImport && (
          <div 
            className="absolute -top-1 -right-1 z-10"
            data-testid={`xero-ribbon-${job.id}`}
          >
            <div className="bg-sky-500 text-white text-xs font-semibold px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
              </svg>
              Xero
            </div>
          </div>
        )}
        
        <CardContent className="p-3">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-1">
              <h4 className="font-semibold text-sm leading-tight line-clamp-2 flex-1">
                {job.title || 'Untitled Job'}
              </h4>
              <div className="flex items-center gap-1 shrink-0 flex-wrap">
                <StatusBadge status={job.status} />
                {job.jobType === 'project' && (
                  <Badge variant="outline" className="text-xs gap-1 border-violet-300 text-violet-700 bg-violet-50 dark:border-violet-700 dark:text-violet-300 dark:bg-violet-950">
                    <Layers className="w-3 h-3" />
                    Project
                  </Badge>
                )}
                {job.jobType === 'service_call' && (
                  <Badge variant="outline" className="text-xs gap-1 border-sky-300 text-sky-700 bg-sky-50 dark:border-sky-700 dark:text-sky-300 dark:bg-sky-950">
                    <Wrench className="w-3 h-3" />
                    Service Call
                  </Badge>
                )}
                {job.leadSource && getLeadSourceBadge(job.leadSource)}
                {job.requiresInspection && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Search className="w-3 h-3" />
                    {job.inspectionCompletedAt ? 'Inspected' : 'Inspection'}
                  </Badge>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" data-testid={`job-card-menu-${job.id}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" style={{ borderRadius: "12px" }}>
                    <DropdownMenuItem onClick={() => onViewJob?.(job.id)}>
                      <Briefcase className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    {!showArchived && (
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchiveJob(job); }}>
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      onClick={(e) => { e.stopPropagation(); handleDeleteJob(job); }}
                      className="text-red-600 dark:text-red-400"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            <div className="space-y-0.5">
              {job.clientName && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{job.clientName}</span>
                </div>
              )}
              {job.address && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{job.address}</span>
                </div>
              )}
              {scheduledLabel && (
                <div className="flex items-center gap-1 text-xs font-medium text-primary">
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  <span>{scheduledLabel}</span>
                </div>
              )}
            </div>
          </div>
          
          {nextAction && (
            <div className="mt-2 pt-2 border-t flex justify-end">
              <Button
                size="sm"
                variant={job.status === 'done' ? 'default' : 'outline'}
                className="rounded-lg h-7 text-xs px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  nextAction.action();
                }}
                data-testid={`btn-${nextAction.label.toLowerCase()}-${job.id}`}
              >
                <nextAction.icon className="h-3 w-3 mr-1" />
                {nextAction.label}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <PageShell data-testid="work-page">
      <PageHeader
        title="Work"
        subtitle={`${jobs.length} total jobs`}
        action={
          canCreateJobs && (
            <div className="flex items-center gap-2">
              <div className="hidden md:inline-flex rounded-lg border bg-muted p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("cards")}
                  className={cn(
                    "h-8 px-3 rounded-md",
                    viewMode === "cards" && "bg-background shadow-sm"
                  )}
                  data-testid="button-work-view-cards"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "h-8 px-3 rounded-md",
                    viewMode === "table" && "bg-background shadow-sm"
                  )}
                  data-testid="button-work-view-table"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPasteJobOpen(true)}
                className="rounded-xl"
                data-testid="btn-paste-job"
              >
                <Clipboard className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Paste</span>
              </Button>
              <Button
                size="sm"
                onClick={onCreateJob}
                className="rounded-xl text-white"
                style={{ backgroundColor: 'hsl(var(--trade))' }}
                data-testid="btn-create-job"
              >
                <Plus className="h-4 w-4 mr-1" />
                Job
              </Button>
            </div>
          )
        }
      />

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search jobs by title, client, or address..."
      />

      <div className="flex items-center gap-2 flex-wrap">
        <FilterChips 
          chips={[
            { id: 'all', label: 'All', count: stats.total, icon: <Briefcase className="h-3 w-3" /> },
            { id: 'requests', label: 'Requests', count: stats.requests, icon: <ClipboardList className="h-3 w-3" /> },
            { id: 'pending', label: 'Pending', count: stats.pending, icon: <Hourglass className="h-3 w-3" /> },
            { id: 'quoted', label: 'Quoted', count: stats.quoted, icon: <FileText className="h-3 w-3" /> },
            { id: 'scheduled', label: 'Scheduled', count: stats.scheduled, icon: <Calendar className="h-3 w-3" /> },
            { id: 'in_progress', label: 'In Progress', count: stats.inProgress, icon: <Play className="h-3 w-3" /> },
            { id: 'done', label: 'Completed', count: stats.done, icon: <CheckCircle className="h-3 w-3" /> },
            { id: 'invoiced', label: 'Invoiced', count: stats.invoiced, icon: <Receipt className="h-3 w-3" /> },
            { id: 'today', label: 'Today', count: jobs.filter(j => j.scheduledAt && isToday(parseISO(j.scheduledAt))).length, icon: <Calendar className="h-3 w-3" /> },
            { id: 'inspection', label: 'Inspection', count: stats.inspection, icon: <Search className="h-3 w-3" /> },
            { id: 'archived', label: 'Archived', count: stats.archived, icon: <Archive className="h-3 w-3" /> },
          ]}
          activeId={activeFilter}
          onSelect={setActiveFilter}
          className="flex-1"
        />

        <div className="flex items-center gap-1">
          <Button
            variant={advancedOpen || hasAdvancedFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className={cn("rounded-lg gap-1.5", hasAdvancedFilters && "text-white")}
            style={hasAdvancedFilters ? { backgroundColor: 'hsl(var(--trade))' } : {}}
            data-testid="btn-advanced-filters"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          {savedFiltersList.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-lg gap-1.5" data-testid="btn-saved-filters">
                  <BookmarkCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Saved</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {savedFiltersList.map((sf) => (
                  <DropdownMenuItem key={sf.id} className="flex items-center justify-between gap-2">
                    <button
                      className="flex-1 text-left text-sm truncate"
                      onClick={() => handleLoadSavedFilter(sf)}
                    >
                      {sf.name}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFilterMutation.mutate(sf.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="rounded-lg"
                onClick={() => window.open('/api/export/jobs', '_blank')}
                data-testid="btn-export-jobs"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export Jobs to CSV</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {advancedOpen && (
        <Card className="overflow-visible" style={{ borderRadius: '12px' }}>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Advanced Filters</span>
              </div>
              <div className="flex items-center gap-1">
                {hasAdvancedFilters && (
                  <Button variant="ghost" size="sm" onClick={handleClearAdvanced} className="text-xs gap-1 rounded-lg">
                    <X className="h-3 w-3" />
                    Clear All
                  </Button>
                )}
                {hasAdvancedFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSaveDialogOpen(true)}
                    className="text-xs gap-1 rounded-lg"
                  >
                    <Save className="h-3 w-3" />
                    Save
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <div className="flex flex-wrap gap-1">
                  {(['pending', 'scheduled', 'in_progress', 'done', 'invoiced'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleStatus(s)}
                      className={cn(
                        "px-2 py-1 rounded-md text-xs border transition-colors",
                        (advancedFilters?.statuses || []).includes(s)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover-elevate"
                      )}
                    >
                      {{ pending: 'Pending', scheduled: 'Scheduled', in_progress: 'In Progress', done: 'Completed', invoiced: 'Invoiced' }[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Scheduled From</Label>
                <Input
                  type="date"
                  value={advancedFilters.dateFrom}
                  onChange={(e) => setAdvancedFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Scheduled To</Label>
                <Input
                  type="date"
                  value={advancedFilters.dateTo}
                  onChange={(e) => setAdvancedFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Assigned To</Label>
                <Select
                  value={advancedFilters.assignedTo || '_all'}
                  onValueChange={(v) => setAdvancedFilters(prev => ({ ...prev, assignedTo: v === '_all' ? '' : v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All team members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All team members</SelectItem>
                    {teamMembersList.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.name || m.email || 'Unnamed'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Client</Label>
                <Select
                  value={advancedFilters.clientId || '_all'}
                  onValueChange={(v) => setAdvancedFilters(prev => ({ ...prev, clientId: v === '_all' ? '' : v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All clients</SelectItem>
                    {clientsList.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name || 'Unnamed'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Address / Suburb</Label>
                <Input
                  value={advancedFilters.suburb}
                  onChange={(e) => setAdvancedFilters(prev => ({ ...prev, suburb: e.target.value }))}
                  placeholder="e.g. Richmond, NSW..."
                  className="h-9"
                />
              </div>
            </div>

            {hasAdvancedFilters && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(advancedFilters?.statuses || []).map((s) => (
                  <Badge key={s} variant="secondary" className="gap-1 text-xs">
                    {{ pending: 'Pending', scheduled: 'Scheduled', in_progress: 'In Progress', done: 'Completed', invoiced: 'Invoiced' }[s] || s}
                    <button onClick={() => toggleStatus(s)}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
                {advancedFilters.dateFrom && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    From: {advancedFilters.dateFrom}
                    <button onClick={() => setAdvancedFilters(prev => ({ ...prev, dateFrom: '' }))}><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {advancedFilters.dateTo && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    To: {advancedFilters.dateTo}
                    <button onClick={() => setAdvancedFilters(prev => ({ ...prev, dateTo: '' }))}><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {advancedFilters.assignedTo && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    Assigned: {teamMembersList.find((m: any) => m.id === advancedFilters.assignedTo)?.name || advancedFilters.assignedTo}
                    <button onClick={() => setAdvancedFilters(prev => ({ ...prev, assignedTo: '' }))}><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {advancedFilters.clientId && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    Client: {clientsList.find((c: any) => c.id === advancedFilters.clientId)?.name || advancedFilters.clientId}
                    <button onClick={() => setAdvancedFilters(prev => ({ ...prev, clientId: '' }))}><X className="h-3 w-3" /></button>
                  </Badge>
                )}
                {advancedFilters.suburb && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    Suburb: {advancedFilters.suburb}
                    <button onClick={() => setAdvancedFilters(prev => ({ ...prev, suburb: '' }))}><X className="h-3 w-3" /></button>
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Save Filter Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Filter</DialogTitle>
            <DialogDescription>
              Name this filter combination to quickly recall it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={saveFilterName}
              onChange={(e) => setSaveFilterName(e.target.value)}
              placeholder="e.g. This week's scheduled jobs"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFilter(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSaveFilter}
              disabled={!saveFilterName.trim() || saveFilterMutation.isPending}
              className="text-white"
              style={{ backgroundColor: 'hsl(var(--trade))' }}
            >
              {saveFilterMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Save Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Request Cards */}
      {(activeFilter === 'requests' || (activeFilter === 'all' && pendingRequests.length > 0)) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Client Requests</h3>
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{pendingRequests.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {pendingRequests.map((request: any) => (
              <Card
                key={request.id}
                className="hover-elevate cursor-pointer relative overflow-visible border-amber-200 dark:border-amber-800/50"
                style={{ borderRadius: '12px' }}
                onClick={() => {
                  setSelectedRequest(request);
                  setEditingRequestId(null);
                  setRequestDialogOpen(true);
                }}
                data-testid={`request-card-${request.id}`}
              >
                <CardContent className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="font-semibold text-sm leading-tight line-clamp-2 flex-1">
                        {request.title}
                      </h4>
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 shrink-0 text-xs no-default-active-elevate">
                        Request
                      </Badge>
                    </div>
                    <div className="space-y-0.5">
                      {request.clientName && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{request.clientName}</span>
                        </div>
                      )}
                      {request.preferredDate && (
                        <div className="flex items-center gap-1 text-xs font-medium text-primary">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          <span>{format(parseISO(request.preferredDate), 'EEE d MMM')}</span>
                        </div>
                      )}
                      {request.urgency && request.urgency !== 'normal' && (
                        <Badge className={cn(
                          "text-xs mt-1 no-default-active-elevate",
                          request.urgency === 'emergency' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                        )}>
                          {request.urgency.charAt(0).toUpperCase() + request.urgency.slice(1)}
                        </Badge>
                      )}
                      <p className="text-xs text-muted-foreground/60 pt-0.5">
                        {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Request Detail Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={(open) => {
        setRequestDialogOpen(open);
        if (!open) {
          setEditingRequestId(null);
          setSelectedRequest(null);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingRequestId === selectedRequest?.id ? (
                <span>Edit Request</span>
              ) : (
                <span>{selectedRequest?.title}</span>
              )}
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs no-default-active-elevate">
                Request
              </Badge>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Job request details
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            editingRequestId === selectedRequest.id ? (
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={editRequestForm.title}
                    onChange={(e) => setEditRequestForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Job title"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={editRequestForm.description}
                    onChange={(e) => setEditRequestForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Description"
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Preferred Date</label>
                  <Input
                    type="date"
                    value={editRequestForm.preferredDate}
                    onChange={(e) => setEditRequestForm(prev => ({ ...prev, preferredDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Client Notes</label>
                  <Textarea
                    value={editRequestForm.clientNotes}
                    onChange={(e) => setEditRequestForm(prev => ({ ...prev, clientNotes: e.target.value }))}
                    placeholder="Notes from client"
                    rows={2}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-2">
                {selectedRequest.clientName && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {selectedRequest.clientId ? (
                      <button
                        className="font-medium text-primary hover:underline text-left"
                        onClick={() => {
                          setRequestDialogOpen(false);
                          navigate(`/clients/${selectedRequest.clientId}`);
                        }}
                      >
                        {selectedRequest.clientName}
                      </button>
                    ) : (
                      <span className="font-medium">{selectedRequest.clientName}</span>
                    )}
                  </div>
                )}
                {selectedRequest.description && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</p>
                    <p className="text-sm">{selectedRequest.description}</p>
                  </div>
                )}
                {selectedRequest.clientNotes && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client Notes</p>
                    <div className="flex items-start gap-2 text-sm">
                      <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <span>{selectedRequest.clientNotes}</span>
                    </div>
                  </div>
                )}
                {selectedRequest.preferredDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>Preferred: {format(parseISO(selectedRequest.preferredDate), 'EEE d MMM yyyy')}</span>
                  </div>
                )}
                {selectedRequest.urgency && selectedRequest.urgency !== 'normal' && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Badge className={cn(
                      "text-xs no-default-active-elevate",
                      selectedRequest.urgency === 'emergency' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    )}>
                      {selectedRequest.urgency.charAt(0).toUpperCase() + selectedRequest.urgency.slice(1)}
                    </Badge>
                  </div>
                )}
                {selectedRequest.preferredWorkerName && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>Preferred Worker: {selectedRequest.preferredWorkerName}</span>
                  </div>
                )}
                {selectedRequest.referenceJobTitle && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>Reference: {selectedRequest.referenceJobTitle}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground/60">
                  {formatDistanceToNow(new Date(selectedRequest.createdAt), { addSuffix: true })}
                </p>
              </div>
            )
          )}

          <DialogFooter className="flex-row gap-2">
            {editingRequestId === selectedRequest?.id ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditingRequestId(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveRequest} disabled={editRequestMutation.isPending}>
                  {editRequestMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => selectedRequest && startEditRequest(selectedRequest)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {selectedRequest?.clientId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewInPortal(selectedRequest.clientId)}
                    disabled={portalPreviewLoading}
                  >
                    {portalPreviewLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ExternalLink className="h-3 w-3 mr-1" />}
                    View in Portal
                  </Button>
                )}
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50"
                  onClick={() => selectedRequest && handleDeclineRequest(selectedRequest)}
                  disabled={decliningId === selectedRequest?.id}
                >
                  {decliningId === selectedRequest?.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}
                  Decline
                </Button>
                <Button
                  size="sm"
                  className="text-white"
                  style={{ backgroundColor: 'hsl(var(--trade))' }}
                  onClick={() => selectedRequest && handleAcceptRequest(selectedRequest)}
                  disabled={acceptingId === selectedRequest?.id}
                >
                  {acceptingId === selectedRequest?.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                  Accept
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeFilter === 'requests' ? (
        isLoadingRequests ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i} style={{ borderRadius: '12px' }}>
                <CardContent className="p-4 animate-pulse">
                  <div className="space-y-3">
                    <div className="h-5 w-48 bg-muted rounded" />
                    <div className="h-4 w-32 bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : pendingRequests.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No pending requests"
            description="When clients submit job requests, they'll appear here for you to review."
          />
        ) : null
      ) : (
      <>
      {activeFilter !== 'archived' && filteredJobs.length > 0 && (
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Your Jobs</h3>
          <Badge variant="secondary">{filteredJobs.length}</Badge>
        </div>
      )}
      {isLoading ? (
        <div className="space-y-3" data-testid="jobs-loading">
          {[1, 2, 3].map((i) => (
            <Card key={i} style={{ borderRadius: '14px' }}>
              <CardContent className="p-4 animate-pulse">
                <div className="space-y-3">
                  <div className="h-5 w-48 bg-muted rounded" />
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="flex gap-4">
                    <div className="h-3 w-24 bg-muted rounded" />
                    <div className="h-3 w-24 bg-muted rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={
            searchTerm 
              ? "No jobs found" 
              : activeFilter !== 'all' && jobs.length > 0
                ? activeFilter === 'today' ? 'No jobs scheduled for today'
                  : activeFilter === 'inspection' ? 'No jobs needing inspection'
                  : activeFilter === 'archived' ? 'No archived jobs'
                  : `No ${(statusLabels[activeFilter as JobStatus] || activeFilter).toLowerCase()} jobs`
                : "No jobs yet"
          }
          description={
            searchTerm 
              ? "Try adjusting your search terms"
              : activeFilter !== 'all' && jobs.length > 0
                ? "Want to create a new job?"
                : "Create your first job to start tracking work and generating invoices."
          }
          action={
            canCreateJobs && (
              <Button 
                onClick={onCreateJob}
                style={{ borderRadius: '12px' }}
                className="text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                {activeFilter !== 'all' && jobs.length > 0 ? "Create a Job" : "Create Your First Job"}
              </Button>
            )
          }
          tip={activeFilter === 'all' && jobs.length === 0 ? "Jobs flow: Pending → Scheduled → In Progress → Done → Invoiced" : undefined}
          encouragement={activeFilter === 'all' && jobs.length === 0 ? "Track jobs from start to payment" : undefined}
        />
      ) : viewMode === "table" ? (
        <DataTable
          data={filteredJobs}
          columns={tableColumns}
          onRowClick={(row) => onViewJob?.(row.id)}
          isLoading={isLoading}
          pageSize={15}
          showViewToggle={false}
          getRowId={(row) => row.id}
        />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" data-testid="jobs-list-cards">
          {filteredJobs.map((job: Job) => (
            <JobCardItem key={job.id} job={job} />
          ))}
        </div>
      )}
      </>
      )}

      <PasteJobModal
        open={pasteJobOpen}
        onOpenChange={setPasteJobOpen}
        onCreateJob={async (data) => {
          try {
            const response = await fetch('/api/jobs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                title: data.title,
                description: data.description,
                address: data.address,
                status: 'pending',
              }),
            });
            if (response.ok) {
              const job = await response.json();
              await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
              setPasteJobOpen(false);
              onViewJob?.(job.id);
              toast({
                title: "Job Created",
                description: `${data.title} created successfully`,
              });
            }
          } catch (error) {
            toast({
              title: "Error",
              description: "Failed to create job",
              variant: "destructive",
            });
          }
        }}
      />

      <ConfirmationDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        title={`${pendingStatus === 'in_progress' ? 'Start' : pendingStatus === 'done' ? 'Complete' : 'Update'} Job?`}
        description={`${selectedJob?.title || 'This job'} will be marked as ${statusLabels[pendingStatus || 'pending']}.`}
        confirmLabel={pendingStatus === 'in_progress' ? 'Start Job' : pendingStatus === 'done' ? 'Mark Complete' : 'Update'}
        onConfirm={handleConfirmStatusChange}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Job"
        description={`Are you sure you want to delete ${selectedJob?.title || 'this job'}? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={handleConfirmDeleteJob}
        isPending={deleteJobMutation.isPending}
      />

      <ConfirmationDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title="Archive this job?"
        description={`${selectedJob?.title || 'This job'} will be moved to the archive. Archived jobs can be restored later from the archive tab.`}
        confirmLabel="Archive"
        onConfirm={handleConfirmArchiveJob}
        isPending={archiveJobMutation.isPending}
      />

      <ConfirmationDialog
        open={declineDialogOpen}
        onOpenChange={setDeclineDialogOpen}
        title="Decline this request?"
        description={`Are you sure you want to decline "${declineTarget?.title || 'this request'}"? The client will be notified.`}
        confirmLabel="Decline"
        confirmVariant="destructive"
        onConfirm={handleConfirmDecline}
        isPending={updateRequestMutation.isPending}
      />
    </PageShell>
  );
}
