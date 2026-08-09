import { useState } from "react";
import { getAuthHeaders } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Briefcase, 
  User, 
  ChevronRight,
  CheckCircle,
  Calendar,
  MapPin,
  FileText,
  Receipt,
  Search,
  X,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

interface CompletedJob {
  id: string;
  title: string;
  description?: string;
  status: string;
  address?: string;
  scheduledDate?: string;
  completedAt?: string;
  updatedAt?: string;
  client?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  } | null;
  linkedQuote?: {
    id: string;
    number: string;
    total: string;
    lineItems?: any[];
  } | null;
  linkedInvoice?: {
    id: string;
    number: string;
    total: string;
  } | null;
  hasInvoice?: boolean;
}

interface CompletedJobPickerProps {
  onSelectJob: (job: CompletedJob) => void;
  selectedJobId?: string;
}

export default function CompletedJobPicker({ onSelectJob, selectedJobId }: CompletedJobPickerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: allJobs = [], isLoading } = useQuery<CompletedJob[]>({
    queryKey: ["/api/jobs/contextual", "done"],
    queryFn: async () => {
      const res = await fetch("/api/jobs/contextual?status=done", { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch completed jobs");
      return res.json();
    },
    staleTime: 30000,
  });

  const jobs = allJobs.filter(job => {
    if (!searchTerm.trim()) return true;
    
    const search = searchTerm.toLowerCase();
    const matchesTitle = job.title?.toLowerCase().includes(search);
    const matchesDescription = job.description?.toLowerCase().includes(search);
    const matchesClient = job.client?.name?.toLowerCase().includes(search);
    const matchesAddress = job.address?.toLowerCase().includes(search);
    
    return matchesTitle || matchesDescription || matchesClient || matchesAddress;
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-sm">Loading completed jobs...</span>
        </div>
      </Card>
    );
  }

  if (allJobs.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground text-sm">
          <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No completed jobs found.</p>
          <p className="text-xs mt-1">Complete a job first, then you can create an invoice for it here.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden" data-testid="completed-jobs-picker">
      <div className="p-3 border-b bg-muted/30">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          Create Invoice from Completed Job
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select a completed job to generate an invoice
        </p>
      </div>
      
      <div className="px-3 py-2 border-b bg-muted/10">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by job title, client, or address..."
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
      
      <ScrollArea className="h-64">
        <div className="p-2 space-y-2">
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
              {searchTerm ? (
                <p>No jobs matching "{searchTerm}"</p>
              ) : (
                <p>No completed jobs found</p>
              )}
            </div>
          ) : jobs.map((job) => (
            <button
              key={job.id}
              onClick={() => onSelectJob(job)}
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
                    <span className="font-medium text-sm truncate max-w-[200px]">{job.title}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      <CheckCircle className="h-2.5 w-2.5 mr-1" />
                      Completed
                    </Badge>
                    {job.linkedQuote && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        <FileText className="h-2.5 w-2.5 mr-1" />
                        Has Quote
                      </Badge>
                    )}
                    {(job.hasInvoice || job.linkedInvoice) && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 border-amber-500/50 text-amber-600">
                        <Receipt className="h-2.5 w-2.5 mr-1" />
                        Has Invoice
                      </Badge>
                    )}
                  </div>
                  
                  {job.client && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="h-3 w-3 shrink-0" />
                      <span className="truncate">{job.client.name}</span>
                    </div>
                  )}
                  
                  {job.address && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{job.address}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    {job.completedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Completed {format(new Date(job.completedAt), 'MMM d')}
                      </span>
                    )}
                    {!job.completedAt && job.updatedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Updated {format(new Date(job.updatedAt), 'MMM d')}
                      </span>
                    )}
                  </div>

                  {job.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {job.description}
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
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
