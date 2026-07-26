import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSessionToken } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Briefcase, 
  User, 
  Clock, 
  Camera, 
  ChevronRight,
  CheckCircle,
  FileText,
  AlertCircle,
  Copy,
  Search,
  X
} from "lucide-react";
import { format } from "date-fns";

interface LinkedDocument {
  id: string;
  quoteNumber?: string;
  invoiceNumber?: string;
  title: string;
  description?: string;
  lineItems: any[];
  subtotal: number;
  gstAmount: number;
  total: number;
  status: string;
  notes?: string;
  terms?: string;
  depositPercent?: number;
  dueDate?: string;
}

interface EnrichedJob {
  id: string;
  title: string;
  description?: string;
  status: string;
  address?: string;
  scheduledAt?: string;
  createdAt?: string;
  updatedAt?: string;
  client: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  } | null;
  timeTracking: {
    totalMinutes: number;
    totalHours: number;
    entriesCount: number;
  };
  photos: Array<{
    id: string;
    fileName: string;
    category?: string;
    caption?: string;
  }>;
  hasQuote: boolean;
  hasInvoice: boolean;
  linkedQuote?: LinkedDocument | null;
  linkedInvoice?: LinkedDocument | null;
}

type StatusFilter = 'all' | 'done' | 'in_progress' | 'scheduled';

interface RecentJobPickerProps {
  type: 'quote' | 'invoice';
  onSelectJob: (job: EnrichedJob, linkedDocument?: LinkedDocument | null) => void;
  selectedJobId?: string;
}

export default function RecentJobPicker({ type, onSelectJob, selectedJobId }: RecentJobPickerProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: allJobs = [], isLoading } = useQuery<EnrichedJob[]>({
    queryKey: ["/api/jobs/contextual"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/jobs/contextual`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    },
    staleTime: 30000,
  });

  // Guard: cache can return non-array on odd fallbacks
  const jobs = Array.isArray(allJobs) ? allJobs : [];

  // Filter jobs by status and search term
  const filteredJobs = jobs.filter(job => {
    // Status filter
    let matchesStatus = true;
    if (statusFilter === 'done') matchesStatus = job.status === 'done' || job.status === 'completed' || job.status === 'invoiced';
    else if (statusFilter === 'in_progress') matchesStatus = job.status === 'in_progress';
    else if (statusFilter === 'scheduled') matchesStatus = job.status === 'scheduled' || job.status === 'pending';
    
    if (!matchesStatus) return false;
    
    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      const matchesTitle = job.title.toLowerCase().includes(search);
      const matchesClient = job.client?.name.toLowerCase().includes(search);
      const matchesAddress = job.address?.toLowerCase().includes(search);
      const matchesStatus = job.status.toLowerCase().includes(search);
      return matchesTitle || matchesClient || matchesAddress || matchesStatus;
    }
    
    return true;
  });

  // Count jobs by status for tab badges
  const statusCounts = {
    all: jobs.length,
    done: jobs.filter(j => j.status === 'done' || j.status === 'completed' || j.status === 'invoiced').length,
    in_progress: jobs.filter(j => j.status === 'in_progress').length,
    scheduled: jobs.filter(j => j.status === 'scheduled' || j.status === 'pending').length,
  };

  const handleSelectJob = (job: EnrichedJob) => {
    // If job has linked document matching type, pass it along for auto-fill
    const linkedDoc = type === 'quote' ? job.linkedQuote : job.linkedInvoice;
    onSelectJob(job, linkedDoc);
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-sm">Loading jobs...</span>
        </div>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground text-sm">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No jobs found.</p>
          <p className="text-xs mt-1">Create a job first to link it to a {type}.</p>
        </div>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      case 'scheduled': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'in_progress': return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
      case 'done': 
      case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'invoiced': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'pending': return 'New';
      case 'scheduled': return 'Scheduled';
      case 'in_progress': return 'In Progress';
      case 'done': 
      case 'completed': return 'Completed';
      case 'invoiced': return 'Invoiced';
      default: return status;
    }
  };

  const hasLinkedDocument = (job: EnrichedJob) => {
    return type === 'quote' ? job.hasQuote : job.hasInvoice;
  };

  return (
    <Card className="overflow-hidden" data-testid="recent-jobs-picker">
      <div className="p-3 border-b bg-muted/30">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          Create {type === 'quote' ? 'Quote' : 'Invoice'} from Job
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select a job to auto-fill details
        </p>
      </div>
      
      {/* Search Input */}
      <div className="px-3 py-2 border-b bg-muted/10">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search jobs by title, client, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-8 h-9 text-sm"
            data-testid="input-job-search"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              data-testid="button-clear-job-search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Status Filter Tabs */}
      <div className="px-2 pt-2 pb-1 border-b bg-muted/10">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList className="w-full h-9 grid grid-cols-4 bg-muted/50">
            <TabsTrigger 
              value="all" 
              className="text-xs px-1 data-[state=active]:bg-background"
              data-testid="tab-all-jobs"
            >
              All ({statusCounts.all})
            </TabsTrigger>
            <TabsTrigger 
              value="done" 
              className="text-xs px-1 data-[state=active]:bg-background"
              data-testid="tab-completed-jobs"
            >
              Done ({statusCounts.done})
            </TabsTrigger>
            <TabsTrigger 
              value="in_progress" 
              className="text-xs px-1 data-[state=active]:bg-background"
              data-testid="tab-inprogress-jobs"
            >
              Active ({statusCounts.in_progress})
            </TabsTrigger>
            <TabsTrigger 
              value="scheduled" 
              className="text-xs px-1 data-[state=active]:bg-background"
              data-testid="tab-scheduled-jobs"
            >
              Upcoming ({statusCounts.scheduled})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      <ScrollArea className="h-64">
        <div className="p-2 space-y-2">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
              {searchTerm ? (
                <p>No jobs matching "{searchTerm}"</p>
              ) : (
                <p>No {statusFilter === 'all' ? '' : statusFilter.replace('_', ' ')} jobs found</p>
              )}
            </div>
          ) : (
            filteredJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => handleSelectJob(job)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedJobId === job.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-primary/50 hover:bg-accent/50'
                }`}
                data-testid={`job-picker-item-${job.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-sm truncate max-w-[180px]">{job.title}</span>
                      <Badge variant="secondary" className={`text-xs px-1.5 py-0 shrink-0 ${getStatusColor(job.status)}`}>
                        {formatStatus(job.status)}
                      </Badge>
                      {hasLinkedDocument(job) && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 shrink-0 border-primary/50 text-primary">
                          <Copy className="h-2.5 w-2.5 mr-1" />
                          Has {type}
                        </Badge>
                      )}
                    </div>
                    
                    {job.client && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">{job.client.name}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      {job.timeTracking.totalHours > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {job.timeTracking.totalHours}h
                        </span>
                      )}
                      {job.photos.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          {job.photos.length}
                        </span>
                      )}
                      {job.scheduledAt && (
                        <span className="text-xs">
                          {format(new Date(job.scheduledAt), 'MMM d')}
                        </span>
                      )}
                    </div>

                    {/* Show hint when job has linked document */}
                    {hasLinkedDocument(job) && (
                      <p className="text-xs text-primary/80 mt-1.5 italic">
                        Will copy from existing {type}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex-shrink-0">
                    {selectedJobId === job.id ? (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
