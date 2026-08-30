import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useForm, useWatch, useFieldArray } from "react-hook-form";
import { calculateDocumentTotals } from "@shared/financials";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearch, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useClients, useCreateClient } from "@/hooks/use-clients";
import { useCreateQuote } from "@/hooks/use-quotes";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useFeatureAccess } from "@/hooks/use-subscription";
import { useDocumentTemplates, type DocumentTemplate } from "@/hooks/use-templates";
import { useQuery } from "@tanstack/react-query";
import { queryClient, getSessionToken, getAuthHeaders} from "@/lib/queryClient";
import LiveDocumentPreview from "./LiveDocumentPreview";
import type { StylePreset } from "@shared/schema";
import { TemplateCustomization, DOCUMENT_TEMPLATES, TemplateId } from "@/lib/document-templates";
import CatalogModal from "@/components/CatalogModal";
import PriceListModal from "@/components/PriceListModal";
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Eye,
  FileText,
  User,
  Calendar,
  Package,
  BookOpen,
  ChevronLeft,
  Check,
  DollarSign,
  Percent,
  Briefcase,
  Sparkles,
  Palette,
  Search,
  UserPlus,
  Tag,
  ClipboardList,
} from "lucide-react";
import AIQuoteGenerator from "@/components/AIQuoteGenerator";

const lineItemSchema = z.object({
  itemCode: z.string().optional(),
  description: z.string().min(1, "Description required"),
  quantity: z.string().min(1, "Quantity required"),
  unitPrice: z.string().min(1, "Price required"),
  cost: z.string().optional(), // Cost for profit margin calculation
});

const quoteFormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  validUntil: z.string().min(1, "Valid until date is required"),
  notes: z.string().optional(),
  gstEnabled: z.boolean().default(true),
  depositRequired: z.boolean().default(false),
  depositPercent: z.number().min(0).max(100).default(50),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item required"),
});

type QuoteFormData = z.infer<typeof quoteFormSchema>;

interface LiveQuoteEditorProps {
  quoteId?: string;
  onSave?: (quoteId: string) => void;
  onCancel?: () => void;
}

export default function LiveQuoteEditor({ quoteId: editQuoteId, onSave, onCancel }: LiveQuoteEditorProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: clients = [] } = useClients();
  const { data: businessSettings } = useBusinessSettings();
  const { canUseAIFeatures } = useFeatureAccess();
  const createQuoteMutation = useCreateQuote();
  const isEditMode = !!editQuoteId;
  
  // Read jobId and clientId from URL query parameters (e.g., /quotes/new?jobId=123 or /quotes/new?clientId=456)
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlJobId = urlParams.get('jobId');
  const urlClientId = urlParams.get('clientId');
  
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ itemCode: "", description: "", quantity: "1", unitPrice: "", cost: "" });
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [priceListOpen, setPriceListOpen] = useState(false);
  const [showMarginMode, setShowMarginMode] = useState(false);
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(urlJobId || undefined);
  const [jobAutoLoaded, setJobAutoLoaded] = useState(false);
  const [aiQuoteOpen, setAiQuoteOpen] = useState(false);
  const [isGeneratingFromTasks, setIsGeneratingFromTasks] = useState(false);
  const [quickAddClientOpen, setQuickAddClientOpen] = useState(false);
  const [quickClientName, setQuickClientName] = useState("");
  const [quickClientEmail, setQuickClientEmail] = useState("");
  const [quickClientPhone, setQuickClientPhone] = useState("");
  
  
  const createClient = useCreateClient();

  const { data: editQuoteData } = useQuery({
    queryKey: ['/api/quotes', editQuoteId],
    enabled: isEditMode,
  });

  const [editLoaded, setEditLoaded] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);

  const { data: userCheck } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
    retry: false,
    staleTime: 30000,
  });

  // Fetch job data if jobId is provided in URL
  const { data: preloadedJob, isLoading: jobLoading } = useQuery({
    queryKey: ['/api/jobs', urlJobId],
    enabled: !!urlJobId && !jobAutoLoaded,
  });

  // Use effective job ID that considers both URL param and selected state
  // This ensures signatures load immediately when coming from URL before effect runs
  const effectiveJobId = selectedJobId || urlJobId;

  // Fetch job signatures if a job is selected (or loaded from URL)
  const { data: jobSignatures = [] } = useQuery<any[]>({
    queryKey: ['/api/jobs', effectiveJobId, 'signatures'],
    enabled: !!effectiveJobId,
  });

  // Fetch style presets to get the default style for the preview
  const { data: stylePresets = [] } = useQuery<StylePreset[]>({
    queryKey: ['/api/style-presets'],
  });

  // Get the default style preset for preview styling
  const defaultStylePreset = stylePresets.find((p) => p.isDefault) || stylePresets[0];

  // Fetch document templates for template selector
  const { data: documentTemplates = [] } = useDocumentTemplates('quote');
  
  // Fetch quote templates for unified search
  const { data: quoteTemplates = [] } = useQuery<any[]>({
    queryKey: ['/api/quote-templates'],
  });
  
  // Track selected document template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateSource, setSelectedTemplateSource] = useState<'document' | 'quote' | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  
  // Merge document templates and quote templates into a unified searchable list
  const allSearchableTemplates = useMemo(() => {
    const docTemplates = documentTemplates.map(t => ({ ...t, _source: 'document' as const }));
    const qtTemplates = quoteTemplates.map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      tradeType: t.tradeType || 'general',
      items: t.items,
      _source: 'quote' as const,
    }));
    return [...docTemplates, ...qtTemplates];
  }, [documentTemplates, quoteTemplates]);

  // Filter templates by search across both types
  const filteredTemplates = allSearchableTemplates.filter(template => {
    if (!templateSearch.trim()) return true;
    const search = templateSearch.toLowerCase();
    return template.name.toLowerCase().includes(search) || 
           template.tradeType?.toLowerCase().includes(search) ||
           ('description' in template && !!template.description && template.description.toLowerCase().includes(search));
  });

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      clientId: "",
      title: "",
      description: "",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "",
      gstEnabled: true,
      depositRequired: false,
      depositPercent: 50,
      lineItems: [],
    },
  });

  // Use useState for line items - now that Router is fixed, this should work correctly
  const [lineItems, setLineItems] = useState<Array<{ itemCode?: string; description: string; quantity: string; unitPrice: string; cost?: string }>>([]);
  
  // Sync line items to form for submission
  useEffect(() => {
    form.setValue("lineItems", lineItems);
  }, [lineItems, form]);

  useEffect(() => {
    if (!isEditMode || editLoaded || !editQuoteData) return;
    const q = editQuoteData as any;
    form.reset({
      clientId: q.clientId || "",
      title: q.title || "",
      description: q.description || "",
      validUntil: q.validUntil ? new Date(q.validUntil).toISOString().split('T')[0] : "",
      notes: q.notes || "",
      gstEnabled: q.gstEnabled !== undefined ? q.gstEnabled : (businessSettings?.gstEnabled ?? true),
      depositRequired: q.depositRequired || false,
      depositPercent: q.depositPercent ? Number(q.depositPercent) : 50,
      lineItems: (q.lineItems || []).map((li: any) => ({
        itemCode: li.itemCode || "",
        description: li.description || "",
        quantity: String(li.quantity || "1"),
        unitPrice: String(li.unitPrice || "0"),
        cost: li.cost ? String(li.cost) : "",
      })),
    });
    setLineItems((q.lineItems || []).map((li: any) => ({
      itemCode: li.itemCode || "",
      description: li.description || "",
      quantity: String(li.quantity || "1"),
      unitPrice: String(li.unitPrice || "0"),
      cost: li.cost ? String(li.cost) : "",
    })));
    if (q.jobId) setSelectedJobId(q.jobId);
    setEditLoaded(true);
    setJobAutoLoaded(true);
  }, [isEditMode, editQuoteData, editLoaded]);

  // Line item management functions
  const appendLineItem = (item: { itemCode?: string; description: string; quantity: string; unitPrice: string; cost?: string }) => {
    setLineItems(prev => [...prev, item]);
  };
  
  const removeLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };
  
  const updateLineItem = (index: number, item: any) => {
    setLineItems(prev => prev.map((existing, i) => i === index ? item : existing));
  };
  
  const replaceLineItems = (items: Array<{ itemCode?: string; description: string; quantity: string; unitPrice: string; cost?: string }>) => {
    setLineItems(items);
  };

  useEffect(() => {
    if (!isEditMode && businessSettings && businessSettings.gstEnabled !== undefined) {
      form.setValue("gstEnabled", businessSettings.gstEnabled);
    }
  }, [businessSettings?.gstEnabled, isEditMode]);

  // Auto-fill form when job is loaded from URL parameter
  useEffect(() => {
    if (preloadedJob && !jobAutoLoaded && (clients as any[]).length > 0) {
      setJobAutoLoaded(true);
      const job = preloadedJob as any;
      
      // Set client
      if (job.clientId) {
        form.setValue("clientId", job.clientId);
      }
      
      // Set title and description from job
      form.setValue("title", job.title || "");
      form.setValue("description", job.description || "");
      
      toast({
        title: "Job details loaded",
        description: `Creating quote for "${job.title}"`,
      });
    }
  }, [preloadedJob, jobAutoLoaded, clients, form, toast]);

  // Use form.watch() for general form values
  const watchedValues = form.watch();
  const selectedClient = (clients as any[]).find(c => c.id === watchedValues.clientId);

  // Prefill form from selected job (and optionally copy from existing quote)
  const handleSelectJob = (job: any, linkedDocument?: any) => {
    setSelectedJobId(job.id);
    
    // Set client
    if (job.client?.id) {
      form.setValue("clientId", job.client.id);
    }
    
    // If job already has a linked quote, copy from it
    if (linkedDocument) {
      form.setValue("title", linkedDocument.title || job.title || "");
      form.setValue("description", linkedDocument.description || job.description || "");
      form.setValue("notes", linkedDocument.notes || linkedDocument.terms || "");
      
      if (linkedDocument.depositPercent) {
        form.setValue("depositRequired", true);
        form.setValue("depositPercent", linkedDocument.depositPercent);
      }
      
      // Copy line items from existing quote
      if (linkedDocument.lineItems && linkedDocument.lineItems.length > 0) {
        const items = linkedDocument.lineItems.map((item: any) => ({
          description: item.description || "",
          quantity: String(item.quantity || item.qty || 1),
          unitPrice: String(item.unitPrice || 0),
          cost: "",
        }));
        // Clear existing and add new items using useFieldArray's replace
        replaceLineItems(items);
      }
      
      toast({
        title: "Copied from existing quote",
        description: `Quote data copied from "${job.title}"`,
      });
      return;
    }
    
    // Otherwise, create from job details
    form.setValue("title", job.title || "");
    form.setValue("description", job.description || "");
    
    // Clear existing line items using useFieldArray's replace
    replaceLineItems([]);
    
    // If job has time tracking, add a labor line item
    if (job.timeTracking?.totalHours > 0) {
      const hourlyRate = businessSettings?.defaultHourlyRate || 85;
      replaceLineItems([{
        description: `Labour - ${job.title}`,
        quantity: String(job.timeTracking.totalHours),
        unitPrice: String(hourlyRate),
        cost: "",
      }]);
    }
    
    toast({
      title: "Job loaded",
      description: `Quote prefilled from "${job.title}"`,
    });
  };

  // Auto-fill client when coming from client detail page
  useEffect(() => {
    if (urlClientId && (clients as any[]).length > 0 && !form.getValues("clientId")) {
      const clientExists = (clients as any[]).some(c => String(c.id) === urlClientId);
      if (clientExists) {
        form.setValue("clientId", urlClientId);
      }
    }
  }, [urlClientId, clients, form]);

  // Track the last auto-generated title so we never overwrite a user's custom edit.
  const lastAutoTitleRef = useRef<string>("");

  const formatAutoQuoteTitle = useCallback((clientName: string): string => {
    const tz = businessSettings?.timezone || "Australia/Sydney";
    let datePart: string;
    try {
      datePart = new Intl.DateTimeFormat("en-AU", {
        timeZone: tz,
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date());
    } catch {
      datePart = new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Sydney",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date());
    }
    // Normalise to "DD Mon YYYY" (strip stray commas some locales add)
    datePart = datePart.replace(/,/g, "").trim();
    return `Quote for ${clientName} – ${datePart}`;
  }, [businessSettings?.timezone]);

  // Auto-fill the title when a client is selected (or changed via quick-add).
  // Never clobber a custom title the user has typed.
  const watchedClientId = watchedValues.clientId;
  useEffect(() => {
    if (isEditMode) return; // Don't touch titles on existing quotes
    if (!watchedClientId) return;
    const client = (clients as any[]).find(c => c.id === watchedClientId);
    if (!client?.name) return;
    const nextAuto = formatAutoQuoteTitle(client.name);
    const currentTitle = form.getValues("title") || "";
    if (currentTitle === "" || currentTitle === lastAutoTitleRef.current) {
      if (currentTitle !== nextAuto) {
        form.setValue("title", nextAuto, { shouldDirty: false });
      }
      lastAutoTitleRef.current = nextAuto;
    }
  }, [watchedClientId, clients, isEditMode, form, formatAutoQuoteTitle]);

  const handleApplyTemplate = (template: DocumentTemplate) => {
    // Update scalar form values using setValue
    if (template.defaults?.title) {
      form.setValue("title", template.defaults.title);
    }
    if (template.defaults?.description) {
      form.setValue("description", template.defaults.description);
    }
    if (template.defaults?.terms) {
      form.setValue("notes", template.defaults.terms);
    }
    if (template.defaults?.depositPct) {
      form.setValue("depositRequired", true);
      form.setValue("depositPercent", template.defaults.depositPct);
    }
    
    if (template.defaultLineItems && template.defaultLineItems.length > 0) {
      const newLineItems = template.defaultLineItems.map((item: any) => ({
        description: item.description || "",
        quantity: String(item.qty || 1),
        unitPrice: item.unitPrice > 0 ? String(item.unitPrice) : "",
        cost: "",
      }));
      replaceLineItems(newLineItems);
    }
    
    setTemplateSheetOpen(false);
    toast({
      title: "Template applied",
      description: `"${template.name}" template has been applied`,
    });
  };

  const handleGenerateFromTasks = async () => {
    const jobId = selectedJobId || urlJobId;
    if (!jobId) return;
    setIsGeneratingFromTasks(true);
    try {
      const token = getSessionToken();
      const res = await fetch(`/api/jobs/${jobId}/generate-from-tasks`, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate from tasks');
      }
      const data = await res.json();
      const allItems = [
        ...(data.taskItems || []).map((t: any) => ({
          itemCode: '',
          description: t.description,
          quantity: t.quantity,
          unitPrice: t.unitPrice,
          cost: '',
        })),
        ...(data.materialItems || []).map((m: any) => ({
          itemCode: '',
          description: m.description,
          quantity: m.quantity,
          unitPrice: m.unitPrice,
          cost: '',
        })),
      ];
      if (allItems.length === 0) {
        toast({
          title: 'No tasks found',
          description: 'This job has no tasks yet. Add tasks to the job first.',
        });
        return;
      }
      // Append to any existing line items so nothing already entered is lost
      replaceLineItems([...lineItems, ...allItems]);
      toast({
        title: 'Tasks added',
        description: `${data.taskCount} task${data.taskCount !== 1 ? 's' : ''}${data.materialItems?.length > 0 ? ` + ${data.materialItems.length} material${data.materialItems.length !== 1 ? 's' : ''}` : ''} added as line items. Review and adjust before sending.`,
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Could not generate from tasks',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingFromTasks(false);
    }
  };

  const handleAddLineItem = () => {
    setEditForm({ itemCode: "", description: "", quantity: "1", unitPrice: "", cost: "" });
    setEditingLineIndex(-1);
  };

  const handleEditLineItem = (index: number) => {
    const item = lineItems[index];
    setEditForm({
      itemCode: item.itemCode || "",
      description: item.description || "",
      quantity: String(item.quantity || "1"),
      unitPrice: String(item.unitPrice || ""),
      cost: String(item.cost || "")
    });
    setEditingLineIndex(index);
  };

  const handleSaveLineItem = () => {
    if (!editForm.description.trim()) {
      toast({
        title: "Description required",
        description: "Please enter a description for this item",
        variant: "destructive"
      });
      return;
    }

    if (!editForm.unitPrice || parseFloat(editForm.unitPrice) <= 0) {
      toast({
        title: "Unit price required",
        description: "Please enter a unit price greater than $0",
        variant: "destructive"
      });
      return;
    }

    if (editingLineIndex === -1) {
      appendLineItem(editForm);
    } else if (editingLineIndex !== null) {
      updateLineItem(editingLineIndex, editForm);
    }
    setEditingLineIndex(null);
  };

  const handleCatalogSelect = (item: any) => {
    // Use name as the description (what user sees as title), fallback to description if name is empty
    const itemDescription = item.name || item.description || 'Service item';
    
    // Create the new item
    const newItem = {
      itemCode: item.itemCode || "",
      description: itemDescription,
      quantity: String(item.defaultQuantity || 1),
      unitPrice: String(item.unitPrice || 0),
      cost: "",
    };
    
    console.log('[CatalogSelect] Adding item:', itemDescription);
    
    // Append the item first - this is critical
    appendLineItem(newItem);
    
    console.log('[CatalogSelect] appendLineItem called, form has:', form.getValues("lineItems").length, 'items');
    
    // Then close the modal and show toast
    setCatalogOpen(false);
    
    toast({
      title: "Item added",
      description: `"${itemDescription}" added to quote`,
    });
  };

  const handlePriceListSelect = (item: any) => {
    // If the saved price already includes GST, convert to ex-GST before inserting
    // so the document's own GST calculation doesn't double-charge.
    const savedPrice = parseFloat(item.unitPrice || 0);
    const basePrice = item.gstIncluded ? savedPrice / 1.1 : savedPrice;
    const markupPct = item.itemType === 'material'
      ? parseFloat((businessSettings as any)?.defaultMaterialMarkupPct || '0')
      : 0;
    const appliedPrice = markupPct > 0 ? basePrice * (1 + markupPct / 100) : basePrice;
    const desc = item.name + (item.description ? ` — ${item.description}` : '');
    appendLineItem({
      description: desc,
      quantity: String(item.defaultQuantity || 1),
      unitPrice: appliedPrice.toFixed(2),
      cost: "",
    });
    setPriceListOpen(false);
    toast({ title: "Item added", description: `"${item.name}" added to quote` });
  };

  const handleQuickAddClient = async () => {
    if (!quickClientName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a client name",
        variant: "destructive",
      });
      return;
    }

    try {
      const newClient = await createClient.mutateAsync({
        name: quickClientName.trim(),
        email: quickClientEmail.trim() || undefined,
        phone: quickClientPhone.trim() || undefined,
      });
      
      form.setValue("clientId", newClient.id);
      setQuickAddClientOpen(false);
      setQuickClientName("");
      setQuickClientEmail("");
      setQuickClientPhone("");
      
      toast({
        title: "Client created",
        description: `${newClient.name} has been added`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create client",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const calculateTotal = (quantity: string, unitPrice: string) => {
    return (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);
  };

  const calculateItemCost = (quantity: string, cost: string) => {
    return (parseFloat(quantity) || 0) * (parseFloat(cost) || 0);
  };

  const calculateItemMargin = (quantity: string, unitPrice: string, cost: string) => {
    const revenue = calculateTotal(quantity, unitPrice);
    const totalCost = calculateItemCost(quantity, cost);
    if (revenue === 0) return 0;
    return ((revenue - totalCost) / revenue) * 100;
  };

  const quoteGstEnabled = watchedValues.gstEnabled ?? true;
  const { subtotal, gstAmount: gst, total } = calculateDocumentTotals(
    lineItems.map(item => ({
      quantity: parseFloat(item.quantity) || 0,
      unitPrice: parseFloat(item.unitPrice) || 0,
    })),
    quoteGstEnabled ? 0.1 : 0
  );
  
  // Profit margin calculations
  const totalCost = lineItems.reduce(
    (sum, item) => sum + calculateItemCost(item.quantity, item.cost || "0"), 
    0
  );
  const grossProfit = subtotal - totalCost;
  const profitMargin = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;
  const hasCostData = lineItems.some(item => item.cost && parseFloat(item.cost) > 0);

  const handleSubmit = async (data: QuoteFormData) => {
    try {
      const quoteData: any = {
        clientId: data.clientId,
        jobId: selectedJobId || urlJobId || null,
        title: data.title,
        description: data.description,
        validUntil: new Date(data.validUntil),
        notes: data.notes,
        subtotal: subtotal.toFixed(2),
        gstEnabled: data.gstEnabled,
        gstAmount: gst.toFixed(2),
        total: total.toFixed(2),
        depositRequired: data.depositRequired,
        depositPercent: data.depositRequired ? String(data.depositPercent) : null,
        depositAmount: data.depositRequired ? (total * (data.depositPercent / 100)).toFixed(2) : null,
        lineItems: data.lineItems.map(item => ({
          itemCode: item.itemCode?.trim() || null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: (parseFloat(item.quantity || "0") * parseFloat(item.unitPrice || "0")).toFixed(2),
          cost: item.cost && parseFloat(item.cost) > 0 ? item.cost : null,
        })),
      };

      if (isEditMode && editQuoteId) {
        setIsEditSaving(true);
        try {
          const token = getSessionToken();
          const res = await fetch(`/api/quotes/${editQuoteId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(quoteData),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to update quote');
          }

          queryClient.invalidateQueries({ queryKey: ['/api/quotes', editQuoteId] });
          queryClient.invalidateQueries({ queryKey: ['/api/quotes', editQuoteId, 'versions'] });
          queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
          const jobIdToInvalidate = selectedJobId || urlJobId;
          if (jobIdToInvalidate) {
            queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobIdToInvalidate, 'linked-documents'] });
          }

          toast({
            title: "Quote updated",
            description: "Your changes have been saved",
          });

          onSave?.(editQuoteId);
        } finally {
          setIsEditSaving(false);
        }
        return;
      }

      const result = await createQuoteMutation.mutateAsync(quoteData);
      
      const jobIdToInvalidate = selectedJobId || urlJobId;
      if (jobIdToInvalidate) {
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobIdToInvalidate, 'linked-documents'] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobIdToInvalidate] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      
      toast({
        title: "Quote created!",
        description: "Your quote has been saved successfully",
      });

      onSave?.(result.id);
    } catch (error) {
      console.error("Error saving quote:", error);
      toast({
        title: "Error",
        description: isEditMode ? "Failed to update quote. Please try again." : "Failed to create quote. Please try again.",
        variant: "destructive",
      });
    }
  };

  const gstEnabled = businessSettings?.gstEnabled ?? true;

  const businessInfo = {
    businessName: businessSettings?.businessName,
    abn: businessSettings?.abn,
    address: businessSettings?.address,
    phone: businessSettings?.phone,
    email: businessSettings?.email,
    logoUrl: businessSettings?.logoUrl,
    brandColor: userCheck?.user?.tradeColor,
  };

  const clientInfo = selectedClient ? {
    name: selectedClient.name,
    email: selectedClient.email,
    phone: selectedClient.phone,
    address: selectedClient.address,
  } : null;

  const previewLineItems = lineItems.map(item => ({
    itemCode: item.itemCode?.trim() || undefined,
    description: item.description,
    quantity: parseFloat(item.quantity) || 0,
    unitPrice: parseFloat(item.unitPrice) || 0,
  }));

  return (
    <div className="h-full flex flex-col">
      {/* Mobile Tab Switcher - Made more noticeable */}
      <div className="lg:hidden border-b-2 bg-card sticky top-0 z-10 shadow-sm">
        <Tabs value={mobileView} onValueChange={(v) => setMobileView(v as 'edit' | 'preview')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 gap-1 p-1.5 bg-muted/60">
            <TabsTrigger 
              value="edit" 
              className="gap-2 font-semibold rounded-lg data-[state=active]:shadow-md transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger 
              value="preview" 
              className="gap-2 font-semibold rounded-lg data-[state=active]:shadow-md transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Desktop: Side-by-side layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Form Panel */}
        <div className={`flex-1 overflow-auto p-4 lg:p-6 ${mobileView === 'preview' ? 'hidden lg:block' : ''}`}>
          <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 max-w-xl mx-auto lg:mx-0">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onCancel}
                  className="rounded-xl"
                  data-testid="button-back"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <h1 className="ios-title">New Quote</h1>
              </div>
              <Badge 
                className="px-3 py-1.5 text-xs font-semibold"
                style={{ 
                  backgroundColor: 'hsl(var(--trade) / 0.1)', 
                  color: 'hsl(var(--trade))',
                  border: 'none'
                }}
              >
                {formatCurrency(total)}
              </Badge>
            </div>


            {/* Client Selection */}
            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                    Client
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuickAddClientOpen(!quickAddClientOpen)}
                    className="text-xs"
                    data-testid="btn-quick-add-client"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Quick Add
                  </Button>
                </div>

                {/* Quick Add Client Form */}
                {quickAddClientOpen && (
                  <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
                    <div className="text-xs font-medium text-muted-foreground">New Client</div>
                    <Input
                      placeholder="Client name *"
                      value={quickClientName}
                      onChange={(e) => setQuickClientName(e.target.value)}
                      data-testid="input-quick-client-name"
                    />
                    <Input
                      placeholder="Email (optional)"
                      type="email"
                      value={quickClientEmail}
                      onChange={(e) => setQuickClientEmail(e.target.value)}
                      data-testid="input-quick-client-email"
                    />
                    <Input
                      placeholder="Phone (optional)"
                      type="tel"
                      value={quickClientPhone}
                      onChange={(e) => setQuickClientPhone(e.target.value)}
                      data-testid="input-quick-client-phone"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setQuickAddClientOpen(false);
                          setQuickClientName("");
                          setQuickClientEmail("");
                          setQuickClientPhone("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="flex-1"
                        onClick={handleQuickAddClient}
                        disabled={createClient.isPending || !quickClientName.trim()}
                        data-testid="btn-save-quick-client"
                      >
                        {createClient.isPending ? "Saving..." : "Add Client"}
                      </Button>
                    </div>
                  </div>
                )}

                <Select
                  value={watchedValues.clientId}
                  onValueChange={(value) => form.setValue("clientId", value)}
                >
                  <SelectTrigger className="rounded-xl" data-testid="select-client">
                    <SelectValue placeholder="Tap to select a client..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {(clients as any[]).map((client) => (
                      <SelectItem 
                        key={client.id} 
                        value={client.id}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                            style={{ 
                              backgroundColor: 'hsl(var(--primary) / 0.1)',
                              color: 'hsl(var(--primary))'
                            }}
                          >
                            {client.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{client.name}</div>
                            {client.email && (
                              <div className="text-xs text-muted-foreground truncate">{client.email}</div>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.clientId && (
                  <p className="text-xs text-destructive">{form.formState.errors.clientId.message}</p>
                )}
              </CardContent>
            </Card>

            {/* Quote Details */}
            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Quote Details
                </div>

                {/* Unified Template Selector with Search (Job + Quote templates) */}
                {(documentTemplates.length > 0 || quoteTemplates.length > 0) && (
                  <div className="relative">
                    <Label className="text-xs text-muted-foreground">Template</Label>
                    
                    {selectedTemplateId && !templateSearch && (
                      <div className="flex items-center gap-2 mt-1 p-3 rounded-xl border bg-muted/30">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium flex-1">
                          {allSearchableTemplates.find(t => t.id === selectedTemplateId)?.name}
                        </span>
                        <Badge variant={selectedTemplateSource === 'document' ? 'default' : 'outline'} className="text-xs">
                          {selectedTemplateSource === 'document' ? 'Job' : 'Quote'}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {allSearchableTemplates.find(t => t.id === selectedTemplateId)?.tradeType}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedTemplateId(null);
                            setSelectedTemplateSource(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    {!selectedTemplateId && (
                      <div className="relative mt-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                        <Input
                          placeholder="Search job & quote templates..."
                          value={templateSearch}
                          onChange={(e) => {
                            setTemplateSearch(e.target.value);
                            setShowTemplateDropdown(true);
                          }}
                          onFocus={() => setShowTemplateDropdown(true)}
                          onBlur={() => setTimeout(() => setShowTemplateDropdown(false), 200)}
                          className="h-12 rounded-xl pl-10"
                          data-testid="input-template-search"
                        />
                        {templateSearch && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 z-10"
                            onClick={() => {
                              setTemplateSearch("");
                              setShowTemplateDropdown(false);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                    {showTemplateDropdown && filteredTemplates.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-lg z-50 max-h-[300px] overflow-y-auto bg-background border-border">
                        {filteredTemplates.map((template) => (
                          <div
                            key={`${template._source}-${template.id}`}
                            className="p-3 cursor-pointer border-b last:border-b-0 border-border hover-elevate overflow-visible flex items-center justify-between gap-2"
                            onClick={() => {
                              setSelectedTemplateId(template.id);
                              setSelectedTemplateSource(template._source);
                              setTemplateSearch("");
                              setShowTemplateDropdown(false);
                              if (template._source === 'document') {
                                handleApplyTemplate(template as DocumentTemplate);
                              } else {
                                const items = Array.isArray(template.items) ? (template.items as any[]) : [];
                                const lineItemsFromTemplate = items
                                  .filter((item: any) => item.description || item.label)
                                  .map((item: any) => ({
                                    description: item.description || item.label || "",
                                    quantity: String(item.quantity || item.qty || item.defaultQty || 1),
                                    unitPrice: String(item.unitPrice || item.estimatedPrice || item.price || 0),
                                    cost: "",
                                  }));
                                if (lineItemsFromTemplate.length > 0) {
                                  lineItemsFromTemplate.forEach((item: any) => appendLineItem(item));
                                  toast({
                                    title: "Template applied",
                                    description: `Added ${lineItemsFromTemplate.length} items from "${template.name}"`,
                                  });
                                }
                              }
                            }}
                            data-testid={`template-option-${template.id}`}
                          >
                            <span className="font-medium text-sm">{template.name}</span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Badge variant={template._source === 'document' ? 'default' : 'outline'} className="text-xs">
                                {template._source === 'document' ? 'Job' : 'Quote'}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {template.tradeType}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {showTemplateDropdown && templateSearch && filteredTemplates.length === 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-lg z-50 p-3 text-sm text-muted-foreground bg-background border-border">
                        No templates match your search
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <Label htmlFor="title" className="text-xs text-muted-foreground">Title</Label>
                  <Input
                    id="title"
                    {...form.register("title")}
                    placeholder="e.g., Bathroom Renovation"
                    className="h-12 rounded-xl mt-1"
                    data-testid="input-title"
                  />
                  {form.formState.errors.title && (
                    <p className="text-xs text-destructive mt-1">{form.formState.errors.title.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description" className="text-xs text-muted-foreground">Description (optional)</Label>
                  <Textarea
                    id="description"
                    {...form.register("description")}
                    placeholder="Brief description of the work..."
                    className="rounded-xl mt-1 min-h-[80px]"
                    data-testid="input-description"
                  />
                </div>

                <div>
                  <Label htmlFor="validUntil" className="text-xs text-muted-foreground">Valid Until</Label>
                  <div className="relative mt-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="validUntil"
                      type="date"
                      {...form.register("validUntil")}
                      className="h-12 rounded-xl pl-10"
                      data-testid="input-valid-until"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Package className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                    Line Items
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {lineItems.length} {lineItems.length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>

                {/* Item list - use useFieldArray fields for reliable re-rendering */}
                <div className="space-y-2" key={`line-items-${lineItems.length}`}>
                  {lineItems.map((item, index) => {
                    const itemTotal = calculateTotal(item?.quantity || "0", item?.unitPrice || "0");
                    const itemMargin = item?.cost && parseFloat(item.cost) > 0 
                      ? calculateItemMargin(item.quantity, item.unitPrice, item.cost)
                      : null;
                    
                    return (
                      <div 
                        key={`line-item-${index}`}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover-elevate"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item?.description || 'Untitled'}</p>
                          <p className="text-xs text-muted-foreground">
                            {item?.itemCode ? `${item.itemCode} · ` : ''}{item?.quantity} × {formatCurrency(parseFloat(item?.unitPrice || "0"))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">{formatCurrency(itemTotal)}</p>
                          {showMarginMode && itemMargin !== null && (
                            <Badge 
                              variant="secondary"
                              className={`text-xs h-5 mt-1 ${
                                itemMargin >= 30 ? 'bg-green-100 text-green-700' :
                                itemMargin >= 15 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}
                            >
                              {itemMargin.toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg"
                            onClick={() => handleEditLineItem(index)}
                            data-testid={`button-edit-item-${index}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
                            onClick={() => removeLineItem(index)}
                            data-testid={`button-delete-item-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add item buttons */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddLineItem}
                    className="flex-1 h-12 rounded-xl gap-2 press-scale"
                    data-testid="button-add-item"
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                  {canUseAIFeatures && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAiQuoteOpen(true)}
                    className="h-12 px-4 rounded-xl press-scale gap-2 text-primary border-primary/30 hover:bg-primary/5"
                    data-testid="button-ai-generate"
                    title="Generate quote items with AI"
                  >
                    <Sparkles className="h-4 w-4" />
                    AI
                  </Button>
                  )}
                  {(selectedJobId || urlJobId) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateFromTasks}
                    disabled={isGeneratingFromTasks}
                    className="h-12 px-3 rounded-xl press-scale gap-2 text-primary border-primary/30 hover:bg-primary/5"
                    data-testid="button-generate-from-tasks"
                    title="Generate line items from job tasks"
                  >
                    {isGeneratingFromTasks ? (
                      <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (
                      <ClipboardList className="h-4 w-4" />
                    )}
                    Tasks
                  </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCatalogOpen(true)}
                    className="h-12 w-12 rounded-xl press-scale"
                    data-testid="button-from-catalog"
                    title="Browse catalog"
                  >
                    <BookOpen className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPriceListOpen(true)}
                    className="h-12 w-12 rounded-xl press-scale"
                    data-testid="button-from-price-list"
                    title="Add from price list"
                  >
                    <Tag className="h-4 w-4" />
                  </Button>
                </div>

                {form.formState.errors.lineItems && (
                  <p className="text-xs text-destructive">{form.formState.errors.lineItems.message}</p>
                )}

                {/* Totals */}
                {lineItems.length > 0 && (
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">GST (10%)</span>
                        <Switch
                          checked={quoteGstEnabled}
                          onCheckedChange={(checked) => form.setValue("gstEnabled", checked)}
                          data-testid="switch-gst-enabled"
                          className="scale-75"
                        />
                      </div>
                      <span className={!quoteGstEnabled ? "line-through text-muted-foreground/50" : ""}>{formatCurrency(gst)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold pt-2 border-t">
                      <span>{quoteGstEnabled ? "Total (inc. GST)" : "Total (no GST)"}</span>
                      <span style={{ color: 'hsl(var(--trade))' }}>{formatCurrency(total)}</span>
                    </div>
                    
                    {/* Profit Margin Section */}
                    <div className="pt-3 mt-3 border-t border-dashed">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          <DollarSign className="h-3.5 w-3.5" />
                          Profit Analysis
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setShowMarginMode(!showMarginMode)}
                        >
                          {showMarginMode ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                      
                      {showMarginMode && (
                        <div className="space-y-1.5 p-3 rounded-lg bg-muted/50">
                          {hasCostData ? (
                            <>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Total Costs</span>
                                <span>{formatCurrency(totalCost)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Gross Profit</span>
                                <span className={grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {formatCurrency(grossProfit)}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm font-semibold pt-1 border-t border-muted">
                                <span>Profit Margin</span>
                                <Badge 
                                  variant="secondary"
                                  className={`font-semibold ${
                                    profitMargin >= 30 ? 'bg-green-100 text-green-700' :
                                    profitMargin >= 15 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {profitMargin.toFixed(1)}%
                                </Badge>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              Add cost values to line items to see profit analysis
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Deposit Settings */}
            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Percent className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                    Deposit Required
                  </div>
                  <Switch
                    checked={watchedValues.depositRequired}
                    onCheckedChange={(checked) => form.setValue("depositRequired", checked)}
                    data-testid="switch-deposit-required"
                  />
                </div>

                {watchedValues.depositRequired && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Deposit Percentage</Label>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[10, 20, 25, 30, 50, 75, 100].map((pct) => (
                          <Button
                            key={pct}
                            type="button"
                            variant={watchedValues.depositPercent === pct ? "default" : "outline"}
                            size="sm"
                            onClick={() => form.setValue("depositPercent", pct)}
                            data-testid={`button-deposit-${pct}`}
                          >
                            {pct}%
                          </Button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        <Label className="text-xs text-muted-foreground shrink-0">Custom</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={watchedValues.depositPercent}
                          onChange={(e) => {
                            const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                            form.setValue("depositPercent", val);
                          }}
                          className="h-9 rounded-lg w-20"
                          data-testid="input-deposit-percent"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                        <span className="text-sm font-semibold ml-auto" style={{ color: 'hsl(var(--trade))' }}>
                          {formatCurrency(total * (watchedValues.depositPercent / 100))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Notes & Terms
                </div>
                <Textarea
                  {...form.register("notes")}
                  placeholder="Terms, conditions, or notes for the client..."
                  className="rounded-xl min-h-[100px]"
                  data-testid="input-notes"
                />
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isEditMode ? isEditSaving : createQuoteMutation.isPending}
              className="w-full h-14 rounded-2xl text-base font-semibold gap-2 press-scale"
              style={{ 
                backgroundColor: 'hsl(var(--trade))',
                color: 'white'
              }}
              data-testid={isEditMode ? "button-save-quote" : "button-create-quote"}
            >
              {(isEditMode ? isEditSaving : createQuoteMutation.isPending) ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isEditMode ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  {isEditMode ? 'Save Changes' : 'Create Quote'}
                </>
              )}
            </Button>
          </form>
          </Form>
        </div>

        {/* Preview Panel */}
        <div className={`flex-1 bg-muted/30 overflow-auto p-4 lg:p-6 ${mobileView === 'edit' ? 'hidden lg:block' : ''}`}>
          <div className="max-w-lg mx-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Live Preview</h2>
              <div className="flex items-center gap-2">
                <Link href="/templates">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="button-customize-template">
                    <Palette className="h-3 w-3" />
                    Customize
                  </Button>
                </Link>
                <Badge variant="outline" className="text-xs">Updates as you type</Badge>
              </div>
            </div>
            <LiveDocumentPreview
              type="quote"
              documentNumber="Q-XXXXX"
              title={watchedValues.title}
              description={watchedValues.description}
              validUntil={watchedValues.validUntil}
              lineItems={previewLineItems}
              notes={watchedValues.notes}
              business={businessInfo}
              client={clientInfo}
              showDepositSection={watchedValues.depositRequired}
              depositPercent={watchedValues.depositPercent}
              gstEnabled={quoteGstEnabled}
              templateId={(() => {
                // Primary source: businessSettings.documentTemplate (set in Templates Hub)
                const savedTemplate = (businessSettings as any)?.documentTemplate as TemplateId | undefined;
                if (savedTemplate && ['professional', 'modern', 'minimal'].includes(savedTemplate)) {
                  return savedTemplate;
                }
                // Fallback: check style preset headerLayout
                let presetLayout = defaultStylePreset?.headerLayout as string | undefined;
                // Map legacy 'standard' or 'classic' to 'professional'
                if (presetLayout === 'standard' || presetLayout === 'classic') {
                  presetLayout = 'professional';
                }
                if (presetLayout && ['professional', 'modern', 'minimal'].includes(presetLayout)) {
                  return presetLayout as TemplateId;
                }
                return 'professional';
              })()}
              templateCustomization={(() => {
                // Get template config from the selected template
                // Primary source: businessSettings.documentTemplate
                let templateId: TemplateId = (businessSettings as any)?.documentTemplate as TemplateId;
                if (!templateId || !['professional', 'modern', 'minimal'].includes(templateId)) {
                  // Fallback: check style preset headerLayout
                  let presetLayout = defaultStylePreset?.headerLayout as string | undefined;
                  if (presetLayout === 'standard' || presetLayout === 'classic') {
                    presetLayout = 'professional';
                  }
                  templateId = (presetLayout && ['professional', 'modern', 'minimal'].includes(presetLayout))
                    ? presetLayout as TemplateId
                    : 'professional';
                }
                const template = DOCUMENT_TEMPLATES[templateId];
                
                // User's saved settings take priority; fall back to template defaults
                return {
                  tableStyle: (businessSettings as any)?.documentTemplateSettings?.tableStyle || template.tableStyle,
                  noteStyle: (businessSettings as any)?.documentTemplateSettings?.noteStyle || template.noteStyle,
                  accentColor: (businessSettings as any)?.documentTemplateSettings?.accentColor || defaultStylePreset?.accentColor,
                  showHeaderDivider: (businessSettings as any)?.documentTemplateSettings?.showHeaderDivider ?? template.showHeaderDivider,
                  headerBorderWidth: template.headerBorderWidth,
                  bodyWeight: template.bodyWeight,
                  headingWeight: template.headingWeight,
                } as TemplateCustomization;
              })()}
              jobSignatures={jobSignatures?.filter((s: any) => s.documentType === 'job_completion') || []}
            />
          </div>
        </div>
      </div>

      {/* Line Item Editor Sheet */}
      <Sheet open={editingLineIndex !== null} onOpenChange={() => setEditingLineIndex(null)}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-3xl pb-8 z-[60]">
          <SheetHeader className="pb-4">
            <SheetTitle>{editingLineIndex === -1 ? 'Add Item' : 'Edit Item'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pb-4">
            <div>
              <Label className="text-xs text-muted-foreground">Item Code (optional)</Label>
              <Input
                value={editForm.itemCode}
                onChange={(e) => setEditForm({ ...editForm, itemCode: e.target.value })}
                placeholder="e.g. 01_801_0138_1_1 or SKU"
                className="h-12 rounded-xl mt-1"
                data-testid="input-item-code"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="What are you charging for?"
                className="h-12 rounded-xl mt-1"
                data-testid="input-item-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                  className="h-12 rounded-xl mt-1"
                  data-testid="input-item-quantity"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Unit Price ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.unitPrice}
                  onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })}
                  className="h-12 rounded-xl mt-1"
                  data-testid="input-item-price"
                />
              </div>
            </div>
            
            {/* Cost for profit margin (optional) */}
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Your Cost (optional, for profit analysis)
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editForm.cost}
                onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })}
                placeholder="0.00"
                className="h-12 rounded-xl mt-1"
                data-testid="input-item-cost"
              />
            </div>
            
            <div className="pt-2 p-3 rounded-xl bg-muted/50 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Line Total</span>
                <span className="font-semibold">{formatCurrency(calculateTotal(editForm.quantity, editForm.unitPrice))}</span>
              </div>
              {editForm.cost && parseFloat(editForm.cost) > 0 && (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Cost</span>
                    <span>{formatCurrency(calculateItemCost(editForm.quantity, editForm.cost))}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Margin</span>
                    <Badge 
                      variant="secondary"
                      className={`text-xs h-5 ${
                        calculateItemMargin(editForm.quantity, editForm.unitPrice, editForm.cost) >= 30 
                          ? 'bg-green-100 text-green-700' 
                          : calculateItemMargin(editForm.quantity, editForm.unitPrice, editForm.cost) >= 15 
                            ? 'bg-yellow-100 text-yellow-700' 
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {calculateItemMargin(editForm.quantity, editForm.unitPrice, editForm.cost).toFixed(1)}%
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </div>
          <SheetFooter className="pt-2">
            <Button
              onClick={handleSaveLineItem}
              className="w-full h-12 rounded-xl press-scale"
              style={{ backgroundColor: 'hsl(var(--trade))' }}
              data-testid="button-save-item"
            >
              {editingLineIndex === -1 ? 'Add Item' : 'Save Changes'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Catalog Modal */}
      <CatalogModal
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onSelectItem={handleCatalogSelect}
        tradeType={userCheck?.user?.tradeType}
      />

      {/* Price List Modal */}
      <PriceListModal
        open={priceListOpen}
        onOpenChange={setPriceListOpen}
        onSelectItem={handlePriceListSelect}
        tradeType={userCheck?.user?.tradeType}
        materialMarkupPct={parseFloat((businessSettings as any)?.defaultMaterialMarkupPct || '0')}
      />

      {/* AI Quote Generator Modal */}
      <AIQuoteGenerator
        open={aiQuoteOpen}
        onOpenChange={setAiQuoteOpen}
        jobId={selectedJobId}
        onApplyItems={(items, title, description) => {
          // Update title and description if provided and not already set
          const currentTitle = form.getValues("title");
          const currentDescription = form.getValues("description");
          if (title && !currentTitle) {
            form.setValue("title", title);
          }
          if (description && !currentDescription) {
            form.setValue("description", description);
          }
          
          // Use useFieldArray append to add AI-generated items
          const newItems = items.map(item => ({
            description: item.description,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString(),
            cost: "",
          }));
          newItems.forEach(item => appendLineItem(item));
          
          toast({
            title: "Items added",
            description: `${items.length} items added from AI generation`,
          });
        }}
      />
    </div>
  );
}
