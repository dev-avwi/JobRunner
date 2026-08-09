import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Receipt,
  Mail,
  FileText,
  Send,
  Eye,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Clock,
  Check,
  X,
  Loader2,
  MessageSquare,
  Calendar,
  Bell,
  CreditCard,
  ArrowRight,
  Zap,
  Edit3
} from "lucide-react";

export type ActionStatus = 'suggested' | 'queued' | 'running' | 'completed' | 'skipped';

export interface SmartAction {
  id: string;
  type: 'create_invoice' | 'send_email' | 'send_sms' | 'create_job' | 'schedule_reminder' | 'collect_payment' | 'send_confirmation';
  title: string;
  description: string;
  icon: 'invoice' | 'email' | 'sms' | 'job' | 'reminder' | 'payment' | 'calendar';
  status: ActionStatus;
  enabled: boolean;
  preview?: {
    subject?: string;
    message?: string;
    amount?: string;
    recipient?: string;
    scheduledFor?: string;
  };
  aiSuggestion?: string;
  requirements?: string[];
  missingRequirements?: string[];
}

interface SmartActionsPanelProps {
  title: string;
  subtitle?: string;
  actions: SmartAction[];
  onActionToggle: (actionId: string, enabled: boolean) => void;
  onActionPreview: (actionId: string) => void;
  onActionEdit: (actionId: string) => void;
  onExecuteAll: () => void;
  onSkipAll: () => void;
  isExecuting?: boolean;
  entityType: 'job' | 'quote' | 'invoice';
  entityStatus?: string;
}

const getActionIcon = (iconType: string) => {
  switch (iconType) {
    case 'invoice': return Receipt;
    case 'email': return Mail;
    case 'sms': return MessageSquare;
    case 'job': return FileText;
    case 'reminder': return Bell;
    case 'payment': return CreditCard;
    case 'calendar': return Calendar;
    default: return Zap;
  }
};

const getStatusBadge = (status: ActionStatus) => {
  switch (status) {
    case 'suggested':
      return <Badge variant="secondary" className="text-xs">Suggested</Badge>;
    case 'queued':
      return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Queued</Badge>;
    case 'running':
      return <Badge className="text-xs bg-amber-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
    case 'completed':
      return <Badge className="text-xs bg-green-500"><Check className="h-3 w-3 mr-1" />Done</Badge>;
    case 'skipped':
      return <Badge variant="secondary" className="text-xs text-muted-foreground"><X className="h-3 w-3 mr-1" />Skipped</Badge>;
    default:
      return null;
  }
};

function SmartActionItem({ 
  action, 
  onToggle, 
  onPreview, 
  onEdit,
  isExecuting 
}: { 
  action: SmartAction; 
  onToggle: (enabled: boolean) => void;
  onPreview: () => void;
  onEdit: () => void;
  isExecuting?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const IconComponent = getActionIcon(action.icon);
  const hasMissingRequirements = action.missingRequirements && action.missingRequirements.length > 0;
  const isDisabled = isExecuting || action.status === 'completed' || action.status === 'running';

  return (
    <div 
      className={`border rounded-lg p-3 transition-all ${
        action.enabled && !hasMissingRequirements ? 'border-primary/30 bg-primary/5' : 'border-border'
      } ${hasMissingRequirements ? 'opacity-60' : ''}`}
      data-testid={`smart-action-${action.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${action.enabled && !hasMissingRequirements ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
          <IconComponent className="h-4 w-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm">{action.title}</h4>
              {getStatusBadge(action.status)}
            </div>
            <Switch
              checked={action.enabled}
              onCheckedChange={onToggle}
              disabled={isDisabled || hasMissingRequirements}
              data-testid={`toggle-action-${action.id}`}
            />
          </div>
          
          <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
          
          {hasMissingRequirements && (
            <div className="mt-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/50 rounded px-2 py-1">
              Missing: {action.missingRequirements?.join(', ')}
            </div>
          )}
          
          {action.aiSuggestion && action.enabled && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-primary bg-primary/5 rounded px-2 py-1.5">
              <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>{action.aiSuggestion}</span>
            </div>
          )}
        </div>
      </div>
      
      {action.preview && action.enabled && !hasMissingRequirements && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-2 justify-between text-xs h-7"
              data-testid={`expand-action-${action.id}`}
            >
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                Preview what will happen
              </span>
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-xs">
              {action.preview.recipient && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To:</span>
                  <span className="font-medium">{action.preview.recipient}</span>
                </div>
              )}
              {action.preview.subject && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subject:</span>
                  <span className="font-medium truncate ml-2">{action.preview.subject}</span>
                </div>
              )}
              {action.preview.amount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium text-primary">{action.preview.amount}</span>
                </div>
              )}
              {action.preview.message && (
                <div className="mt-2 pt-2 border-t">
                  <p className="text-muted-foreground mb-1">Message preview:</p>
                  <p className="bg-background rounded p-2 text-xs whitespace-pre-wrap line-clamp-3">
                    {action.preview.message}
                  </p>
                </div>
              )}
              <div className="flex gap-2 mt-2 pt-2 border-t">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 h-7 text-xs"
                  onClick={onEdit}
                  disabled={isDisabled}
                  data-testid={`edit-action-${action.id}`}
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 h-7 text-xs"
                  onClick={onPreview}
                  disabled={isDisabled}
                  data-testid={`preview-action-${action.id}`}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Full Preview
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export default function SmartActionsPanel({
  title,
  subtitle,
  actions,
  onActionToggle,
  onActionPreview,
  onActionEdit,
  onExecuteAll,
  onSkipAll,
  isExecuting,
  entityType,
  entityStatus
}: SmartActionsPanelProps) {
  const enabledActions = actions.filter(a => a.enabled && (!a.missingRequirements || a.missingRequirements.length === 0));
  const completedActions = actions.filter(a => a.status === 'completed');
  const hasActionsToRun = enabledActions.length > 0 && enabledActions.some(a => a.status !== 'completed');

  return (
    <Card className="border-primary/20" data-testid="smart-actions-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          {completedActions.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {completedActions.length}/{actions.length} done
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {actions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No suggested actions for this {entityType}</p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2 pr-2">
                {actions.map((action) => (
                  <SmartActionItem
                    key={action.id}
                    action={action}
                    onToggle={(enabled) => onActionToggle(action.id, enabled)}
                    onPreview={() => onActionPreview(action.id)}
                    onEdit={() => onActionEdit(action.id)}
                    isExecuting={isExecuting}
                  />
                ))}
              </div>
            </ScrollArea>
            
            <Separator />
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{enabledActions.length} action{enabledActions.length !== 1 ? 's' : ''} selected</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs"
                  onClick={onSkipAll}
                  disabled={isExecuting}
                >
                  Skip all
                </Button>
              </div>
              
              <Button
                onClick={onExecuteAll}
                disabled={!hasActionsToRun || isExecuting}
                className="w-full"
                data-testid="button-execute-actions"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running actions...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Run {enabledActions.length} Action{enabledActions.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                Review each action above before running. Nothing happens until you click Run.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function getJobSmartActions(job: any, client: any, linkedQuote?: any, linkedInvoice?: any): SmartAction[] {
  const actions: SmartAction[] = [];
  const clientEmail = client?.email;
  const clientPhone = client?.phone;
  const clientName = client?.name || 'Client';

  if (job.status === 'done' && !linkedInvoice) {
    actions.push({
      id: 'create_invoice',
      type: 'create_invoice',
      title: 'Create Invoice',
      description: `Generate invoice for ${job.title}`,
      icon: 'invoice',
      status: 'suggested',
      enabled: true,
      preview: {
        recipient: clientName,
        amount: linkedQuote?.total ? `$${parseFloat(linkedQuote.total).toFixed(2)}` : 'Based on job details',
      },
      aiSuggestion: linkedQuote ? 'Will use line items from the accepted quote' : 'Add line items based on work completed',
      requirements: ['Job must be completed'],
    });

    if (clientEmail) {
      actions.push({
        id: 'send_invoice_email',
        type: 'send_email',
        title: 'Email Invoice',
        description: `Send invoice to ${clientName}`,
        icon: 'email',
        status: 'suggested',
        enabled: true,
        preview: {
          recipient: clientEmail,
          subject: `Invoice for ${job.title}`,
          message: `G'day ${clientName.split(' ')[0]},\n\nPlease find attached your invoice for "${job.title}".\n\nCheers`,
        },
        aiSuggestion: 'Friendly Australian-style email with payment link included',
        requirements: ['Invoice created', 'Client email'],
      });
    } else {
      actions.push({
        id: 'send_invoice_email',
        type: 'send_email',
        title: 'Email Invoice',
        description: 'Send invoice via email',
        icon: 'email',
        status: 'suggested',
        enabled: false,
        missingRequirements: ['Client email address'],
        requirements: ['Invoice created', 'Client email'],
      });
    }

    if (clientPhone) {
      actions.push({
        id: 'send_invoice_sms',
        type: 'send_sms',
        title: 'SMS Payment Link',
        description: `Text payment link to ${clientPhone}`,
        icon: 'sms',
        status: 'suggested',
        enabled: false,
        preview: {
          recipient: clientPhone,
          message: `Hi ${clientName.split(' ')[0]}! Your invoice for ${job.title} is ready. Pay here: [link]`,
        },
        requirements: ['Invoice created', 'Client phone'],
      });
    }
  }

  if (job.status === 'pending' || job.status === 'scheduled') {
    if (!linkedQuote) {
      actions.push({
        id: 'create_quote',
        type: 'create_invoice',
        title: 'Create Quote',
        description: `Generate quote for ${job.title}`,
        icon: 'invoice',
        status: 'suggested',
        enabled: false,
        preview: {
          recipient: clientName,
        },
        aiSuggestion: 'Create a professional quote based on job scope',
      });
    }
  }

  if (job.status === 'scheduled' && clientEmail) {
    actions.push({
      id: 'send_confirmation',
      type: 'send_confirmation',
      title: 'Send Confirmation',
      description: 'Confirm booking with client',
      icon: 'email',
      status: 'suggested',
      enabled: false,
      preview: {
        recipient: clientEmail,
        subject: `Booking Confirmed: ${job.title}`,
        message: `G'day! Just confirming we'll be there on ${job.scheduledAt ? new Date(job.scheduledAt).toLocaleDateString('en-AU') : 'the scheduled date'}.`,
      },
    });
  }

  return actions;
}

export function getQuoteSmartActions(quote: any, client: any, linkedJob?: any): SmartAction[] {
  const actions: SmartAction[] = [];
  const clientEmail = client?.email;
  const clientName = client?.name || 'Client';

  if (quote.status === 'accepted') {
    if (!linkedJob) {
      actions.push({
        id: 'create_job',
        type: 'create_job',
        title: 'Create Job',
        description: 'Schedule the work',
        icon: 'job',
        status: 'suggested',
        enabled: true,
        preview: {
          recipient: clientName,
        },
        aiSuggestion: 'Create job with details from this quote',
      });
    }

    if (clientEmail) {
      actions.push({
        id: 'send_acceptance_confirmation',
        type: 'send_email',
        title: 'Confirm Acceptance',
        description: 'Thank client for accepting',
        icon: 'email',
        status: 'suggested',
        enabled: true,
        preview: {
          recipient: clientEmail,
          subject: `Quote Accepted - ${quote.title}`,
          message: `G'day ${clientName.split(' ')[0]},\n\nThanks for accepting the quote! We'll be in touch to schedule the work.\n\nCheers`,
        },
      });
    }
  }

  if (quote.status === 'draft' || quote.status === 'sent') {
    if (clientEmail) {
      actions.push({
        id: 'send_quote_email',
        type: 'send_email',
        title: 'Send Quote',
        description: `Email quote to ${clientName}`,
        icon: 'email',
        status: 'suggested',
        enabled: quote.status === 'draft',
        preview: {
          recipient: clientEmail,
          subject: `Quote #${quote.number} - ${quote.title}`,
          message: `G'day ${clientName.split(' ')[0]},\n\nPlease find attached your quote for "${quote.title}".\n\nTotal: $${parseFloat(quote.total || 0).toFixed(2)}\n\nCheers`,
          amount: `$${parseFloat(quote.total || 0).toFixed(2)}`,
        },
        aiSuggestion: 'PDF will be auto-attached via Gmail',
      });
    }

    actions.push({
      id: 'schedule_followup',
      type: 'schedule_reminder',
      title: 'Follow-up Reminder',
      description: 'Remind me if no response in 3 days',
      icon: 'reminder',
      status: 'suggested',
      enabled: false,
      preview: {
        scheduledFor: '3 days from now',
      },
    });
  }

  return actions;
}

export function getInvoiceSmartActions(invoice: any, client: any): SmartAction[] {
  const actions: SmartAction[] = [];
  const clientEmail = client?.email;
  const clientPhone = client?.phone;
  const clientName = client?.name || 'Client';

  if (invoice.status === 'draft' || invoice.status === 'sent') {
    if (clientEmail) {
      actions.push({
        id: 'send_invoice_email',
        type: 'send_email',
        title: invoice.status === 'draft' ? 'Send Invoice' : 'Resend Invoice',
        description: `Email to ${clientName}`,
        icon: 'email',
        status: 'suggested',
        enabled: invoice.status === 'draft',
        preview: {
          recipient: clientEmail,
          subject: `Invoice #${invoice.number} - ${invoice.title}`,
          message: `G'day ${clientName.split(' ')[0]},\n\nPlease find attached your invoice for "${invoice.title}".\n\nTotal: $${parseFloat(invoice.total || 0).toFixed(2)}\n\nCheers`,
          amount: `$${parseFloat(invoice.total || 0).toFixed(2)}`,
        },
        aiSuggestion: 'PDF and payment link will be included',
      });
    }

    if (invoice.status === 'sent') {
      actions.push({
        id: 'send_reminder',
        type: 'schedule_reminder',
        title: 'Payment Reminder',
        description: 'Send friendly payment reminder',
        icon: 'reminder',
        status: 'suggested',
        enabled: false,
        preview: {
          recipient: clientEmail || clientPhone || clientName,
          message: `Just a friendly reminder that invoice #${invoice.number} is due. Pay online: [link]`,
        },
      });
    }
  }

  if (invoice.status === 'paid') {
    if (clientEmail) {
      actions.push({
        id: 'send_receipt',
        type: 'send_email',
        title: 'Send Receipt',
        description: 'Thank you email with receipt',
        icon: 'email',
        status: 'suggested',
        enabled: false,
        preview: {
          recipient: clientEmail,
          subject: `Payment Received - ${invoice.title}`,
          message: `G'day ${clientName.split(' ')[0]},\n\nThanks heaps for your payment! Receipt attached.\n\nCheers`,
        },
      });
    }
  }

  return actions;
}
