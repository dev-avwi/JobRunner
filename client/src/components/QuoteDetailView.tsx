import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Printer, ArrowLeft, Send, FileText, Download, Mail, AlertTriangle, ChevronRight, FolderOpen, Briefcase, PlusCircle, Receipt, Camera, ChevronDown, StickyNote, Image, Layers, Eye, Loader2, Edit2, History, Clock, X, UploadCloud, CheckCircle2 } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConvertQuoteToInvoice } from "@/hooks/use-quotes";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useToast } from "@/hooks/use-toast";
import { queryClient, getSessionToken, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useIntegrationHealth, isEmailReady } from "@/hooks/use-integration-health";
import StatusBadge from "./StatusBadge";
import SendDocumentModal from "./SendDocumentModal";
import { getTemplateStyles, TemplateId, DEFAULT_TEMPLATE } from "@/lib/document-templates";
import type { BusinessTemplate } from "@shared/schema";
import { ImportOriginBadge } from "./ImportOriginBadge";

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {};
  const token = getSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

interface QuoteDetailViewProps {
  quoteId: string;
  onBack?: () => void;
  onSend?: (id: string) => void;
}

interface JobPhoto {
  id: string;
  url: string;
  category?: string;
  caption?: string;
  createdAt: string;
}

interface JobNote {
  id: string;
  content: string;
  createdByName?: string;
  createdAt: string;
}

export default function QuoteDetailView({ quoteId, onBack, onSend }: QuoteDetailViewProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [jobContextOpen, setJobContextOpen] = useState(false);
  const [includeBeforePhotos, setIncludeBeforePhotos] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [, setLocation] = useLocation();
  const { data: businessSettings } = useBusinessSettings();
  const { data: integrationHealth } = useIntegrationHealth();
  const { toast } = useToast();

  const emailConnected = isEmailReady(integrationHealth);
  const convertToInvoiceMutation = useConvertQuoteToInvoice();
  const brandColor = businessSettings?.brandColor || '#2563eb';
  const templateId = (businessSettings?.documentTemplate as TemplateId) || DEFAULT_TEMPLATE;
  const templateStyles = getTemplateStyles(templateId, brandColor);
  const { template, primaryColor, headingStyle, tableHeaderStyle, getTableRowStyle, getNoteStyle } = templateStyles;

  const { data: quote, isLoading } = useQuery({
    queryKey: ['/api/quotes', quoteId],
    queryFn: async () => {
      const response = await fetch(`/api/quotes/${quoteId}?_t=${Date.now()}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch quote');
      return response.json();
    }
  });

  const { data: quoteVersions = [] } = useQuery<any[]>({
    queryKey: ['/api/quotes', quoteId, 'versions'],
    queryFn: async () => {
      const response = await fetch(`/api/quotes/${quoteId}/versions`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!quote,
  });

  const { data: client } = useQuery({
    queryKey: ['/api/clients', quote?.clientId],
    queryFn: async () => {
      if (!quote?.clientId) return null;
      const response = await fetch(`/api/clients/${quote.clientId}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch client');
      return response.json();
    },
    enabled: !!quote?.clientId
  });

  const { data: job } = useQuery({
    queryKey: ['/api/jobs', quote?.jobId],
    queryFn: async () => {
      if (!quote?.jobId) return null;
      const response = await fetch(`/api/jobs/${quote.jobId}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch job');
      return response.json();
    },
    enabled: !!quote?.jobId
  });

  const { data: linkedInvoice, isLoading: isLinkedInvoiceLoading } = useQuery({
    queryKey: ['/api/invoices', { quoteId }],
    queryFn: async () => {
      const response = await fetch(`/api/invoices?quoteId=${quoteId}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) return null;
      const invoices = await response.json();
      return Array.isArray(invoices) && invoices.length > 0 ? invoices[0] : null;
    },
    enabled: !!quote && quote.status === 'accepted'
  });

  const { data: termsTemplate } = useQuery<BusinessTemplate>({
    queryKey: ["/api/business-templates/active/terms_conditions"],
    enabled: !!quote,
  });

  const { data: warrantyTemplate } = useQuery<BusinessTemplate>({
    queryKey: ["/api/business-templates/active/warranty"],
    enabled: !!quote,
  });

  const { data: jobPhotos = [], isLoading: photosLoading } = useQuery<JobPhoto[]>({
    queryKey: ['/api/jobs', quote?.jobId, 'photos'],
    queryFn: async () => {
      const response = await fetch(`/api/jobs/${quote!.jobId}/photos`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!quote?.jobId && jobContextOpen,
  });

  const { data: jobNotes = [], isLoading: notesLoading } = useQuery<JobNote[]>({
    queryKey: ['/api/jobs', quote?.jobId, 'notes'],
    queryFn: async () => {
      const response = await fetch(`/api/jobs/${quote!.jobId}/notes`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!quote?.jobId && jobContextOpen,
  });

  const buildPdfUrl = () => {
    const pdfParams = new URLSearchParams();
    if (includeBeforePhotos) pdfParams.set('includeBeforePhotos', 'true');
    if (!includeNotes) pdfParams.set('excludeNotes', 'true');
    return `/api/quotes/${quoteId}/pdf${pdfParams.toString() ? '?' + pdfParams.toString() : ''}`;
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const response = await fetch(buildPdfUrl(), {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-10000px';
      iframe.style.left = '-10000px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.addEventListener('load', () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            toast({
              title: "Print Unavailable",
              description: "Could not open print dialog. Try using Save as PDF instead.",
              variant: "destructive",
            });
          }
          setTimeout(() => {
            document.body.removeChild(iframe);
            window.URL.revokeObjectURL(url);
          }, 60000);
        }, 500);
      });
    } catch (error) {
      console.error('Error generating PDF for print:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF for printing. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const isIOSSafari = () => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isWebKit = /WebKit/.test(ua);
    const isChrome = /CriOS/.test(ua);
    const isFirefox = /FxiOS/.test(ua);
    return isIOS && isWebKit && !isChrome && !isFirefox;
  };

  const handleSaveAsPDF = async () => {
    setIsPrinting(true);
    const pdfUrl = buildPdfUrl();
    const filename = `Quote-${quote?.number || quote?.id || quoteId}.pdf`;
    
    let pdfWindow: Window | null = null;
    if (isIOSSafari()) {
      pdfWindow = window.open('', '_blank');
      if (pdfWindow) {
        pdfWindow.document.write('<html><head><title>Generating PDF...</title></head><body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;"><p>Generating PDF, please wait...</p></body></html>');
      }
    }
    
    try {
      const response = await fetch(pdfUrl, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      if (isIOSSafari() && pdfWindow) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          pdfWindow!.document.write(`<html><head><title>${filename}</title></head><body style="margin:0;"><embed width="100%" height="100%" src="${dataUrl}" type="application/pdf" /></body></html>`);
          pdfWindow!.document.close();
        };
        reader.readAsDataURL(blob);
        window.URL.revokeObjectURL(url);
        toast({
          title: "PDF Opened",
          description: "PDF opened in new tab.",
        });
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(url), 5000);
        toast({
          title: "PDF Downloaded",
          description: "Quote PDF has been downloaded successfully.",
        });
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      if (pdfWindow) {
        pdfWindow.close();
      }
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Generate the public quote URL for email
  const getPublicQuoteUrl = () => {
    return quote?.acceptanceToken 
      ? `${window.location.origin}/portal/quote/${quote.acceptanceToken}`
      : undefined;
  };

  // Task #93: Push to Xero via the real Xero Quotes API.
  const { data: xeroStatus } = useQuery<{ configured: boolean; connected: boolean }>({
    queryKey: ['/api/integrations/xero/status'],
  });

  const pushQuoteToXeroMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/integrations/xero/push-quote-real/${quoteId}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', quoteId] });
      if (data?.success && data?.xeroQuoteId) {
        toast({ title: 'Pushed to Xero', description: 'Quote has been synced to Xero successfully.' });
      } else {
        toast({ title: 'Connect Xero', description: data?.message || 'Connect Xero first to push this quote.' });
      }
    },
    onError: (error: any) => {
      toast({ title: 'Push to Xero Failed', description: error?.message || 'Failed to push quote to Xero', variant: 'destructive' });
    },
  });

  // Convert quote to invoice
  const handleConvertToInvoice = async () => {
    if (!quote) return;
    try {
      const result = await convertToInvoiceMutation.mutateAsync(quote.id);
      toast({
        title: "Invoice Created",
        description: `Quote ${quote.number} has been converted to invoice ${result?.number || ''}`,
      });
      // Navigate to the new invoice
      if (result?.id) {
        setLocation(`/invoices/${result.id}`);
      }
    } catch (error) {
      console.error('Error converting quote to invoice:', error);
      toast({
        title: "Error",
        description: "Failed to convert quote to invoice. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading || !quote) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading quote details...</p>
        </div>
      </div>
    );
  }

  const subtotal = Number(quote.subtotal || 0);
  const gstAmount = Number(quote.gstAmount || 0);
  const total = Number(quote.total || 0);

  return (
    <>
      <style>{`
        @media print {
          * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: none !important;
            margin: 0 !important;
            padding: 10px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            height: auto !important;
            overflow: visible !important;
            font-size: 9px !important;
          }
          .no-print { display: none !important; }
          .print-job-context [data-state] { display: block !important; }
          .print-job-context .no-print { display: none !important; }
          body {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            height: auto !important;
            overflow: visible !important;
          }
          html, body {
            height: auto !important;
            overflow: visible !important;
          }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          @page { size: A4; margin: 10mm; }
          .print-content h1 { font-size: 18px !important; margin-bottom: 4px !important; }
          .print-content h2 { font-size: 16px !important; }
          .print-content h3 { font-size: 10px !important; margin-bottom: 2px !important; }
          .print-content p, .print-content span, .print-content td, .print-content th, .print-content div { font-size: inherit !important; }
          .print-content .text-2xl, .print-content .sm\\:text-3xl, .print-content .text-3xl { font-size: 18px !important; }
          .print-content .text-xl { font-size: 14px !important; }
          .print-content .text-lg { font-size: 11px !important; }
          .print-content .text-base { font-size: 9px !important; }
          .print-content .text-sm { font-size: 8px !important; }
          .print-content .text-xs { font-size: 7px !important; }
          .print-content .mb-8 { margin-bottom: 4px !important; }
          .print-content .mb-6 { margin-bottom: 4px !important; }
          .print-content .mb-4 { margin-bottom: 3px !important; }
          .print-content .mb-3 { margin-bottom: 2px !important; }
          .print-content .mb-2 { margin-bottom: 1px !important; }
          .print-content .mt-10, .print-content .mt-8, .print-content .mt-6 { margin-top: 6px !important; }
          .print-content .mt-4 { margin-top: 4px !important; }
          .print-content .p-6, .print-content .sm\\:p-8 { padding: 10px 14px !important; }
          .print-content .p-5, .print-content .p-4 { padding: 6px 10px !important; }
          .print-content .pt-5, .print-content .pt-4 { padding-top: 4px !important; }
          .print-content .pb-4, .print-content .pb-3 { padding-bottom: 3px !important; }
          .print-content .gap-6 { gap: 8px !important; }
          .print-content .gap-4 { gap: 4px !important; }
          .print-content .gap-3 { gap: 3px !important; }
          .print-content .space-y-4 > * + * { margin-top: 4px !important; }
          .print-content .space-y-3 > * + * { margin-top: 3px !important; }
          .print-content .space-y-2 > * + * { margin-top: 2px !important; }
          .print-content .space-y-0\\.5 > * + * { margin-top: 0px !important; }
          .print-content .max-w-\\[150px\\] { max-width: 100px !important; }
          .print-content .max-h-\\[60px\\] { max-height: 40px !important; }
          .print-content table th, .print-content table td { padding: 4px 6px !important; font-size: 8px !important; }
          .print-content .whitespace-pre-wrap { font-size: 7px !important; line-height: 1.3 !important; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Logical breadcrumb navigation */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4 no-print">
          <button 
            onClick={() => setLocation('/documents?tab=quotes')} 
            className="hover:text-foreground transition-colors flex items-center gap-1"
            data-testid="breadcrumb-documents"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Documents
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{quote.number || `Q-${quote.id?.substring(0,8).toUpperCase()}`}</span>
        </div>

        <div className="space-y-3 mb-6 no-print">
          {/* Row 1: Back + Title */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={onBack || (() => setLocation('/documents?tab=quotes'))} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Quote Details</h1>
          </div>

          {/* Row 2: Primary workflow actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Edit - available for draft and sent quotes */}
            {(quote.status === 'draft' || quote.status === 'sent') && (
              <Button 
                variant="outline" 
                onClick={() => setLocation(`/quotes/${quote.id}/edit`)}
                data-testid="button-edit-quote"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Quote
              </Button>
            )}
            {/* Send / Resend - Primary action */}
            {(quote.status === 'draft' || quote.status === 'sent') && client?.email && (
              emailConnected ? (
                <Button onClick={() => setShowEmailCompose(true)} data-testid="button-send-email">
                  <Mail className="h-4 w-4 mr-2" />
                  {quote.status === 'draft' ? 'Send Quote' : 'Resend'}
                </Button>
              ) : (
                <div 
                  className="flex items-center gap-2 p-1.5 px-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800"
                  data-testid="warning-email-not-configured"
                >
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-medium text-amber-800 dark:text-amber-400">Email not set up</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setLocation('/integrations')}
                    data-testid="button-setup-email"
                  >
                    Set Up
                  </Button>
                </div>
              )
            )}
            {/* Legacy onSend prop support */}
            {quote.status === 'draft' && onSend && !client?.email && (
              <Button onClick={() => onSend(quote.id)} data-testid={`button-send-${quote.id}`}>
                <Send className="h-4 w-4 mr-2" />
                Send Quote
              </Button>
            )}
            {/* Create Job from Quote - accepted quotes without a linked job */}
            {quote.status === 'accepted' && !quote.jobId && (
              <Button 
                onClick={() => setLocation(`/jobs/new?quoteId=${quote.id}&clientId=${quote.clientId}`)}
                style={{ backgroundColor: 'hsl(142.1 76.2% 36.3%)', color: 'white' }}
                data-testid="button-create-job-from-quote"
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Create Job
              </Button>
            )}
            {/* Convert to Invoice - accepted quotes without linked invoice */}
            {quote.status === 'accepted' && !linkedInvoice && !isLinkedInvoiceLoading && (
              <Button 
                onClick={handleConvertToInvoice}
                variant="outline"
                disabled={convertToInvoiceMutation.isPending}
                data-testid="button-convert-to-invoice"
              >
                <Receipt className="h-4 w-4 mr-2" />
                {convertToInvoiceMutation.isPending ? 'Converting...' : 'Convert to Invoice'}
              </Button>
            )}

            {/* Task #93: Push to Xero (real Xero Quotes API). Treats both
                xeroQuoteId (new path) and xeroInvoiceId (legacy DRAFT-invoice
                path) as already-synced so legacy quotes don't get double-pushed. */}
            {xeroStatus?.connected && (quote.status === 'sent' || quote.status === 'accepted') && !quote.xeroQuoteId && !quote.xeroInvoiceId && (
              <Button
                variant="outline"
                onClick={() => pushQuoteToXeroMutation.mutate()}
                disabled={pushQuoteToXeroMutation.isPending}
                data-testid="button-push-quote-to-xero"
              >
                {pushQuoteToXeroMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4 mr-2" />
                )}
                {pushQuoteToXeroMutation.isPending ? 'Pushing...' : 'Push to Xero'}
              </Button>
            )}
            {xeroStatus?.connected && (!!quote.xeroQuoteId || !!quote.xeroInvoiceId) && (
              <Badge variant="secondary" className="gap-1" data-testid="badge-quote-pushed-xero">
                <CheckCircle2 className="h-3 w-3" />
                Pushed to Xero
              </Badge>
            )}
            <ImportOriginBadge importRunId={(quote as any).importRunId} rowNumber={(quote as any).importRowNumber} />

            {/* Divider between workflow actions and document tools */}
            <div className="hidden sm:block w-px h-6 bg-border" />

            {/* Navigation to linked docs */}
            {quote.jobId && job && (
              <Button 
                variant="outline"
                onClick={() => setLocation(`/jobs/${quote.jobId}`)}
                data-testid="button-view-linked-job"
              >
                <Briefcase className="h-4 w-4 mr-2" />
                View Job
              </Button>
            )}
            {quote.status === 'accepted' && linkedInvoice && (
              <Button 
                variant="outline"
                onClick={() => setLocation(`/invoices/${linkedInvoice.id}`)}
                data-testid="button-view-linked-invoice"
              >
                <Receipt className="h-4 w-4 mr-2" />
                View Invoice
              </Button>
            )}

            {quote.acceptanceToken && (
              <Button 
                variant="outline"
                onClick={() => window.open(`/portal/quote/${quote.acceptanceToken}`, '_blank')}
                data-testid="button-view-as-client"
              >
                <Eye className="h-4 w-4 mr-2" />
                View as Client
              </Button>
            )}
          </div>

          {/* Row 3: Document output tools + content toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting} data-testid="button-print">
              {isPrinting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Printer className="h-4 w-4 mr-1.5" />}
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleSaveAsPDF} data-testid="button-save-pdf">
              <Download className="h-4 w-4 mr-1.5" />
              {quote.status === 'accepted' && quote.signature ? 'Signed PDF' : 'Save as PDF'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowEmailCompose(true)} data-testid="button-send">
              <Send className="h-4 w-4 mr-1.5" />
              Send
            </Button>
            {quoteVersions.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setVersionHistoryOpen(true)} data-testid="button-version-history">
                <History className="h-4 w-4 mr-1.5" />
                History
                <Badge variant="secondary" className="ml-1 text-xs">{quoteVersions.length}</Badge>
              </Button>
            )}

            {/* Content toggles for PDF output */}
            {(quote.jobId || quote.notes) && (
              <>
                <div className="hidden sm:block w-px h-6 bg-border" />
                {quote.jobId && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={includeBeforePhotos}
                      onCheckedChange={setIncludeBeforePhotos}
                      id="include-before-photos"
                    />
                    <Label htmlFor="include-before-photos" className="text-xs text-muted-foreground whitespace-nowrap">
                      Site photos
                    </Label>
                  </div>
                )}
                {quote.notes && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={includeNotes}
                      onCheckedChange={setIncludeNotes}
                      id="include-notes"
                    />
                    <Label htmlFor="include-notes" className="text-xs text-muted-foreground whitespace-nowrap">
                      Notes
                    </Label>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="print-content">
          <Card 
            className="bg-white shadow-lg border overflow-hidden"
            style={{ fontFamily: template.fontFamily, fontSize: template.baseFontSize, fontWeight: template.bodyWeight }}
          >
            <div 
              className="p-6 sm:p-8 relative"
              style={{ borderBottom: template.showHeaderDivider ? `${template.headerBorderWidth} solid ${primaryColor}` : 'none' }}
            >
              <div className="flex flex-col sm:flex-row sm:justify-between gap-6 items-start">
                <div className="flex-1">
                  {businessSettings?.logoUrl && (
                    <img 
                      src={businessSettings.logoUrl} 
                      alt={businessSettings?.businessName || 'Logo'} 
                      className="max-w-[150px] max-h-[60px] object-contain mb-3"
                    />
                  )}
                  <h1 
                    className="text-2xl sm:text-3xl mb-2"
                    style={{ ...headingStyle }}
                  >
                    {businessSettings?.businessName || 'Your Business Name'}
                  </h1>
                  <div className="text-sm text-gray-600 space-y-0.5">
                    {businessSettings?.abn && (
                      <p><strong>ABN:</strong> {businessSettings.abn}</p>
                    )}
                    {businessSettings?.address && <p>{businessSettings.address}</p>}
                    {businessSettings?.phone && <p>Phone: {businessSettings.phone}</p>}
                    {businessSettings?.email && <p>Email: {businessSettings.email}</p>}
                    {businessSettings?.licenseNumber && (
                      <p>Licence No: {businessSettings.licenseNumber}</p>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <h2 
                    className="text-2xl sm:text-3xl uppercase tracking-wide"
                    style={{ ...headingStyle }}
                  >
                    QUOTE
                  </h2>
                  <p className="text-gray-600 mt-1">{quote.number}</p>
                  <div className="mt-2">
                    <StatusBadge status={quote.status} />
                  </div>
                </div>
              </div>
            </div>

            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row gap-8 mb-8">
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Quote For</p>
                  <div className="text-gray-800">
                    <p className="font-semibold">{client?.name || quote?.clientName || 'Client'}</p>
                    {client?.address && <p>{client.address}</p>}
                    {client?.email && <p>{client.email}</p>}
                    {client?.phone && <p>{client.phone}</p>}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Quote Details</p>
                  <div className="text-gray-800 space-y-1">
                    <p><strong>Date:</strong> {formatDate(quote.createdAt)}</p>
                    {quote.validUntil && (
                      <p><strong>Valid Until:</strong> {formatDate(quote.validUntil)}</p>
                    )}
                    {quote.acceptedAt && (
                      <p><strong>Accepted:</strong> {formatDate(quote.acceptedAt)}</p>
                    )}
                  </div>
                </div>
              </div>

              {job?.address && (
                <div className="mb-8">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Job Site Location</p>
                  <div className="text-gray-800">
                    <p className="font-semibold">{job.address}</p>
                    {job.scheduledAt && (
                      <p className="text-gray-600 text-sm">Scheduled: {formatDate(job.scheduledAt)}</p>
                    )}
                  </div>
                </div>
              )}

              {(quote.title || quote.description) && (
                <div 
                  className="mb-8 p-4"
                  style={{ backgroundColor: template.sectionBackground, borderRadius: template.borderRadius }}
                >
                  <p 
                    className="font-semibold mb-2"
                    style={{ color: primaryColor }}
                  >
                    {quote.title || 'Description'}
                  </p>
                  {quote.description && (
                    <p className="text-gray-700">{quote.description}</p>
                  )}
                </div>
              )}

              <div className="mb-6 overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={tableHeaderStyle}>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider" style={{ width: '50%', color: tableHeaderStyle.color }}>Description</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider" style={{ width: '15%', color: tableHeaderStyle.color }}>Qty</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider" style={{ width: '17%', color: tableHeaderStyle.color }}>Unit Price</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wider" style={{ width: '18%', color: tableHeaderStyle.color }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lineItems?.map((item: any, index: number) => {
                      const isLast = index === (quote.lineItems?.length || 0) - 1;
                      return (
                        <tr key={index} style={getTableRowStyle(index, isLast)}>
                          <td className="px-4 py-3 text-gray-900">{item.description}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{Number(item.quantity).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(Number(item.unitPrice))}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(Number(item.total))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mb-8">
                <div className="w-72">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold">{formatCurrency(subtotal)}</span>
                  </div>
                  {gstAmount > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">GST (10%)</span>
                      <span className="font-semibold">{formatCurrency(gstAmount)}</span>
                    </div>
                  )}
                  <div 
                    className="flex justify-between py-3 mt-1"
                    style={{ borderTop: `2px solid ${primaryColor}` }}
                  >
                    <span 
                      className="text-lg"
                      style={{ ...headingStyle }}
                    >
                      Total{gstAmount > 0 ? ' (incl. GST)' : ''}
                    </span>
                    <span 
                      className="text-lg"
                      style={{ ...headingStyle }}
                    >
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Job Context — only visible when at least one content toggle is on */}
              {quote.jobId && (includeBeforePhotos || includeNotes) && (
                <Collapsible
                  open={jobContextOpen}
                  onOpenChange={setJobContextOpen}
                  className="mb-8 print-job-context"
                >
                  <CollapsibleTrigger asChild className="no-print">
                    <button
                      className="flex items-center justify-between w-full p-4 rounded-lg transition-colors hover-elevate"
                      style={{ 
                        backgroundColor: template.sectionBackground,
                        borderRadius: template.borderRadius 
                      }}
                      data-testid="job-context-trigger"
                    >
                      <div className="flex items-center gap-3">
                        {includeBeforePhotos && includeNotes ? (
                          <Layers className="h-5 w-5" style={{ color: primaryColor }} />
                        ) : includeBeforePhotos ? (
                          <Camera className="h-5 w-5" style={{ color: primaryColor }} />
                        ) : (
                          <FileText className="h-5 w-5" style={{ color: primaryColor }} />
                        )}
                        <span className="font-semibold text-gray-800">
                          {includeBeforePhotos && includeNotes ? 'PDF Includes' : includeBeforePhotos ? 'Site Photos' : 'Notes'}
                        </span>
                        {job?.title && (
                          <span className="text-sm text-muted-foreground">({job.title})</span>
                        )}
                      </div>
                      <ChevronDown 
                        className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                          jobContextOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="overflow-hidden">
                    <div 
                      className="p-4 mt-2 rounded-lg space-y-6"
                      style={{ 
                        backgroundColor: template.sectionBackground,
                        borderRadius: template.borderRadius 
                      }}
                    >
                      {/* Before Photos — only when site photos toggle is on */}
                      {includeBeforePhotos && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Image className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-medium text-sm text-gray-700">Site Assessment Photos</h4>
                          </div>
                          {photosLoading ? (
                            <div className="flex items-center justify-center py-6">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                            </div>
                          ) : jobPhotos.filter(p => p.category === 'before').length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                              {jobPhotos.filter(p => p.category === 'before').map((photo) => (
                                <div
                                  key={photo.id}
                                  className="relative aspect-square rounded-md overflow-hidden bg-muted group"
                                  title={photo.caption || 'Before photo'}
                                >
                                  <img
                                    src={photo.url}
                                    alt={photo.caption || 'Before photo'}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                  {photo.caption && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-1.5 py-0.5 truncate">
                                      {photo.caption}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                              <Image className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
                              <p>No before photos attached to this job yet</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Job Notes — only when notes toggle is on */}
                      {includeNotes && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <StickyNote className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-medium text-sm text-gray-700">Notes</h4>
                          </div>
                          {notesLoading ? (
                            <div className="flex items-center justify-center py-6">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                            </div>
                          ) : jobNotes.length > 0 ? (
                            <div className="space-y-3">
                              {jobNotes.map((note) => (
                                <div
                                  key={note.id}
                                  className="p-3 rounded-md bg-background border border-border"
                                >
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                    {note.createdByName && (
                                      <>
                                        <span>{note.createdByName}</span>
                                        <span>•</span>
                                      </>
                                    )}
                                    <span>
                                      {new Date(note.createdAt).toLocaleDateString('en-AU', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                              <StickyNote className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
                              <p>No notes attached to this job yet</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Bank Transfer Details - show when bank details are configured and quote not accepted/declined */}
              {quote.status !== 'accepted' && quote.status !== 'declined' && (businessSettings?.bankBsb || businessSettings?.bankAccountNumber || businessSettings?.bankAccountName) && (
                <div 
                  className="mb-8 p-5 rounded-lg"
                  style={{ 
                    background: `linear-gradient(135deg, ${primaryColor}10, ${primaryColor}05)`,
                    border: `1px solid ${primaryColor}30`
                  }}
                  data-testid="bank-transfer-details"
                >
                  <h3 
                    className="font-semibold mb-3 text-sm"
                    style={{ color: primaryColor }}
                  >
                    Bank Transfer Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {businessSettings.bankAccountName && (
                      <div>
                        <span className="text-gray-500 text-xs">Account Name</span>
                        <div className="font-medium text-gray-900" data-testid="bank-account-name">
                          {businessSettings.bankAccountName}
                        </div>
                      </div>
                    )}
                    {businessSettings.bankBsb && (
                      <div>
                        <span className="text-gray-500 text-xs">BSB</span>
                        <div className="font-medium text-gray-900 font-mono" data-testid="bank-bsb">
                          {businessSettings.bankBsb}
                        </div>
                      </div>
                    )}
                    {businessSettings.bankAccountNumber && (
                      <div>
                        <span className="text-gray-500 text-xs">Account Number</span>
                        <div className="font-medium text-gray-900 font-mono" data-testid="bank-account-number">
                          {businessSettings.bankAccountNumber}
                        </div>
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <span className="text-gray-500 text-xs">Reference</span>
                      <div className="font-medium text-gray-900" data-testid="bank-reference">
                        {quote.number || `Q-${quote.id?.substring(0,8).toUpperCase()}`}
                      </div>
                    </div>
                  </div>
                  {businessSettings.paymentInstructions && (
                    <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-gray-200">
                      {businessSettings.paymentInstructions}
                    </p>
                  )}
                </div>
              )}

              {/* Payment Instructions only - when no bank details but has instructions */}
              {quote.status !== 'accepted' && quote.status !== 'declined' && !businessSettings?.bankBsb && !businessSettings?.bankAccountNumber && !businessSettings?.bankAccountName && businessSettings?.paymentInstructions && (
                <div 
                  className="mb-8 p-5 rounded-lg"
                  style={{ 
                    background: `linear-gradient(135deg, ${primaryColor}10, ${primaryColor}05)`,
                    border: `1px solid ${primaryColor}30`
                  }}
                  data-testid="payment-instructions"
                >
                  <h3 
                    className="font-semibold mb-3 text-sm"
                    style={{ color: primaryColor }}
                  >
                    Payment Instructions
                  </h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{businessSettings.paymentInstructions}</p>
                </div>
              )}

              {quote.notes && includeNotes && (
                <div 
                  className="mb-8 p-4"
                  style={getNoteStyle()}
                >
                  <h3 className="font-semibold mb-2 text-gray-800">Additional Notes</h3>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap">{quote.notes}</p>
                </div>
              )}

              {termsTemplate?.content && (
                <div 
                  className="mb-8 p-4"
                  style={getNoteStyle()}
                >
                  <h3 className="font-semibold mb-2 text-gray-800">Terms & Conditions</h3>
                  <div className="text-gray-600 text-sm whitespace-pre-wrap">{termsTemplate.content}</div>
                </div>
              )}

              {(warrantyTemplate?.content || businessSettings?.warrantyPeriod) && (
                <div 
                  className="mb-8 p-4"
                  style={getNoteStyle()}
                >
                  <h3 className="font-semibold mb-2 text-gray-800">Warranty</h3>
                  <div className="text-gray-600 text-sm whitespace-pre-wrap">
                    {warrantyTemplate?.content || `All work is guaranteed for ${businessSettings?.warrantyPeriod} from completion date.`}
                  </div>
                </div>
              )}

              {quote.status !== 'accepted' && quote.status !== 'declined' && (
                <div className="mb-8 p-5 border-2 border-dashed border-gray-300 rounded-lg">
                  <h3 className="font-semibold mb-4 text-gray-800">Quote Acceptance</h3>
                  <p className="text-sm text-gray-600 mb-5">
                    By signing below, I accept this quote and authorise the work to proceed in accordance with the terms and conditions above.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-8">
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-8">Client Signature</p>
                      <div className="border-b border-gray-800"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-8">Print Name</p>
                      <div className="border-b border-gray-800"></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-8">Date</p>
                      <div className="border-b border-gray-800"></div>
                    </div>
                  </div>
                </div>
              )}

              {quote.status === 'accepted' && quote.acceptedBy && (
                <div 
                  className="mb-8 p-4 rounded-lg"
                  style={{ 
                    background: '#dcfce7',
                    borderLeft: `4px solid #22c55e`
                  }}
                >
                  <h3 className="font-semibold mb-2" style={{ color: '#166534' }}>Quote Accepted</h3>
                  <div className="text-sm" style={{ color: '#166534' }}>
                    <p>Accepted by: {quote.acceptedBy}</p>
                    <p>Date: {formatDate(quote.acceptedAt)}</p>
                  </div>
                  {quote.signature?.signatureData && (
                    <div className="mt-3 pt-3 border-t border-green-300">
                      <p className="text-xs font-medium mb-2" style={{ color: '#166534' }}>Client Signature</p>
                      <div className="bg-white rounded-md p-2 inline-block border border-green-200">
                        <img 
                          src={quote.signature.signatureData.startsWith('data:') 
                            ? quote.signature.signatureData 
                            : `data:image/png;base64,${quote.signature.signatureData}`}
                          alt={`Signature by ${quote.signature.signerName || quote.acceptedBy}`}
                          className="max-h-16 max-w-[200px]"
                          data-testid="img-quote-signature"
                        />
                      </div>
                      <p className="text-xs mt-1 opacity-75" style={{ color: '#166534' }}>
                        Signed by {quote.signature.signerName || quote.acceptedBy} on {formatDate(quote.signature.signedAt)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-10 pt-5 border-t border-gray-200 text-center text-gray-500 text-sm">
                <p>Thank you for your business!</p>
                {businessSettings?.abn && (
                  <p className="mt-1">ABN: {businessSettings.abn}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Send Document Modal with email/SMS support */}
      {quote && client && (
        <SendDocumentModal
          isOpen={showEmailCompose}
          onClose={() => setShowEmailCompose(false)}
          type="quote"
          documentId={quoteId}
          clientName={client.name || ''}
          clientEmail={client.email || ''}
          clientPhone={client?.phone}
          documentNumber={quote.number || quote.id.slice(0, 8)}
          documentTitle={quote.title || 'Quote'}
          total={quote.total || '0'}
          businessName={businessSettings?.businessName}
          publicUrl={getPublicQuoteUrl()}
          includeBeforePhotos={includeBeforePhotos}
          excludeNotes={!includeNotes}
        />
      )}

      {/* Version History Sheet */}
      <Sheet open={versionHistoryOpen} onOpenChange={setVersionHistoryOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version History
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-3">
            {quoteVersions.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No previous versions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Current version indicator */}
                <div className="flex items-start gap-3 p-3 rounded-lg border bg-primary/5 border-primary/20">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">v{quoteVersions.length + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">Current Version</p>
                      <Badge variant="default" className="text-xs">Latest</Badge>
                    </div>
                    {quote && (
                      <p className="text-sm font-medium mt-1">${parseFloat(quote.total || '0').toFixed(2)}</p>
                    )}
                    {quote?.lineItems && (
                      <div className="mt-2 space-y-0.5">
                        {(quote.lineItems as any[]).map((li: any, i: number) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            {li.description} — {parseFloat(li.quantity || '1').toFixed(0)} × ${parseFloat(li.unitPrice || '0').toFixed(2)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Previous versions */}
                {quoteVersions.map((version: any) => {
                  const snap = version.snapshot;
                  const isExpanded = selectedVersion?.id === version.id;
                  return (
                    <div
                      key={version.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${isExpanded ? 'ring-1 ring-primary/30 bg-muted/50' : 'hover-elevate'}`}
                      onClick={() => setSelectedVersion(isExpanded ? null : version)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-muted-foreground">v{version.versionNumber}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-sm font-medium">${parseFloat(snap.total || '0').toFixed(2)}</p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(version.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          {version.editedBy && (
                            <p className="text-xs text-muted-foreground mt-0.5">Edited by {version.editedBy}</p>
                          )}

                          {/* Expanded detail */}
                          {isExpanded && snap.lineItems && (
                            <div className="mt-3 pt-3 border-t space-y-2">
                              <div className="space-y-1">
                                {snap.lineItems.map((li: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between gap-2 text-sm">
                                    <span className="text-muted-foreground truncate">{li.description}</span>
                                    <span className="font-medium flex-shrink-0">
                                      {parseFloat(li.quantity || '1').toFixed(0)} × ${parseFloat(li.unitPrice || '0').toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="pt-2 border-t space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Subtotal</span>
                                  <span>${parseFloat(snap.subtotal || '0').toFixed(2)}</span>
                                </div>
                                {parseFloat(snap.gstAmount || '0') > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">GST (10%)</span>
                                    <span>${parseFloat(snap.gstAmount || '0').toFixed(2)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between font-semibold">
                                  <span>Total</span>
                                  <span>${parseFloat(snap.total || '0').toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <ChevronRight className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}