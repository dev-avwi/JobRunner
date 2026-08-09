import { Badge } from "@/components/ui/badge";

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';
type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'partial' | 'partially_paid';

interface StatusBadgeProps {
  status: JobStatus | QuoteStatus | InvoiceStatus | string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; colorClass?: string }> = {
      // Job statuses - ServiceM8 style workflow
      pending: { label: 'Pending', variant: 'secondary', colorClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
      cancelled: { label: 'Cancelled', variant: 'destructive', colorClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
      scheduled: { label: 'Scheduled', variant: 'outline', colorClass: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
      in_progress: { label: 'In Progress', variant: 'default', colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
      done: { label: 'Completed', variant: 'default', colorClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      invoiced: { label: 'Invoiced', variant: 'default', colorClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
      
      // Quote statuses
      draft: { label: 'Draft', variant: 'secondary' },
      sent: { label: 'Sent', variant: 'default', colorClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
      accepted: { label: 'Accepted', variant: 'default', colorClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      rejected: { label: 'Declined', variant: 'destructive' },
      expired: { label: 'Expired', variant: 'secondary', colorClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
      
      // Invoice statuses
      paid: { label: 'Paid', variant: 'default', colorClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      overdue: { label: 'Overdue', variant: 'destructive' },
      partial: { label: 'Partial', variant: 'outline', colorClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300' },
      partially_paid: { label: 'Partially Paid', variant: 'outline', colorClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700' },
      processing: { label: 'Processing', variant: 'outline', colorClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700' },
      pending_payment: { label: 'Pending Payment', variant: 'outline', colorClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700' },
    };
    
    return configs[status] || { label: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '), variant: 'secondary' as const };
  };

  const config = getStatusConfig(status);

  return (
    <Badge 
      variant={config.variant} 
      className={`${config.colorClass || ''} ${className || ''}`}
      data-testid={`status-${status}`}
    >
      {config.label}
    </Badge>
  );
}