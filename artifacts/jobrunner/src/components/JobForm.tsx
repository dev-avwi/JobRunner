import { SearchableSelect } from "@/components/ui/searchable-select";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useCreateJob, type SubscriptionLimitError } from "@/hooks/use-jobs";
import { useClients, useCreateClient } from "@/hooks/use-clients";
import { useToast } from "@/hooks/use-toast";
import { useSubscriptionUsage } from "@/hooks/use-subscription";
import TemplateSelector from "@/components/TemplateSelector";
import UpgradePrompt from "@/components/UpgradePrompt";
import { type DocumentTemplate } from "@/hooks/use-templates";
import { useQuery } from "@tanstack/react-query";
import { queryClient, getSessionToken } from "@/lib/queryClient";
import { Plus, User, Phone, Mail, MapPin, Loader2, X, History, Copy, ChevronDown, ChevronUp, Calendar, FileText, Search, Zap, Briefcase, ArrowLeft, Percent, Package, Wrench, Layers, Trash2, CheckCircle2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import AddressAutocomplete from "@/components/ui/address-autocomplete";
import { useSearch } from "wouter";
import { tradeCatalog } from "@shared/tradeCatalog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/StatusBadge";

type JobType = 'service' | 'project';
type ProjectFlowStep = 'type-picker' | 'template-picker' | 'form';
type ProjectFormStep = 'basic' | 'phases' | 'settings';

interface ProjectPhase {
  localId: string;
  phaseCode: string;
  name: string;
  description?: string;
  bookedHours?: string;
}

const PROJECT_STEPS: { id: ProjectFormStep; label: string }[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'phases', label: 'Phases' },
  { id: 'settings', label: 'Settings' },
];

const jobFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  clientId: z.string().min(1, "Client is required"),
  address: z.string().min(1, "Address is required"),
  scheduledAt: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  estimatedHours: z.string().optional(),
  requiresInspection: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.enum(["weekly", "fortnightly", "monthly", "quarterly", "yearly"]).optional(),
  customFields: z.record(z.any()).optional(),
});

type JobFormData = z.infer<typeof jobFormSchema>;

const RECURRENCE_OPTIONS: Array<{ value: NonNullable<JobFormData["recurrencePattern"]>; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

function calculateNextRecurrenceDate(base: Date, pattern: string): Date {
  const next = new Date(base);
  switch (pattern) {
    case "weekly": next.setDate(next.getDate() + 7); break;
    case "fortnightly": next.setDate(next.getDate() + 14); break;
    case "monthly": next.setMonth(next.getMonth() + 1); break;
    case "quarterly": next.setMonth(next.getMonth() + 3); break;
    case "yearly": next.setFullYear(next.getFullYear() + 1); break;
  }
  return next;
}

interface JobFormProps {
  onSubmit?: (jobId: string) => void;
  onCancel?: () => void;
}

const quickClientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type QuickClientData = z.infer<typeof quickClientSchema>;

export default function JobForm({ onSubmit, onCancel }: JobFormProps) {
  const { data: clients = [] } = useClients();
  const { data: usage } = useSubscriptionUsage();
  const { toast } = useToast();
  const createJobMutation = useCreateJob();
  const createClientMutation = useCreateClient();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showQuickAddClient, setShowQuickAddClient] = useState(false);
  const [jobType, setJobType] = useState<JobType | null>(null);
  const [projectFlowStep, setProjectFlowStep] = useState<ProjectFlowStep>('type-picker');
  const [projectFormStep, setProjectFormStep] = useState<ProjectFormStep>('basic');
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [practicalCompletionDate, setPracticalCompletionDate] = useState('');
  const [defectsLiabilityMonths, setDefectsLiabilityMonths] = useState('12');

  // Project-specific state (only used when jobType === 'project')
  const [budgetedCost, setBudgetedCost] = useState('');
  const [materialMarkupPct, setMaterialMarkupPct] = useState('');
  const [equipmentMarkupPct, setEquipmentMarkupPct] = useState('');
  const [subcontractorMarkupPct, setSubcontractorMarkupPct] = useState('');
  const [quickClientData, setQuickClientData] = useState<QuickClientData>({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [previousJobsOpen, setPreviousJobsOpen] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  
  
  // Read clientId and quoteId from URL params (when navigating from client view or quote)
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlClientId = urlParams.get('clientId');
  const urlQuoteId = urlParams.get('quoteId');
  const urlTitle = urlParams.get('title');
  const urlAddress = urlParams.get('address');
  const urlClientName = urlParams.get('clientName');
  const [urlClientApplied, setUrlClientApplied] = useState(false);
  const [urlPrefillApplied, setUrlPrefillApplied] = useState(false);

  // Fetch project templates (for the template picker step)
  const { data: projectTemplates = [] } = useQuery<Array<{
    id: string;
    name: string;
    description: string | null;
    templateData: {
      phases: Array<{ phaseCode: string; name: string; description?: string; bookedHours?: string }>;
      settings?: { materialMarkupPct?: string; equipmentMarkupPct?: string; subcontractorMarkupPct?: string; budgetedCost?: string; description?: string };
    };
    createdAt: string;
  }>>({
    queryKey: ["/api/project-templates"],
    enabled: jobType === 'project',
  });

  // Fetch quote details if creating job from quote
  const { data: sourceQuote } = useQuery({
    queryKey: ['/api/quotes', urlQuoteId],
    queryFn: async () => {
      const token = getSessionToken();
      const response = await fetch(`/api/quotes/${urlQuoteId}`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!urlQuoteId,
  });

  // Get current user's trade type for personalized templates
  const { data: userCheck } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const authToken = getSessionToken();
      const res = await fetch('/api/auth/me', { credentials: 'include', headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : undefined });
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
    retry: false,
    staleTime: 30000,
  });

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: "",
      description: "",
      clientId: "",
      address: "",
      scheduledAt: "",
      priority: "medium",
      estimatedHours: "",
      requiresInspection: false,
      isRecurring: false,
      recurrencePattern: "monthly",
      customFields: {},
    },
  });

  // Track pending client to select after cache updates
  const pendingClientToSelect = useRef<{ id: string; address?: string } | null>(null);
  
  // Auto-fill address when client is selected (only once per client change)
  const selectedClientId = form.watch("clientId");
  const [lastAutoFilledClientId, setLastAutoFilledClientId] = useState<string | null>(null);
  
  // Effect to select pending client when it appears in the clients list
  useEffect(() => {
    if (pendingClientToSelect.current) {
      const pendingClient = pendingClientToSelect.current;
      const clientExists = (clients as any[]).some(c => c.id === pendingClient.id);
      
      if (clientExists) {
        form.setValue("clientId", pendingClient.id, { shouldValidate: true });
        
        // Auto-fill address if provided
        if (pendingClient.address) {
          const currentAddress = form.getValues("address");
          if (!currentAddress) {
            form.setValue("address", pendingClient.address);
            setAddressConfirmed(true);
            setLastAutoFilledClientId(pendingClient.id);
          }
        }
        
        // Clear the pending client
        pendingClientToSelect.current = null;
      }
    }
  }, [clients, form]);
  
  // Effect to apply clientId from URL params (when navigating from client view)
  useEffect(() => {
    if (urlClientId && !urlClientApplied && (clients as any[]).length > 0) {
      const clientFromUrl = (clients as any[]).find(c => c.id === urlClientId);
      if (clientFromUrl) {
        form.setValue("clientId", urlClientId, { shouldValidate: true });
        
        // Also auto-fill address from this client
        if (clientFromUrl.address) {
          form.setValue("address", clientFromUrl.address);
          setAddressConfirmed(true);
          setLastAutoFilledClientId(urlClientId);
        }
        
        setUrlClientApplied(true);
        toast({
          title: "Client selected",
          description: `Creating job for ${clientFromUrl.name}`,
        });
      }
    }
  }, [urlClientId, urlClientApplied, clients, form, toast]);

  // Effect to pre-fill job details from source quote
  const [quoteApplied, setQuoteApplied] = useState(false);
  useEffect(() => {
    if (sourceQuote && !quoteApplied) {
      // Pre-fill job title from quote title or number
      if (sourceQuote.title) {
        form.setValue("title", sourceQuote.title, { shouldValidate: true });
      } else if (sourceQuote.number) {
        const title = `Job from ${sourceQuote.number}`;
        form.setValue("title", title, { shouldValidate: true });
      }
      
      // Pre-fill description from quote description or job scope
      if (sourceQuote.description || sourceQuote.jobScope) {
        const desc = sourceQuote.description || sourceQuote.jobScope;
        form.setValue("description", desc);
      }
      
      setQuoteApplied(true);
      toast({
        title: "Creating job from quote",
        description: `Quote ${sourceQuote.number} details have been pre-filled`,
      });
    }
  }, [sourceQuote, quoteApplied, form, toast]);

  useEffect(() => {
    if (!urlPrefillApplied && (urlTitle || urlAddress || urlClientName)) {
      if (urlTitle) {
        form.setValue("title", urlTitle, { shouldValidate: true });
      }
      if (urlAddress) {
        form.setValue("address", urlAddress);
        setAddressConfirmed(true);
      }
      if (urlClientName && (clients as any[]).length > 0) {
        const matchingClient = (clients as any[]).find(
          (c: any) => c.name?.toLowerCase() === urlClientName.toLowerCase()
        );
        if (matchingClient) {
          form.setValue("clientId", matchingClient.id, { shouldValidate: true });
          setLastAutoFilledClientId(matchingClient.id);
        } else {
          setQuickClientData(prev => ({ ...prev, name: urlClientName, address: urlAddress || "" }));
          setShowQuickAddClient(true);
        }
      }
      setUrlPrefillApplied(true);
    }
  }, [urlTitle, urlAddress, urlClientName, urlPrefillApplied, clients, form]);
  
  useEffect(() => {
    if (selectedClientId && selectedClientId !== lastAutoFilledClientId) {
      const selectedClient = (clients as any[]).find(c => c.id === selectedClientId);
      if (selectedClient?.address) {
        const currentAddress = form.getValues("address");
        if (!currentAddress) {
          form.setValue("address", selectedClient.address, { shouldDirty: true, shouldValidate: true });
          form.clearErrors("address");
          setAddressConfirmed(true);
          setLastAutoFilledClientId(selectedClientId);
          toast({
            title: "Address auto-filled",
            description: `Using ${selectedClient.name}'s address. You can change it if needed.`,
          });
        }
      }
    }
  }, [selectedClientId, clients, form, toast, lastAutoFilledClientId]);

  // Fetch previous jobs for the selected client (notes only, no photos)
  const { data: previousJobs = [] } = useQuery({
    queryKey: ['/api/clients', selectedClientId, 'jobs'],
    queryFn: async () => {
      const token = getSessionToken();
      const response = await fetch(`/api/clients/${selectedClientId}/jobs`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!response.ok) return [];
      const jobs = await response.json();
      if (!Array.isArray(jobs)) {
        console.warn('[JobForm] Ignoring malformed previous-jobs response');
        return [];
      }
      // Sort by date descending and limit to 5 most recent
      return [...jobs]
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 5);
    },
    enabled: !!selectedClientId,
  });

  // Copy notes from previous job to current description
  const handleCopyNotes = (job: any) => {
    const currentDescription = form.getValues("description") || "";
    const jobNotes = job.description || job.notes || "";
    
    if (!jobNotes) {
      toast({
        title: "No notes to copy",
        description: "This job doesn't have any notes or description.",
      });
      return;
    }
    
    const separator = currentDescription ? "\n\n--- Notes from previous job: " + job.title + " ---\n" : "";
    form.setValue("description", currentDescription + separator + jobNotes);
    
    toast({
      title: "Notes copied",
      description: `Notes from "${job.title}" added to description.`,
    });
  };

  const formatJobDate = (dateString?: string | null) => {
    const date = dateString ? new Date(dateString) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return 'Date unavailable';
    }

    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Handle quick add client submission
  const handleQuickAddClient = async () => {
    try {
      const parsed = quickClientSchema.parse(quickClientData);
      const result = await createClientMutation.mutateAsync(parsed);
      
      // Store the pending client selection - will be applied when cache updates
      pendingClientToSelect.current = {
        id: result.id,
        address: parsed.address,
      };
      
      // Optimistically update the cache to include the new client
      queryClient.setQueryData(["/api/clients"], (oldData: any) => {
        if (Array.isArray(oldData)) {
          return [...oldData, result];
        }
        return [result];
      });
      
      // Show appropriate message based on whether created offline
      if (result.isOffline) {
        toast({
          title: "Client saved offline",
          description: `${parsed.name} will be synced when you're back online`,
        });
      } else {
        toast({
          title: "Client created",
          description: `${parsed.name} has been added and selected`,
        });
      }
      
      // Reset and close
      setQuickClientData({ name: "", email: "", phone: "", address: "" });
      setShowQuickAddClient(false);
      
      // Background refetch to sync with server (non-blocking) - only if online
      if (!result.isOffline) {
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Invalid client details",
          description: error.errors[0]?.message || "Please check the form",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to create client. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleApplyTemplate = (template: DocumentTemplate) => {
    try {
      const defaults = template.defaults || {};
      
      const titleToSet = defaults.title || template.name || "";
      if (titleToSet) {
        form.setValue("title", titleToSet, { 
          shouldValidate: true, 
          shouldDirty: true, 
          shouldTouch: true 
        });
      }
      
      // Apply description if available
      if (defaults.description) {
        form.setValue("description", defaults.description, { 
          shouldValidate: true, 
          shouldDirty: true, 
          shouldTouch: true 
        });
      }
      
      // Apply estimated hours from dueTermDays if available
      if (defaults.dueTermDays && defaults.dueTermDays > 0) {
        form.setValue("estimatedHours", String(defaults.dueTermDays), { 
          shouldValidate: true, 
          shouldDirty: true, 
          shouldTouch: true 
        });
      }
      
    } catch (error) {
      console.error('[JobForm] Error applying template:', error);
      toast({
        title: "Error applying template",
        description: "There was an issue applying the template data",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (data: JobFormData) => {
    if (!addressConfirmed && data.address) {
      toast({ title: "Please select an address", description: "Tap an address from the suggestions to confirm it", variant: "destructive" });
      return;
    }
    try {
      const recurrenceBase = data.scheduledAt ? new Date(data.scheduledAt) : new Date();
      const jobData: any = {
        ...data,
        jobType: jobType ?? 'service',
        estimatedHours: data.estimatedHours ? parseInt(data.estimatedHours) : undefined,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : undefined,
        customFields: data.customFields,
        // Project-specific fields (only sent when jobType === 'project')
        ...(jobType === 'project' && {
          ...(budgetedCost ? { budgetedCost } : {}),
          ...(materialMarkupPct ? { materialMarkupPct } : {}),
          ...(equipmentMarkupPct ? { equipmentMarkupPct } : {}),
          ...(subcontractorMarkupPct ? { subcontractorMarkupPct } : {}),
          ...(practicalCompletionDate ? { practicalCompletionDate } : {}),
          ...(defectsLiabilityMonths ? { defectsLiabilityMonths: parseInt(defectsLiabilityMonths) } : {}),
        }),
        ...(data.isRecurring && data.recurrencePattern
          ? {
              isRecurring: true,
              recurrencePattern: data.recurrencePattern,
              nextRecurrenceDate: calculateNextRecurrenceDate(recurrenceBase, data.recurrencePattern).toISOString(),
            }
          : { isRecurring: false, recurrencePattern: undefined }),
        ...(urlQuoteId ? { quoteId: urlQuoteId } : {}),
      };

      const result = await createJobMutation.mutateAsync(jobData);

      // After job is created, create phases (inline or from template)
      if (result.id && phases.length > 0) {
        const authToken = getSessionToken();
        let phaseErrors = 0;
        for (let i = 0; i < phases.length; i++) {
          const { localId, ...phase } = phases[i];
          try {
            const phaseRes = await fetch(`/api/jobs/${result.id}/phases`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}) },
              credentials: 'include',
              body: JSON.stringify({ ...phase, sortOrder: i }),
            });
            if (!phaseRes.ok) {
              phaseErrors++;
              console.error(`Failed to create phase "${phase.name}" (${phaseRes.status})`);
            }
          } catch (e) {
            phaseErrors++;
            console.error('Failed to create phase from template:', e);
          }
        }
        if (phaseErrors > 0) {
          toast({
            title: `Project created — ${phaseErrors} phase${phaseErrors > 1 ? 's' : ''} couldn't be added`,
            description: 'You can add them manually from the project detail page.',
            variant: 'destructive',
          });
        }
      }

      // After job is created, update the quote to link to this job
      if (urlQuoteId && result.id) {
        try {
          const linkToken = getSessionToken();
          await fetch(`/api/quotes/${urlQuoteId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...(linkToken ? { 'Authorization': `Bearer ${linkToken}` } : {}) },
            credentials: 'include',
            body: JSON.stringify({ jobId: result.id }),
          });
          queryClient.invalidateQueries({ queryKey: ['/api/quotes', urlQuoteId] });
          queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
          toast({
            title: "Job linked to quote",
            description: `Quote ${sourceQuote?.number || ''} is now linked to this job`,
          });
        } catch (e) {
          console.error('Failed to link quote to job:', e);
        }
      }
      
      // Success handling is now in the hook
      if (onSubmit) onSubmit(result.id);
    } catch (error: any) {
      // Handle subscription limit errors
      if (error.subscriptionError?.type === 'SUBSCRIPTION_LIMIT') {
        setShowUpgradePrompt(true);
        return;
      }
      
      // Other errors are handled by the hook's onError callback
    }
  };

  // Show template picker for project type
  if (jobType === 'project' && projectFlowStep === 'template-picker') {
    return (
      <div className="w-full px-6 lg:px-8 py-6 space-y-6" data-testid="page-template-picker">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setJobType(null); setProjectFlowStep('type-picker'); setPhases([]); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Back to type picker"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                <Layers className="h-3.5 w-3.5" />
                Project
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">Start from a template?</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Pick a saved project structure or start blank</p>
          </div>
        </div>

        <div className="space-y-3 max-w-2xl">
          {/* Skip / start blank option */}
          <button
            type="button"
            onClick={() => { setPhases([]); setProjectFlowStep('form'); setProjectFormStep('basic'); }}
            data-testid="button-skip-template"
            className="group w-full text-left p-4 rounded-xl border-2 border-border hover:border-primary hover:shadow-md transition-all bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-muted/80 transition-colors">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Start blank</p>
                <p className="text-sm text-muted-foreground">No phases pre-filled — add them manually</p>
              </div>
            </div>
          </button>

          {/* Saved templates */}
          {projectTemplates.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground px-2">or choose a saved template</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {projectTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setPhases(tpl.templateData.phases.map((p, i) => ({ ...p, localId: `tpl-${i}` })));
                    // Pre-fill description from template settings if present
                    if (tpl.templateData.settings?.description) {
                      form.setValue('description', tpl.templateData.settings.description);
                    }
                    // Pre-fill markup percentages
                    if (tpl.templateData.settings?.materialMarkupPct) setMaterialMarkupPct(tpl.templateData.settings.materialMarkupPct);
                    if (tpl.templateData.settings?.equipmentMarkupPct) setEquipmentMarkupPct(tpl.templateData.settings.equipmentMarkupPct);
                    if (tpl.templateData.settings?.subcontractorMarkupPct) setSubcontractorMarkupPct(tpl.templateData.settings.subcontractorMarkupPct);
                    if (tpl.templateData.settings?.budgetedCost) setBudgetedCost(tpl.templateData.settings.budgetedCost);
                    setProjectFlowStep('form');
                    setProjectFormStep('basic');
                    toast({ title: `Template applied`, description: `${tpl.templateData.phases.length} phase${tpl.templateData.phases.length !== 1 ? 's' : ''} loaded — review and adjust below` });
                  }}
                  data-testid={`button-use-template-${tpl.id}`}
                  className="group w-full text-left p-4 rounded-xl border-2 border-border hover:border-primary hover:shadow-md transition-all bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-muted/80 transition-colors shrink-0">
                      <Layers className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{tpl.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {tpl.templateData.phases.length} phase{tpl.templateData.phases.length !== 1 ? 's' : ''}
                        {tpl.templateData.phases.length > 0 && (
                          <span className="ml-1">— {tpl.templateData.phases.slice(0, 3).map(p => p.name).join(', ')}{tpl.templateData.phases.length > 3 ? '…' : ''}</span>
                        )}
                      </p>
                    </div>
                    <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-0.5" />
                  </div>
                </button>
              ))}
            </>
          )}
        </div>

        {onCancel && (
          <div className="pt-2">
            <Button type="button" variant="ghost" onClick={onCancel} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Show type picker if job type not yet chosen
  if (jobType === null) {
    return (
      <div className="w-full px-6 lg:px-8 py-6 space-y-6" data-testid="page-job-type-picker">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Create New Job</h1>
          <p className="text-sm text-muted-foreground mt-0.5">What kind of job is this?</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          {/* Service Call card */}
          <button
            type="button"
            onClick={() => setJobType('service')}
            data-testid="card-job-type-service"
            className="group text-left p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-md transition-all bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                <Wrench className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">Job</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Simple single-visit jobs — fault finding, repairs, maintenance, and quick call-outs.
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {["Client", "Title", "Schedule", "Notes"].map((f) => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{f}</span>
                  ))}
                </div>
              </div>
            </div>
          </button>

          {/* Project card */}
          <button
            type="button"
            onClick={() => { setJobType('project'); setProjectFlowStep('template-picker'); }}
            data-testid="card-job-type-project"
            className="group text-left p-6 rounded-xl border-2 border-border hover:border-primary hover:shadow-md transition-all bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-muted text-muted-foreground group-hover:bg-muted/80 transition-colors">
                <Layers className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">Project</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Multi-phase work with tracked spend — fit-outs, builds, renovations, and long-running contracts.
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {["Phases", "Budget", "Markup", "POs", "Claims"].map((f) => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{f}</span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        </div>

        {onCancel && (
          <div className="pt-2">
            <Button type="button" variant="ghost" onClick={onCancel} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ─── Reusable form field blocks ───────────────────────────────────────────
  const titleField = (
    <FormField
      control={form.control}
      name="title"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{jobType === 'project' ? 'Project Title' : 'Job Title'}</FormLabel>
          <FormControl>
            <Input
              placeholder={jobType === 'project' ? 'Enter project name' : 'Enter job title'}
              value={field.value || ""}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              data-testid="input-job-title"
            />
          </FormControl>
          <FormMessage />
          {userCheck?.tradeType && tradeCatalog[userCheck.tradeType]?.typicalJobs && !field.value && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tradeCatalog[userCheck.tradeType].typicalJobs.slice(0, 6).map((job: string) => (
                <Badge key={job} variant="secondary" className="cursor-pointer text-xs" onClick={() => form.setValue("title", job, { shouldValidate: true })}>
                  {job}
                </Badge>
              ))}
            </div>
          )}
        </FormItem>
      )}
    />
  );

  const descriptionField = (
    <FormField
      control={form.control}
      name="description"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Description</FormLabel>
          <FormControl>
            <Textarea
              placeholder="Enter description"
              value={field.value || ""}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              data-testid="input-job-description"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const clientField = (
    <FormField
      control={form.control}
      name="clientId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Client</FormLabel>
          <div className="flex gap-2">
            <FormControl>
              <SearchableSelect
                value={field.value}
                onValueChange={(clientId) => {
                  field.onChange(clientId);
                  form.clearErrors('clientId');
                }}
                placeholder="Select a client"
                searchPlaceholder="Search clients..."
                emptyMessage="No clients yet. Add your first client!"
                className="flex-1"
                options={(clients as any[]).map((client) => ({ value: client.id, label: client.name, description: client.phone || undefined }))}
                data-testid="select-client"
              />
            </FormControl>
            {field.value && (
              <Button type="button" variant="outline" size="icon" onClick={() => { field.onChange(""); setLastAutoFilledClientId(null); }} data-testid="button-clear-client" title="Clear selected client">
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button type="button" variant="outline" size="icon" onClick={() => setShowQuickAddClient(true)} data-testid="button-quick-add-client" title="Add new client">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const addressField = (
    <FormField
      control={form.control}
      name="address"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Address</FormLabel>
          <FormControl>
            <AddressAutocomplete value={field.value || ''} onChange={field.onChange} onConfirmedChange={(confirmed) => setAddressConfirmed(confirmed)} placeholder="Start typing an address..." data-testid="input-job-address" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const previousJobsSection = selectedClientId && previousJobs.length > 0 ? (
    <Collapsible open={previousJobsOpen} onOpenChange={setPreviousJobsOpen}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between" data-testid="button-previous-jobs">
          <div className="flex items-center gap-2"><History className="h-4 w-4" /><span>Previous Jobs ({previousJobs.length})</span></div>
          {previousJobsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-2">
        <p className="text-xs text-muted-foreground mb-2">View past jobs and copy notes to this job</p>
        {previousJobs.map((job: any) => (
          <div key={job.id} className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-3 cursor-pointer hover-elevate" onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><span className="font-medium text-sm truncate">{job.title}</span><StatusBadge status={job.status} /></div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1"><Calendar className="h-3 w-3" />{formatJobDate(job.createdAt || job.scheduledAt)}</div>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${expandedJobId === job.id ? 'rotate-180' : ''}`} />
            </div>
            {expandedJobId === job.id && (
              <div className="border-t bg-muted/30 p-3 space-y-3">
                {(job.description || job.notes) ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium flex items-center gap-1"><FileText className="h-3 w-3" />Notes</span>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); handleCopyNotes(job); }} data-testid={`button-copy-notes-${job.id}`}>
                        <Copy className="h-3 w-3 mr-1" />Copy to description
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground bg-background p-2 rounded border max-h-20 overflow-y-auto">{job.description || job.notes}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">No notes for this job</p>
                )}
              </div>
            )}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  ) : null;

  // ─── Project step helpers ──────────────────────────────────────────────────
  const addPhase = () => {
    const nextNum = phases.length + 1;
    const code = `P${String(nextNum).padStart(2, '0')}`;
    setPhases(prev => [...prev, { localId: `new-${Date.now()}`, phaseCode: code, name: '' }]);
  };

  const updatePhase = (localId: string, updates: Partial<ProjectPhase>) => {
    setPhases(prev => prev.map(p => p.localId === localId ? { ...p, ...updates } : p));
  };

  const removePhase = (localId: string) => {
    setPhases(prev => {
      const filtered = prev.filter(p => p.localId !== localId);
      // Re-number phase codes
      return filtered.map((p, i) => ({ ...p, phaseCode: `P${String(i + 1).padStart(2, '0')}` }));
    });
  };

  // ─── Project stepper UI ───────────────────────────────────────────────────
  const renderProjectStepIndicator = () => (
    <div className="flex items-center gap-0 mb-6" role="progressbar" aria-label="Form progress">
      {PROJECT_STEPS.map((step, idx) => {
        const stepIndex = PROJECT_STEPS.findIndex(s => s.id === projectFormStep);
        const isComplete = idx < stepIndex;
        const isActive = step.id === projectFormStep;
        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                isComplete ? 'bg-primary text-primary-foreground' :
                isActive ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
                'bg-muted text-muted-foreground'
              )}>
                {isComplete ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
              </div>
              <span className={cn('text-xs font-medium', isActive ? 'text-primary' : isComplete ? 'text-foreground' : 'text-muted-foreground')}>
                {step.label}
              </span>
            </div>
            {idx < PROJECT_STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 mx-2 mb-4 transition-colors', idx < stepIndex ? 'bg-primary' : 'bg-muted')} />
            )}
          </div>
        );
      })}
    </div>
  );

  // ─── Project step content ─────────────────────────────────────────────────
  const renderProjectStep = () => {
    if (projectFormStep === 'basic') {
      return (
        <div className="space-y-5" data-testid="project-step-basic">
          {titleField}
          {descriptionField}
          {clientField}
          {previousJobsSection}
          {addressField}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="scheduledAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} data-testid="input-scheduled-at" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium">Contract Value ($)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 45000"
                value={budgetedCost}
                onChange={(e) => setBudgetedCost(e.target.value)}
                data-testid="input-budgeted-cost"
              />
              <p className="text-xs text-muted-foreground">Used on the profitability card and progress claims.</p>
            </div>
          </div>
        </div>
      );
    }

    if (projectFormStep === 'phases') {
      return (
        <div className="space-y-5" data-testid="project-step-phases">
          <div>
            <h3 className="text-sm font-semibold mb-1">Project Phases</h3>
            <p className="text-sm text-muted-foreground">Add the phases that make up this project. You can edit them further after creation.</p>
          </div>

          {phases.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-muted p-8 text-center">
              <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">No phases yet</p>
              <p className="text-xs text-muted-foreground mb-4">Add phases below, or load from a saved template.</p>
              <Button type="button" variant="outline" size="sm" onClick={addPhase} data-testid="button-add-first-phase">
                <Plus className="h-4 w-4 mr-1" />Add a Phase
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {phases.map((phase, idx) => (
                <div key={phase.localId} className="rounded-lg border bg-card p-4 space-y-3" data-testid={`phase-row-${idx}`}>
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="w-16 shrink-0">
                      <Input
                        value={phase.phaseCode}
                        onChange={(e) => updatePhase(phase.localId, { phaseCode: e.target.value.toUpperCase().slice(0, 10) })}
                        placeholder="P01"
                        className="text-xs font-mono text-center"
                        data-testid={`phase-code-${idx}`}
                      />
                    </div>
                    <Input
                      value={phase.name}
                      onChange={(e) => updatePhase(phase.localId, { name: e.target.value })}
                      placeholder="Phase name (e.g. Site Preparation)"
                      className="flex-1"
                      data-testid={`phase-name-${idx}`}
                    />
                    <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removePhase(phase.localId)} data-testid={`button-remove-phase-${idx}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Description (optional)</label>
                      <Input
                        value={phase.description || ''}
                        onChange={(e) => updatePhase(phase.localId, { description: e.target.value })}
                        placeholder="Brief description..."
                        className="text-sm"
                        data-testid={`phase-description-${idx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Booked Hours (optional)</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={phase.bookedHours || ''}
                        onChange={(e) => updatePhase(phase.localId, { bookedHours: e.target.value })}
                        placeholder="e.g. 40"
                        className="text-sm"
                        data-testid={`phase-hours-${idx}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {phases.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={addPhase} className="gap-1.5" data-testid="button-add-phase">
              <Plus className="h-4 w-4" />Add Phase
            </Button>
          )}

          {/* Load from template */}
          {projectTemplates.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground px-2">or load from a saved template</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-2">
                {projectTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      setPhases(tpl.templateData.phases.map((p, i) => ({ ...p, localId: `tpl-${tpl.id}-${i}` })));
                      if (tpl.templateData.settings?.materialMarkupPct) setMaterialMarkupPct(tpl.templateData.settings.materialMarkupPct);
                      if (tpl.templateData.settings?.equipmentMarkupPct) setEquipmentMarkupPct(tpl.templateData.settings.equipmentMarkupPct);
                      if (tpl.templateData.settings?.subcontractorMarkupPct) setSubcontractorMarkupPct(tpl.templateData.settings.subcontractorMarkupPct);
                      if (tpl.templateData.settings?.budgetedCost) setBudgetedCost(tpl.templateData.settings.budgetedCost);
                      toast({ title: 'Template loaded', description: `${tpl.templateData.phases.length} phase${tpl.templateData.phases.length !== 1 ? 's' : ''} added from "${tpl.name}"` });
                    }}
                    data-testid={`button-load-template-${tpl.id}`}
                    className="w-full text-left p-3 rounded-lg border hover:border-primary hover:bg-muted/30 transition-colors flex items-center gap-3"
                  >
                    <div className="p-1.5 rounded-md bg-muted shrink-0"><Layers className="h-4 w-4 text-muted-foreground" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tpl.name}</p>
                      <p className="text-xs text-muted-foreground">{tpl.templateData.phases.length} phase{tpl.templateData.phases.length !== 1 ? 's' : ''}{tpl.templateData.phases.length > 0 ? ` — ${tpl.templateData.phases.slice(0, 3).map(p => p.name).join(', ')}${tpl.templateData.phases.length > 3 ? '…' : ''}` : ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // settings step
    return (
      <div className="space-y-5" data-testid="project-step-settings">
        <div>
          <h3 className="text-sm font-semibold mb-1">Project Settings</h3>
          <p className="text-sm text-muted-foreground">Configure retention, defects liability, and markup overrides for this project.</p>
        </div>

        {/* Practical completion date + DLP */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Practical Completion Date
            </label>
            <Input
              type="date"
              value={practicalCompletionDate}
              onChange={(e) => setPracticalCompletionDate(e.target.value)}
              data-testid="input-practical-completion-date"
            />
            <p className="text-xs text-muted-foreground">The date the project reached (or is expected to reach) practical completion.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Defects Liability Period (months)
            </label>
            <Input
              type="number"
              min="0"
              max="120"
              step="1"
              value={defectsLiabilityMonths}
              onChange={(e) => setDefectsLiabilityMonths(e.target.value)}
              data-testid="input-defects-liability-months"
            />
            <p className="text-xs text-muted-foreground">Months after practical completion before retention is due.</p>
          </div>
        </div>

        {/* Markup overrides */}
        <div className="space-y-3 pt-2">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Percent className="h-3.5 w-3.5 text-muted-foreground" />
            Markup overrides (optional — leave blank to use business defaults)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Materials %</label>
              <Input type="number" min="0" max="999" step="0.1" placeholder="e.g. 20" value={materialMarkupPct} onChange={(e) => setMaterialMarkupPct(e.target.value)} data-testid="input-material-markup" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><Wrench className="h-3 w-3" /> Equipment %</label>
              <Input type="number" min="0" max="999" step="0.1" placeholder="e.g. 15" value={equipmentMarkupPct} onChange={(e) => setEquipmentMarkupPct(e.target.value)} data-testid="input-equipment-markup" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Subcontractor %</label>
              <Input type="number" min="0" max="999" step="0.1" placeholder="e.g. 10" value={subcontractorMarkupPct} onChange={(e) => setSubcontractorMarkupPct(e.target.value)} data-testid="input-subcontractor-markup" />
            </div>
          </div>
        </div>

        {/* Priority */}
        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Options */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Checkbox id="requiresInspection" checked={!!form.getValues("requiresInspection")} onCheckedChange={(checked) => form.setValue("requiresInspection", !!checked)} data-testid="checkbox-requires-inspection" />
            <Label htmlFor="requiresInspection" className="flex items-center gap-2 cursor-pointer text-sm"><Search className="w-4 h-4 pointer-events-none" />Requires site inspection first</Label>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full px-6 lg:px-8 py-6 space-y-6" data-testid="page-job-form">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => {
                if (jobType === 'project') {
                  if (projectFormStep !== 'basic') {
                    const steps = PROJECT_STEPS.map(s => s.id);
                    const cur = steps.indexOf(projectFormStep);
                    setProjectFormStep(steps[cur - 1] as ProjectFormStep);
                  } else {
                    setProjectFlowStep('template-picker');
                  }
                } else {
                  setJobType(null);
                }
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-0.5 rounded-full ${jobType === 'project' ? 'bg-muted text-muted-foreground' : 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'}`}>
              {jobType === 'project' ? <Layers className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
              {jobType === 'project' ? 'Project' : 'Job'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">{jobType === 'project' ? 'Create New Project' : 'Create New Job'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Fill in the details to create a new {jobType === 'project' ? 'project' : 'job'}</p>
        </div>
      </div>

      {/* Creating from Quote Banner */}
      {sourceQuote && (
        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg" data-testid="quote-source-banner">
          <FileText className="h-5 w-5 text-green-600" />
          <div className="flex-1">
            <p className="font-medium text-green-800 dark:text-green-300">Creating job from quote {sourceQuote.number}</p>
            <p className="text-sm text-green-700 dark:text-green-400">Job details have been pre-filled from the accepted quote</p>
          </div>
        </div>
      )}

      {jobType === 'project' ? (
        /* ── PROJECT: multi-step form ── */
        <div className="max-w-2xl">
          <Card className="border-muted shadow-sm">
            <CardContent className="p-5 sm:p-7">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  {renderProjectStepIndicator()}
                  {renderProjectStep()}

                  {/* Navigation */}
                  <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4 mt-4 border-t border-border">
                    <div className="flex gap-2">
                      {onCancel && projectFormStep === 'basic' && (
                        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-job">Cancel</Button>
                      )}
                      {projectFormStep !== 'basic' && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const steps = PROJECT_STEPS.map(s => s.id);
                            const cur = steps.indexOf(projectFormStep);
                            setProjectFormStep(steps[cur - 1] as ProjectFormStep);
                          }}
                          data-testid="button-project-back"
                        >
                          <ArrowLeft className="h-4 w-4 mr-1" />Back
                        </Button>
                      )}
                    </div>
                    {projectFormStep !== 'settings' ? (
                      <Button
                        type="button"
                        onClick={async () => {
                          if (projectFormStep === 'basic') {
                            const valid = await form.trigger(['title', 'clientId', 'address']);
                            if (!valid) return;
                            if (!addressConfirmed && form.getValues('address')) {
                              toast({ title: 'Please select an address', description: 'Tap an address from the suggestions to confirm it', variant: 'destructive' });
                              return;
                            }
                          }
                          const steps = PROJECT_STEPS.map(s => s.id);
                          const cur = steps.indexOf(projectFormStep);
                          setProjectFormStep(steps[cur + 1] as ProjectFormStep);
                        }}
                        data-testid="button-project-next"
                      >
                        Next
                        <ArrowLeft className="h-4 w-4 ml-1 rotate-180" />
                      </Button>
                    ) : (
                      <Button type="submit" disabled={createJobMutation.isPending} data-testid="button-submit-job">
                        {createJobMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : 'Create Project'}
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ── SERVICE: flat form (unchanged) ── */
        <div className="flex flex-col lg:flex-row-reverse gap-6 items-start">
          {/* Template Selector */}
          <div className="w-full lg:w-[340px] xl:w-96 shrink-0 lg:sticky lg:top-6">
            <TemplateSelector type="job" onApplyTemplate={handleApplyTemplate} userTradeType={userCheck?.tradeType} data-testid="template-selector-job" />
          </div>

          {/* Job Form */}
          <div className="flex-1 w-full">
            <Card className="border-muted shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="pb-2 border-b"><h3 className="text-base font-semibold">Basic Details</h3></div>
                        {titleField}
                        {descriptionField}
                      </div>

                      <div className="space-y-4 pt-2">
                        <div className="pb-2 border-b"><h3 className="text-base font-semibold">Client & Location</h3></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {clientField}
                          <FormField
                            control={form.control}
                            name="priority"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Priority</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-priority"><SelectValue placeholder="Select priority" /></SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        {previousJobsSection}
                        {addressField}
                      </div>

                      <div className="space-y-4 pt-4">
                        <div className="pb-2 border-b"><h3 className="text-base font-semibold">Schedule & Priority</h3></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="scheduledAt"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Scheduled Date & Time</FormLabel>
                                <FormControl><Input type="datetime-local" {...field} data-testid="input-scheduled-at" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="estimatedHours"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Estimated Hours</FormLabel>
                                <FormControl><Input type="number" placeholder="0" {...field} data-testid="input-estimated-hours" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <div className="space-y-4 pt-4">
                        <div className="pb-2 border-b"><h3 className="text-base font-semibold">Job Options</h3></div>
                        <div className="flex items-center space-x-3 pt-2">
                          <Checkbox id="requiresInspection" checked={!!form.getValues("requiresInspection")} onCheckedChange={(checked) => form.setValue("requiresInspection", !!checked)} data-testid="checkbox-requires-inspection" />
                          <Label htmlFor="requiresInspection" className="flex items-center gap-2 cursor-pointer text-sm"><Search className="w-4 h-4 pointer-events-none" />Requires site inspection first</Label>
                        </div>
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center space-x-3">
                            <Checkbox id="isRecurring" checked={!!form.watch("isRecurring")} onCheckedChange={(checked) => form.setValue("isRecurring", !!checked)} data-testid="checkbox-is-recurring" />
                            <Label htmlFor="isRecurring" className="cursor-pointer text-sm">Recurring job (repeats automatically)</Label>
                          </div>
                          {form.watch("isRecurring") && (
                            <FormField
                              control={form.control}
                              name="recurrencePattern"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Repeats</FormLabel>
                                  <Select value={field.value || "monthly"} onValueChange={field.onChange}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-recurrence-pattern"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {RECURRENCE_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                                    </SelectContent>
                                  </Select>
                                  <p className="text-xs text-muted-foreground">A new copy of this job is created automatically each period.</p>
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 mt-6 border-t border-border">
                      {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-job" className="w-full sm:w-auto">Cancel</Button>
                      )}
                      <Button type="submit" disabled={createJobMutation.isPending} data-testid="button-submit-job" className="w-full sm:w-auto">
                        {createJobMutation.isPending ? "Creating..." : "Create Job"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      
      {/* Subscription Usage Info */}
      {usage && usage.subscriptionTier === 'free' && (
        <UpgradePrompt 
          trigger="job-limit" 
          compact={true}
        />
      )}
      
      {/* Upgrade Prompt Modal */}
      {showUpgradePrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" data-testid="upgrade-modal">
          <div className="bg-background max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg p-6">
            <UpgradePrompt 
              trigger="job-limit"
              onClose={() => setShowUpgradePrompt(false)}
            />
          </div>
        </div>
      )}

      {/* Quick Add Client Sheet */}
      <Sheet open={showQuickAddClient} onOpenChange={setShowQuickAddClient}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Quick Add Client
            </SheetTitle>
            <SheetDescription>
              Add a new client without leaving the job form
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Name *
              </label>
              <Input
                placeholder="e.g. John Smith"
                value={quickClientData.name}
                onChange={(e) => setQuickClientData(prev => ({ ...prev, name: e.target.value }))}
                data-testid="input-quick-client-name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Phone
              </label>
              <Input
                placeholder="e.g. 0412 345 678"
                value={quickClientData.phone}
                onChange={(e) => setQuickClientData(prev => ({ ...prev, phone: e.target.value }))}
                data-testid="input-quick-client-phone"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </label>
              <Input
                type="email"
                placeholder="e.g. john@example.com"
                value={quickClientData.email}
                onChange={(e) => setQuickClientData(prev => ({ ...prev, email: e.target.value }))}
                data-testid="input-quick-client-email"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Address
              </label>
              <Input
                placeholder="e.g. 123 Main St, Sydney NSW 2000"
                value={quickClientData.address}
                onChange={(e) => setQuickClientData(prev => ({ ...prev, address: e.target.value }))}
                data-testid="input-quick-client-address"
              />
              <p className="text-xs text-muted-foreground">
                This will auto-fill the job address
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setQuickClientData({ name: "", email: "", phone: "", address: "" });
                  setShowQuickAddClient(false);
                }}
                data-testid="button-cancel-quick-client"
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleQuickAddClient}
                disabled={createClientMutation.isPending || !quickClientData.name}
                data-testid="button-save-quick-client"
              >
                {createClientMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Client
                  </>
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}