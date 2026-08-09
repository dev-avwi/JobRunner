import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Calendar, 
  Play, 
  CheckCircle, 
  Receipt, 
  DollarSign,
  ChevronRight,
  ArrowRight,
  Timer
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

interface StageTimestamps {
  scheduledAt?: Date | string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  invoicedAt?: Date | string | null;
}

interface JobFlowWizardProps {
  status: JobStatus;
  hasQuote?: boolean;
  hasInvoice?: boolean;
  invoicePaid?: boolean;
  timestamps?: StageTimestamps;
  jobId?: number;
  timerRunning?: boolean;
  onCreateQuote?: () => void;
  onViewQuote?: () => void;
  onSchedule?: () => void;
  onStart?: () => void;
  onComplete?: () => void;
  onCreateInvoice?: () => void;
  onViewInvoice?: () => void;
  onSendReminder?: () => void;
  onStatusChange?: (newStatus: JobStatus) => void;
  className?: string;
}

interface FlowStep {
  id: string;
  label: string;
  icon: React.ElementType;
  status: 'completed' | 'current' | 'upcoming';
  timestamp?: Date | null;
  clickable?: boolean;
}

// Helper to safely parse date
function parseTimestamp(ts: Date | string | null | undefined): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  try {
    return new Date(ts);
  } catch {
    return null;
  }
}

export default function JobFlowWizard({
  status,
  hasQuote = false,
  hasInvoice = false,
  invoicePaid = false,
  timestamps = {},
  jobId,
  timerRunning = false,
  onCreateQuote,
  onViewQuote,
  onSchedule,
  onStart,
  onComplete,
  onCreateInvoice,
  onViewInvoice,
  onSendReminder,
  onStatusChange,
  className
}: JobFlowWizardProps) {
  
  // Determine which steps are completed, current, or upcoming
  const steps: FlowStep[] = useMemo(() => {
    const statusOrder: JobStatus[] = ['pending', 'scheduled', 'in_progress', 'done', 'invoiced'];
    const currentIndex = statusOrder.indexOf(status);

    return [
      {
        id: 'quote',
        label: 'Quote',
        icon: FileText,
        status: hasQuote ? 'completed' : (status === 'pending' ? 'current' : 'upcoming'),
        clickable: false
      },
      {
        id: 'scheduled',
        label: 'Scheduled',
        icon: Calendar,
        status: currentIndex >= 1 ? 'completed' : (status === 'pending' && hasQuote ? 'current' : 'upcoming'),
        timestamp: parseTimestamp(timestamps.scheduledAt),
        clickable: currentIndex >= 1 && onStatusChange !== undefined
      },
      {
        id: 'in_progress',
        label: timerRunning && status === 'in_progress' ? 'Timer Running' : 'In Progress',
        icon: timerRunning && status === 'in_progress' ? Timer : Play,
        status: currentIndex >= 2 ? 'completed' : (currentIndex === 1 ? 'current' : 'upcoming'),
        timestamp: parseTimestamp(timestamps.startedAt),
        clickable: currentIndex >= 2 && onStatusChange !== undefined
      },
      {
        id: 'done',
        label: 'Done',
        icon: CheckCircle,
        status: currentIndex >= 3 ? 'completed' : (currentIndex === 2 ? 'current' : 'upcoming'),
        timestamp: parseTimestamp(timestamps.completedAt),
        clickable: currentIndex >= 3 && onStatusChange !== undefined
      },
      {
        id: 'invoiced',
        label: 'Invoiced',
        icon: Receipt,
        status: hasInvoice ? 'completed' : (status === 'done' ? 'current' : 'upcoming'),
        timestamp: parseTimestamp(timestamps.invoicedAt),
        clickable: false
      },
      {
        id: 'paid',
        label: 'Paid',
        icon: DollarSign,
        status: invoicePaid ? 'completed' : (hasInvoice ? 'current' : 'upcoming'),
        clickable: false
      }
    ];
  }, [status, hasQuote, hasInvoice, invoicePaid, timestamps, onStatusChange, timerRunning]);

  // Determine the next action
  const nextAction = useMemo(() => {
    if (status === 'pending' && !hasQuote) {
      return {
        label: 'Create Quote',
        description: 'Send a quote to your client',
        action: onCreateQuote,
        variant: 'outline' as const
      };
    }
    if (status === 'pending') {
      return {
        label: 'Schedule Job',
        description: 'Set a date and time for this job',
        action: onSchedule,
        variant: 'outline' as const
      };
    }
    if (status === 'scheduled') {
      return {
        label: 'Start Job',
        description: 'Begin working on this job',
        action: onStart,
        variant: 'default' as const
      };
    }
    if (status === 'in_progress') {
      return {
        label: 'Complete Job',
        description: 'Mark this job as finished',
        action: onComplete,
        variant: 'default' as const
      };
    }
    if (status === 'done' && !hasInvoice) {
      return {
        label: 'Create Invoice',
        description: 'Send an invoice to get paid',
        action: onCreateInvoice,
        variant: 'default' as const,
        primary: true
      };
    }
    if (hasInvoice && !invoicePaid) {
      return {
        label: 'View Invoice',
        description: 'Check invoice status or send reminder',
        action: onViewInvoice,
        variant: 'outline' as const
      };
    }
    return null;
  }, [status, hasQuote, hasInvoice, invoicePaid, onCreateQuote, onSchedule, onStart, onComplete, onCreateInvoice, onViewInvoice]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress Steps */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                {/* Step Circle */}
                <div 
                  className={cn(
                    "flex flex-col items-center min-w-[48px]",
                    step.clickable && step.status === 'completed' && "cursor-pointer group"
                  )}
                  onClick={() => {
                    if (step.clickable && step.status === 'completed' && onStatusChange) {
                      const statusMap: Record<string, JobStatus> = {
                        'scheduled': 'scheduled',
                        'in_progress': 'in_progress', 
                        'done': 'done'
                      };
                      if (statusMap[step.id]) {
                        onStatusChange(statusMap[step.id]);
                      }
                    }
                  }}
                  title={step.clickable && step.status === 'completed' ? `Click to revert to ${step.label}` : undefined}
                >
                  <div 
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      step.status === 'completed' && "bg-green-500 text-white",
                      step.status === 'current' && "ring-2 ring-offset-2 ring-blue-500 bg-blue-500 text-white",
                      step.status === 'upcoming' && "bg-muted text-muted-foreground",
                      step.clickable && step.status === 'completed' && "group-hover:ring-2 group-hover:ring-offset-2 group-hover:ring-amber-500",
                      step.id === 'in_progress' && timerRunning && status === 'in_progress' && "animate-pulse"
                    )}
                    style={step.id === 'in_progress' && timerRunning && status === 'in_progress' ? { backgroundColor: 'hsl(var(--trade))' } : {}}
                    data-testid={`flow-step-${step.id}`}
                  >
                    <step.icon className="h-4 w-4" />
                  </div>
                  <span 
                    className={cn(
                      "text-[10px] mt-1 text-center whitespace-nowrap",
                      step.status === 'completed' && "text-green-600 font-medium",
                      step.status === 'current' && "font-semibold text-blue-600",
                      step.status === 'upcoming' && "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                  {/* Timestamp display */}
                  {step.timestamp && step.status === 'completed' && (
                    <span className="text-[9px] text-muted-foreground mt-0.5 whitespace-nowrap">
                      {format(step.timestamp, 'd MMM h:mma').toLowerCase()}
                    </span>
                  )}
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div 
                    className={cn(
                      "h-0.5 w-4 sm:w-6 mx-1 transition-all",
                      step.status === 'completed' ? "bg-green-500" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Next Action Card */}
      {nextAction && nextAction.action && (
        <Card 
          className={cn(
            "cursor-pointer hover-elevate transition-all",
            nextAction.primary && "border-2"
          )}
          style={nextAction.primary ? { borderColor: 'hsl(var(--trade))' } : {}}
          onClick={nextAction.action}
          data-testid="card-next-action"
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge 
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      nextAction.primary && "text-white"
                    )}
                    style={nextAction.primary ? { backgroundColor: 'hsl(var(--trade))' } : {}}
                  >
                    Next Step
                  </Badge>
                </div>
                <h3 className="font-semibold">{nextAction.label}</h3>
                <p className="text-sm text-muted-foreground">{nextAction.description}</p>
              </div>
              <Button
                variant={nextAction.variant}
                className={cn(
                  "rounded-xl flex-shrink-0",
                  nextAction.primary && "text-white"
                )}
                style={nextAction.primary ? { backgroundColor: 'hsl(var(--trade))' } : {}}
                data-testid="btn-next-action"
              >
                {nextAction.label}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {invoicePaid && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <h3 className="font-semibold text-green-700 dark:text-green-300">Job Complete!</h3>
            <p className="text-sm text-green-600 dark:text-green-400">This job has been invoiced and paid</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
