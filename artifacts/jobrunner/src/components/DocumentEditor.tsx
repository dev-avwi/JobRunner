import { SearchableSelect } from "@/components/ui/searchable-select";
import { useState, useRef, useEffect } from "react";
import { getAuthHeaders } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/use-clients";
import { useCreateQuote } from "@/hooks/use-quotes";
import { useCreateInvoice } from "@/hooks/use-invoices";
import { useQuery } from "@tanstack/react-query";
import { useFeatureAccess } from "@/hooks/use-subscription";
import { 
  Save, 
  FileDown, 
  Printer, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X,
  Building2,
  User,
  Calendar,
  FileText,
  DollarSign,
  AlertCircle,
  Eye,
  Shield,
  CheckCircle2,
  ImagePlus,
  Crown,
  Sparkles
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const lineItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.number().min(0.01, "Quantity required"),
  unitPrice: z.number().min(0, "Price required"),
});

const documentSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  validUntil: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item required"),
});

type DocumentFormData = z.infer<typeof documentSchema>;

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface DocumentEditorProps {
  type: "quote" | "invoice";
  onSave?: (id: string) => void;
  onCancel?: () => void;
}

function InlineEditField({ 
  value, 
  onChange, 
  placeholder,
  type = "text",
  className = "",
  multiline = false
}: { 
  value: string; 
  onChange: (val: string) => void; 
  placeholder: string;
  type?: string;
  className?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    onChange(tempValue);
    setEditing(false);
  };

  const handleCancel = () => {
    setTempValue(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        {multiline ? (
          <Textarea
            ref={inputRef as any}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className={`min-h-[60px] text-sm ${className}`}
            placeholder={placeholder}
          />
        ) : (
          <Input
            ref={inputRef as any}
            type={type}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className={`h-7 text-sm ${className}`}
            placeholder={placeholder}
          />
        )}
      </div>
    );
  }

  return (
    <span 
      onClick={() => {
        setTempValue(value);
        setEditing(true);
      }}
      className={`cursor-pointer hover:bg-primary/5 rounded px-1 py-0.5 transition-colors border border-transparent hover:border-primary/20 ${!value ? "text-muted-foreground italic" : ""} ${className}`}
      data-testid="inline-edit-field"
    >
      {value || placeholder}
      <Edit2 className="inline-block w-3 h-3 ml-1 opacity-0 group-hover:opacity-50" />
    </span>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: string | Date | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function DocumentEditor({ type, onSave, onCancel }: DocumentEditorProps) {
  const { toast } = useToast();
  const { data: clients = [] } = useClients();
  const createQuoteMutation = useCreateQuote();
  const createInvoiceMutation = useCreateInvoice();
  const documentRef = useRef<HTMLDivElement>(null);
  
  const { data: businessSettings } = useQuery<any>({
    queryKey: ["/api/business-settings"],
  });

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

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0 }
  ]);
  const [editingLineItem, setEditingLineItem] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  
  // Get subscription status to determine Pro features access
  // During loading, features are optimistically enabled to prevent flicker for Pro users
  const { canUploadLogo, subscriptionTier, isLoading: isLoadingSubscription } = useFeatureAccess();
  const isPro = canUploadLogo || subscriptionTier === 'pro' || subscriptionTier === 'business';

  useEffect(() => {
    setHasChanges(true);
    setLastSaved(null);
  }, [selectedClientId, title, description, validUntil, dueDate, notes, lineItems]);

  const selectedClient = (clients as any[]).find(c => c.id === selectedClientId);
  const business = businessSettings || {
    businessName: userCheck?.user?.businessName || "Your Business Name",
    abn: "",
    address: "",
    phone: "",
    email: userCheck?.user?.email || "",
    brandColor: "#2563eb",
    gstEnabled: true,
  };

  const brandColor = business.brandColor || (type === "quote" ? "#2563eb" : "#dc2626");
  const isGstRegistered = business.gstEnabled !== false;

  const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const gstAmount = isGstRegistered ? subtotal * 0.1 : 0;
  const total = subtotal + gstAmount;

  const documentTitle = type === "quote" 
    ? "QUOTE" 
    : (isGstRegistered ? "TAX INVOICE" : "INVOICE");

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unitPrice: 0 }]);
    setEditingLineItem(lineItems.length);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    if (field === "quantity" || field === "unitPrice") {
      updated[index][field] = typeof value === "string" ? parseFloat(value) || 0 : value;
    } else {
      updated[index][field] = value as string;
    }
    setLineItems(updated);
  };

  const handleSave = async () => {
    if (!selectedClientId) {
      toast({ title: "Error", description: "Please select a client", variant: "destructive" });
      return;
    }
    if (!title) {
      toast({ title: "Error", description: "Please enter a title", variant: "destructive" });
      return;
    }
    if (lineItems.some(item => !item.description || item.unitPrice <= 0)) {
      toast({ title: "Error", description: "Please complete all line items", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const formattedLineItems = lineItems.map((item, index) => ({
        description: item.description,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        total: (item.quantity * item.unitPrice).toFixed(2),
        sortOrder: index + 1,
      }));

      if (type === "quote") {
        const result = await createQuoteMutation.mutateAsync({
          clientId: selectedClientId,
          title,
          description,
          validUntil,
          subtotal: subtotal.toFixed(2),
          gstAmount: gstAmount.toFixed(2),
          total: total.toFixed(2),
          lineItems: formattedLineItems,
        });
        toast({ title: "Quote saved", description: `Quote ${result.number} created successfully` });
        setLastSaved(new Date().toLocaleTimeString());
        setHasChanges(false);
        if (onSave) onSave(result.id);
      } else {
        const result = await createInvoiceMutation.mutateAsync({
          clientId: selectedClientId,
          title,
          description,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          notes,
          subtotal: subtotal.toFixed(2),
          gstAmount: gstAmount.toFixed(2),
          total: total.toFixed(2),
          lineItems: formattedLineItems.map(item => ({
            ...item,
            quantity: parseFloat(item.quantity),
            unitPrice: parseFloat(item.unitPrice),
          })),
        });
        toast({ title: "Invoice saved", description: `Invoice ${result.number} created successfully` });
        setLastSaved(new Date().toLocaleTimeString());
        setHasChanges(false);
        if (onSave) onSave(result.id);
      }
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to save document", 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsPDF = async () => {
    if (!selectedClientId || !title) {
      toast({ title: "Error", description: "Please complete the document before downloading", variant: "destructive" });
      return;
    }

    setIsGeneratingPDF(true);
    try {
      const formattedLineItems = lineItems.map((item, index) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
        sortOrder: index + 1,
      }));

      const response = await fetch(`/api/${type}s/preview-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clientId: selectedClientId,
          title,
          description,
          validUntil: type === "quote" ? validUntil : undefined,
          dueDate: type === "invoice" ? dueDate : undefined,
          notes,
          subtotal,
          gstAmount,
          total,
          lineItems: formattedLineItems,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${title.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "PDF Downloaded", description: "Your document has been saved as PDF" });
    } catch (error) {
      toast({ 
        title: "PDF Download Failed", 
        description: "Could not generate PDF. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = () => {
    const printContent = documentRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Error", description: "Please allow popups to print", variant: "destructive" });
      return;
    }

    const styles = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 11px;
          line-height: 1.5;
          color: #1a1a1a;
          padding: 40px;
        }
        .document { max-width: 800px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid ${brandColor}; }
        .company-name { font-size: 24px; font-weight: 700; color: ${brandColor}; margin-bottom: 8px; }
        .company-details { color: #666; font-size: 10px; line-height: 1.6; }
        .document-title { font-size: 28px; font-weight: 700; color: ${brandColor}; text-transform: uppercase; letter-spacing: 2px; text-align: right; }
        .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; gap: 40px; }
        .info-block { flex: 1; }
        .info-label { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 6px; font-weight: 600; }
        .info-value { color: #1a1a1a; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: ${brandColor}; color: white; padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; }
        th:not(:first-child) { text-align: right; }
        td { padding: 12px; border-bottom: 1px solid #eee; }
        td:not(:first-child) { text-align: right; }
        .totals { text-align: right; margin-bottom: 30px; }
        .totals-row { display: flex; justify-content: flex-end; padding: 8px 0; }
        .totals-label { width: 150px; text-align: left; color: #666; }
        .totals-value { width: 120px; text-align: right; font-weight: 600; }
        .total-row { border-top: 2px solid ${brandColor}; padding-top: 12px; margin-top: 8px; }
        .total-row .totals-label, .total-row .totals-value { font-size: 16px; font-weight: 700; color: ${brandColor}; }
        .notes { background: #f8f9fa; padding: 16px; border-radius: 6px; margin-bottom: 20px; }
        .notes-title { font-weight: 600; margin-bottom: 8px; }
        .footer { margin-top: 40px; text-align: center; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
        @media print { body { padding: 20px; } }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${documentTitle} - ${title}</title>
        ${styles}
      </head>
      <body>
        <div class="document">
          <div class="header">
            <div>
              <div class="company-name">${business.businessName}</div>
              <div class="company-details">
                ${business.abn ? `<div>ABN: ${business.abn}</div>` : ''}
                ${business.address ? `<div>${business.address}</div>` : ''}
                ${business.phone ? `<div>Phone: ${business.phone}</div>` : ''}
                ${business.email ? `<div>Email: ${business.email}</div>` : ''}
              </div>
            </div>
            <div>
              <div class="document-title">${documentTitle}</div>
            </div>
          </div>
          
          <div class="info-section">
            <div class="info-block">
              <div class="info-label">${type === "quote" ? "Quote For" : "Bill To"}</div>
              <div class="info-value">
                <strong>${selectedClient?.name || "Select Client"}</strong><br/>
                ${selectedClient?.address || ""}<br/>
                ${selectedClient?.email || ""}<br/>
                ${selectedClient?.phone || ""}
              </div>
            </div>
            <div class="info-block">
              <div class="info-label">${type === "quote" ? "Quote" : "Invoice"} Details</div>
              <div class="info-value">
                <strong>Date:</strong> ${formatDate(new Date())}<br/>
                ${type === "quote" && validUntil ? `<strong>Valid Until:</strong> ${formatDate(validUntil)}` : ''}
                ${type === "invoice" && dueDate ? `<strong>Due Date:</strong> ${formatDate(dueDate)}` : ''}
              </div>
            </div>
          </div>

          ${description ? `
            <div class="notes">
              <div class="notes-title">${title}</div>
              <div>${description}</div>
            </div>
          ` : ''}

          <table>
            <thead>
              <tr>
                <th style="width: 50%">Description</th>
                <th style="width: 15%">Qty</th>
                <th style="width: 17%">Unit Price</th>
                <th style="width: 18%">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lineItems.map(item => `
                <tr>
                  <td>${item.description || '-'}</td>
                  <td>${item.quantity.toFixed(2)}</td>
                  <td>${formatCurrency(item.unitPrice)}</td>
                  <td>${formatCurrency(item.quantity * item.unitPrice)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <span class="totals-label">Subtotal</span>
              <span class="totals-value">${formatCurrency(subtotal)}</span>
            </div>
            ${gstAmount > 0 ? `
              <div class="totals-row">
                <span class="totals-label">GST (10%)</span>
                <span class="totals-value">${formatCurrency(gstAmount)}</span>
              </div>
            ` : ''}
            <div class="totals-row total-row">
              <span class="totals-label">Total${gstAmount > 0 ? ' (incl. GST)' : ''}</span>
              <span class="totals-value">${formatCurrency(total)}</span>
            </div>
          </div>

          ${notes ? `
            <div class="notes">
              <div class="notes-title">Notes</div>
              <div>${notes}</div>
            </div>
          ` : ''}

          <div class="footer">
            <p>Thank you for your business!</p>
            ${business.abn ? `<p>ABN: ${business.abn}</p>` : ''}
          </div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const missingInfo = [];
  if (!business.abn && total > 82.50) missingInfo.push("ABN required for invoices over $82.50");
  if (!business.address) missingInfo.push("Business address");
  if (!business.phone) missingInfo.push("Phone number");

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-4" data-testid="document-editor">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">
            Create New {type === "quote" ? "Quote" : "Invoice"}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
              <Eye className="w-3 h-3 mr-1" />
              Live Preview
            </Badge>
            {lastSaved ? (
              <Badge variant="outline" className="text-xs border-green-300 text-green-700 dark:border-green-700 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Saved at {lastSaved}
              </Badge>
            ) : hasChanges ? (
              <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
                <AlertCircle className="w-3 h-3 mr-1" />
                Unsaved changes
              </Badge>
            ) : null}
            <span className="text-sm text-muted-foreground hidden sm:inline">
              What you see is what your client receives
            </span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePrint}
            data-testid="button-print"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSaveAsPDF}
            disabled={isGeneratingPDF}
            data-testid="button-save-pdf"
          >
            <FileDown className="w-4 h-4 mr-2" />
            {isGeneratingPDF ? "Generating..." : "Save as PDF"}
          </Button>
          <Button 
            size="sm" 
            variant="brand"
            onClick={handleSave}
            disabled={isSaving}
            className="font-semibold shadow-sm"
            data-testid="button-save-document"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} data-testid="button-cancel">
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {missingInfo.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">Complete your business profile</p>
            <p className="text-amber-700 dark:text-amber-300">{missingInfo.join(", ")}</p>
          </div>
        </div>
      )}

      <Card className="overflow-hidden shadow-lg">
        <div 
          ref={documentRef}
          className="bg-white dark:bg-gray-950 p-6 sm:p-10"
          style={{ minHeight: "800px" }}
        >
          <div 
            className="pb-6 mb-6 flex flex-col sm:flex-row justify-between gap-6"
            style={{ borderBottom: `3px solid ${brandColor}` }}
          >
            <div className="flex gap-4 flex-1">
              {/* Logo Spot - Click to add logo (Pro) or show upgrade (Free) */}
              <a
                href={isPro ? "/settings?tab=branding" : undefined}
                className={`w-24 h-24 sm:w-28 sm:h-28 border-2 border-dashed rounded-lg flex-shrink-0 flex items-center justify-center transition-all group relative overflow-visible no-underline ${
                  isLoadingSubscription ? 'opacity-50 cursor-wait pointer-events-none' : 'cursor-pointer hover:bg-muted/50'
                }`}
                style={{ borderColor: business.logoUrl ? 'transparent' : `${brandColor}40` }}
                onClick={(e) => {
                  // While loading, prevent any interaction
                  if (isLoadingSubscription) {
                    e.preventDefault();
                    return;
                  }
                  // Free users get upgrade dialog instead of navigation
                  if (!isPro) {
                    e.preventDefault();
                    setShowUpgradeDialog(true);
                  }
                  // Pro users: allow default anchor behavior to navigate to settings
                }}
                onKeyDown={(e) => {
                  // Handle keyboard interaction for accessibility
                  if ((e.key === 'Enter' || e.key === ' ') && !isLoadingSubscription && !isPro) {
                    e.preventDefault();
                    setShowUpgradeDialog(true);
                  }
                }}
                tabIndex={isLoadingSubscription ? -1 : 0}
                role="button"
                aria-label={isLoadingSubscription ? "Loading subscription status" : isPro ? "Click to manage business logo in settings" : "Upgrade to Pro to add your business logo"}
                aria-disabled={isLoadingSubscription}
                data-testid="logo-spot"
              >
                {isLoadingSubscription ? (
                  <div className="text-center p-2">
                    <div className="h-6 w-6 mx-auto mb-1 rounded-full border-2 border-muted-foreground/30 border-t-transparent animate-spin" />
                    <span className="text-[10px] text-muted-foreground block">Loading...</span>
                  </div>
                ) : business.logoUrl ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img 
                      src={business.logoUrl} 
                      alt="Business Logo" 
                      className="max-w-full max-h-full object-contain rounded"
                    />
                    {/* Pro badge overlay for logo management */}
                    {isPro && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                        <span className="text-white text-xs font-medium">Change Logo</span>
                      </div>
                    )}
                  </div>
                ) : isPro ? (
                  <div className="text-center p-2 group-hover:scale-105 transition-transform">
                    <ImagePlus className="h-6 w-6 mx-auto mb-1" style={{ color: brandColor }} />
                    <span className="text-[10px] text-muted-foreground block">Add Logo</span>
                    <span className="text-[9px] text-muted-foreground/70">Click to add</span>
                  </div>
                ) : (
                  <div className="text-center p-2 group-hover:scale-105 transition-transform">
                    <div className="relative">
                      <Crown className="h-6 w-6 mx-auto text-amber-500 mb-1" />
                      <Sparkles className="h-3 w-3 absolute -top-1 -right-1 text-amber-400" />
                    </div>
                    <span className="text-[10px] text-muted-foreground block">Your Logo</span>
                    <Badge variant="outline" className="mt-1 text-[8px] px-1.5 py-0 h-4 bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-300 text-amber-700 dark:text-amber-400">
                      <Crown className="h-2 w-2 mr-0.5" />
                      Pro
                    </Badge>
                  </div>
                )}
              </a>
              
              <div className="flex-1">
                <div 
                  className="text-xl sm:text-2xl font-bold mb-2"
                  style={{ color: brandColor }}
                >
                  {business.businessName}
                </div>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  {business.abn && <p><strong>ABN:</strong> {business.abn}</p>}
                  {business.address && <p>{business.address}</p>}
                  {business.phone && <p>Phone: {business.phone}</p>}
                  {business.email && <p>Email: {business.email}</p>}
                  {business.licenseNumber && <p>Licence: {business.licenseNumber}</p>}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div 
                className="text-2xl sm:text-3xl font-bold uppercase tracking-wider"
                style={{ color: brandColor }}
              >
                {documentTitle}
              </div>
              <Badge variant="outline" className="mt-2">Draft</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-2">
                <User className="w-3 h-3" />
                {type === "quote" ? "Quote For" : "Bill To"}
                <Badge 
                  variant="outline" 
                  className="text-[9px] px-1.5 py-0 h-4"
                  style={{ 
                    borderColor: 'hsl(var(--trade) / 0.3)',
                    color: 'hsl(var(--trade))'
                  }}
                >
                  <Eye className="w-2 h-2 mr-0.5" />
                  Client sees this
                </Badge>
              </div>
              <SearchableSelect
                value={selectedClientId}
                onValueChange={setSelectedClientId}
                placeholder="Click to select client"
                searchPlaceholder="Search clients..."
                emptyMessage="No clients found."
                options={(clients as any[]).map((client) => ({
                  value: client.id,
                  label: client.name,
                  description: client.phone || undefined,
                }))}
                data-testid="select-client"
              />
              {selectedClient && (
                <div className="mt-2 text-sm space-y-0.5">
                  {selectedClient.address && <p>{selectedClient.address}</p>}
                  {selectedClient.email && <p>{selectedClient.email}</p>}
                  {selectedClient.phone && <p>{selectedClient.phone}</p>}
                </div>
              )}
            </div>
            
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {type === "quote" ? "Quote" : "Invoice"} Details
              </div>
              <div className="text-sm space-y-1">
                <p><strong>Date:</strong> {formatDate(new Date())}</p>
                {type === "quote" && (
                  <div className="flex items-center gap-2">
                    <strong>Valid Until:</strong>
                    <Input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="h-7 w-40"
                      data-testid="input-valid-until"
                    />
                  </div>
                )}
                {type === "invoice" && (
                  <div className="flex items-center gap-2">
                    <strong>Due Date:</strong>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="h-7 w-40"
                      data-testid="input-due-date"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mb-6 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4" style={{ color: brandColor }} />
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter document title (e.g., Kitchen Renovation Quote)"
                className="font-semibold border-none bg-transparent p-0 h-auto focus-visible:ring-0 text-base"
                data-testid="input-title"
              />
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description of the work (optional)"
              className="border-none bg-transparent p-0 resize-none focus-visible:ring-0 text-sm"
              rows={2}
              data-testid="input-description"
            />
          </div>

          <div className="mb-6 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ backgroundColor: brandColor }}>
                  <th className="text-left text-white p-3 text-xs uppercase tracking-wide font-semibold" style={{ width: "50%" }}>
                    Description
                  </th>
                  <th className="text-right text-white p-3 text-xs uppercase tracking-wide font-semibold" style={{ width: "12%" }}>
                    Qty
                  </th>
                  <th className="text-right text-white p-3 text-xs uppercase tracking-wide font-semibold" style={{ width: "18%" }}>
                    Unit Price
                  </th>
                  <th className="text-right text-white p-3 text-xs uppercase tracking-wide font-semibold" style={{ width: "15%" }}>
                    Amount
                  </th>
                  <th className="p-3" style={{ width: "5%" }}></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={index} className="border-b border-muted group">
                    <td className="p-2">
                      <Input
                        value={item.description}
                        onChange={(e) => updateLineItem(index, "description", e.target.value)}
                        placeholder="Item description"
                        className="border-none bg-transparent p-0 h-auto focus-visible:ring-1"
                        data-testid={`input-line-description-${index}`}
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={item.quantity || ""}
                        onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                        placeholder="1"
                        className="border-none bg-transparent p-0 h-auto focus-visible:ring-1 text-right w-16 ml-auto"
                        step="0.01"
                        data-testid={`input-line-qty-${index}`}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-muted-foreground">$</span>
                        <Input
                          type="number"
                          value={item.unitPrice || ""}
                          onChange={(e) => updateLineItem(index, "unitPrice", e.target.value)}
                          placeholder="0.00"
                          className="border-none bg-transparent p-0 h-auto focus-visible:ring-1 text-right w-20"
                          step="0.01"
                          data-testid={`input-line-price-${index}`}
                        />
                      </div>
                    </td>
                    <td className="p-2 text-right font-medium">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </td>
                    <td className="p-2">
                      {lineItems.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeLineItem(index)}
                          data-testid={`button-remove-line-${index}`}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={addLineItem}
              data-testid="button-add-line-item"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Line Item
            </Button>
          </div>

          <div className="flex justify-end mb-8">
            <div className="w-72 space-y-2">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {gstAmount > 0 && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">GST (10%)</span>
                  <span className="font-medium">{formatCurrency(gstAmount)}</span>
                </div>
              )}
              <div 
                className="flex justify-between py-3 text-lg font-bold"
                style={{ borderTop: `2px solid ${brandColor}`, color: brandColor }}
              >
                <span>Total{gstAmount > 0 ? " (incl. GST)" : ""}</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {type === "invoice" && (
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Notes
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add payment instructions or additional notes for your client"
                className="resize-none"
                rows={3}
                data-testid="input-notes"
              />
            </div>
          )}

          <div className="border-t pt-6 mt-8 text-center text-xs text-muted-foreground">
            <p>Thank you for your business!</p>
            {business.abn && <p className="mt-1">ABN: {business.abn}</p>}
          </div>
        </div>
      </Card>

      <Card className="border-dashed">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold">Australian Compliance Checklist</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              {business.abn ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              )}
              <span className={business.abn ? "" : "text-muted-foreground"}>
                ABN displayed {!business.abn && "(recommended)"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {gstAmount > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted flex-shrink-0" />
              )}
              <span className={gstAmount > 0 ? "" : "text-muted-foreground"}>
                GST at 10% {gstAmount > 0 ? "applied" : "(optional)"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {type === "invoice" && gstAmount > 0 && documentTitle.includes("TAX INVOICE") ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              ) : type === "invoice" && gstAmount > 0 ? (
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted flex-shrink-0" />
              )}
              <span className={type === "invoice" ? "" : "text-muted-foreground"}>
                "TAX INVOICE" label {type === "invoice" && gstAmount > 0 ? "(required for GST)" : "(invoices with GST)"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedClient?.address ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted flex-shrink-0" />
              )}
              <span className={selectedClient?.address ? "" : "text-muted-foreground"}>
                Client address {selectedClient?.address ? "included" : "(recommended)"}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Documents meeting ATO requirements help with tax compliance and professional credibility.
          </p>
        </div>
      </Card>

      {/* Upgrade to Pro Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Upgrade to Pro
            </DialogTitle>
            <DialogDescription>
              Add your logo to quotes and invoices for a professional look that builds client trust.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <ImagePlus className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Custom Logo on Documents</p>
                <p className="text-xs text-muted-foreground">Your branding on every quote and invoice</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Custom Brand Colors</p>
                <p className="text-xs text-muted-foreground">Match documents to your business identity</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <FileText className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-sm">Unlimited Templates</p>
                <p className="text-xs text-muted-foreground">Save and reuse your best quotes</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50 rounded-lg p-4 text-center">
            <Badge className="bg-green-600 text-white mb-2">FREE for Early Access Members!</Badge>
            <p className="text-sm text-muted-foreground">
              All Pro features are included free during Early Access.
            </p>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Maybe Later
            </Button>
            <Button 
              onClick={() => {
                setShowUpgradeDialog(false);
                window.location.href = '/settings?tab=branding';
              }}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
            >
              <Crown className="h-4 w-4 mr-2" />
              Set Up Logo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}