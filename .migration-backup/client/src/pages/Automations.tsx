import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Zap,
  Plus,
  ArrowRight,
  Mail,
  MessageSquare,
  FileText,
  Receipt,
  Bell,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  Play,
  Pause,
  ChevronRight,
  Briefcase,
  Settings,
  Timer,
  Camera,
  MapPin,
  Phone,
  Save,
  Loader2,
  Eye,
  Send,
  Calendar
} from "lucide-react";

interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: {
    type: 'status_change' | 'time_delay' | 'no_response' | 'payment_received';
    entityType: 'job' | 'quote' | 'invoice';
    fromStatus?: string;
    toStatus?: string;
    delayDays?: number;
  };
  actions: Array<{
    type: 'send_email' | 'create_job' | 'create_invoice' | 'notification' | 'update_status';
    template?: string;
    message?: string;
    newStatus?: string;
  }>;
  createdAt: string;
}

interface AutomationSettings {
  id: string;
  userId: string;
  jobReminderEnabled: boolean;
  jobReminderHoursBefore: number;
  jobReminderType: 'sms' | 'email' | 'both';
  quoteFollowUpEnabled: boolean;
  quoteFollowUpDays: number;
  quoteFollowUpType?: 'sms' | 'email' | 'both';
  invoiceReminderEnabled: boolean;
  invoiceReminderDaysBeforeDue: number;
  invoiceOverdueReminderDays: number;
  invoiceReminderType?: 'sms' | 'email' | 'both';
  requirePhotoBeforeStart: boolean;
  requirePhotoAfterComplete: boolean;
  autoCheckInOnArrival: boolean;
  autoCheckOutOnDeparture: boolean;
  dailySummaryEnabled: boolean;
  dailySummaryTime: string;
  dailySummaryLastSent?: string;
}

const TRIGGER_TYPES = [
  { value: 'status_change', label: 'Status Changed', icon: ArrowRight, description: 'When a job/quote/invoice status changes' },
  { value: 'time_delay', label: 'Time Passed', icon: Clock, description: 'After a period of time' },
  { value: 'no_response', label: 'No Response', icon: AlertCircle, description: 'When client hasn\'t responded' },
  { value: 'payment_received', label: 'Payment Received', icon: CheckCircle2, description: 'When payment is made' },
];

const ACTION_TYPES = [
  { value: 'send_email', label: 'Send Email', icon: Mail },
  { value: 'create_job', label: 'Create Job', icon: Briefcase },
  { value: 'create_invoice', label: 'Create Invoice', icon: Receipt },
  { value: 'notification', label: 'Send Notification', icon: Bell },
  { value: 'update_status', label: 'Update Status', icon: Settings },
];

const JOB_STATUSES = ['pending', 'scheduled', 'in_progress', 'done', 'invoiced'];
const QUOTE_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'];
const INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'];

const PRESET_AUTOMATIONS: Omit<AutomationRule, 'id' | 'createdAt'>[] = [
  {
    name: "Quote Accepted → Create Job",
    description: "Automatically create a job when a quote is accepted",
    isActive: false,
    trigger: {
      type: 'status_change',
      entityType: 'quote',
      toStatus: 'accepted',
    },
    actions: [
      { type: 'create_job' },
      { type: 'notification', message: 'A new job has been created from an accepted quote' },
    ],
  },
  {
    name: "Job Completed → Create Invoice",
    description: "Automatically create an invoice when a job is marked as done",
    isActive: false,
    trigger: {
      type: 'status_change',
      entityType: 'job',
      toStatus: 'done',
    },
    actions: [
      { type: 'create_invoice' },
      { type: 'send_email', template: 'job_completed' },
    ],
  },
  {
    name: "Quote Follow-up (3 days)",
    description: "Send a friendly follow-up email if quote not responded after 3 days",
    isActive: false,
    trigger: {
      type: 'no_response',
      entityType: 'quote',
      delayDays: 3,
    },
    actions: [
      { type: 'send_email', template: 'quote_followup' },
    ],
  },
  {
    name: "Quote Follow-up (5 days)",
    description: "Second follow-up email for quotes without response after 5 days",
    isActive: false,
    trigger: {
      type: 'no_response',
      entityType: 'quote',
      delayDays: 5,
    },
    actions: [
      { type: 'send_email', template: 'quote_followup_urgent' },
    ],
  },
  {
    name: "Quote Final Reminder (7 days)",
    description: "Final reminder before quote expires - creates urgency",
    isActive: false,
    trigger: {
      type: 'no_response',
      entityType: 'quote',
      delayDays: 7,
    },
    actions: [
      { type: 'send_email', template: 'quote_final_reminder' },
      { type: 'notification', message: 'Quote expires soon - may need follow-up call' },
    ],
  },
  {
    name: "Job Overdue Alert (1 day)",
    description: "Notify when a scheduled job passes its date without completion",
    isActive: false,
    trigger: {
      type: 'time_delay',
      entityType: 'job',
      delayDays: 1,
    },
    actions: [
      { type: 'notification', message: 'Job overdue: {job_title} was scheduled for {scheduled_date} but hasn\'t been completed' },
    ],
  },
  {
    name: "Job Overdue Alert (3 days)",
    description: "Escalated alert for jobs 3+ days overdue",
    isActive: false,
    trigger: {
      type: 'time_delay',
      entityType: 'job',
      delayDays: 3,
    },
    actions: [
      { type: 'notification', message: 'URGENT: Job {job_title} is 3+ days overdue!' },
      { type: 'send_email', template: 'job_overdue_internal' },
    ],
  },
  {
    name: "Invoice Reminder (7 days overdue)",
    description: "Send reminder when invoice is 7 days overdue",
    isActive: false,
    trigger: {
      type: 'time_delay',
      entityType: 'invoice',
      delayDays: 7,
    },
    actions: [
      { type: 'send_email', template: 'invoice_reminder' },
    ],
  },
  {
    name: "Invoice Final Notice (14 days)",
    description: "Final payment notice for invoices 14 days overdue",
    isActive: false,
    trigger: {
      type: 'time_delay',
      entityType: 'invoice',
      delayDays: 14,
    },
    actions: [
      { type: 'send_email', template: 'invoice_final_notice' },
      { type: 'notification', message: 'Invoice {invoice_number} is 14+ days overdue - may need follow-up call' },
    ],
  },
  {
    name: "Payment Received → Thank You",
    description: "Send thank you message when payment is received",
    isActive: false,
    trigger: {
      type: 'payment_received',
      entityType: 'invoice',
    },
    actions: [
      { type: 'send_email', template: 'payment_received' },
      { type: 'update_status', newStatus: 'paid' },
    ],
  },
  {
    name: "Job Scheduled → Confirmation",
    description: "Send confirmation when a job is scheduled",
    isActive: false,
    trigger: {
      type: 'status_change',
      entityType: 'job',
      toStatus: 'scheduled',
    },
    actions: [
      { type: 'send_email', template: 'job_confirmation' },
    ],
  },
  {
    name: "Job Starting Tomorrow → Reminder",
    description: "Send reminder to client the day before scheduled job",
    isActive: false,
    trigger: {
      type: 'time_delay',
      entityType: 'job',
      delayDays: -1,
    },
    actions: [
      { type: 'send_email', template: 'job_reminder' },
    ],
  },
];

function TriggerIcon({ type }: { type: string }) {
  const trigger = TRIGGER_TYPES.find(t => t.value === type);
  if (!trigger) return <Zap className="h-4 w-4" />;
  const Icon = trigger.icon;
  return <Icon className="h-4 w-4" />;
}

function ActionIcon({ type }: { type: string }) {
  const action = ACTION_TYPES.find(a => a.value === type);
  if (!action) return <Zap className="h-4 w-4" />;
  const Icon = action.icon;
  return <Icon className="h-4 w-4" />;
}

export default function Automations() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'available' | 'settings'>('active');
  const { toast } = useToast();

  const { data: automations = [], isLoading } = useQuery<AutomationRule[]>({
    queryKey: ['/api/automations'],
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<AutomationSettings>({
    queryKey: ['/api/automation-settings'],
  });

  const [settingsForm, setSettingsForm] = useState<Partial<AutomationSettings>>({});

  // Sync settings form when data loads
  useEffect(() => {
    if (settings) {
      setSettingsForm(settings);
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<AutomationSettings>) => {
      return apiRequest('PUT', '/api/automation-settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation-settings'] });
      toast({
        title: "Settings saved",
        description: "Your automation settings have been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  const toggleAutomationMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest('PATCH', `/api/automations/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automations'] });
      toast({
        title: "Automation updated",
        description: "The automation has been toggled",
      });
    },
  });

  const createAutomationMutation = useMutation({
    mutationFn: async (data: Omit<AutomationRule, 'id' | 'createdAt'>) => {
      return apiRequest('POST', '/api/automations', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automations'] });
      setIsDialogOpen(false);
      toast({
        title: "Automation created",
        description: "Your new automation rule is ready",
      });
    },
  });

  const deleteAutomationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/automations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automations'] });
      toast({
        title: "Automation deleted",
        description: "The automation has been removed",
      });
    },
  });

  // Daily Summary state and mutations
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSubject, setPreviewSubject] = useState<string>('');

  const previewSummaryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/email/daily-summary/preview', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load preview');
      return res.json();
    },
    onSuccess: (data) => {
      setPreviewHtml(data.preview.html);
      setPreviewSubject(data.preview.subject);
      setPreviewDialogOpen(true);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to load daily summary preview",
        variant: "destructive",
      });
    },
  });

  const sendSummaryMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/email/daily-summary');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automation-settings'] });
      toast({
        title: "Daily summary sent",
        description: "The summary email has been sent to your business email",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send daily summary email",
        variant: "destructive",
      });
    },
  });

  const handleAddPreset = (preset: Omit<AutomationRule, 'id' | 'createdAt'>) => {
    createAutomationMutation.mutate({ ...preset, isActive: true });
  };

  const getQuickSetupIcon = (name: string) => {
    if (name.includes("Quote Accepted")) return Briefcase;
    if (name.includes("Job Completed")) return Receipt;
    if (name.includes("Invoice Reminder")) return Timer;
    if (name.includes("Payment Received")) return CheckCircle2;
    return Zap;
  };

  const QUICK_SETUP_AUTOMATIONS = [
    PRESET_AUTOMATIONS[0],
    PRESET_AUTOMATIONS[1],
    PRESET_AUTOMATIONS[7],
    PRESET_AUTOMATIONS[9],
  ];

  const activeAutomations = automations.filter(a => a.isActive);
  const inactiveAutomations = automations.filter(a => !a.isActive);

  const availablePresets = PRESET_AUTOMATIONS.filter(preset => 
    !automations.some(a => a.name === preset.name)
  );

  return (
    <PageShell data-testid="automations-page">
      <PageHeader
        title="Automations"
        subtitle="Set up automatic workflows to save time"
        action={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-automation">
                <Plus className="h-4 w-4 mr-2" />
                New Automation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Custom Automation</DialogTitle>
                <DialogDescription>
                  Build your own automation rule from scratch
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-muted-foreground text-center">
                  Custom automation builder coming soon! For now, use the preset templates below.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="mb-6 bg-muted/30" data-testid="quick-setup-section">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg" data-testid="quick-setup-title">Recommended for Most Businesses</CardTitle>
          <CardDescription data-testid="quick-setup-subtitle">
            Enable these automations to save hours every week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK_SETUP_AUTOMATIONS.map((preset, idx) => {
              const existingAutomation = automations.find(a => a.name === preset.name);
              const isActive = existingAutomation?.isActive ?? false;
              const isAdded = !!existingAutomation;
              const Icon = getQuickSetupIcon(preset.name);

              return (
                <Card 
                  key={idx} 
                  className="hover-elevate"
                  data-testid={`quick-setup-card-${idx}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${
                        isActive 
                          ? 'bg-green-100 dark:bg-green-900/30' 
                          : 'bg-primary/10'
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          isActive ? 'text-green-600' : ''
                        }`} style={isActive ? {} : { color: 'hsl(var(--trade))' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm leading-tight" data-testid={`quick-setup-name-${idx}`}>
                          {preset.name}
                        </h4>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2" data-testid={`quick-setup-desc-${idx}`}>
                      {preset.description}
                    </p>
                    {isActive ? (
                      <div 
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium"
                        data-testid={`quick-setup-active-${idx}`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Active
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={createAutomationMutation.isPending}
                        onClick={() => handleAddPreset(preset)}
                        data-testid={`quick-setup-enable-${idx}`}
                      >
                        Enable
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                <Play className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeAutomations.length}</p>
                <p className="text-sm text-muted-foreground">Active Automations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Pause className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inactiveAutomations.length}</p>
                <p className="text-sm text-muted-foreground">Paused</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{availablePresets.length}</p>
                <p className="text-sm text-muted-foreground">Available Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'available' | 'settings')}>
        <TabsList>
          <TabsTrigger value="active" className="gap-2" data-testid="tab-my-automations">
            <CheckCircle2 className="h-4 w-4" />
            My Automations
            {automations.length > 0 && (
              <Badge variant="secondary" className="ml-1">{automations.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="available" className="gap-2" data-testid="tab-templates">
            <Plus className="h-4 w-4" />
            Templates
            {availablePresets.length > 0 && (
              <Badge variant="secondary" className="ml-1">{availablePresets.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {automations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Zap className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No automations yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Add automation templates to streamline your workflow
                </p>
                <Button onClick={() => setActiveTab('available')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Browse Templates
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {automations.map((automation) => (
                <Card key={automation.id} data-testid={`automation-${automation.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div 
                          className={`p-2 rounded-full ${
                            automation.isActive 
                              ? 'bg-green-100 dark:bg-green-900/30' 
                              : 'bg-muted'
                          }`}
                        >
                          <Zap className={`h-5 w-5 ${
                            automation.isActive ? 'text-green-600' : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{automation.name}</h3>
                            <Badge 
                              variant={automation.isActive ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {automation.isActive ? 'Active' : 'Paused'}
                            </Badge>
                          </div>
                          {automation.description && (
                            <p className="text-sm text-muted-foreground mb-3">
                              {automation.description}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted">
                              <TriggerIcon type={automation.trigger.type} />
                              <span className="capitalize">
                                {automation.trigger.entityType}
                                {automation.trigger.toStatus && ` → ${automation.trigger.toStatus}`}
                                {automation.trigger.delayDays && ` (${automation.trigger.delayDays} days)`}
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            {automation.actions.map((action, idx) => (
                              <div 
                                key={idx}
                                className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10"
                              >
                                <ActionIcon type={action.type} />
                                <span className="capitalize">{action.type.replace('_', ' ')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={automation.isActive}
                          onCheckedChange={(checked) => 
                            toggleAutomationMutation.mutate({ 
                              id: automation.id, 
                              isActive: checked 
                            })
                          }
                          data-testid={`toggle-${automation.id}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAutomationMutation.mutate(automation.id)}
                          data-testid={`delete-${automation.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="available" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {PRESET_AUTOMATIONS.map((preset, idx) => {
              const isAdded = automations.some(a => a.name === preset.name);
              
              return (
                <Card 
                  key={idx}
                  className={isAdded ? 'opacity-60' : ''}
                  data-testid={`preset-${idx}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Zap className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                        </div>
                        <CardTitle className="text-base">{preset.name}</CardTitle>
                      </div>
                      {isAdded && (
                        <Badge variant="secondary">Added</Badge>
                      )}
                    </div>
                    <CardDescription>{preset.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-2 text-sm mb-4">
                      <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted">
                        <TriggerIcon type={preset.trigger.type} />
                        <span className="capitalize">
                          {preset.trigger.entityType}
                          {preset.trigger.toStatus && ` → ${preset.trigger.toStatus}`}
                          {preset.trigger.delayDays && ` (${preset.trigger.delayDays} days)`}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      {preset.actions.map((action, actionIdx) => (
                        <div 
                          key={actionIdx}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10"
                        >
                          <ActionIcon type={action.type} />
                          <span className="capitalize">{action.type.replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                    
                    <Button
                      className="w-full"
                      variant={isAdded ? "secondary" : "default"}
                      disabled={isAdded || createAutomationMutation.isPending}
                      onClick={() => handleAddPreset(preset)}
                      data-testid={`add-preset-${idx}`}
                    >
                      {isAdded ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Already Added
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Automation
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          {settingsLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Job Reminders */}
              <Card data-testid="settings-job-reminders">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                      <Bell className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Job Reminders</CardTitle>
                      <CardDescription>
                        Automatically remind clients before scheduled jobs
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="job-reminder-enabled">Enable job reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Send automatic reminders before scheduled jobs
                      </p>
                    </div>
                    <Switch
                      id="job-reminder-enabled"
                      checked={settingsForm.jobReminderEnabled ?? false}
                      onCheckedChange={(checked) => 
                        setSettingsForm(prev => ({ ...prev, jobReminderEnabled: checked }))
                      }
                      data-testid="switch-job-reminder-enabled"
                    />
                  </div>
                  
                  {settingsForm.jobReminderEnabled !== false && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="job-reminder-hours">Hours before job</Label>
                          <Select
                            value={String(settingsForm.jobReminderHoursBefore ?? 24)}
                            onValueChange={(v) => 
                              setSettingsForm(prev => ({ ...prev, jobReminderHoursBefore: parseInt(v) }))
                            }
                          >
                            <SelectTrigger id="job-reminder-hours" data-testid="select-reminder-hours">
                              <SelectValue placeholder="Select hours" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 hour before</SelectItem>
                              <SelectItem value="2">2 hours before</SelectItem>
                              <SelectItem value="4">4 hours before</SelectItem>
                              <SelectItem value="12">12 hours before</SelectItem>
                              <SelectItem value="24">24 hours before</SelectItem>
                              <SelectItem value="48">48 hours before</SelectItem>
                              <SelectItem value="72">72 hours before</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="job-reminder-type">Reminder type</Label>
                          <Select
                            value={settingsForm.jobReminderType ?? 'sms'}
                            onValueChange={(v) => 
                              setSettingsForm(prev => ({ ...prev, jobReminderType: v as 'sms' | 'email' | 'both' }))
                            }
                          >
                            <SelectTrigger id="job-reminder-type" data-testid="select-reminder-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sms">
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4" />
                                  SMS only
                                </div>
                              </SelectItem>
                              <SelectItem value="email">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4" />
                                  Email only
                                </div>
                              </SelectItem>
                              <SelectItem value="both">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4" />
                                  SMS and Email
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Quote Follow-ups */}
              <Card data-testid="settings-quote-followups">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                      <FileText className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Quote Follow-ups</CardTitle>
                      <CardDescription>
                        Automatically follow up on quotes that haven't been responded to
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="quote-followup-enabled">Enable quote follow-ups</Label>
                      <p className="text-sm text-muted-foreground">
                        Send reminders to clients who haven't responded
                      </p>
                    </div>
                    <Switch
                      id="quote-followup-enabled"
                      checked={settingsForm.quoteFollowUpEnabled ?? false}
                      onCheckedChange={(checked) => 
                        setSettingsForm(prev => ({ ...prev, quoteFollowUpEnabled: checked }))
                      }
                      data-testid="switch-quote-followup-enabled"
                    />
                  </div>
                  
                  {settingsForm.quoteFollowUpEnabled !== false && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="quote-followup-days">Days after sending quote</Label>
                        <Select
                          value={String(settingsForm.quoteFollowUpDays ?? 3)}
                          onValueChange={(v) => 
                            setSettingsForm(prev => ({ ...prev, quoteFollowUpDays: parseInt(v) }))
                          }
                        >
                          <SelectTrigger id="quote-followup-days" data-testid="select-quote-followup-days">
                            <SelectValue placeholder="Select days" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 day</SelectItem>
                            <SelectItem value="2">2 days</SelectItem>
                            <SelectItem value="3">3 days</SelectItem>
                            <SelectItem value="5">5 days</SelectItem>
                            <SelectItem value="7">7 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="quote-followup-type">Send via</Label>
                        <Select
                          value={settingsForm.quoteFollowUpType ?? 'email'}
                          onValueChange={(v) => 
                            setSettingsForm(prev => ({ ...prev, quoteFollowUpType: v as 'sms' | 'email' | 'both' }))
                          }
                        >
                          <SelectTrigger id="quote-followup-type" data-testid="select-quote-followup-type">
                            <SelectValue placeholder="Select channel" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                Email only
                              </div>
                            </SelectItem>
                            <SelectItem value="sms">
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                SMS only
                              </div>
                            </SelectItem>
                            <SelectItem value="both">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                SMS and Email
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Invoice Reminders */}
              <Card data-testid="settings-invoice-reminders">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                      <Receipt className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Invoice Reminders</CardTitle>
                      <CardDescription>
                        Automatically remind clients about upcoming and overdue invoices
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="invoice-reminder-enabled">Enable invoice reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Send payment reminders to clients
                      </p>
                    </div>
                    <Switch
                      id="invoice-reminder-enabled"
                      checked={settingsForm.invoiceReminderEnabled ?? false}
                      onCheckedChange={(checked) => 
                        setSettingsForm(prev => ({ ...prev, invoiceReminderEnabled: checked }))
                      }
                      data-testid="switch-invoice-reminder-enabled"
                    />
                  </div>
                  
                  {settingsForm.invoiceReminderEnabled !== false && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="invoice-reminder-before">Days before due date</Label>
                          <Select
                            value={String(settingsForm.invoiceReminderDaysBeforeDue ?? 3)}
                            onValueChange={(v) => 
                              setSettingsForm(prev => ({ ...prev, invoiceReminderDaysBeforeDue: parseInt(v) }))
                            }
                          >
                            <SelectTrigger id="invoice-reminder-before" data-testid="select-invoice-before">
                              <SelectValue placeholder="Select days" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 day before</SelectItem>
                              <SelectItem value="2">2 days before</SelectItem>
                              <SelectItem value="3">3 days before</SelectItem>
                              <SelectItem value="5">5 days before</SelectItem>
                              <SelectItem value="7">7 days before</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="invoice-overdue-reminder">Days after overdue</Label>
                          <Select
                            value={String(settingsForm.invoiceOverdueReminderDays ?? 7)}
                            onValueChange={(v) => 
                              setSettingsForm(prev => ({ ...prev, invoiceOverdueReminderDays: parseInt(v) }))
                            }
                          >
                            <SelectTrigger id="invoice-overdue-reminder" data-testid="select-invoice-overdue">
                              <SelectValue placeholder="Select days" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3">3 days overdue</SelectItem>
                              <SelectItem value="7">7 days overdue</SelectItem>
                              <SelectItem value="14">14 days overdue</SelectItem>
                              <SelectItem value="21">21 days overdue</SelectItem>
                              <SelectItem value="30">30 days overdue</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="md:w-1/2">
                        <Label htmlFor="invoice-reminder-type">Send via</Label>
                        <Select
                          value={settingsForm.invoiceReminderType ?? 'email'}
                          onValueChange={(v) => 
                            setSettingsForm(prev => ({ ...prev, invoiceReminderType: v as 'sms' | 'email' | 'both' }))
                          }
                        >
                          <SelectTrigger id="invoice-reminder-type" data-testid="select-invoice-reminder-type">
                            <SelectValue placeholder="Select channel" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                Email only
                              </div>
                            </SelectItem>
                            <SelectItem value="sms">
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4" />
                                SMS only
                              </div>
                            </SelectItem>
                            <SelectItem value="both">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                SMS and Email
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Photo Gates */}
              <Card data-testid="settings-photo-gates">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                      <Camera className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Photo Requirements (Photo Gates)</CardTitle>
                      <CardDescription>
                        Require photos at specific job stages to maintain quality documentation
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <Label htmlFor="require-photo-before">Require photo before starting job</Label>
                      <p className="text-sm text-muted-foreground">
                        Team members must capture a photo before marking job as "In Progress"
                      </p>
                    </div>
                    <Switch
                      id="require-photo-before"
                      checked={settingsForm.requirePhotoBeforeStart ?? false}
                      onCheckedChange={(checked) => 
                        setSettingsForm(prev => ({ ...prev, requirePhotoBeforeStart: checked }))
                      }
                      data-testid="switch-photo-before-start"
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <Label htmlFor="require-photo-after">Require photo after completing job</Label>
                      <p className="text-sm text-muted-foreground">
                        Team members must capture a photo before marking job as "Completed"
                      </p>
                    </div>
                    <Switch
                      id="require-photo-after"
                      checked={settingsForm.requirePhotoAfterComplete ?? false}
                      onCheckedChange={(checked) => 
                        setSettingsForm(prev => ({ ...prev, requirePhotoAfterComplete: checked }))
                      }
                      data-testid="switch-photo-after-complete"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* GPS Auto Check-in */}
              <Card data-testid="settings-gps-checkin">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                      <MapPin className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">GPS Auto Check-in</CardTitle>
                      <CardDescription>
                        Automatically record arrival and departure at job sites using GPS
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b">
                    <div>
                      <Label htmlFor="auto-checkin">Auto check-in on arrival</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically start time tracking when arriving at job site
                      </p>
                    </div>
                    <Switch
                      id="auto-checkin"
                      checked={settingsForm.autoCheckInOnArrival ?? false}
                      onCheckedChange={(checked) => 
                        setSettingsForm(prev => ({ ...prev, autoCheckInOnArrival: checked }))
                      }
                      data-testid="switch-auto-checkin"
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <Label htmlFor="auto-checkout">Auto check-out on departure</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically stop time tracking when leaving job site
                      </p>
                    </div>
                    <Switch
                      id="auto-checkout"
                      checked={settingsForm.autoCheckOutOnDeparture ?? false}
                      onCheckedChange={(checked) => 
                        setSettingsForm(prev => ({ ...prev, autoCheckOutOnDeparture: checked }))
                      }
                      data-testid="switch-auto-checkout"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Daily Summary Email */}
              <Card data-testid="settings-daily-summary">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                      <Calendar className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">End-of-Day Summary Email</CardTitle>
                      <CardDescription>
                        Receive a daily recap of jobs completed, invoices, quotes, and payments
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="daily-summary-enabled">Enable daily summary emails</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive an email summary at the end of each business day
                      </p>
                    </div>
                    <Switch
                      id="daily-summary-enabled"
                      checked={settingsForm.dailySummaryEnabled ?? false}
                      onCheckedChange={(checked) => 
                        setSettingsForm(prev => ({ ...prev, dailySummaryEnabled: checked }))
                      }
                      data-testid="switch-daily-summary-enabled"
                    />
                  </div>
                  
                  {settingsForm.dailySummaryEnabled && (
                    <>
                      <div>
                        <Label htmlFor="daily-summary-time">Send time</Label>
                        <Select
                          value={settingsForm.dailySummaryTime ?? '18:00'}
                          onValueChange={(v) => 
                            setSettingsForm(prev => ({ ...prev, dailySummaryTime: v }))
                          }
                        >
                          <SelectTrigger id="daily-summary-time" className="w-full md:w-48" data-testid="select-daily-summary-time">
                            <SelectValue placeholder="Select time" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="16:00">4:00 PM</SelectItem>
                            <SelectItem value="17:00">5:00 PM</SelectItem>
                            <SelectItem value="18:00">6:00 PM</SelectItem>
                            <SelectItem value="19:00">7:00 PM</SelectItem>
                            <SelectItem value="20:00">8:00 PM</SelectItem>
                            <SelectItem value="21:00">9:00 PM</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Summary will be sent at this time each day
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => previewSummaryMutation.mutate()}
                          disabled={previewSummaryMutation.isPending}
                          data-testid="button-preview-summary"
                        >
                          {previewSummaryMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4 mr-2" />
                          )}
                          Preview Summary
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendSummaryMutation.mutate()}
                          disabled={sendSummaryMutation.isPending}
                          data-testid="button-send-summary-now"
                        >
                          {sendSummaryMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          Send Now
                        </Button>
                      </div>

                      {settingsForm.dailySummaryLastSent && (
                        <p className="text-xs text-muted-foreground">
                          Last sent: {new Date(settingsForm.dailySummaryLastSent).toLocaleString('en-AU')}
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Daily Summary Preview Dialog */}
              <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Daily Summary Preview</DialogTitle>
                    <DialogDescription>
                      {previewSubject}
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="flex-1 max-h-[60vh]">
                    <div 
                      className="p-4"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  </ScrollArea>
                  <DialogFooter className="flex-shrink-0">
                    <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
                      Close
                    </Button>
                    <Button 
                      onClick={() => {
                        sendSummaryMutation.mutate();
                        setPreviewDialogOpen(false);
                      }}
                      disabled={sendSummaryMutation.isPending}
                    >
                      {sendSummaryMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Send Now
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    const { id, userId, createdAt, updatedAt, dailySummaryLastSent, ...settingsToSave } = settingsForm as any;
                    updateSettingsMutation.mutate(settingsToSave);
                  }}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="button-save-settings"
                >
                  {updateSettingsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
