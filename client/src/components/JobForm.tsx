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
import { Plus, User, Phone, Mail, MapPin, Loader2, X, History, Copy, ChevronDown, ChevronUp, Calendar, FileText, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import AddressAutocomplete from "@/components/ui/address-autocomplete";
import { useSearch } from "wouter";
import { tradeCatalog } from "@shared/tradeCatalog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/StatusBadge";

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
          form.setValue("address", selectedClient.address);
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
      // Sort by date descending and limit to 5 most recent
      return jobs
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

  const formatJobDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
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
      const jobData = {
        ...data,
        estimatedHours: data.estimatedHours ? parseInt(data.estimatedHours) : undefined,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : undefined,
        customFields: data.customFields,
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

  return (
    <div className="w-full px-6 lg:px-8 py-6 space-y-6" data-testid="page-job-form">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Create New Job</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Fill in the details to create a new job</p>
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
      
      <div className="flex flex-col lg:flex-row-reverse gap-6 items-start">
        {/* Template Selector */}
        <div className="w-full lg:w-[340px] xl:w-96 shrink-0 lg:sticky lg:top-6">
          <TemplateSelector 
            type="job" 
            onApplyTemplate={handleApplyTemplate}
            userTradeType={userCheck?.tradeType}
            data-testid="template-selector-job"
          />
        </div>
        
        {/* Job Form */}
        <div className="flex-1 w-full">
        <Card className="border-muted shadow-sm">
          <CardContent className="p-4 sm:p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="pb-2 border-b">
                    <h3 className="text-base font-semibold">Basic Details</h3>
                  </div>
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter job title"
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
                          <Badge
                            key={job}
                            variant="secondary"
                            className="cursor-pointer text-xs"
                            onClick={() => form.setValue("title", job, { shouldValidate: true })}
                          >
                            {job}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter job description"
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
              </div>

              <div className="space-y-4 pt-2">
                <div className="pb-2 border-b">
                  <h3 className="text-base font-semibold">Client & Location</h3>
                </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <div className="flex gap-2">
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-client" className="flex-1">
                              <SelectValue placeholder="Select a client" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(clients as any[]).length === 0 ? (
                              <div className="p-3 text-center text-sm text-muted-foreground">
                                No clients yet. Add your first client!
                              </div>
                            ) : (
                              (clients as any[]).map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  <div className="flex flex-col">
                                    <span>{client.name}</span>
                                    {client.phone && (
                                      <span className="text-xs text-muted-foreground">{client.phone}</span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {field.value && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              field.onChange("");
                              setLastAutoFilledClientId(null);
                            }}
                            data-testid="button-clear-client"
                            title="Clear selected client"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setShowQuickAddClient(true)}
                          data-testid="button-quick-add-client"
                          title="Add new client"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              </div>

              {/* Previous Jobs Section - Shows when client is selected */}
              {selectedClientId && previousJobs.length > 0 && (
                <Collapsible open={previousJobsOpen} onOpenChange={setPreviousJobsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between"
                      data-testid="button-previous-jobs"
                    >
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        <span>Previous Jobs ({previousJobs.length})</span>
                      </div>
                      {previousJobsOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground mb-2">
                      View past jobs and copy notes to this job
                    </p>
                    {previousJobs.map((job: any) => (
                      <div
                        key={job.id}
                        className="border rounded-lg overflow-hidden"
                      >
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer hover-elevate"
                          onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{job.title}</span>
                              <StatusBadge status={job.status} />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3" />
                              {formatJobDate(job.createdAt || job.scheduledAt)}
                            </div>
                          </div>
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedJobId === job.id ? 'rotate-180' : ''}`} />
                        </div>
                        
                        {expandedJobId === job.id && (
                          <div className="border-t bg-muted/30 p-3 space-y-3">
                            {/* Job Notes/Description */}
                            {(job.description || job.notes) && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    Notes
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyNotes(job);
                                    }}
                                    data-testid={`button-copy-notes-${job.id}`}
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    Copy to description
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground bg-background p-2 rounded border max-h-20 overflow-y-auto">
                                  {job.description || job.notes}
                                </p>
                              </div>
                            )}
                            
                            {!job.description && !job.notes && (
                              <p className="text-xs text-muted-foreground text-center py-2">
                                No notes for this job
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <AddressAutocomplete 
                        value={field.value || ''} 
                        onChange={field.onChange}
                        onConfirmedChange={(confirmed) => setAddressConfirmed(confirmed)}
                        placeholder="Start typing an address..." 
                        data-testid="input-job-address" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>

              <div className="space-y-4 pt-4">
                <div className="pb-2 border-b">
                  <h3 className="text-base font-semibold">Schedule & Priority</h3>
                </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="scheduledAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scheduled Date & Time</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local" 
                          {...field} 
                          data-testid="input-scheduled-at" 
                        />
                      </FormControl>
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
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field} 
                          data-testid="input-estimated-hours" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              </div>

              <div className="space-y-4 pt-4">
                <div className="pb-2 border-b">
                  <h3 className="text-base font-semibold">Job Options</h3>
                </div>
              <div className="flex items-center space-x-3 pt-2">
                <Checkbox
                  id="requiresInspection"
                  checked={!!form.getValues("requiresInspection")}
                  onCheckedChange={(checked) => form.setValue("requiresInspection", !!checked)}
                  data-testid="checkbox-requires-inspection"
                />
                <Label htmlFor="requiresInspection" className="flex items-center gap-2 cursor-pointer text-sm">
                  <Search className="w-4 h-4" />
                  Requires site inspection first
                </Label>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="isRecurring"
                    checked={!!form.watch("isRecurring")}
                    onCheckedChange={(checked) => form.setValue("isRecurring", !!checked)}
                    data-testid="checkbox-is-recurring"
                  />
                  <Label htmlFor="isRecurring" className="cursor-pointer text-sm">
                    Recurring job (repeats automatically)
                  </Label>
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
                            <SelectTrigger data-testid="select-recurrence-pattern">
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RECURRENCE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          A new copy of this job is created automatically each period.
                        </p>
                      </FormItem>
                    )}
                  />
                )}
              </div>
              </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6 mt-6 border-t border-border">
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-job" className="w-full sm:w-auto">
                    Cancel
                  </Button>
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