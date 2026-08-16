import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Briefcase, User, Clock, MapPin, MoreVertical, Edit, FileText, CheckCircle, AlertCircle, LayoutGrid, List, ChevronRight, Play, ArrowRight, Clipboard, Lightbulb, Columns3, Calendar, Receipt, Timer, AlertTriangle, Bot, Globe, Phone, Archive } from "lucide-react";
import { getJobUrgency } from "@/lib/jobUrgency";
import PasteJobModal from "./PasteJobModal";
import XeroRibbon from "./XeroRibbon";
import ProjectHealthRow from "./ProjectHealthRow";
import { PageShell, PageHeader, SectionTitle } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/compact-card";
import { FilterChips, SearchBar } from "@/components/ui/filter-chips";
import { DataTable, ColumnDef, StatusBadge } from "@/components/ui/data-table";
import { useJobs, useUpdateJob, useRecentJobs, useJobNextActions, usePrefetchJob, seedJobCacheFromList, useArchiveJob, useUnarchiveJob, type NextAction } from "@/hooks/use-jobs";
import { useGenerateQuoteFromJob } from "@/hooks/use-quotes";
import { useToast } from "@/hooks/use-toast";
import { useUndoableMutation } from "@/hooks/use-undoable-mutation";
import { useAppMode } from "@/hooks/use-app-mode";
import { formatHistoryDate } from "@shared/dateUtils";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useFeatureAccess } from "@/hooks/use-subscription";
import { ConfirmationDialog } from "./ConfirmationDialog";

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

interface JobsListProps {
  onCreateJob?: () => void;
  onViewJob?: (id: string) => void;
  onStatusChange?: (id: string, newStatus: JobStatus) => void;
  onGenerateQuote?: (id: string) => void;
  onShowQuoteModal?: (quoteId: string) => void;
}

export default function JobsList({
  onCreateJob,
  onViewJob,
  onStatusChange,
  onGenerateQuote,
  onShowQuoteModal
}: JobsListProps) {
  const searchParams = useSearch();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showOlderJobs, setShowOlderJobs] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table" | "kanban">("cards");
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [pendingStatus, setPendingStatus] = useState<JobStatus | null>(null);
  const { canUseAIFeatures } = useFeatureAccess();
  const [pasteJobOpen, setPasteJobOpen] = useState(false);
  const { data: jobs = [] } = useJobs() as { data: any[] };
  const { data: nextActions = {}, isLoading: nextActionsLoading } = useJobNextActions();
  const { onHover: prefetchOnHover, onLeave: prefetchOnLeave } = usePrefetchJob();
  
  useEffect(() => {
    if (jobs.length > 0) {
      seedJobCacheFromList(jobs);
    }
  }, [jobs]);
  
  // Get role-based permissions
  const { actionPermissions, shouldFilterToAssignedJobs } = useAppMode();
  const canCreateJobs = actionPermissions.canCreateJobs;

  const tableColumns: ColumnDef<any>[] = [
    {
      id: "title",
      header: "Job",
      accessorKey: "title",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.title || "Untitled Job"}</span>
          {row.isXeroImport && (
            <Badge 
              variant="secondary" 
              className="text-[10px] px-1.5 py-0 bg-[#13B5EA]/10 text-[#13B5EA] border-[#13B5EA]/20"
            >
              XERO
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "client",
      header: "Client",
      accessorKey: "clientName",
      sortable: true,
      cell: (row) => row.clientName || "—",
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
      cell: (row) =>
        row.scheduledAt
          ? new Date(row.scheduledAt).toLocaleDateString("en-AU")
          : "—",
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
      id: "nextAction",
      header: "Next Action",
      hideOnMobile: true,
      cell: (row) => {
        if (nextActionsLoading) {
          return <div className="h-5 w-20 bg-muted animate-pulse rounded" />;
        }
        const action = nextActions[row.id];
        if (!action) {
          return <span className="text-muted-foreground text-xs italic">No guidance</span>;
        }
        return (
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded text-xs w-fit",
            action.priority === 'high' 
              ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
              : action.priority === 'medium'
              ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
              : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
          )}>
            <Lightbulb className="h-3 w-3 flex-shrink-0" />
            <span className="truncate max-w-[120px]">{action.action}</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      className: "w-10",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => e.stopPropagation()}
              data-testid={`button-job-table-actions-${row.id}`}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuItem onClick={() => onViewJob?.(row.id)}>
              <Edit className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            {row.status === "pending" && (
              <DropdownMenuItem
                onClick={() => handleStatusChange(row.id, "scheduled")}
              >
                <Clock className="h-4 w-4 mr-2" />
                Schedule Job
              </DropdownMenuItem>
            )}
            {row.status === "scheduled" && (
              <DropdownMenuItem
                onClick={() => handleStatusChange(row.id, "in_progress")}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Job
              </DropdownMenuItem>
            )}
            {row.status === "in_progress" && (
              <DropdownMenuItem
                onClick={() => handleStatusChange(row.id, "done")}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Job
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => handleGenerateQuote(row.id)}>
              <FileText className="h-4 w-4 mr-2" />
              Generate Quote
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleArchiveJob(row.id)}
              data-testid={`menu-archive-job-${row.id}`}
            >
              <Archive className="h-4 w-4 mr-2" />
              Archive Job
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const filterParam = params.get('filter');
    if (filterParam && ['all', 'projects', 'pending', 'scheduled', 'in_progress', 'done', 'invoiced'].includes(filterParam)) {
      setStatusFilter(filterParam);
    }
  }, [searchParams]);
  const { recent: recentJobs, older: olderJobs, isLoading: jobsLoading } = useRecentJobs();
  const { toast } = useToast();
  const updateJobMutation = useUpdateJob();
  const generateQuoteMutation = useGenerateQuoteFromJob();
  const archiveJobMutation = useArchiveJob();
  const unarchiveJobMutation = useUnarchiveJob();

  // Eager undoable archive: archive fires immediately, Undo unarchives.
  const undoableArchiveJob = useUndoableMutation<{ id: string; title: string }>({
    mode: "eager",
    forward: ({ id }) => archiveJobMutation.mutateAsync(id),
    inverse: ({ id }) => unarchiveJobMutation.mutateAsync(id),
    successTitle: ({ title }) => "Job archived",
    successDescription: ({ title }) => title,
    undoTitle: ({ title }) => `${title} restored`,
    errorTitle: () => "Failed to archive job",
    invalidateKeys: [["/api/jobs"], ["/api/jobs", { archived: true }]],
  });

  const handleArchiveJob = (id: string) => {
    const job = jobs.find((j: any) => j.id === id);
    undoableArchiveJob.trigger({ id, title: job?.title || "Job" });
  };

  // Status display labels for toast messages
  const statusLabels: Record<JobStatus, string> = {
    pending: 'Pending',
    scheduled: 'Scheduled',
    in_progress: 'In Progress',
    done: 'Completed',
    invoiced: 'Invoiced',
  };

  // Open confirmation dialog for status change
  const handleStatusChange = (id: string, newStatus: JobStatus) => {
    const job = jobs.find((j: any) => j.id === id);
    if (job) {
      setSelectedJob(job);
      setPendingStatus(newStatus);
      setStatusDialogOpen(true);
    }
  };

  // Called when user confirms status change
  const handleConfirmStatusChange = async () => {
    if (!selectedJob || !pendingStatus) return;
    
    try {
      await updateJobMutation.mutateAsync({ id: selectedJob.id, data: { status: pendingStatus } });
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      const jobTitle = selectedJob.title || 'Job';
      const clientName = selectedJob.clientName || '';
      toast({
        title: `Job ${statusLabels[pendingStatus]}`,
        description: `${jobTitle}${clientName ? ` for ${clientName}` : ''} → ${statusLabels[pendingStatus]}`,
      });
      if (onStatusChange) onStatusChange(selectedJob.id, pendingStatus);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update job status",
        variant: "destructive",
      });
    }
  };

  const handleGenerateQuote = async (jobId: string) => {
    try {
      const quote = await generateQuoteMutation.mutateAsync(jobId);
      toast({
        title: "Quote generated",
        description: `Quote ${quote.number} has been created successfully`,
      });
      
      if (onShowQuoteModal && quote.id) {
        onShowQuoteModal(quote.id);
      }
      
      if (onGenerateQuote) onGenerateQuote(jobId);
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to generate quote from job",
        variant: "destructive",
      });
    }
  };

  const statusCounts = {
    all: jobs.length,
    projects: jobs.filter(j => j.jobType === 'project').length,
    pending: jobs.filter(j => j.status === 'pending').length,
    scheduled: jobs.filter(j => j.status === 'scheduled').length,
    in_progress: jobs.filter(j => j.status === 'in_progress').length,
    done: jobs.filter(j => j.status === 'done').length,
    invoiced: jobs.filter(j => j.status === 'invoiced').length
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = (job.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (job.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (job.address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (job.jobNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all"
      ? true
      : statusFilter === "projects"
      ? job.jobType === 'project'
      : job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    if (status === 'done') {
      return <Badge className="bg-status-completed/10 text-status-completed border-status-completed/20 text-[11px] font-medium px-2 py-0.5 rounded-full">Completed</Badge>;
    }
    if (status === 'invoiced') {
      return <Badge className="bg-status-invoiced/10 text-status-invoiced border-status-invoiced/20 text-[11px] font-medium px-2 py-0.5 rounded-full">Invoiced</Badge>;
    }
    if (status === 'in_progress') {
      return (
        <Badge className="bg-status-in-progress/10 text-status-in-progress border-status-in-progress/20 text-[11px] font-medium px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-status-in-progress mr-1.5 animate-pulse" />
          In Progress
        </Badge>
      );
    }
    if (status === 'scheduled') {
      return <Badge className="bg-status-scheduled/10 text-status-scheduled border-status-scheduled/20 text-[11px] font-medium px-2 py-0.5 rounded-full">Scheduled</Badge>;
    }
    return <Badge className="bg-status-pending/10 text-status-pending border-status-pending/20 text-[11px] font-medium px-2 py-0.5 rounded-full">New</Badge>;
  };

  const getLeadSourceBadge = (source: string | null | undefined) => {
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
      <Badge className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full gap-1", c.className)}>
        <Icon className="h-3 w-3" />
        {c.label}
      </Badge>
    );
  };

  const filterChips = [
    { id: "all", label: "All", count: statusCounts.all },
    { id: "projects", label: "Projects", count: statusCounts.projects },
    { id: "pending", label: "New", count: statusCounts.pending },
    { id: "scheduled", label: "Scheduled", count: statusCounts.scheduled },
    { id: "in_progress", label: "In Progress", count: statusCounts.in_progress },
    { id: "done", label: "Completed", count: statusCounts.done },
    { id: "invoiced", label: "Invoiced", count: statusCounts.invoiced }
  ];

  return (
    <PageShell data-testid="jobs-list">
      <PageHeader
        title="Jobs"
        subtitle={`${jobs.length} total`}
        action={
          <div className="flex items-center gap-2">
            <div className="hidden md:inline-flex rounded-xl border bg-muted p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("cards")}
                className={cn(
                  "h-8 px-3 rounded-lg press-scale",
                  viewMode === "cards" && "bg-background shadow-sm"
                )}
                data-testid="button-view-cards"
                title="Card View"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("table")}
                className={cn(
                  "h-8 px-3 rounded-lg press-scale",
                  viewMode === "table" && "bg-background shadow-sm"
                )}
                data-testid="button-view-table"
                title="Table View"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("kanban")}
                className={cn(
                  "h-8 px-3 rounded-lg press-scale",
                  viewMode === "kanban" && "bg-background shadow-sm"
                )}
                data-testid="button-view-kanban"
                title="Kanban Board"
              >
                <Columns3 className="h-4 w-4" />
              </Button>
            </div>
            {onCreateJob && canCreateJobs && (
              <>
                {canUseAIFeatures && (
                <Button 
                  variant="outline"
                  onClick={() => setPasteJobOpen(true)}
                  data-testid="button-paste-job"
                  className="font-medium rounded-xl h-10 px-3 press-scale border-primary/30 text-primary hover:bg-primary/5"
                  title="Create job from pasted text"
                >
                  <Clipboard className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Paste</span>
                </Button>
                )}
                <Button 
                  onClick={onCreateJob} 
                  data-testid="button-create-job"
                  className="text-white font-medium rounded-xl h-10 px-4 press-scale"
                  style={{ backgroundColor: 'hsl(var(--trade))' }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Job
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Search and Filter Chips */}
      <div className="space-y-3">
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search jobs, clients, addresses..."
        />
        <FilterChips
          chips={filterChips}
          activeId={statusFilter}
          onSelect={setStatusFilter}
        />
      </div>

      {/* KPI Stats - Native Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {jobsLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="feed-card card-padding">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 w-16 bg-muted rounded" />
                  <div className="h-8 w-12 bg-muted rounded" />
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            {[
              { title: "Total Jobs", value: statusCounts.all, filter: 'all', icon: Briefcase, color: 'hsl(var(--trade))' },
              { title: "Scheduled", value: statusCounts.scheduled, filter: 'scheduled', icon: Clock, color: 'hsl(var(--status-scheduled))' },
              { title: "In Progress", value: statusCounts.in_progress, filter: 'in_progress', icon: Play, color: 'hsl(var(--status-in-progress))' },
              { title: "Completed", value: statusCounts.done, filter: 'done', icon: CheckCircle, color: 'hsl(var(--status-completed))' },
            ].map((kpi) => (
              <div
                key={kpi.filter}
                className="feed-card card-press cursor-pointer"
                onClick={() => setStatusFilter(kpi.filter)}
              >
                <div className="card-padding">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${kpi.color}15` }}
                    >
                      <kpi.icon className="h-5 w-5" style={{ color: kpi.color }} />
                    </div>
                    <div>
                      <p className="text-xl font-bold">{kpi.value}</p>
                      <p className="ios-caption">{kpi.title}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Recent Activity - Native Feed */}
      <section>
        <SectionTitle icon={<Clock className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />}>
          Recent Activity
        </SectionTitle>
        <div className="mt-3 feed-card">
          <div className="card-padding">
            {jobsLoading ? (
              <div className="text-center py-4">
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mx-auto"
                     style={{ borderColor: 'hsl(var(--trade))', borderTopColor: 'transparent' }} />
              </div>
            ) : (recentJobs && recentJobs.length > 0) || (olderJobs && olderJobs.length > 0) ? (
              <div className="max-h-[220px] overflow-y-auto">
                <div className="space-y-1">
                  {recentJobs && recentJobs.length > 0 && (
                    <>
                      <p className="ios-label px-1 mb-2">This Week</p>
                      {recentJobs.slice(0, 4).map((job: any, index: number) => (
                        <div 
                          key={job.id}
                          className="flex items-center gap-3 p-2.5 rounded-xl hover-elevate cursor-pointer"
                          onClick={() => onViewJob?.(job.id)}
                          onMouseEnter={() => prefetchOnHover(job.id)}
                          onMouseLeave={prefetchOnLeave}
                        >
                          <div 
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: 'hsl(var(--trade))' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="ios-body font-medium truncate">{job.title || 'Untitled Job'}</p>
                            <p className="ios-caption truncate">
                              {job.clientName} · {formatHistoryDate(job.createdAt)}
                            </p>
                          </div>
                          {getStatusBadge(job.status)}
                        </div>
                      ))}
                    </>
                  )}

                  {olderJobs && olderJobs.length > 0 && (
                    <div className="pt-3 border-t mt-3">
                      <p className="ios-label px-1 mb-2">Earlier</p>
                      {olderJobs.slice(0, showOlderJobs ? undefined : 3).map((job: any, index: number) => (
                        <div 
                          key={job.id}
                          className="flex items-center gap-3 p-2.5 rounded-xl hover-elevate cursor-pointer"
                          onClick={() => onViewJob?.(job.id)}
                          onMouseEnter={() => prefetchOnHover(job.id)}
                          onMouseLeave={prefetchOnLeave}
                        >
                          <div 
                            className="w-2 h-2 rounded-full flex-shrink-0 opacity-50"
                            style={{ backgroundColor: 'hsl(var(--trade))' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="ios-body font-medium truncate">{job.title || 'Untitled Job'}</p>
                            <p className="ios-caption truncate">
                              {job.clientName} · {formatHistoryDate(job.createdAt)}
                            </p>
                          </div>
                          {getStatusBadge(job.status)}
                        </div>
                      ))}
                      
                      {olderJobs.length > 3 && !showOlderJobs && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-9 text-xs mt-2 rounded-xl press-scale"
                          onClick={() => setShowOlderJobs(true)}
                        >
                          View {olderJobs.length - 3} more...
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}
                >
                  <Briefcase className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="ios-caption">No recent jobs</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Jobs List - Table or Card View */}
      <section>
        <SectionTitle icon={<Briefcase className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />}>
          All Jobs
        </SectionTitle>
        <div className="mt-3">
          {jobsLoading ? (
            <div className="feed-gap" data-testid="jobs-loading">
              {[1, 2, 3].map((i) => (
                <div key={i} className="feed-card card-padding animate-pulse">
                  <div className="space-y-3">
                    <div className="h-5 w-48 bg-muted rounded" />
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="flex gap-4">
                      <div className="h-3 w-24 bg-muted rounded" />
                      <div className="h-3 w-24 bg-muted rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No jobs found"
              description={
                searchTerm || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Jobs help you track work from start to finish and convert to invoices in one tap."
              }
              action={
                (!searchTerm && statusFilter === "all" && onCreateJob && canCreateJobs) && (
                  <Button 
                    onClick={onCreateJob} 
                    className="rounded-xl h-11 px-5 press-scale"
                    style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Job
                  </Button>
                )
              }
              tip={(!searchTerm && statusFilter === "all") ? "Add photos and notes to jobs for easy reference later" : undefined}
              encouragement={(!searchTerm && statusFilter === "all") ? "Most tradies add their first job in under 2 minutes" : undefined}
            />
          ) : viewMode === "kanban" ? (
            <div className="overflow-x-auto pb-4" data-testid="jobs-kanban-board">
              <div className="flex gap-4 min-w-max">
                {['pending', 'scheduled', 'in_progress', 'done', 'invoiced'].map((status) => {
                  const statusJobs = filteredJobs.filter((j: any) => j.status === status);
                  const columnConfig = {
                    pending: { label: 'New', icon: Briefcase, color: 'hsl(var(--status-pending))' },
                    scheduled: { label: 'Scheduled', icon: Calendar, color: 'hsl(var(--status-scheduled))' },
                    in_progress: { label: 'In Progress', icon: Play, color: 'hsl(var(--status-in-progress))' },
                    done: { label: 'Done', icon: CheckCircle, color: 'hsl(var(--status-completed))' },
                    invoiced: { label: 'Invoiced', icon: Receipt, color: 'hsl(var(--status-invoiced))' },
                  }[status]!;
                  const ColumnIcon = columnConfig.icon;
                  
                  return (
                    <div 
                      key={status} 
                      className="flex-shrink-0 w-72 bg-muted/30 rounded-xl p-3"
                      data-testid={`kanban-column-${status}`}
                    >
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${columnConfig.color}15` }}
                        >
                          <ColumnIcon className="h-4 w-4" style={{ color: columnConfig.color }} />
                        </div>
                        <span className="font-medium text-sm">{columnConfig.label}</span>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {statusJobs.length}
                        </Badge>
                      </div>
                      <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
                        {statusJobs.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground text-sm">
                            No jobs
                          </div>
                        ) : (
                          statusJobs.map((job: any) => (
                            <div
                              key={job.id}
                              className="bg-background rounded-lg p-3 border hover-elevate cursor-pointer relative overflow-hidden"
                              onClick={() => onViewJob?.(job.id)}
                              onMouseEnter={() => prefetchOnHover(job.id)}
                              onMouseLeave={prefetchOnLeave}
                              data-testid={`kanban-job-${job.id}`}
                            >
                              {job.isXeroImport && <XeroRibbon size="sm" />}
                              <p className="font-medium text-sm truncate mb-1">
                                {job.title || 'Untitled Job'}
                              </p>
                              {job.clientName && (
                                <p className="text-xs text-muted-foreground truncate mb-2">
                                  {job.clientName}
                                </p>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                {(() => {
                                  const urgency = getJobUrgency(job.scheduledAt, job.status);
                                  if (urgency) {
                                    return (
                                      <Badge 
                                        variant="outline" 
                                        className={cn(
                                          "text-[10px] px-1.5 py-0",
                                          urgency.color,
                                          urgency.animate && "animate-pulse"
                                        )}
                                      >
                                        {urgency.level === 'overdue' && <AlertTriangle className="h-2.5 w-2.5 mr-1" />}
                                        {urgency.level === 'starting_soon' && <Timer className="h-2.5 w-2.5 mr-1" />}
                                        {urgency.level === 'today' && <Clock className="h-2.5 w-2.5 mr-1" />}
                                        {urgency.shortLabel}
                                      </Badge>
                                    );
                                  }
                                  if (job.scheduledAt) {
                                    return (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        <span>{new Date(job.scheduledAt).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}</span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                                {nextActions[job.id] && (
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-[10px] px-1.5 py-0",
                                      nextActions[job.id].priority === 'high' 
                                        ? "border-orange-300 text-orange-600 dark:text-orange-400"
                                        : nextActions[job.id].priority === 'medium'
                                        ? "border-yellow-300 text-yellow-600 dark:text-yellow-400"
                                        : "border-blue-300 text-blue-600 dark:text-blue-400"
                                    )}
                                  >
                                    <Lightbulb className="h-2.5 w-2.5 mr-1" />
                                    Action needed
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : viewMode === "table" ? (
            <DataTable
              data={filteredJobs}
              columns={tableColumns}
              onRowClick={(row) => onViewJob?.(row.id)}
              isLoading={jobsLoading}
              pageSize={15}
              showViewToggle={false}
              getRowId={(row) => row.id}
            />
          ) : (
            <div className="feed-gap" data-testid="jobs-list-card">
              {filteredJobs.map((job: any, index: number) => (
                <div 
                  key={job.id} 
                  className="feed-card card-press cursor-pointer relative overflow-hidden"
                  onClick={() => onViewJob?.(job.id)}
                  onMouseEnter={() => prefetchOnHover(job.id)}
                  onMouseLeave={prefetchOnLeave}
                  data-testid={`job-item-${job.id}`}
                >
                  {job.isXeroImport && <XeroRibbon size="sm" />}
                  <div className="card-padding">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {(job.jobNumber || job.jobType === 'project') && (
                          <div className="flex items-center gap-1.5 mb-1">
                            {job.jobNumber && (
                              <span className="text-xs font-mono font-semibold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{job.jobNumber}</span>
                            )}
                            {job.jobType === 'project' && (
                              <span className="text-xs font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Project</span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="ios-card-title truncate">{job.title || 'Untitled Job'}</h3>
                          {getStatusBadge(job.status)}
                          {getLeadSourceBadge(job.leadSource)}
                        </div>
                        {job.clientName && (
                          <div className="flex items-center gap-2 ios-body mb-2">
                            <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{job.clientName}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 flex-wrap">
                          {(() => {
                            const urgency = getJobUrgency(job.scheduledAt, job.status);
                            if (urgency) {
                              return (
                                <div className={cn(
                                  "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium",
                                  urgency.bgColor,
                                  urgency.color,
                                  urgency.animate && "animate-pulse"
                                )}>
                                  {urgency.level === 'overdue' && <AlertTriangle className="h-3 w-3" />}
                                  {urgency.level === 'starting_soon' && <Timer className="h-3 w-3" />}
                                  {(urgency.level === 'today' || urgency.level === 'tomorrow') && <Clock className="h-3 w-3" />}
                                  <span>{urgency.label}</span>
                                </div>
                              );
                            }
                            if (job.scheduledAt) {
                              return (
                                <div className="flex items-center gap-1.5 ios-caption">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>{new Date(job.scheduledAt).toLocaleDateString('en-AU')}</span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          {job.address && (
                            <div className="flex items-center gap-1.5 ios-caption">
                              <MapPin className="h-3.5 w-3.5" />
                              <span className="truncate max-w-[180px]">{job.address}</span>
                            </div>
                          )}
                        </div>
                        {/* Project Health Indicators */}
                        {job.jobType === 'project' && (
                          <ProjectHealthRow jobId={job.id} />
                        )}
                        {/* Next Action Indicator */}
                        {nextActionsLoading ? (
                          <div className="mt-2 h-6 w-32 bg-muted animate-pulse rounded-lg" />
                        ) : nextActions[job.id] ? (
                          <div className={cn(
                            "flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg text-xs",
                            nextActions[job.id].priority === 'high' 
                              ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                              : nextActions[job.id].priority === 'medium'
                              ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                              : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          )}>
                            <Lightbulb className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{nextActions[job.id].action}</span>
                          </div>
                        ) : job.status !== 'invoiced' ? (
                          <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg text-xs bg-muted text-muted-foreground">
                            <Lightbulb className="h-3 w-3 flex-shrink-0" />
                            <span className="italic">No guidance</span>
                          </div>
                        ) : null}
                      </div>
                      
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 rounded-xl"
                              data-testid={`button-job-actions-${job.id}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem onClick={() => onViewJob?.(job.id)}>
                              <Edit className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {job.status !== 'pending' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'pending')}>
                                <Clock className="h-4 w-4 mr-2" />
                                Mark as Pending
                              </DropdownMenuItem>
                            )}
                            {job.status !== 'in_progress' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'in_progress')}>
                                <Play className="h-4 w-4 mr-2" />
                                Mark as In Progress
                              </DropdownMenuItem>
                            )}
                            {job.status !== 'done' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(job.id, 'done')}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark as Done
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleGenerateQuote(job.id)}>
                              <FileText className="h-4 w-4 mr-2" />
                              Generate Quote
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleArchiveJob(job.id)}
                              data-testid={`menu-archive-job-card-${job.id}`}
                            >
                              <Archive className="h-4 w-4 mr-2" />
                              Archive Job
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Job Status Change Confirmation Dialog */}
      {selectedJob && pendingStatus && (
        <ConfirmationDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          title="Change Job Status"
          description={`Update status for this job?`}
          details={[
            { label: "Job", value: selectedJob.title || 'Untitled Job' },
            { label: "Client", value: selectedJob.clientName || 'Unknown' },
            { label: "Current Status", value: statusLabels[selectedJob.status as JobStatus] || 'Unknown' },
            { label: "New Status", value: statusLabels[pendingStatus] },
          ]}
          confirmLabel={`Mark as ${statusLabels[pendingStatus]}`}
          onConfirm={handleConfirmStatusChange}
          isPending={updateJobMutation.isPending}
        />
      )}

      {/* Paste Job Modal - Instant job from text */}
      <PasteJobModal
        open={pasteJobOpen}
        onOpenChange={setPasteJobOpen}
        onCreateJob={(data) => {
          // Navigate to job creation with pre-filled data
          // Use scoped session key with expiry to prevent cross-tab access
          const draftData = {
            ...data,
            _createdAt: Date.now(),
            _expiresAt: Date.now() + 5 * 60 * 1000, // 5 minute expiry
          };
          sessionStorage.setItem('jobrunner_draft_job', JSON.stringify(draftData));
          toast({
            title: "Job details extracted",
            description: "Opening job form with extracted details...",
          });
          onCreateJob?.();
        }}
      />
    </PageShell>
  );
}
