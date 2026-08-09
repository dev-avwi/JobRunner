import { Button } from "@/components/ui/button";
import { 
  Briefcase, 
  FileText, 
  Users, 
  Receipt,
  Calendar,
  Plus,
  Sparkles,
  ArrowRight,
  type LucideIcon
} from "lucide-react";

interface EmptyStateProps {
  type: 'jobs' | 'quotes' | 'invoices' | 'clients' | 'calendar';
  onAction?: () => void;
  actionLabel?: string;
  showTips?: boolean;
}

const emptyStateConfig: Record<string, {
  icon: LucideIcon;
  title: string;
  description: string;
  tips: string[];
  actionLabel: string;
  encouragement: string;
}> = {
  jobs: {
    icon: Briefcase,
    title: "No jobs yet",
    description: "Jobs help you track work from start to finish. Add your first job to get started.",
    tips: [
      "Jobs can be converted to invoices with one tap",
      "Add photos to document your work",
      "Set reminders so nothing falls through the cracks"
    ],
    actionLabel: "Add Your First Job",
    encouragement: "Most tradies add their first job in under 2 minutes"
  },
  quotes: {
    icon: FileText,
    title: "No quotes yet",
    description: "Send professional quotes that win work. Clients can accept and pay online.",
    tips: [
      "Quotes auto-calculate GST for you",
      "Clients can accept quotes with one click",
      "Easily convert accepted quotes to invoices"
    ],
    actionLabel: "Create Your First Quote",
    encouragement: "Professional quotes help you win more work"
  },
  invoices: {
    icon: Receipt,
    title: "No invoices yet",
    description: "Get paid faster with professional invoices. Clients can pay online instantly.",
    tips: [
      "Automatic payment reminders chase late payers",
      "Online payments mean faster cash flow",
      "GST calculated and displayed correctly"
    ],
    actionLabel: "Create Your First Invoice",
    encouragement: "Online payments and automatic reminders help you get paid sooner"
  },
  clients: {
    icon: Users,
    title: "No clients yet",
    description: "Save client details once, use them everywhere. Makes quoting and invoicing a breeze.",
    tips: [
      "Client details auto-fill into quotes and invoices",
      "Keep notes on each client for quick reference",
      "Track all jobs and payments per client"
    ],
    actionLabel: "Add Your First Client",
    encouragement: "Start with your most frequent customer"
  },
  calendar: {
    icon: Calendar,
    title: "No scheduled jobs",
    description: "Schedule jobs to see your week at a glance. Never double-book again.",
    tips: [
      "Drag jobs to reschedule them",
      "Set start and end times for accurate scheduling",
      "See travel time between jobs"
    ],
    actionLabel: "Schedule a Job",
    encouragement: "A clear schedule means less stress"
  }
};

export default function EmptyState({ 
  type, 
  onAction, 
  actionLabel,
  showTips = true 
}: EmptyStateProps) {
  const config = emptyStateConfig[type];
  const Icon = config.icon;

  return (
    <div 
      className="flex flex-col items-center justify-center py-12 px-6 text-center"
      data-testid={`empty-state-${type}`}
    >
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground/50" />
      </div>
      
      <h3 className="text-lg font-semibold mb-2">{config.title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {config.description}
      </p>

      {onAction && (
        <Button 
          onClick={onAction}
          className="mb-6"
          data-testid={`button-${type}-empty-action`}
        >
          <Plus className="h-4 w-4 mr-2" />
          {actionLabel || config.actionLabel}
        </Button>
      )}

      {showTips && (
        <div className="w-full max-w-md">
          <div className="bg-muted/30 rounded-lg p-4 text-left">
            <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Sparkles className="h-3 w-3" />
              Quick Tips
            </div>
            <ul className="space-y-2">
              {config.tips.map((tip, index) => (
                <li 
                  key={index}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <ArrowRight className="h-3 w-3 mt-1 shrink-0 text-primary" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <p className="text-xs text-muted-foreground mt-4 italic">
            {config.encouragement}
          </p>
        </div>
      )}
    </div>
  );
}
