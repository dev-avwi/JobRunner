import { useState, useEffect } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearch, useLocation, Link } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/use-clients";
import { useCreateInvoice } from "@/hooks/use-invoices";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useDocumentTemplates, type DocumentTemplate } from "@/hooks/use-templates";
import { useQuery } from "@tanstack/react-query";
import { queryClient, getSessionToken } from "@/lib/queryClient";
import LiveDocumentPreview from "./LiveDocumentPreview";
import type { StylePreset } from "@shared/schema";
import { TemplateCustomization, DOCUMENT_TEMPLATES, TemplateId } from "@/lib/document-templates";
import CatalogModal from "@/components/CatalogModal";
import CompletedJobPicker from "@/components/CompletedJobPicker";
import {
  Plus,
  Trash2,
  Edit2,
  Eye,
  FileText,
  User,
  Calendar,
  Package,
  BookOpen,
  ChevronLeft,
  Check,
  Palette,
  ChevronsUpDown,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const lineItemSchema = z.object({
  itemCode: z.string().optional(),
  description: z.string().min(1, "Description required"),
  quantity: z.string().min(1, "Quantity required"),
  unitPrice: z.string().min(1, "Price required"),
});

const invoiceFormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item required"),
});

type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

interface LiveInvoiceEditorProps {
  invoiceId?: string;
  onSave?: (invoiceId: string) => void;
  onCancel?: () => void;
}

export default function LiveInvoiceEditor({ invoiceId: editInvoiceId, onSave, onCancel }: LiveInvoiceEditorProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: clients = [] } = useClients();
  const { data: businessSettings } = useBusinessSettings();
  const createInvoiceMutation = useCreateInvoice();
  const isEditMode = !!editInvoiceId;
  
  // Read jobId or quoteId from URL query parameters
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlJobId = urlParams.get('jobId');
  const urlQuoteId = urlParams.get('quoteId');
  
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ itemCode: "", description: "", quantity: "1", unitPrice: "" });
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | undefined>(urlQuoteId || undefined);
  const [sourceQuoteId, setSourceQuoteId] = useState<string | undefined>(urlQuoteId || undefined);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(urlJobId || undefined);
  const [autoLoaded, setAutoLoaded] = useState(false);
  const [showExistingInvoiceDialog, setShowExistingInvoiceDialog] = useState(false);
  const [existingInvoiceData, setExistingInvoiceData] = useState<any>(null);

  const { data: editInvoiceData } = useQuery({
    queryKey: ['/api/invoices', editInvoiceId],
    enabled: isEditMode,
  });

  const { data: userCheck } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch('/api/auth/me', { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
    retry: false,
    staleTime: 30000,
  });

  // Fetch job data if jobId is provided in URL
  const { data: preloadedJob } = useQuery({
    queryKey: ['/api/jobs', urlJobId],
    enabled: !!urlJobId && !autoLoaded,
  });

  // Fetch quote data if quoteId is provided in URL
  const { data: preloadedQuote } = useQuery({
    queryKey: ['/api/quotes', urlQuoteId],
    enabled: !!urlQuoteId && !autoLoaded,
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

  // Rate cards carry the material markup % applied when materials roll into an invoice
  const { data: rateCards = [] } = useQuery<any[]>({
    queryKey: ['/api/rate-cards'],
  });

  // Get the default style preset for preview styling
  const defaultStylePreset = stylePresets.find((p) => p.isDefault) || stylePresets[0];

  // Fetch document templates for template selector
  const { data: documentTemplates = [] } = useDocumentTemplates('invoice');
  
  // Track selected document template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState(false);

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      clientId: "",
      title: "",
      description: "",
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "",
      lineItems: [],
    },
  });

  const { fields, append, remove, update, replace } = useFieldArray({
    control: form.control,
    name: "lineItems"
  });

  const [editLoaded, setEditLoaded] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  useEffect(() => {
    if (!isEditMode || editLoaded || !editInvoiceData) return;
    const inv = editInvoiceData as any;
    form.reset({
      clientId: inv.clientId || "",
      title: inv.title || "",
      description: inv.description || "",
      dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : "",
      notes: inv.notes || "",
      lineItems: (inv.lineItems || []).map((li: any) => ({
        itemCode: li.itemCode || "",
        description: li.description || "",
        quantity: String(li.quantity || "1"),
        unitPrice: String(li.unitPrice || "0"),
      })),
    });
    if (inv.jobId) setSelectedJobId(inv.jobId);
    setEditLoaded(true);
    setAutoLoaded(true);
  }, [isEditMode, editInvoiceData, editLoaded]);

  // Build labour + materials line items from a job's tracked time and materials.
  // Mirrors the Job Detail "Labour cost" calc: team-wide entries (teamView=true),
  // per-worker tracked rates, breaks excluded. Also pulls in job materials.
  const buildJobChargeItems = async (jobId: string, jobTitle?: string) => {
    const items: { description: string; quantity: string; unitPrice: string }[] = [];
    const token = getSessionToken();
    const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : undefined;

    // Labour from tracked time — same source/scope the job card totals from
    try {
      const timeRes = await fetch(`/api/time-entries?jobId=${jobId}&teamView=true`, { credentials: 'include', headers: authHeaders });
      if (timeRes.ok) {
        const timeEntries = await timeRes.json();
        // Breaks are only billed when the business has opted in via "Bill for breaks".
        const billBreaks = !!(businessSettings as any)?.billBreaks;
        const workEntries = Array.isArray(timeEntries)
          ? timeEntries.filter((e: any) => e.endTime && (billBreaks || !e.isBreak))
          : [];
        // hourlyRate is a decimal column and arrives as a string (e.g. "85.00"),
        // so always coerce to a finite number before any arithmetic.
        const toRate = (v: any) => {
          const n = parseFloat(v);
          return Number.isFinite(n) && n > 0 ? n : 0;
        };
        // Minutes per entry — mirrors Job Detail getEntryMinutes: prefer stored
        // duration, else floor((end-start)/60000).
        const entryMinutes = (e: any) => {
          const dur = parseFloat(e.duration);
          if (Number.isFinite(dur) && dur > 0) return dur;
          return Math.floor((new Date(e.endTime).getTime() - new Date(e.startTime).getTime()) / 60000);
        };
        // Overall average tracked rate (rated entries only), matching the card's
        // avgHourlyRate; fall back to the business hourly rate only if nothing is set.
        const allRated = workEntries.map((e: any) => toRate(e.hourlyRate)).filter((r: number) => r > 0);
        const overallAvgRate = allRated.length > 0
          ? allRated.reduce((s: number, r: number) => s + r, 0) / allRated.length
          : toRate(businessSettings?.hourlyRate);
        const byWorker = new Map<string, any[]>();
        for (const e of workEntries) {
          const key = e.userId || 'unknown';
          if (!byWorker.has(key)) byWorker.set(key, []);
          byWorker.get(key)!.push(e);
        }
        for (const entries of Array.from(byWorker.values())) {
          const totalMinutes = entries.reduce((sum: number, e: any) => sum + entryMinutes(e), 0);
          const hours = Math.round((totalMinutes / 60) * 100) / 100;
          if (!Number.isFinite(hours) || hours <= 0) continue;
          const rated = entries.map((e: any) => toRate(e.hourlyRate)).filter((r: number) => r > 0);
          const rate = rated.length > 0
            ? rated.reduce((s: number, r: number) => s + r, 0) / rated.length
            : overallAvgRate;
          const safeRate = Number.isFinite(rate) ? Math.round(rate * 100) / 100 : 0;
          const workerName = entries[0]?.userName;
          items.push({
            description: workerName ? `Labour - ${workerName} (${hours}h)` : `${jobTitle || 'Labour'} - ${hours} hours`,
            quantity: String(hours),
            unitPrice: String(safeRate),
          });
        }
      }
    } catch (err) {
      // Silently skip labour on failure
    }

    // Materials charged to the client — cost rolls up with the rate-card markup applied.
    // Sell-price priority: explicit unitPrice > (unitCost x markup) > unitCost.
    // Markup % priority: material's own markupPercent > rate card materialMarkupPct > 20% default.
    try {
      const matRes = await fetch(`/api/jobs/${jobId}/materials`, { credentials: 'include', headers: authHeaders });
      if (matRes.ok) {
        const materials = await matRes.json();
        if (Array.isArray(materials)) {
          const defaultRateCard = (rateCards as any[]).find((r) => r?.tradeType === (businessSettings as any)?.tradeType) || (rateCards as any[])[0];
          const cardMarkup = parseFloat(defaultRateCard?.materialMarkupPct ?? '');
          const fallbackMarkup = Number.isFinite(cardMarkup) ? cardMarkup : 20;
          for (const m of materials) {
            const qty = parseFloat(m.quantity ?? '1') || 0;
            const explicitPrice = parseFloat(m.unitPrice ?? '0') || 0;
            const cost = parseFloat(m.unitCost ?? '0') || 0;
            const ownMarkup = parseFloat(m.markupPercent ?? '');
            const markupPct = Number.isFinite(ownMarkup) ? ownMarkup : fallbackMarkup;
            let price = 0;
            if (explicitPrice > 0) {
              price = explicitPrice;
            } else if (cost > 0) {
              price = Math.round(cost * (1 + markupPct / 100) * 100) / 100;
            }
            if (qty <= 0 || price <= 0) continue;
            const unitLabel = m.unit && m.unit !== 'each' ? ` (${m.unit})` : '';
            items.push({
              description: `${m.name}${unitLabel}`,
              quantity: String(qty),
              unitPrice: String(price),
            });
          }
        }
      }
    } catch (err) {
      // Silently skip materials on failure
    }

    return items;
  };

  // Auto-fill form when job or quote is loaded from URL parameter
  useEffect(() => {
    if (autoLoaded || (clients as any[]).length === 0) return;
    
    const fetchVariationsForAutoLoad = async (jobId: string, baseItems: any[]) => {
      try {
        const varToken = getSessionToken();
        const varRes = await fetch(`/api/jobs/${jobId}/variations`, { credentials: 'include', headers: varToken ? { 'Authorization': `Bearer ${varToken}` } : undefined });
        if (varRes.ok) {
          const allVariations = await varRes.json();
          const approved = allVariations.filter((v: any) => v.status === 'approved');
          if (approved.length > 0) {
            const variationItems = approved.map((v: any) => ({
              description: `VARIATION: ${v.title}${v.description ? ' - ' + v.description : ''}`,
              quantity: "1",
              unitPrice: String(v.additionalAmount || v.totalAmount || 0),
            }));
            return { items: [...baseItems, ...variationItems], count: approved.length };
          }
        }
      } catch (err) {
        // Silently fall back
      }
      return { items: baseItems, count: 0 };
    };

    // Priority: Quote data first (contains line items), then job data
    if (preloadedQuote) {
      setAutoLoaded(true);
      const quote = preloadedQuote as any;
      
      // Set client from quote
      if (quote.clientId) {
        form.setValue("clientId", quote.clientId);
      }
      
      // Copy quote details to invoice
      form.setValue("title", quote.title || "");
      form.setValue("description", quote.description || "");
      form.setValue("notes", quote.notes || quote.terms || "");
      
      // Copy line items from quote
      let baseItems: any[] = [];
      if (quote.lineItems && quote.lineItems.length > 0) {
        baseItems = quote.lineItems.map((item: any) => ({
          description: String(item.description ?? ""),
          quantity: String(item.quantity ?? item.qty ?? 1),
          unitPrice: String(item.unitPrice ?? item.unit_price ?? 0),
        }));
      }

      if (urlJobId) {
        fetchVariationsForAutoLoad(urlJobId, baseItems).then(({ items: finalItems, count: varCount }) => {
          form.setValue("lineItems", finalItems);
          toast({
            title: "Quote details loaded",
            description: varCount > 0
              ? `Creating invoice from quote "${quote.title}" + ${varCount} variation${varCount > 1 ? 's' : ''}`
              : `Creating invoice from quote "${quote.title}"`,
          });
        });
      } else {
        form.setValue("lineItems", baseItems);
        toast({
          title: "Quote details loaded",
          description: `Creating invoice from quote "${quote.title}"`,
        });
      }
    } else if (preloadedJob) {
      setAutoLoaded(true);
      const job = preloadedJob as any;
      
      // Mark this job as selected in the picker
      setSelectedJobId(job.id);
      
      // Set client from job
      if (job.clientId) {
        form.setValue("clientId", job.clientId);
      }
      
      // Set title and description from job
      form.setValue("title", job.title || "");
      form.setValue("description", job.description || "");
      
      // Set default due date
      const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      form.setValue("dueDate", dueDate);
      
      // Fetch linked documents to get quote line items
      (async () => {
        try {
          const ldToken = getSessionToken();
          const res = await fetch(`/api/jobs/${job.id}/linked-documents`, { credentials: 'include', headers: ldToken ? { 'Authorization': `Bearer ${ldToken}` } : undefined });
          const data = res.ok ? await res.json() : null;
          if (data?.linkedInvoice) {
            setExistingInvoiceData(data.linkedInvoice);
            setShowExistingInvoiceDialog(true);
          }
          if (data?.quote?.lineItems && data.quote.lineItems.length > 0) {
            const baseItems = data.quote.lineItems.map((item: any) => ({
              description: String(item.description ?? ""),
              quantity: String(item.quantity ?? item.qty ?? 1),
              unitPrice: String(item.unitPrice ?? item.unit_price ?? 0),
            }));
            setSourceQuoteId(data.quote.id);
            setSelectedQuoteId(data.quote.id);
            
            const { items: finalItems, count: varCount } = await fetchVariationsForAutoLoad(job.id, baseItems);
            form.setValue("lineItems", finalItems);
            
            toast({
              title: "Job loaded",
              description: varCount > 0
                ? `Invoice prefilled from "${job.title}" with quote items + ${varCount} variation${varCount > 1 ? 's' : ''}`
                : `Invoice prefilled from "${job.title}" with quote line items`,
            });
          } else {
            const timeBasedItems = await buildJobChargeItems(job.id, job.title);
            
            const { items: varOnlyItems, count: varCount } = await fetchVariationsForAutoLoad(job.id, timeBasedItems);
            form.setValue("lineItems", varOnlyItems);

            toast({
              title: "Job loaded", 
              description: varCount > 0
                ? `Invoice prefilled from "${job.title}" with labour, materials & ${varCount} variation${varCount > 1 ? 's' : ''}`
                : varOnlyItems.length > 0
                  ? `Invoice prefilled from "${job.title}" with labour & materials`
                  : `Invoice prefilled from "${job.title}". Add line items for your charges.`,
            });
          }
        } catch {
          const timeBasedItems = await buildJobChargeItems(job.id, job.title);
          
          const { items: varOnlyItems, count: varCount } = await fetchVariationsForAutoLoad(job.id, timeBasedItems);
          form.setValue("lineItems", varOnlyItems);

          toast({
            title: "Job loaded",
            description: varCount > 0
              ? `Invoice prefilled from "${job.title}" with labour, materials & ${varCount} variation${varCount > 1 ? 's' : ''}`
              : varOnlyItems.length > 0
                ? `Invoice prefilled from "${job.title}" with labour & materials`
                : `Invoice prefilled from "${job.title}". Add line items for your charges.`,
          });
        }
      })();
    }
  }, [preloadedJob, preloadedQuote, autoLoaded, clients, form, toast]);

  // Use form.watch() for general form values
  const watchedValues = form.watch();
  const selectedClient = (clients as any[]).find(c => c.id === watchedValues.clientId);
  
  // Use useWatch specifically for lineItems to ensure proper re-rendering
  const lineItems = useWatch({
    control: form.control,
    name: "lineItems",
    defaultValue: []
  });

  // Prefill form from accepted quote - the natural workflow for invoice creation
  const handleSelectQuote = (quote: any) => {
    setSelectedQuoteId(quote.id);
    setSourceQuoteId(quote.id);
    
    // Set client from quote
    if (quote.client?.id) {
      form.setValue("clientId", quote.client.id);
    }
    
    // Copy quote details to invoice
    form.setValue("title", quote.title || "");
    form.setValue("description", quote.description || "");
    form.setValue("notes", quote.notes || quote.terms || "");
    
    // Use quote's valid until date as due date if available, otherwise default to 14 days
    let dueDate: string;
    if (quote.validUntil) {
      dueDate = new Date(quote.validUntil).toISOString().split('T')[0];
    } else {
      dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    form.setValue("dueDate", dueDate);
    
    // Copy line items from quote - ensure all values are strings for the form
    // Use nullish coalescing to handle all possible property names
    if (quote.lineItems && quote.lineItems.length > 0) {
      const items = quote.lineItems.map((item: any) => ({
        description: String(item.description ?? ""),
        quantity: String(item.quantity ?? item.qty ?? 1),
        unitPrice: String(item.unitPrice ?? item.unit_price ?? 0),
      }));
      form.setValue("lineItems", items);
    } else {
      form.setValue("lineItems", []);
    }
    
    toast({
      title: "Quote loaded",
      description: `Invoice prefilled from accepted quote #${quote.number}`,
    });
  };

  // Prefill form from completed job - the primary workflow for invoice creation
  const handleSelectJob = async (job: any) => {
    setSelectedJobId(job.id);
    
    // Check if job already has an invoice
    try {
      const ldToken2 = getSessionToken();
      const linkedRes = await fetch(`/api/jobs/${job.id}/linked-documents`, { credentials: 'include', headers: ldToken2 ? { 'Authorization': `Bearer ${ldToken2}` } : undefined });
      if (linkedRes.ok) {
        const linkedData = await linkedRes.json();
        if (linkedData.linkedInvoice) {
          setExistingInvoiceData(linkedData.linkedInvoice);
          setShowExistingInvoiceDialog(true);
        }
      }
    } catch (err) {
      // Continue with invoice creation
    }
    
    // Set client from job
    if (job.client?.id) {
      form.setValue("clientId", job.client.id);
    } else if (job.clientId) {
      form.setValue("clientId", job.clientId);
    }
    
    // Copy job details to invoice
    form.setValue("title", job.title || "");
    form.setValue("description", job.description || "");
    
    // Set default due date to 14 days from now
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    form.setValue("dueDate", dueDate);
    
    const fetchApprovedVariations = async (jobId: string, baseItems: any[]) => {
      try {
        const varToken2 = getSessionToken();
        const varRes = await fetch(`/api/jobs/${jobId}/variations`, { credentials: 'include', headers: varToken2 ? { 'Authorization': `Bearer ${varToken2}` } : undefined });
        if (varRes.ok) {
          const allVariations = await varRes.json();
          const approved = allVariations.filter((v: any) => v.status === 'approved');
          if (approved.length > 0) {
            const variationItems = approved.map((v: any) => ({
              description: `VARIATION: ${v.title}${v.description ? ' - ' + v.description : ''}`,
              quantity: "1",
              unitPrice: String(v.additionalAmount || v.totalAmount || 0),
            }));
            return { items: [...baseItems, ...variationItems], count: approved.length };
          }
        }
      } catch (err) {
        // Silently fall back to just base items
      }
      return { items: baseItems, count: 0 };
    };

    // Check if job has a linked quote with line items
    if (job.linkedQuote?.lineItems && job.linkedQuote.lineItems.length > 0) {
      const baseItems = job.linkedQuote.lineItems.map((item: any) => ({
        description: String(item.description ?? ""),
        quantity: String(item.quantity ?? item.qty ?? 1),
        unitPrice: String(item.unitPrice ?? item.unit_price ?? 0),
      }));
      
      // Set the source quote for linking
      setSourceQuoteId(job.linkedQuote.id);
      setSelectedQuoteId(job.linkedQuote.id);

      const { items: finalItems, count: varCount } = await fetchApprovedVariations(job.id, baseItems);
      form.setValue("lineItems", finalItems);
      
      toast({
        title: "Job loaded",
        description: varCount > 0
          ? `Invoice prefilled from "${job.title}" with quote items + ${varCount} variation${varCount > 1 ? 's' : ''}`
          : `Invoice prefilled from "${job.title}" with quote line items`,
      });
    } else {
      // Try to fetch linked documents to get quote line items
      try {
        const ldToken3 = getSessionToken();
        const res = await fetch(`/api/jobs/${job.id}/linked-documents`, { credentials: 'include', headers: ldToken3 ? { 'Authorization': `Bearer ${ldToken3}` } : undefined });
        if (res.ok) {
          const data = await res.json();
          if (data.quote?.lineItems && data.quote.lineItems.length > 0) {
            const baseItems = data.quote.lineItems.map((item: any) => ({
              description: String(item.description ?? ""),
              quantity: String(item.quantity ?? item.qty ?? 1),
              unitPrice: String(item.unitPrice ?? item.unit_price ?? 0),
            }));
            
            // Set the source quote for linking
            setSourceQuoteId(data.quote.id);
            setSelectedQuoteId(data.quote.id);

            const { items: finalItems, count: varCount } = await fetchApprovedVariations(job.id, baseItems);
            form.setValue("lineItems", finalItems);
            
            toast({
              title: "Job loaded",
              description: varCount > 0
                ? `Invoice prefilled from "${job.title}" with quote items + ${varCount} variation${varCount > 1 ? 's' : ''}`
                : `Invoice prefilled from "${job.title}" with quote line items`,
            });
            return;
          }
        }
      } catch (err) {
        console.error("Error fetching linked documents:", err);
      }
      
      const timeBasedItems = await buildJobChargeItems(job.id, job.title);

      const { items: varOnlyItems, count: varCount } = await fetchApprovedVariations(job.id, timeBasedItems);
      form.setValue("lineItems", varOnlyItems);
      setSourceQuoteId(undefined);
      setSelectedQuoteId(undefined);
      
      toast({
        title: "Job loaded",
        description: varCount > 0
          ? `Invoice prefilled from "${job.title}" with labour, materials & ${varCount} variation${varCount > 1 ? 's' : ''}`
          : varOnlyItems.length > 0
            ? `Invoice prefilled from "${job.title}" with labour & materials`
            : `Invoice prefilled from "${job.title}". Add line items for your charges.`,
      });
    }
  };

  const handleApplyTemplate = (template: DocumentTemplate) => {
    form.setValue("title", template.defaults?.title || "");
    form.setValue("description", template.defaults?.description || "");
    form.setValue("notes", template.defaults?.terms || "");
    
    if (template.defaultLineItems) {
      const items = template.defaultLineItems.map((item: any) => ({
        description: item.description,
        quantity: String(item.qty || 1),
        unitPrice: item.unitPrice > 0 ? String(item.unitPrice) : "",
      }));
      form.setValue("lineItems", items);
    }
    
    setTemplateSheetOpen(false);
    toast({
      title: "Template applied",
      description: `"${template.name}" template has been applied`,
    });
  };

  const handleAddLineItem = () => {
    setEditForm({ itemCode: "", description: "", quantity: "1", unitPrice: "" });
    setEditingLineIndex(-1);
  };

  const handleEditLineItem = (index: number) => {
    const item = lineItems[index];
    setEditForm({
      itemCode: (item as any).itemCode || "",
      description: item.description || "",
      quantity: String(item.quantity || "1"),
      unitPrice: String(item.unitPrice || "")
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
      append(editForm);
    } else if (editingLineIndex !== null) {
      update(editingLineIndex, editForm);
    }
    setEditingLineIndex(null);
  };

  const handleCatalogSelect = (item: any) => {
    // Use name as description if available, fallback to description
    const itemDescription = item.name || item.description || 'Service item';
    
    // Create new item
    const newItem = {
      itemCode: item.itemCode || "",
      description: itemDescription,
      quantity: String(item.defaultQuantity || 1),
      unitPrice: String(item.unitPrice || 0),
    };
    
    // Close the modal first
    setCatalogOpen(false);
    
    // Use setTimeout to ensure modal close doesn't interfere with form update
    setTimeout(() => {
      // Use append() which directly updates the useFieldArray fields array
      append(newItem);
      
      toast({
        title: "Item added",
        description: `"${itemDescription}" added to invoice`,
      });
    }, 0);
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

  const subtotal = lineItems?.reduce(
    (sum, item) => sum + calculateTotal(item.quantity, item.unitPrice), 
    0
  ) || 0;
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  const handleSubmit = async (data: InvoiceFormData) => {
    try {
      const invoiceData: any = {
        clientId: data.clientId,
        jobId: selectedJobId || null,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        notes: data.notes,
        lineItems: data.lineItems.map(item => ({
          itemCode: item.itemCode?.trim() || null,
          description: item.description,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
        })),
      };

      if (isEditMode && editInvoiceId) {
        setIsEditSaving(true);
        try {
          const token = getSessionToken();
          const res = await fetch(`/api/invoices/${editInvoiceId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(invoiceData),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to update invoice');
          }
          const updated = await res.json();

          queryClient.invalidateQueries({ queryKey: ['/api/invoices', editInvoiceId] });
          queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
          queryClient.invalidateQueries({ queryKey: ['/api/invoices', editInvoiceId, 'edits'] });
          if (selectedJobId) {
            queryClient.invalidateQueries({ queryKey: ['/api/jobs', selectedJobId, 'linked-documents'] });
          }

          toast({
            title: "Invoice updated",
            description: "Your changes have been saved",
          });

          onSave?.(editInvoiceId);
        } finally {
          setIsEditSaving(false);
        }
        return;
      }

      if (sourceQuoteId) {
        invoiceData.quoteId = sourceQuoteId;
      }

      const result = await createInvoiceMutation.mutateAsync(invoiceData);
      
      const jobIdToInvalidate = selectedJobId || urlJobId;
      if (jobIdToInvalidate) {
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobIdToInvalidate, 'linked-documents'] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobIdToInvalidate] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      }
      
      toast({
        title: "Invoice created!",
        description: "Your invoice has been saved successfully",
      });

      if (result.id && (selectedJobId || urlJobId)) {
        try {
          const labourToken = getSessionToken();
          const labourRes = await fetch(`/api/invoices/${result.id}/generate-labour-lines`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...(labourToken ? { 'Authorization': `Bearer ${labourToken}` } : {}) },
          });
          if (labourRes.ok) {
            const labourData = await labourRes.json();
            if (labourData.labourItems && labourData.labourItems.length > 0) {
              toast({
                title: "Labour lines added",
                description: `${labourData.labourItems.length} labour line(s) generated from time tracking (${labourData.summary?.totalBillableHours?.toFixed(1) || '0'} hours)`,
              });
            }
          }
        } catch (err) {
          // Silently skip - labour lines are optional
        }
      }

      onSave?.(result.id);
    } catch (error: any) {
      console.error("Error saving invoice:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save invoice. Please try again.",
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

  const previewLineItems = lineItems?.map(item => ({
    itemCode: (item as any).itemCode?.trim() || undefined,
    description: item.description,
    quantity: parseFloat(item.quantity) || 0,
    unitPrice: parseFloat(item.unitPrice) || 0,
  })) || [];

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
                <h1 className="ios-title">New Invoice</h1>
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

            {/* Create Invoice from Completed Job - only show when not already coming from a job/quote context */}
            {!urlJobId && !urlQuoteId && (
              <CompletedJobPicker
                onSelectJob={handleSelectJob}
                selectedJobId={selectedJobId}
              />
            )}

            {/* Client Selection */}
            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Client
                </div>
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

            {/* Invoice Details */}
            <Card className="rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  Invoice Details
                </div>

                {/* Template Selector */}
                {documentTemplates.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Template</Label>
                    <Popover open={templatePopoverOpen} onOpenChange={setTemplatePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={templatePopoverOpen}
                          className="w-full h-12 rounded-xl mt-1 justify-between font-normal"
                        >
                          {selectedTemplateId ? (
                            <div className="flex items-center gap-2 truncate">
                              <span className="truncate">
                                {documentTemplates.find(t => t.id === selectedTemplateId)?.name}
                              </span>
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                {documentTemplates.find(t => t.id === selectedTemplateId)?.tradeType}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Start from a template (optional)</span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search templates..." />
                          <CommandEmpty>No template found.</CommandEmpty>
                          <CommandList>
                            <CommandGroup>
                              {documentTemplates.map((template) => (
                                <CommandItem
                                  key={template.id}
                                  value={`${template.name} ${template.tradeType}`}
                                  onSelect={() => {
                                    setSelectedTemplateId(template.id);
                                    const found = documentTemplates.find((t) => t.id === template.id);
                                    if (found) {
                                      handleApplyTemplate(found);
                                    }
                                    setTemplatePopoverOpen(false);
                                  }}
                                >
                                  <Check className={`mr-2 h-4 w-4 ${selectedTemplateId === template.id ? 'opacity-100' : 'opacity-0'}`} />
                                  <span className="flex-1 truncate">{template.name}</span>
                                  <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">
                                    {template.tradeType}
                                  </Badge>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
                
                <div>
                  <Label htmlFor="title" className="text-xs text-muted-foreground">Title</Label>
                  <Input
                    id="title"
                    {...form.register("title")}
                    placeholder="e.g., Plumbing Services - March"
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
                  <Label htmlFor="dueDate" className="text-xs text-muted-foreground">Due Date</Label>
                  <div className="relative mt-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="dueDate"
                      type="date"
                      {...form.register("dueDate")}
                      className="h-12 rounded-xl pl-10"
                      data-testid="input-due-date"
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
                    {lineItems?.length || 0} {(lineItems?.length || 0) === 1 ? 'item' : 'items'}
                  </Badge>
                </div>

                {/* Item list - use lineItems from useWatch for reliable re-rendering */}
                <div className="space-y-2">
                  {(lineItems || []).map((item, index) => {
                    const itemTotal = calculateTotal(item?.quantity || "0", item?.unitPrice || "0");
                    
                    return (
                      <div 
                        key={`line-item-${index}`}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover-elevate"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item?.description || 'Untitled'}</p>
                          <p className="text-xs text-muted-foreground">
                            {(item as any)?.itemCode ? `${(item as any).itemCode} · ` : ''}{item?.quantity} × {formatCurrency(parseFloat(item?.unitPrice || "0"))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">{formatCurrency(itemTotal)}</p>
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
                            onClick={() => remove(index)}
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCatalogOpen(true)}
                    className="h-12 w-12 rounded-xl press-scale"
                    data-testid="button-from-catalog"
                  >
                    <BookOpen className="h-4 w-4" />
                  </Button>
                </div>

                {(lineItems?.length || 0) === 0 && form.formState.errors.lineItems && (
                  <p className="text-xs text-destructive">At least one line item required</p>
                )}

                {/* Totals */}
                {(lineItems?.length || 0) > 0 && (
                  <div className="pt-4 border-t space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">GST (10%)</span>
                      <span>{formatCurrency(gst)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold pt-2 border-t">
                      <span>Total (inc. GST)</span>
                      <span style={{ color: 'hsl(var(--trade))' }}>{formatCurrency(total)}</span>
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
                  Payment Terms & Notes
                </div>
                <Textarea
                  {...form.register("notes")}
                  placeholder="Payment terms, bank details, or notes for the client..."
                  className="rounded-xl min-h-[100px]"
                  data-testid="input-notes"
                />
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={createInvoiceMutation.isPending || isEditSaving}
              className="w-full h-14 rounded-2xl text-base font-semibold gap-2 press-scale"
              style={{ 
                backgroundColor: 'hsl(var(--trade))',
                color: 'white'
              }}
              data-testid={isEditMode ? "button-save-invoice" : "button-create-invoice"}
            >
              {(createInvoiceMutation.isPending || isEditSaving) ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isEditMode ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  {isEditMode ? 'Save Changes' : 'Create Invoice'}
                </>
              )}
            </Button>
          </form>

          <AlertDialog open={showExistingInvoiceDialog} onOpenChange={setShowExistingInvoiceDialog}>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" style={{ color: 'hsl(38 92% 50%)' }} />
                  Invoice Already Exists
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p>This job already has an invoice attached. Are you sure you want to create another one?</p>
                    
                    {existingInvoiceData && (
                      <Card className="bg-muted/50">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium text-sm text-foreground">{existingInvoiceData.title || 'Existing Invoice'}</span>
                            <Badge variant="secondary" className="text-xs capitalize">{existingInvoiceData.status}</Badge>
                          </div>
                          {existingInvoiceData.invoiceNumber && (
                            <p className="text-xs text-muted-foreground">#{existingInvoiceData.invoiceNumber}</p>
                          )}
                          {existingInvoiceData.total && (
                            <p className="text-sm font-semibold text-foreground">
                              ${parseFloat(existingInvoiceData.total).toFixed(2)}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel 
                  onClick={() => {
                    if (existingInvoiceData?.id) {
                      navigate(`/invoices/${existingInvoiceData.id}`);
                    }
                  }}
                >
                  View Existing Invoice
                </AlertDialogCancel>
                <AlertDialogAction onClick={() => setShowExistingInvoiceDialog(false)}>
                  Create Another Invoice
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
              type="invoice"
              documentNumber="INV-XXXXX"
              title={watchedValues.title}
              description={watchedValues.description}
              dueDate={watchedValues.dueDate}
              lineItems={previewLineItems}
              notes={watchedValues.notes}
              business={businessInfo}
              client={clientInfo}
              gstEnabled={gstEnabled}
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
            <div className="pt-2 p-3 rounded-xl bg-muted/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Line Total</span>
                <span className="font-semibold">{formatCurrency(calculateTotal(editForm.quantity, editForm.unitPrice))}</span>
              </div>
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
    </div>
  );
}
