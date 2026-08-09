import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Phone, 
  Mail, 
  MapPin, 
  Briefcase, 
  FileText, 
  DollarSign, 
  Plus,
  User,
  X,
  ChevronRight,
  Calendar
} from "lucide-react";
import StatusBadge from "./StatusBadge";

interface Job {
  id: string;
  title: string;
  status: string;
  clientId?: string;
  address?: string;
  scheduledAt?: string;
  assignedTo?: string;
}

interface ClientInsightsPanelProps {
  clientId: string | null;
  clientPhone: string;
  conversationId: string;
  onClose?: () => void;
  onNavigateToJob?: (jobId: string) => void;
  onNavigateToInvoice?: (invoiceId: string) => void;
  onCreateJob?: () => void;
  onCreateQuote?: () => void;
  // Job context for unified client view
  activeJobContext?: Job | null;
  onJobContextChange?: (job: Job | null) => void;
  relatedJobs?: Job[];
}

interface ClientInsightsData {
  client: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  } | null;
  outstandingInvoices: Array<{
    id: string;
    number: string;
    total: string;
    status: string;
    dueDate?: string;
  }>;
  recentJobs: Array<{
    id: string;
    title: string;
    status: string;
    scheduledAt?: string;
    createdAt: string;
  }>;
}

export default function ClientInsightsPanel({
  clientId,
  clientPhone,
  conversationId,
  onClose,
  onNavigateToJob,
  onNavigateToInvoice,
  onCreateJob,
  onCreateQuote,
  activeJobContext,
  onJobContextChange,
  relatedJobs
}: ClientInsightsPanelProps) {
  const { data: insights, isLoading } = useQuery<ClientInsightsData>({
    queryKey: ['/api/sms/conversations', conversationId, 'client-insights'],
    queryFn: async () => {
      const response = await fetch(`/api/sms/conversations/${conversationId}/client-insights`);
      if (!response.ok) throw new Error('Failed to fetch client insights');
      return response.json();
    },
    enabled: !!conversationId
  });

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(numAmount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const openMaps = (address: string) => {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full" data-testid="client-insights-loading">
        <div className="flex items-center justify-between p-4 border-b">
          <Skeleton className="h-6 w-32" />
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-insights">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const client = insights?.client;
  const displayName = client?.name || 'Unknown Contact';
  const displayPhone = client?.phone || clientPhone;

  return (
    <div className="flex flex-col h-full" data-testid="client-insights-panel">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
          >
            <User className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
          </div>
          <div>
            <h2 className="font-semibold text-base" data-testid="text-client-name">{displayName}</h2>
            <p className="text-sm text-muted-foreground" data-testid="text-client-phone">{displayPhone}</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-insights">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <div className="flex items-center gap-2">
          <a href={`tel:${displayPhone}`} data-testid="link-call-client">
            <Button variant="outline" size="icon">
              <Phone className="h-4 w-4" />
            </Button>
          </a>
          
          {client?.email && (
            <a href={`mailto:${client.email}`} data-testid="link-email-client">
              <Button variant="outline" size="icon">
                <Mail className="h-4 w-4" />
              </Button>
            </a>
          )}
          
          {client?.address && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => openMaps(client.address!)}
              data-testid="button-open-maps"
            >
              <MapPin className="h-4 w-4" />
            </Button>
          )}
        </div>

        {client?.address && (
          <div className="space-y-1">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Address</h3>
            <p className="text-sm" data-testid="text-client-address">{client.address}</p>
          </div>
        )}

        {/* Active Job Context - show related jobs that can be selected */}
        {relatedJobs && relatedJobs.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              Related Jobs
            </h3>
            <div className="space-y-1.5">
              {relatedJobs.map((job) => {
                const isActive = activeJobContext?.id === job.id;
                return (
                  <Card 
                    key={job.id}
                    className={`cursor-pointer transition-all ${isActive ? 'ring-2 ring-primary bg-primary/5' : 'hover-elevate'}`}
                    onClick={() => onJobContextChange?.(isActive ? null : job)}
                    data-testid={`card-related-job-${job.id}`}
                  >
                    <CardContent className="p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{job.title}</span>
                            <StatusBadge status={job.status} />
                          </div>
                          {job.address && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{job.address}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToJob?.(job.id);
                          }}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {!client && (
          <Card className="border-dashed">
            <CardContent className="p-4 text-center">
              <User className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                This phone number is not linked to any client yet.
              </p>
            </CardContent>
          </Card>
        )}

        {insights?.outstandingInvoices && insights.outstandingInvoices.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Outstanding Invoices
            </h3>
            <div className="space-y-2">
              {insights.outstandingInvoices.map((invoice) => (
                <Card 
                  key={invoice.id}
                  className="hover-elevate active-elevate-2 cursor-pointer"
                  onClick={() => onNavigateToInvoice?.(invoice.id)}
                  data-testid={`card-invoice-${invoice.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-sm truncate" data-testid={`text-invoice-number-${invoice.id}`}>
                          {invoice.number}
                        </span>
                        <StatusBadge status={invoice.status} />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span 
                          className="font-semibold text-sm" 
                          style={{ color: 'hsl(var(--trade))' }}
                          data-testid={`text-invoice-amount-${invoice.id}`}
                        >
                          {formatCurrency(invoice.total)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {insights?.recentJobs && insights.recentJobs.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              Recent Jobs
            </h3>
            <div className="space-y-2">
              {insights.recentJobs.slice(0, 5).map((job) => (
                <Card 
                  key={job.id}
                  className="hover-elevate active-elevate-2 cursor-pointer"
                  onClick={() => onNavigateToJob?.(job.id)}
                  data-testid={`card-job-${job.id}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate" data-testid={`text-job-title-${job.id}`}>
                            {job.title}
                          </span>
                          <StatusBadge status={job.status} />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <Calendar className="h-3 w-3" />
                          <span data-testid={`text-job-date-${job.id}`}>
                            {formatDate(job.scheduledAt || job.createdAt)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {insights?.outstandingInvoices?.length === 0 && insights?.recentJobs?.length === 0 && client && (
          <Card className="border-dashed">
            <CardContent className="p-4 text-center">
              <Briefcase className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No jobs or invoices yet for this client.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="p-4 border-t flex gap-2">
        <Button 
          className="flex-1" 
          onClick={onCreateJob}
          data-testid="button-create-job"
        >
          <Plus className="h-4 w-4 mr-1" />
          Create Job
        </Button>
        <Button 
          variant="outline" 
          className="flex-1" 
          onClick={onCreateQuote}
          data-testid="button-create-quote"
        >
          <FileText className="h-4 w-4 mr-1" />
          Create Quote
        </Button>
      </div>
    </div>
  );
}
