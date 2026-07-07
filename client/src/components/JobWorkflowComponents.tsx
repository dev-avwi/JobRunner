import { CheckCircle2, Circle, FileText, Receipt, Calendar, Play, Briefcase, ArrowRight, Clock, AlertCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

interface LinkedDocument {
  id: string;
  title?: string;
  status: string;
  total: string;
  number?: string;
  quoteNumber?: string;
  invoiceNumber?: string;
  createdAt?: string;
  dueDate?: string;
  paidAt?: string;
}

interface JobProgressBarProps {
  status: JobStatus;
  hasQuote?: boolean;
  hasInvoice?: boolean;
  className?: string;
}

const WORKFLOW_STEPS = [
  { id: 'pending', label: 'New', icon: Briefcase },
  { id: 'scheduled', label: 'Scheduled', icon: Calendar },
  { id: 'in_progress', label: 'In Progress', icon: Play },
  { id: 'done', label: 'Done', icon: CheckCircle2 },
  { id: 'invoiced', label: 'Invoiced', icon: Receipt },
] as const;

const STATUS_ORDER: Record<JobStatus, number> = {
  pending: 0,
  scheduled: 1,
  in_progress: 2,
  done: 3,
  invoiced: 4,
};

export function JobProgressBar({ status, hasQuote, hasInvoice, className }: JobProgressBarProps) {
  const currentIndex = STATUS_ORDER[status];

  return (
    <Card className={cn("overflow-hidden", className)} data-testid="job-progress-bar">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          {WORKFLOW_STEPS.map((step, index) => {
            const isPassed = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isUpcoming = index > currentIndex;
            const StepIcon = step.icon;

            return (
              <div key={step.id} className="flex-1 flex flex-col items-center relative">
                {index > 0 && (
                  <div 
                    className={cn(
                      "absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2",
                      isPassed || isCurrent ? "bg-primary/60" : "bg-muted"
                    )}
                    style={{ width: 'calc(100% - 32px)', right: 'calc(50% + 16px)' }}
                  />
                )}
                <div
                  className={cn(
                    "relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all",
                    isPassed && "bg-primary/20 text-primary border-2 border-primary/40",
                    isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                    isUpcoming && "bg-muted text-muted-foreground"
                  )}
                >
                  <StepIcon className="h-4 w-4" />
                </div>
                <span 
                  className={cn(
                    "text-xs mt-1.5 font-medium text-center",
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface LinkedReceipt {
  id: string;
  receiptNumber: string;
  amount: string;
  gstAmount: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
  pdfUrl: string | null;
  createdAt: string;
}

interface LinkedDocumentsCardProps {
  linkedQuote?: LinkedDocument | null;
  linkedInvoice?: LinkedDocument | null;
  linkedReceipts?: LinkedReceipt[];
  jobStatus: JobStatus;
  onViewQuote?: (id: string) => void;
  onViewInvoice?: (id: string) => void;
  onViewReceipt?: (id: string) => void;
  onCreateQuote?: () => void;
  onCreateInvoice?: () => void;
  onSendQuote?: (id: string) => void;
  onSendInvoice?: (id: string) => void;
  className?: string;
}

export function LinkedDocumentsCard({
  linkedQuote,
  linkedInvoice,
  linkedReceipts = [],
  jobStatus,
  onViewQuote,
  onViewInvoice,
  onViewReceipt,
  onCreateQuote,
  onCreateInvoice,
  onSendQuote,
  onSendInvoice,
  className,
}: LinkedDocumentsCardProps) {
  const getQuoteStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'sent':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">Sent</Badge>;
      case 'accepted':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Accepted</Badge>;
      case 'declined':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">Declined</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Draft</Badge>;
    }
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'sent':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">Sent</Badge>;
      case 'paid':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Paid</Badge>;
      case 'overdue':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">Overdue</Badge>;
      case 'partial':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">Partial</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Draft</Badge>;
    }
  };

  return (
    <Card className={className} data-testid="linked-documents-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
          Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div 
          className={cn(
            "flex items-center justify-between p-3 rounded-lg border",
            linkedQuote ? "hover-elevate cursor-pointer" : "bg-muted/30"
          )}
          onClick={() => linkedQuote && onViewQuote?.(linkedQuote.id)}
          data-testid="quote-link"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center",
              linkedQuote ? "bg-blue-500/10" : "bg-muted"
            )}>
              <FileText className={cn("h-4 w-4", linkedQuote ? "text-blue-600" : "text-muted-foreground")} />
            </div>
            <div>
              <p className="text-sm font-medium">
                {linkedQuote 
                  ? (linkedQuote.quoteNumber || `Quote`) 
                  : "No Quote"}
              </p>
              {linkedQuote ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">${linkedQuote.total}</span>
                  {getQuoteStatusBadge(linkedQuote.status)}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Create a quote for this job</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {linkedQuote && linkedQuote.status?.toLowerCase() === 'draft' && onSendQuote && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onSendQuote(linkedQuote.id); }}
                data-testid="button-send-quote"
              >
                <Send className="h-3 w-3 mr-1" />
                Send
              </Button>
            )}
            {!linkedQuote && onCreateQuote && (
              <Button 
                size="sm" 
                onClick={(e) => { e.stopPropagation(); onCreateQuote(); }}
                data-testid="button-create-quote"
              >
                Create Quote
              </Button>
            )}
            {linkedQuote && (
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        <div 
          className={cn(
            "flex items-center justify-between p-3 rounded-lg border",
            linkedInvoice ? "hover-elevate cursor-pointer" : "bg-muted/30"
          )}
          onClick={() => linkedInvoice && onViewInvoice?.(linkedInvoice.id)}
          data-testid="invoice-link"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center",
              linkedInvoice ? "bg-purple-500/10" : "bg-muted"
            )}>
              <Receipt className={cn("h-4 w-4", linkedInvoice ? "text-purple-600" : "text-muted-foreground")} />
            </div>
            <div>
              <p className="text-sm font-medium">
                {linkedInvoice 
                  ? (linkedInvoice.invoiceNumber || `Invoice`) 
                  : "No Invoice"}
              </p>
              {linkedInvoice ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">${linkedInvoice.total}</span>
                  {getInvoiceStatusBadge(linkedInvoice.status)}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {jobStatus === 'done' 
                    ? "Job complete - ready to invoice!" 
                    : "Invoice will be created after job is done"}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {linkedInvoice && linkedInvoice.status?.toLowerCase() === 'draft' && onSendInvoice && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onSendInvoice(linkedInvoice.id); }}
                data-testid="button-send-invoice"
              >
                <Send className="h-3 w-3 mr-1" />
                Send
              </Button>
            )}
            {!linkedInvoice && jobStatus === 'done' && onCreateInvoice && (
              <Button 
                size="sm" 
                onClick={(e) => { e.stopPropagation(); onCreateInvoice(); }}
                data-testid="button-create-invoice"
              >
                Create Invoice
              </Button>
            )}
            {linkedInvoice && (
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {linkedReceipts.length > 0 && (
          <div className="space-y-2">
            {linkedReceipts.map((receipt) => (
              <div 
                key={receipt.id}
                className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                onClick={() => onViewReceipt?.(receipt.id)}
                data-testid={`receipt-link-${receipt.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-green-500/10">
                    <Receipt className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{receipt.receiptNumber}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">${parseFloat(receipt.amount).toFixed(2)}</span>
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                        Paid
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface NextActionCardProps {
  jobStatus: JobStatus;
  hasQuote?: boolean;
  hasInvoice?: boolean;
  quoteStatus?: string;
  invoiceStatus?: string;
  scheduledAt?: string | null;
  onSchedule?: () => void;
  onStartJob?: () => void;
  onCompleteJob?: () => void;
  onCreateQuote?: () => void;
  onSendQuote?: () => void;
  onCreateInvoice?: () => void;
  onSendInvoice?: () => void;
  onSendReminder?: () => void;
  className?: string;
}

export function NextActionCard({
  jobStatus,
  hasQuote,
  hasInvoice,
  quoteStatus,
  invoiceStatus,
  scheduledAt,
  onSchedule,
  onStartJob,
  onCompleteJob,
  onCreateQuote,
  onSendQuote,
  onCreateInvoice,
  onSendInvoice,
  onSendReminder,
  className,
}: NextActionCardProps) {
  const getNextAction = () => {
    switch (jobStatus) {
      case 'pending':
        if (!hasQuote) {
          return {
            title: "Create a Quote",
            description: "Send the client a quote before scheduling",
            icon: FileText,
            action: onCreateQuote,
            buttonText: "Create Quote",
            priority: 'medium' as const,
          };
        }
        if (quoteStatus?.toLowerCase() === 'draft') {
          return {
            title: "Send Your Quote",
            description: "Quote is ready - send it to the client",
            icon: Send,
            action: onSendQuote,
            buttonText: "Send Quote",
            priority: 'high' as const,
          };
        }
        if (!scheduledAt) {
          return {
            title: "Schedule This Job",
            description: "Pick a date and time for the work",
            icon: Calendar,
            action: onSchedule,
            buttonText: "Schedule Job",
            priority: 'medium' as const,
          };
        }
        return null;

      case 'scheduled':
        return {
          title: "Start the Job",
          description: "Mark as in progress when you begin work",
          icon: Play,
          action: onStartJob,
          buttonText: "Start Job",
          priority: 'medium' as const,
        };

      case 'in_progress':
        return {
          title: "Complete the Job",
          description: "Mark as done when work is finished",
          icon: CheckCircle2,
          action: onCompleteJob,
          buttonText: "Mark Complete",
          priority: 'high' as const,
        };

      case 'done':
        if (!hasInvoice) {
          if (!onCreateInvoice) return null;
          return {
            title: "Create Invoice",
            description: "Job is done - time to get paid!",
            icon: Receipt,
            action: onCreateInvoice,
            buttonText: "Create Invoice",
            priority: 'high' as const,
          };
        }
        if (invoiceStatus?.toLowerCase() === 'draft') {
          return {
            title: "Send Invoice",
            description: "Invoice is ready - send it to get paid",
            icon: Send,
            action: onSendInvoice,
            buttonText: "Send Invoice",
            priority: 'high' as const,
          };
        }
        if (invoiceStatus?.toLowerCase() === 'sent' || invoiceStatus?.toLowerCase() === 'overdue') {
          return {
            title: "Follow Up on Payment",
            description: invoiceStatus?.toLowerCase() === 'overdue' 
              ? "Payment is overdue - send a reminder" 
              : "Waiting for payment",
            icon: AlertCircle,
            action: onSendReminder,
            buttonText: "Send Reminder",
            priority: invoiceStatus?.toLowerCase() === 'overdue' ? 'high' as const : 'low' as const,
          };
        }
        return null;

      case 'invoiced':
        if (invoiceStatus?.toLowerCase() !== 'paid') {
          return {
            title: "Follow Up on Payment",
            description: "Invoice sent - waiting for payment",
            icon: Clock,
            action: onSendReminder,
            buttonText: "Send Reminder",
            priority: 'low' as const,
          };
        }
        return null;

      default:
        return null;
    }
  };

  const nextAction = getNextAction();

  if (!nextAction) {
    return null;
  }

  const priorityColors = {
    high: "border-red-500/30 bg-red-500/5",
    medium: "border-amber-500/30 bg-amber-500/5",
    low: "border-green-500/30 bg-green-500/5",
  };

  const iconColors = {
    high: "bg-red-500/10 text-red-600",
    medium: "bg-amber-500/10 text-amber-600",
    low: "bg-green-500/10 text-green-600",
  };

  const ActionIcon = nextAction.icon;

  return (
    <Card className={cn("border-2", priorityColors[nextAction.priority], className)} data-testid="next-action-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", iconColors[nextAction.priority])}>
            <ActionIcon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{nextAction.title}</p>
            <p className="text-xs text-muted-foreground">{nextAction.description}</p>
          </div>
          {nextAction.action && (
            <Button 
              size="sm" 
              onClick={nextAction.action}
              data-testid="button-next-action"
            >
              {nextAction.buttonText}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
