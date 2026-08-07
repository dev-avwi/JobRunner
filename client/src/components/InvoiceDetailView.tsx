import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Printer, ArrowLeft, Send, FileText, CreditCard, Download, Copy, ExternalLink, Loader2, RefreshCw, Check, Upload, Mail, AlertTriangle, ChevronRight, FolderOpen, DollarSign, Receipt, CalendarClock, Briefcase, Clock, Eye, Pencil, History } from "lucide-react";
import { SiXero, SiQuickbooks } from "react-icons/si";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useIntegrationHealth, isStripeReady } from "@/hooks/use-integration-health";
import { useMarkInvoicePaid, useRecordPayment, usePaymentRecords, useVoidPayment, useUpdateMilestones } from "@/hooks/use-invoices";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { apiRequest, queryClient, getSessionToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

interface InvoiceDetailViewProps {
  invoiceId: string;
  onBack?: () => void;
  onSend?: (id: string) => void;
  onMarkPaid?: (id: string) => void;
}

export default function InvoiceDetailView({ 
  invoiceId, 
  onBack, 
  onSend, 
  onMarkPaid 
}: InvoiceDetailViewProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [includeBeforePhotos, setIncludeBeforePhotos] = useState(false);
  const [includeAfterPhotos, setIncludeAfterPhotos] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [showVersionsDialog, setShowVersionsDialog] = useState(false);
  const [showEditHistoryDialog, setShowEditHistoryDialog] = useState(false);
  const [showRecordPaymentDialog, setShowRecordPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'cheque' | 'card' | 'other'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [showPaymentPlanDialog, setShowPaymentPlanDialog] = useState(false);
  const [paymentPlanInstallments, setPaymentPlanInstallments] = useState<number>(3);
  const [paymentPlanFrequency, setPaymentPlanFrequency] = useState<'weekly' | 'fortnightly' | 'monthly'>('fortnightly');
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [includeLabourLines, setIncludeLabourLines] = useState(false);
  const [paymentAmountStr, setPaymentAmountStr] = useState('');
  const [showMilestonesDialog, setShowMilestonesDialog] = useState(false);
  const [milestonePreset, setMilestonePreset] = useState<string>('custom');
  const [retentionPercentStr, setRetentionPercentStr] = useState('');
  const { data: businessSettings } = useBusinessSettings();
  const markPaidMutation = useMarkInvoicePaid();
  const recordPaymentMutation = useRecordPayment();
  const voidPaymentMutation = useVoidPayment();
  const updateMilestonesMutation = useUpdateMilestones();
  const { data: integrationHealth } = useIntegrationHealth();
  const stripeConnected = isStripeReady(integrationHealth);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const brandColor = businessSettings?.brandColor || '#2563eb';
  const templateId = (businessSettings?.documentTemplate as TemplateId) || DEFAULT_TEMPLATE;
  const templateStyles = getTemplateStyles(templateId, brandColor);
  const { template, primaryColor, headingStyle, tableHeaderStyle, getTableRowStyle, getNoteStyle } = templateStyles;

  const connectEnabled = businessSettings?.connectChargesEnabled === true;

  const { data: invoice, isLoading, refetch: refetchInvoice } = useQuery({
    queryKey: ['/api/invoices', invoiceId],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/${invoiceId}?_t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch invoice');
      return response.json();
    }
  });

  const hasLabourLines = invoice?.lineItems?.some((item: any) => item.description?.startsWith('Labour —') || item.description?.startsWith('Labour -'));

  const { data: paymentData, refetch: refetchPayments } = usePaymentRecords(invoiceId);
  const paymentRecordsList = paymentData?.records || [];
  const paymentSummary = paymentData?.summary;

  const { data: client } = useQuery({
    queryKey: ['/api/clients', invoice?.clientId],
    queryFn: async () => {
      if (!invoice?.clientId) return null;
      const response = await fetch(`/api/clients/${invoice.clientId}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch client');
      return response.json();
    },
    enabled: !!invoice?.clientId
  });

  const { data: job } = useQuery({
    queryKey: ['/api/jobs', invoice?.jobId],
    queryFn: async () => {
      if (!invoice?.jobId) return null;
      const response = await fetch(`/api/jobs/${invoice.jobId}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch job');
      return response.json();
    },
    enabled: !!invoice?.jobId
  });

  const { data: linkedQuote } = useQuery({
    queryKey: ['/api/quotes', invoice?.quoteId],
    queryFn: async () => {
      if (!invoice?.quoteId) return null;
      const response = await fetch(`/api/quotes/${invoice.quoteId}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch linked quote');
      return response.json();
    },
    enabled: !!invoice?.quoteId
  });

  const { data: quoteSignature } = useQuery({
    queryKey: ['/api/digital-signatures', invoice?.quoteId, 'quote_acceptance'],
    queryFn: async () => {
      if (!invoice?.quoteId) return null;
      const response = await fetch(`/api/digital-signatures?documentType=quote_acceptance&documentId=${invoice.quoteId}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) return null;
      const signatures = await response.json();
      return signatures.length > 0 ? signatures[0] : null;
    },
    enabled: !!invoice?.quoteId && businessSettings?.includeSignatureOnInvoices === true
  });

  const { data: termsTemplate } = useQuery<BusinessTemplate | null>({
    queryKey: ["/api/business-templates/active/terms_conditions"],
    queryFn: async () => {
      const response = await fetch("/api/business-templates/active/terms_conditions", {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to fetch terms template');
      return response.json();
    },
    enabled: !!invoice,
  });

  const { data: warrantyTemplate } = useQuery<BusinessTemplate | null>({
    queryKey: ["/api/business-templates/active/warranty"],
    queryFn: async () => {
      const response = await fetch("/api/business-templates/active/warranty", {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to fetch warranty template');
      return response.json();
    },
    enabled: !!invoice,
  });

  const { data: editHistory = [] } = useQuery<any[]>({
    queryKey: ['/api/invoices', invoiceId, 'edits'],
    enabled: showEditHistoryDialog,
  });

  const { data: siblingInvoices } = useQuery({
    queryKey: ['/api/jobs', invoice?.jobId, 'invoices'],
    queryFn: async () => {
      const response = await fetch(`/api/jobs/${invoice.jobId}/invoices`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
    enabled: !!invoice?.jobId,
  });

  // Get related receipt for paid invoices
  const { data: relatedReceipt } = useQuery({
    queryKey: ['/api/invoices', invoiceId, 'receipt'],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/${invoiceId}/receipt`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: invoice?.status === 'paid'
  });

  // Get existing payment schedule for this invoice
  const { data: paymentSchedule, refetch: refetchPaymentSchedule } = useQuery({
    queryKey: ['/api/payment-schedules', 'invoice', invoiceId],
    queryFn: async () => {
      const response = await fetch(`/api/payment-schedules/invoice/${invoiceId}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to fetch payment schedule');
      return response.json();
    },
    enabled: !!invoice && invoice.status !== 'paid'
  });

  const createPaymentPlanMutation = useMutation({
    mutationFn: async (data: { numberOfInstallments: number; frequency: string }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7);
      return apiRequest('POST', '/api/payment-schedules', {
        invoiceId,
        numberOfInstallments: data.numberOfInstallments,
        frequency: data.frequency,
        startDate: startDate.toISOString(),
      });
    },
    onSuccess: () => {
      refetchPaymentSchedule();
      setShowPaymentPlanDialog(false);
      toast({
        title: "Payment plan created",
        description: `${paymentPlanInstallments} installment payment plan set up successfully.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating payment plan",
        description: error.message || "Failed to create payment plan",
        variant: "destructive",
      });
    }
  });

  const toggleOnlinePaymentMutation = useMutation({
    mutationFn: async (allowOnlinePayment: boolean) => {
      return apiRequest('PATCH', `/api/invoices/${invoiceId}/online-payment`, {
        allowOnlinePayment
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', invoiceId] });
      toast({
        title: invoice?.allowOnlinePayment ? "Online payment disabled" : "Online payment enabled",
        description: invoice?.allowOnlinePayment 
          ? "Customers can no longer pay online for this invoice."
          : "Customers can now pay this invoice online via card.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update online payment setting",
        variant: "destructive",
      });
    }
  });

  const { data: xeroStatus } = useQuery<{ configured: boolean; connected: boolean }>({
    queryKey: ['/api/integrations/xero/status'],
  });

  // Task #89: MYOB has no API void; surface the credit-note workaround.
  const { data: myobStatus } = useQuery<{ connected: boolean; companyName?: string }>({
    queryKey: ['/api/integrations/myob/status'],
  });
  const [showMyobCreditNoteDialog, setShowMyobCreditNoteDialog] = useState(false);
  const [myobVoidExplanation, setMyobVoidExplanation] = useState<string>('');

  const voidInMyobMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/integrations/myob/void-invoice/${invoiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(getSessionToken() ? { Authorization: `Bearer ${getSessionToken()}` } : {}) },
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    },
    onSuccess: ({ status, body }) => {
      if (status === 422 && body?.voidMethod === 'unsupported') {
        setMyobVoidExplanation(body.message || 'MYOB AccountRight does not support voiding posted invoices via API.');
        setShowMyobCreditNoteDialog(true);
        return;
      }
      if (status >= 200 && status < 300 && body?.success) {
        toast({ title: 'Voided in MYOB', description: body.message || 'Invoice voided in MYOB.' });
        return;
      }
      toast({ title: 'MYOB void failed', description: body?.message || `Request failed (${status})`, variant: 'destructive' });
    },
    onError: (error: any) => {
      toast({ title: 'MYOB void failed', description: error?.message || 'Network error', variant: 'destructive' });
    },
  });

  const raiseMyobCreditNoteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/integrations/myob/credit-note/${invoiceId}`);
      return response.json();
    },
    onSuccess: (data: any) => {
      setShowMyobCreditNoteDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', invoiceId] });
      toast({ title: 'Credit note raised', description: data?.message || 'Credit note posted to MYOB.' });
    },
    onError: (error: any) => {
      toast({ title: 'Credit note failed', description: error?.message || 'Could not raise credit note in MYOB.', variant: 'destructive' });
    },
  });

  // Task #97: QuickBooks void mirror — same flow as MYOB, with credit-memo fallback dialog.
  const { data: quickbooksStatus } = useQuery<{ connected: boolean; companyName?: string }>({
    queryKey: ['/api/integrations/quickbooks/status'],
  });
  const [showQuickbooksCreditNoteDialog, setShowQuickbooksCreditNoteDialog] = useState(false);
  const [quickbooksVoidExplanation, setQuickbooksVoidExplanation] = useState<string>('');

  const voidInQuickbooksMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/integrations/quickbooks/void-invoice/${invoiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(getSessionToken() ? { Authorization: `Bearer ${getSessionToken()}` } : {}) },
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    },
    onSuccess: ({ status, body }) => {
      if (status === 422 && body?.voidMethod === 'unsupported') {
        setQuickbooksVoidExplanation(body.message || 'QuickBooks could not void this invoice.');
        setShowQuickbooksCreditNoteDialog(true);
        return;
      }
      if (status >= 200 && status < 300 && body?.success) {
        queryClient.invalidateQueries({ queryKey: ['/api/invoices', invoiceId] });
        toast({ title: 'Voided in QuickBooks', description: body.message || 'Invoice voided in QuickBooks.' });
        return;
      }
      toast({ title: 'QuickBooks void failed', description: body?.message || body?.error || `Request failed (${status})`, variant: 'destructive' });
    },
    onError: (error: any) => {
      toast({ title: 'QuickBooks void failed', description: error?.message || 'Network error', variant: 'destructive' });
    },
  });

  const pushToXeroMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/integrations/xero/push-invoice/${invoiceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', invoiceId] });
      toast({
        title: "Pushed to Xero",
        description: "Invoice has been synced to Xero successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Push to Xero Failed",
        description: error.message || "Failed to push invoice to Xero",
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    setIncludeLabourLines(!!hasLabourLines);
  }, [hasLabourLines]);

  const generateLabourLinesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/invoices/${invoiceId}/generate-labour-lines`);
    },
    onSuccess: async (response: any) => {
      const data = typeof response.json === 'function' ? await response.json() : response;
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', invoiceId] });
      const itemCount = data.labourItems?.length || 0;
      const hours = data.summary?.totalBillableHours?.toFixed(1) || '0';
      toast({
        title: itemCount > 0 ? "Labour lines generated" : "No time entries found",
        description: itemCount > 0
          ? `${itemCount} labour line(s) added from time tracking (${hours} billable hours)`
          : "No billable time entries found for this job",
      });
    },
    onError: (error: any) => {
      setIncludeLabourLines(false);
      toast({
        title: "Error generating labour lines",
        description: error.message || "Failed to generate labour lines from time tracking",
        variant: "destructive",
      });
    }
  });

  const removeLabourLinesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/invoices/${invoiceId}/labour-lines`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', invoiceId] });
      toast({
        title: "Labour lines removed",
        description: "Labour line items have been removed from the invoice",
      });
    },
    onError: (error: any) => {
      setIncludeLabourLines(true);
      toast({
        title: "Error removing labour lines",
        description: error.message || "Failed to remove labour lines",
        variant: "destructive",
      });
    }
  });

  const sendPaymentLinkMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/invoices/${invoiceId}/send-payment-link`);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Payment link sent",
        description: data.message || "Payment link emailed to customer",
      });
    },
    onError: (error: any) => {
      toast({
        title: error.title || "Error sending payment link",
        description: error.message || "Failed to send payment link",
        variant: "destructive",
      });
    }
  });

  const handleCopyPaymentLink = () => {
    if (invoice?.paymentToken) {
      const paymentUrl = `${window.location.origin}/portal/invoice/${invoice.paymentToken}`;
      navigator.clipboard.writeText(paymentUrl);
      toast({
        title: "Link copied",
        description: "Payment link copied to clipboard",
      });
    }
  };

  const handleEmailPaymentLink = () => {
    if (!invoice || !client || !businessSettings) return;
    
    const paymentUrl = `${window.location.origin}/portal/invoice/${invoice.paymentToken}`;
    const businessName = businessSettings.businessName || 'Your Business';
    const invoiceNumber = invoice.number || invoice.id?.substring(0, 8).toUpperCase();
    const formattedTotal = new Intl.NumberFormat('en-AU', { 
      style: 'currency', 
      currency: 'AUD' 
    }).format(parseFloat(invoice.total || '0'));
    
    const subject = encodeURIComponent(`Payment Link for Invoice #${invoiceNumber} from ${businessName}`);
    const body = encodeURIComponent(
`G'day ${client.name},

Here's a quick link to pay your invoice online. It only takes a minute!

Invoice #${invoiceNumber}
Amount: ${formattedTotal}

Pay Online: ${paymentUrl}

Secure payment powered by Stripe.

Cheers,
${businessName}
${businessSettings.phone ? `Phone: ${businessSettings.phone}` : ''}
${businessSettings.email ? `Email: ${businessSettings.email}` : ''}`
    );
    
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(client.email)}&su=${subject}&body=${body}`, '_blank');
    
    toast({
      title: "Gmail opened",
      description: "Review the email and click Send in Gmail",
    });
  };

  // Send receipt email for paid invoice
  const handleSendReceipt = async () => {
    if (!invoice || !client?.email) return;
    
    setSendingReceipt(true);
    try {
      const response = await apiRequest("POST", `/api/invoices/${invoice.id}/send-receipt`, {
        email: client.email
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send receipt');
      }
      toast({
        title: "Receipt sent",
        description: `Receipt emailed to ${client.email}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send receipt",
        variant: "destructive",
      });
    } finally {
      setSendingReceipt(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!invoice) return;
    
    const invoiceTotal = parseFloat(invoice.total || '0');
    const retentionAmt = parseFloat(invoice.retentionAmount || '0');
    const previouslyPaid = parseFloat(invoice.amountPaid || '0');
    const effectiveTotal = invoiceTotal - retentionAmt;
    const remaining = Math.max(0, effectiveTotal - previouslyPaid);
    const paymentAmount = paymentAmountStr ? parseFloat(paymentAmountStr) : remaining;
    
    if (Number.isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid payment amount", variant: "destructive" });
      return;
    }
    
    try {
      const result = await recordPaymentMutation.mutateAsync({
        invoiceId: invoice.id,
        amount: paymentAmount,
        paymentMethod,
        reference: paymentReference || undefined,
        notes: paymentNotes || undefined,
      });
      const formattedAmount = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(paymentAmount);
      const methodLabels: Record<string, string> = {
        cash: 'Cash',
        bank_transfer: 'Bank Transfer',
        cheque: 'Cheque',
        card: 'Card',
        other: 'Other'
      };
      toast({
        title: result.isFullyPaid ? "Invoice fully paid" : "Progress payment recorded",
        description: `${invoice.number} - ${formattedAmount} received via ${methodLabels[paymentMethod]}`,
      });
      setShowRecordPaymentDialog(false);
      setPaymentMethod('cash');
      setPaymentReference('');
      setPaymentNotes('');
      setPaymentAmountStr('');
      refetchInvoice();
      refetchPayments();
      if (result.isFullyPaid && onMarkPaid) onMarkPaid(invoice.id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      });
    }
  };

  const buildPdfUrl = () => {
    const photoParams = new URLSearchParams();
    if (includeBeforePhotos) photoParams.set('includeBeforePhotos', 'true');
    if (includeAfterPhotos) photoParams.set('includeAfterPhotos', 'true');
    if (!includeNotes) photoParams.set('excludeNotes', 'true');
    const photoQuery = photoParams.toString();
    return `/api/invoices/${invoiceId}/pdf${photoQuery ? '?' + photoQuery : ''}`;
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
    const filename = `Invoice-${invoice?.number || invoice?.id || invoiceId}.pdf`;
    
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
          description: "Invoice PDF has been downloaded successfully.",
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

  // Generate the public invoice payment URL
  const getPublicPaymentUrl = () => {
    return invoice?.paymentToken 
      ? `${window.location.origin}/portal/invoice/${invoice.paymentToken}`
      : undefined;
  };

  if (isLoading || !invoice) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading invoice details...</p>
        </div>
      </div>
    );
  }

  const subtotal = Number(invoice.subtotal || 0);
  const gstAmount = Number(invoice.gstAmount || 0);
  const total = Number(invoice.total || 0);
  const isGstRegistered = businessSettings?.gstEnabled && gstAmount > 0;
  const documentTitle = isGstRegistered ? 'TAX INVOICE' : 'INVOICE';

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
            onClick={() => navigate('/documents?tab=invoices')} 
            className="hover:text-foreground transition-colors flex items-center gap-1"
            data-testid="breadcrumb-documents"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Documents
          </button>
          {linkedQuote && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <button 
                onClick={() => navigate(`/quotes/${linkedQuote.id}`)} 
                className="hover:text-foreground transition-colors"
                data-testid="breadcrumb-quote"
              >
                Quote {linkedQuote.number}
              </button>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{invoice.number || `INV-${invoice.id?.substring(0,8).toUpperCase()}`}</span>
        </div>

        <div className="space-y-3 mb-6 no-print">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={onBack || (() => navigate('/documents?tab=invoices'))} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Invoice Details</h1>
            <ImportOriginBadge importRunId={(invoice as any).importRunId} rowNumber={(invoice as any).importRowNumber} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {invoice.status !== 'paid' && !invoice.lockedAt && (
              <Button 
                variant="outline"
                onClick={() => navigate(`/invoices/${invoiceId}/edit`)}
                data-testid="button-edit-invoice"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {(invoice.status === 'draft' || invoice.status === 'sent') && client?.email && (
              <Button onClick={() => setShowEmailCompose(true)} data-testid="button-send-email">
                <Mail className="h-4 w-4 mr-2" />
                {invoice.status === 'draft' ? 'Send Invoice' : 'Resend'}
              </Button>
            )}
            {invoice.status === 'draft' && onSend && !client?.email && (
              <Button onClick={() => onSend(invoice.id)} data-testid={`button-send-${invoice.id}`}>
                <Send className="h-4 w-4 mr-2" />
                Send Invoice
              </Button>
            )}
            {(invoice.status === 'sent' || invoice.status === 'overdue' || invoice.status === 'partially_paid') && (
              <Button onClick={() => setShowRecordPaymentDialog(true)} data-testid="button-record-payment">
                <DollarSign className="h-4 w-4 mr-2" />
                {invoice.status === 'partially_paid' ? 'Record Next Payment' : 'Record Payment'}
              </Button>
            )}
            {invoice.status === 'paid' && client?.email && (
              <Button onClick={handleSendReceipt} disabled={sendingReceipt} data-testid="button-send-receipt">
                {sendingReceipt ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                Send Receipt
              </Button>
            )}
            {xeroStatus?.connected && invoice.status === 'sent' && !invoice.xeroInvoiceId && (
              <Button 
                variant="outline" 
                onClick={() => pushToXeroMutation.mutate()}
                disabled={pushToXeroMutation.isPending}
                data-testid="button-push-to-xero"
              >
                {pushToXeroMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <SiXero className="h-4 w-4 mr-2" />
                )}
                Push to Xero
              </Button>
            )}
            {myobStatus?.connected && invoice.status !== 'paid' && invoice.status !== 'draft' && (
              <Button
                variant="outline"
                onClick={() => voidInMyobMutation.mutate()}
                disabled={voidInMyobMutation.isPending}
                data-testid="button-void-in-myob"
              >
                {voidInMyobMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mr-2" />
                )}
                Void in MYOB
              </Button>
            )}
            {quickbooksStatus?.connected && invoice.status !== 'paid' && invoice.status !== 'draft' && (
              <Button
                variant="outline"
                onClick={() => voidInQuickbooksMutation.mutate()}
                disabled={voidInQuickbooksMutation.isPending}
                data-testid="button-void-in-quickbooks"
              >
                {voidInQuickbooksMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <SiQuickbooks className="h-4 w-4 mr-2" />
                )}
                Void in QuickBooks
              </Button>
            )}

            <div className="hidden sm:block w-px h-6 bg-border" />

            {invoice.jobId && job && (
              <Button 
                variant="outline"
                onClick={() => navigate(`/jobs/${invoice.jobId}`)}
                data-testid="button-view-linked-job"
              >
                <Briefcase className="h-4 w-4 mr-2" />
                View Job
              </Button>
            )}
            {invoice.quoteId && linkedQuote && (
              <Button 
                variant="outline"
                onClick={() => navigate(`/quotes/${invoice.quoteId}`)}
                data-testid="button-view-linked-quote"
              >
                <FileText className="h-4 w-4 mr-2" />
                View Quote
              </Button>
            )}

            {invoice.paymentToken && (
              <Button 
                variant="outline"
                onClick={() => window.open(`/portal/invoice/${invoice.paymentToken}`, '_blank')}
                data-testid="button-view-as-client"
              >
                <Eye className="h-4 w-4 mr-2" />
                View as Client
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {siblingInvoices && siblingInvoices.length > 1 && (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowVersionsDialog(true)}
                  data-testid="button-previous-versions"
                >
                  <Clock className="h-4 w-4 mr-1.5" />
                  Versions ({siblingInvoices.length})
                </Button>
                <div className="hidden sm:block w-px h-6 bg-border" />
              </>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowEditHistoryDialog(true)}
              data-testid="button-edit-history"
            >
              <History className="h-4 w-4 mr-1.5" />
              Edit History
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting} data-testid="button-print">
              {isPrinting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Printer className="h-4 w-4 mr-1.5" />}
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleSaveAsPDF} data-testid="button-save-pdf">
              <Download className="h-4 w-4 mr-1.5" />
              Save as PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowEmailCompose(true)} data-testid="button-send">
              <Send className="h-4 w-4 mr-1.5" />
              Send
            </Button>
            {invoice.jobId && invoice.status !== 'paid' && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={includeLabourLines}
                  onCheckedChange={(checked) => {
                    setIncludeLabourLines(checked);
                    if (checked) {
                      generateLabourLinesMutation.mutate();
                    } else {
                      removeLabourLinesMutation.mutate();
                    }
                  }}
                  id="include-labour-lines"
                  disabled={generateLabourLinesMutation.isPending || removeLabourLinesMutation.isPending}
                />
                <Label htmlFor="include-labour-lines" className="text-xs text-muted-foreground whitespace-nowrap">
                  Labour lines
                </Label>
              </div>
            )}

            {(invoice.jobId || invoice.notes) && (
              <>
                <div className="hidden sm:block w-px h-6 bg-border" />
                {invoice.jobId && (
                  <>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={includeBeforePhotos}
                        onCheckedChange={setIncludeBeforePhotos}
                        id="include-before-photos"
                      />
                      <Label htmlFor="include-before-photos" className="text-xs text-muted-foreground whitespace-nowrap">
                        Before photos
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={includeAfterPhotos}
                        onCheckedChange={setIncludeAfterPhotos}
                        id="include-after-photos"
                      />
                      <Label htmlFor="include-after-photos" className="text-xs text-muted-foreground whitespace-nowrap">
                        After photos
                      </Label>
                    </div>
                  </>
                )}
                {invoice.notes && (
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

        {connectEnabled && invoice.status !== 'paid' && (
          <Card className="mb-6 no-print">
            <div className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold">Online Payment</h3>
                    <p className="text-sm text-muted-foreground">
                      Allow customers to pay this invoice online via card
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Switch
                    checked={invoice.allowOnlinePayment || false}
                    onCheckedChange={(checked) => toggleOnlinePaymentMutation.mutate(checked)}
                    disabled={toggleOnlinePaymentMutation.isPending || !stripeConnected}
                    data-testid="switch-online-payment"
                  />
                  {toggleOnlinePaymentMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
              </div>

              {!stripeConnected && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-md mt-4" data-testid="info-manual-payments">
                  <div className="flex items-start gap-3">
                    <DollarSign className="h-5 w-5 text-green-600 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                        Collect payment directly - no processing fees!
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300">
                        Accept cash, bank transfer, or EFTPOS and use "Record Payment" to mark this invoice as paid.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button 
                          size="sm"
                          onClick={() => setShowRecordPaymentDialog(true)}
                          data-testid="button-quick-record-payment"
                        >
                          <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                          Record Payment
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate("/integrations")}
                          data-testid="button-setup-stripe-optional"
                        >
                          <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                          Setup Online Payments (Optional)
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {stripeConnected && invoice.allowOnlinePayment && invoice.paymentToken && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Label className="text-sm font-medium">Payment Link:</Label>
                      <div className="flex-1 flex items-center gap-2">
                        <code className="text-xs bg-background p-2 rounded flex-1 overflow-x-auto">
                          {`${window.location.origin}/portal/invoice/${invoice.paymentToken}`}
                        </code>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={handleCopyPaymentLink}
                          data-testid="button-copy-payment-link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => window.open(`/portal/invoice/${invoice.paymentToken}`, '_blank')}
                          data-testid="button-open-payment-link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <p className="text-sm text-muted-foreground">
                        Send this link to your customer so they can pay online
                      </p>
                      <Button
                        size="sm"
                        onClick={handleEmailPaymentLink}
                        disabled={!client?.email}
                        data-testid="button-send-payment-link"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Email to Customer
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {!connectEnabled && invoice.status !== 'paid' && (
          <Card className="mb-6 no-print border-dashed">
            <div className="p-4">
              <div className="flex items-center gap-4">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <h3 className="font-semibold text-muted-foreground">Online Payment</h3>
                  <p className="text-sm text-muted-foreground">
                    Connect your Stripe account in Settings to enable online payments for invoices.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {invoice.status !== 'paid' && (
          <Card className="mb-6 no-print">
            <div className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <DollarSign className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold">Payment Milestones & Retention</h3>
                  <p className="text-sm text-muted-foreground">
                    {invoice.paymentMilestones && Array.isArray(invoice.paymentMilestones) && invoice.paymentMilestones.length > 0
                      ? `${(invoice.paymentMilestones as any[]).length} milestones defined`
                      : 'Define progress payment stages for this invoice'}
                    {parseFloat(invoice.retentionPercent || '0') > 0 && ` | ${invoice.retentionPercent}% retention held`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRetentionPercentStr(invoice.retentionPercent || '');
                    setShowMilestonesDialog(true);
                  }}
                  data-testid="button-setup-milestones"
                >
                  <CalendarClock className="h-4 w-4 mr-2" />
                  {invoice.paymentMilestones && (invoice.paymentMilestones as any[]).length > 0 ? 'Edit Milestones' : 'Set Up Milestones'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {invoice.status !== 'paid' && (
          <Card className="mb-6 no-print">
            <div className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <CalendarClock className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold">Payment Plan</h3>
                  {paymentSchedule ? (
                    <p className="text-sm text-muted-foreground">
                      {paymentSchedule.numberOfInstallments}-installment plan ({paymentSchedule.frequency})
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Offer flexible payment options to your customer
                    </p>
                  )}
                </div>
                {!paymentSchedule && (
                  <Button
                    onClick={() => setShowPaymentPlanDialog(true)}
                    data-testid="button-setup-payment-plan"
                  >
                    <CalendarClock className="h-4 w-4 mr-2" />
                    Set Up Payment Plan
                  </Button>
                )}
              </div>

              {paymentSchedule && paymentSchedule.installments && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="space-y-2">
                    {paymentSchedule.installments.map((installment: any) => (
                      <div 
                        key={installment.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-md bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            #{installment.installmentNumber}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(installment.dueDate).toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold">
                            ${Number(installment.amount).toFixed(2)}
                          </span>
                          <Badge 
                            variant={
                              installment.status === 'paid' ? 'default' :
                              installment.status === 'overdue' ? 'destructive' :
                              installment.status === 'due' ? 'secondary' :
                              'outline'
                            }
                            className="text-xs"
                          >
                            {installment.status === 'paid' ? 'Paid' :
                             installment.status === 'overdue' ? 'Overdue' :
                             installment.status === 'due' ? 'Due' :
                             'Pending'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      {paymentSchedule.installments.filter((i: any) => i.status === 'paid').length} of {paymentSchedule.numberOfInstallments} paid
                    </span>
                    <span className="font-semibold">
                      Total: ${Number(paymentSchedule.totalAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        <Dialog open={showPaymentPlanDialog} onOpenChange={setShowPaymentPlanDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Set Up Payment Plan</DialogTitle>
              <DialogDescription>
                Create an installment plan for invoice {invoice?.number}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Number of Installments</Label>
                <Select
                  value={paymentPlanInstallments.toString()}
                  onValueChange={(val) => setPaymentPlanInstallments(Number(val))}
                >
                  <SelectTrigger data-testid="select-installments">
                    <SelectValue placeholder="Select installments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 installments</SelectItem>
                    <SelectItem value="3">3 installments</SelectItem>
                    <SelectItem value="4">4 installments</SelectItem>
                    <SelectItem value="6">6 installments</SelectItem>
                    <SelectItem value="12">12 installments</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment Frequency</Label>
                <Select
                  value={paymentPlanFrequency}
                  onValueChange={(val: 'weekly' | 'fortnightly' | 'monthly') => setPaymentPlanFrequency(val)}
                >
                  <SelectTrigger data-testid="select-frequency">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {invoice?.total && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h4 className="text-sm font-semibold mb-3">Payment Preview</h4>
                  <div className="space-y-2">
                    {Array.from({ length: paymentPlanInstallments }).map((_, index) => {
                      const installmentAmount = Number(invoice.total) / paymentPlanInstallments;
                      const isLast = index === paymentPlanInstallments - 1;
                      const amount = isLast 
                        ? Number(invoice.total) - (Math.floor(installmentAmount * 100) / 100 * (paymentPlanInstallments - 1))
                        : Math.floor(installmentAmount * 100) / 100;
                      
                      const startDate = new Date();
                      startDate.setDate(startDate.getDate() + 7);
                      const dueDate = new Date(startDate);
                      if (paymentPlanFrequency === 'weekly') {
                        dueDate.setDate(dueDate.getDate() + (7 * index));
                      } else if (paymentPlanFrequency === 'fortnightly') {
                        dueDate.setDate(dueDate.getDate() + (14 * index));
                      } else {
                        dueDate.setMonth(dueDate.getMonth() + index);
                      }

                      return (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            #{index + 1} - {dueDate.toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          <span className="font-medium">${amount.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="font-semibold">${Number(invoice.total).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowPaymentPlanDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => createPaymentPlanMutation.mutate({
                  numberOfInstallments: paymentPlanInstallments,
                  frequency: paymentPlanFrequency
                })}
                disabled={createPaymentPlanMutation.isPending}
                data-testid="button-create-payment-plan"
              >
                {createPaymentPlanMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Create Payment Plan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        

        <div className="print-content">
          <Card 
            className="bg-white shadow-lg border overflow-hidden"
            style={{ fontFamily: template.fontFamily, fontSize: template.baseFontSize, fontWeight: template.bodyWeight }}
          >
            <div 
              className="p-6 sm:p-8"
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
                    {documentTitle}
                  </h2>
                  <p className="text-gray-600 mt-1">{invoice.number}</p>
                  <div className="mt-2">
                    <StatusBadge status={invoice.status} />
                  </div>
                  {/* Xero sync status */}
                  {invoice.xeroInvoiceId && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Xero Synced
                      </Badge>
                      {invoice.xeroSyncedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(invoice.xeroSyncedAt).toLocaleDateString('en-AU')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row gap-8 mb-8">
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Bill To</p>
                  <div className="text-gray-800">
                    <p className="font-semibold">{client?.name || invoice?.clientName || 'Client'}</p>
                    {client?.address && <p>{client.address}</p>}
                    {client?.email && <p>{client.email}</p>}
                    {client?.phone && <p>{client.phone}</p>}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Invoice Details</p>
                  <div className="text-gray-800 space-y-1">
                    <p><strong>Date:</strong> {formatDate(invoice.createdAt)}</p>
                    {invoice.dueDate && (
                      <p><strong>Due Date:</strong> {formatDate(invoice.dueDate)}</p>
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

              {(invoice.title || invoice.description) && (
                <div 
                  className="mb-8 p-4"
                  style={{ backgroundColor: template.sectionBackground, borderRadius: template.borderRadius }}
                >
                  <p 
                    className="font-semibold mb-2"
                    style={{ color: primaryColor }}
                  >
                    {invoice.title || 'Description'}
                  </p>
                  {invoice.description && (
                    <p className="text-gray-700">{invoice.description}</p>
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
                    {invoice.lineItems?.map((item: any, index: number) => {
                      const isLast = index === (invoice.lineItems?.length || 0) - 1;
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
                  {parseFloat(invoice.retentionAmount || '0') > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Retention ({invoice.retentionPercent || '0'}%)</span>
                      <span className="font-semibold text-amber-600">-{formatCurrency(parseFloat(invoice.retentionAmount || '0'))}</span>
                    </div>
                  )}
                  {parseFloat(invoice.amountPaid || '0') > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Amount Paid</span>
                      <span className="font-semibold text-green-600">-{formatCurrency(parseFloat(invoice.amountPaid || '0'))}</span>
                    </div>
                  )}
                  {(parseFloat(invoice.amountPaid || '0') > 0 || parseFloat(invoice.retentionAmount || '0') > 0) && invoice.status !== 'paid' && (
                    <div className="flex justify-between py-2 mt-1" style={{ borderTop: `2px solid ${primaryColor}` }}>
                      <span className="text-lg font-bold" style={{ color: primaryColor }}>Balance Due</span>
                      <span className="text-lg font-bold" style={{ color: primaryColor }}>
                        {formatCurrency(Math.max(0, total - parseFloat(invoice.retentionAmount || '0') - parseFloat(invoice.amountPaid || '0')))}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {paymentRecordsList.length > 0 && (
                <div className="mb-8">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Receipt className="h-4 w-4" style={{ color: primaryColor }} />
                    Payment History
                  </h3>
                  <div className="relative pl-6 space-y-0">
                    <div className="absolute left-2.5 top-1 bottom-1 w-px" style={{ backgroundColor: `${primaryColor}30` }} />
                    {paymentRecordsList.map((record: any, idx: number) => {
                      const methodLabels: Record<string, string> = {
                        cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque', card: 'Card', other: 'Other'
                      };
                      return (
                        <div key={record.id} className="relative flex items-start gap-3 py-2.5">
                          <div 
                            className="absolute -left-3.5 top-3 w-2.5 h-2.5 rounded-full border-2 bg-white"
                            style={{ borderColor: primaryColor }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="font-semibold text-sm text-green-700">
                                  {formatCurrency(parseFloat(record.amount || '0'))}
                                </span>
                                <span className="text-xs text-gray-500 ml-2">
                                  via {methodLabels[record.method] || record.method}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400">
                                {record.paidAt ? new Date(record.paidAt).toLocaleDateString('en-AU', {
                                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                }) : ''}
                              </span>
                            </div>
                            {record.reference && (
                              <div className="text-xs text-gray-500 mt-0.5">Ref: {record.reference}</div>
                            )}
                            {record.note && (
                              <div className="text-xs text-gray-500 mt-0.5">{record.note}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {invoice.paymentMilestones && Array.isArray(invoice.paymentMilestones) && invoice.paymentMilestones.length > 0 && (
                <div className="mb-8">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" style={{ color: primaryColor }} />
                    Payment Milestones
                  </h3>
                  <div className="space-y-2">
                    {(invoice.paymentMilestones as any[]).map((milestone: any, idx: number) => {
                      const milestoneAmount = (total * (milestone.percent || 0)) / 100;
                      const amountPaid = parseFloat(invoice.amountPaid || '0');
                      const isMilestonePaid = amountPaid >= (invoice.paymentMilestones as any[]).slice(0, idx + 1).reduce((sum: number, m: any) => sum + (total * (m.percent || 0)) / 100, 0);
                      return (
                        <div key={idx} className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-md bg-gray-50">
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${isMilestonePaid ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                              {isMilestonePaid ? <Check className="w-3 h-3" /> : (idx + 1)}
                            </div>
                            <span className="text-sm font-medium">{milestone.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">{milestone.percent}%</span>
                            <span className="text-sm font-semibold">{formatCurrency(milestoneAmount)}</span>
                            <Badge variant={isMilestonePaid ? 'default' : 'outline'} className="text-xs">
                              {isMilestonePaid ? 'Paid' : 'Pending'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bank Transfer Details - show when bank details are configured */}
              {(businessSettings?.bankBsb || businessSettings?.bankAccountNumber || businessSettings?.bankAccountName) && (
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
                        {invoice.number || `INV-${invoice.id?.substring(0,8).toUpperCase()}`}
                      </div>
                    </div>
                  </div>
                  {businessSettings.paymentInstructions && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-gray-600 text-xs whitespace-pre-wrap">
                        {businessSettings.paymentInstructions}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Instructions only - when no bank details but has instructions */}
              {!businessSettings?.bankBsb && !businessSettings?.bankAccountNumber && !businessSettings?.bankAccountName && businessSettings?.paymentInstructions && (
                <div 
                  className="mb-8 p-5 rounded-lg"
                  style={{ 
                    background: `linear-gradient(135deg, ${primaryColor}10, ${primaryColor}05)`,
                    border: `1px solid ${primaryColor}30`
                  }}
                >
                  <h3 
                    className="font-semibold mb-3 text-sm"
                    style={{ color: primaryColor }}
                  >
                    Payment Details
                  </h3>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                    {businessSettings.paymentInstructions}
                  </p>
                </div>
              )}

              {invoice.notes && includeNotes && (
                <div 
                  className="mb-8 p-4"
                  style={getNoteStyle()}
                >
                  <h3 className="font-semibold mb-2 text-gray-800">Additional Notes</h3>
                  <p className="text-gray-600 text-sm whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}

              {invoice.status === 'sent' && invoice.dueDate && (
                <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800">
                    <strong>Payment Due:</strong> This invoice is due on {formatDate(invoice.dueDate)}
                  </p>
                </div>
              )}

              {(invoice.status === 'processing' || invoice.status === 'pending_payment') && (
                <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg" data-testid="payment-processing-notice">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0 animate-pulse" />
                    <div>
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Payment Processing</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        Payment processing may take a few moments. This page will update automatically once confirmed.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {invoice.status === 'paid' && (
                <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg" data-testid="payment-details-paid">
                  <div className="flex items-center gap-2 mb-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <h3 className="text-sm font-semibold text-green-800">Payment Received</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-green-700">Amount</span>
                      <div className="font-semibold text-green-900">
                        {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(parseFloat(invoice.total || '0'))}
                      </div>
                    </div>
                    {invoice.paidAt && (
                      <div>
                        <span className="text-green-700">Date & Time</span>
                        <div className="font-medium text-green-900">
                          {new Date(invoice.paidAt).toLocaleDateString('en-AU', { 
                            weekday: 'short', 
                            day: 'numeric', 
                            month: 'short', 
                            year: 'numeric' 
                          })} at {new Date(invoice.paidAt).toLocaleTimeString('en-AU', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    )}
                    {invoice.paymentMethod && (
                      <div>
                        <span className="text-green-700">Method</span>
                        <div className="font-medium text-green-900 capitalize">
                          {invoice.paymentMethod === 'bank_transfer' ? 'Bank Transfer' : 
                           invoice.paymentMethod === 'stripe' ? 'Online (Stripe)' :
                           invoice.paymentMethod === 'tap_to_pay' ? 'Tap to Pay' :
                           invoice.paymentMethod}
                        </div>
                      </div>
                    )}
                    {invoice.paymentReference && (
                      <div>
                        <span className="text-green-700">Reference</span>
                        <div className="font-medium text-green-900">{invoice.paymentReference}</div>
                      </div>
                    )}
                  </div>
                  {relatedReceipt && (
                    <div className="mt-4 pt-3 border-t border-green-200">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/receipts/${relatedReceipt.id}`)}
                        data-testid="link-invoice-receipt"
                      >
                        <Receipt className="h-4 w-4 mr-2" />
                        View Receipt ({relatedReceipt.number})
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {businessSettings?.includeSignatureOnInvoices && quoteSignature && (
                <div className="mb-8 p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-semibold mb-3 text-gray-800 text-sm">Quote Acceptance Signature</h3>
                  <div className="flex flex-col sm:flex-row gap-6 items-start">
                    <div className="flex-shrink-0">
                      <img 
                        src={quoteSignature.signatureData} 
                        alt="Client Signature" 
                        className="max-w-[200px] max-h-[80px] object-contain border-b border-gray-300"
                      />
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      {quoteSignature.signerName && (
                        <p><strong>Signed by:</strong> {quoteSignature.signerName}</p>
                      )}
                      {quoteSignature.signedAt && (
                        <p><strong>Date:</strong> {formatDate(quoteSignature.signedAt)}</p>
                      )}
                      {linkedQuote?.number && (
                        <p><strong>Quote:</strong> {linkedQuote.number}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Terms & Warranty Section - Full content with compact styling */}
              {termsTemplate?.content && (
                <div className="mb-4 pt-3 border-t border-gray-100">
                  <h4 className="font-medium text-gray-500 text-[10px] uppercase tracking-wide mb-2">Terms & Conditions</h4>
                  <p className="text-gray-500 text-xs leading-relaxed whitespace-pre-wrap">{termsTemplate.content}</p>
                </div>
              )}

              {(warrantyTemplate?.content || businessSettings?.warrantyPeriod) && (
                <div className="mb-4 pt-3 border-t border-gray-100">
                  <h4 className="font-medium text-gray-500 text-[10px] uppercase tracking-wide mb-2">Warranty</h4>
                  <p className="text-gray-500 text-xs leading-relaxed whitespace-pre-wrap">
                    {warrantyTemplate?.content || `All work is guaranteed for ${businessSettings?.warrantyPeriod} from completion date.`}
                  </p>
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

      {/* Record Payment Confirmation Dialog */}
      {invoice && (
        <Dialog open={showRecordPaymentDialog} onOpenChange={(open) => {
          setShowRecordPaymentDialog(open);
          if (!open) {
            setPaymentMethod('cash');
            setPaymentReference('');
            setPaymentNotes('');
            setPaymentAmountStr('');
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                Record Payment
              </DialogTitle>
              <DialogDescription>
                Record a full or partial payment - no processing fees!
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b">
                <div>
                  <div className="text-sm text-muted-foreground">Invoice {invoice.number}</div>
                  <div className="font-medium">{client?.name || 'Unknown'}</div>
                </div>
                <div className="text-right">
                  {(() => {
                    const invTotal = parseFloat(invoice.total || '0');
                    const retAmt = parseFloat(invoice.retentionAmount || '0');
                    const prevPaid = parseFloat(invoice.amountPaid || '0');
                    const balanceDue = Math.max(0, invTotal - retAmt - prevPaid);
                    return (
                      <>
                        <div className="text-xl font-bold" style={{ color: 'hsl(var(--trade))' }}>
                          {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(balanceDue)}
                        </div>
                        {prevPaid > 0 && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(prevPaid)} already paid
                          </div>
                        )}
                        <Badge variant="secondary" className="text-xs mt-1">
                          {balanceDue < invTotal ? 'Balance Due' : 'You keep 100%'}
                        </Badge>
                      </>
                    );
                  })()}
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="payment-amount" className="text-sm font-medium">Payment Amount</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input 
                      id="payment-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder={(() => {
                        const invTotal = parseFloat(invoice.total || '0');
                        const retAmt = parseFloat(invoice.retentionAmount || '0');
                        const prevPaid = parseFloat(invoice.amountPaid || '0');
                        return Math.max(0, invTotal - retAmt - prevPaid).toFixed(2);
                      })()}
                      value={paymentAmountStr}
                      onChange={(e) => setPaymentAmountStr(e.target.value)}
                      className="pl-7"
                      data-testid="input-payment-amount"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Leave blank to pay the full remaining balance</p>
                </div>
                
                <div>
                  <Label htmlFor="payment-method" className="text-sm font-medium">Payment Method</Label>
                  <Select 
                    value={paymentMethod} 
                    onValueChange={(value: 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'other') => setPaymentMethod(value)}
                  >
                    <SelectTrigger id="payment-method" className="mt-1" data-testid="select-payment-method">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="card">Card (EFTPOS/Credit)</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="payment-reference" className="text-sm font-medium">Reference (optional)</Label>
                  <Input 
                    id="payment-reference"
                    placeholder="e.g. Receipt #, Transfer ref"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="mt-1"
                    data-testid="input-payment-reference"
                  />
                </div>
                
                <div>
                  <Label htmlFor="payment-notes" className="text-sm font-medium">Notes (optional)</Label>
                  <Textarea 
                    id="payment-notes"
                    placeholder="Any additional payment notes..."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="mt-1 resize-none"
                    rows={2}
                    data-testid="input-payment-notes"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowRecordPaymentDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleRecordPayment} 
                disabled={recordPaymentMutation.isPending}
                data-testid="button-confirm-payment"
              >
                {recordPaymentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4 mr-2" />
                )}
                Record Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Send Document Modal with email/SMS support */}
      {invoice && client && (
        <SendDocumentModal
          isOpen={showEmailCompose}
          onClose={() => setShowEmailCompose(false)}
          type="invoice"
          documentId={invoiceId}
          clientName={client.name || ''}
          clientEmail={client.email || ''}
          clientPhone={client?.phone}
          documentNumber={invoice.number || invoice.id.slice(0, 8)}
          documentTitle={invoice.title || 'Invoice'}
          total={invoice.total || '0'}
          businessName={businessSettings?.businessName}
          publicUrl={getPublicPaymentUrl()}
          includeBeforePhotos={includeBeforePhotos}
          includeAfterPhotos={includeAfterPhotos}
        />
      )}

      {/* Milestones & Retention Dialog */}
      {invoice && (
        <Dialog open={showMilestonesDialog} onOpenChange={setShowMilestonesDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                Payment Milestones & Retention
              </DialogTitle>
              <DialogDescription>
                Define progress payment stages and retention for construction/trade invoices.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-5">
              <div>
                <Label className="text-sm font-medium">Milestone Preset</Label>
                <Select
                  value={milestonePreset}
                  onValueChange={(value) => {
                    setMilestonePreset(value);
                  }}
                >
                  <SelectTrigger className="mt-1" data-testid="select-milestone-preset">
                    <SelectValue placeholder="Choose a preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom</SelectItem>
                    <SelectItem value="deposit-balance">50% Deposit / 50% Completion</SelectItem>
                    <SelectItem value="three-stage">30% Deposit / 40% Progress / 30% Completion</SelectItem>
                    <SelectItem value="four-stage">25% Deposit / 25% Lockup / 25% Fixout / 25% Completion</SelectItem>
                    <SelectItem value="construction">10% Deposit / 30% Slab / 30% Frame / 30% Completion</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Retention Percentage</Label>
                <div className="relative mt-1">
                  <Input 
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    placeholder="e.g. 5"
                    value={retentionPercentStr}
                    onChange={(e) => setRetentionPercentStr(e.target.value)}
                    data-testid="input-retention-percent"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Common in construction: hold back 5-10% until defect period ends
                </p>
              </div>

              {retentionPercentStr && parseFloat(retentionPercentStr) > 0 && (
                <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex justify-between text-sm">
                    <span>Invoice Total</span>
                    <span className="font-medium">{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(parseFloat(invoice.total || '0'))}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span>Retention ({retentionPercentStr}%)</span>
                    <span className="font-medium text-amber-600">-{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(parseFloat(invoice.total || '0') * parseFloat(retentionPercentStr) / 100)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1 pt-1 border-t border-amber-200 dark:border-amber-700">
                    <span className="font-semibold">Payable Now</span>
                    <span className="font-semibold">{new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(parseFloat(invoice.total || '0') * (1 - parseFloat(retentionPercentStr) / 100))}</span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowMilestonesDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const presetMap: Record<string, any[]> = {
                    'deposit-balance': [
                      { label: 'Deposit', percent: 50 },
                      { label: 'Completion', percent: 50 },
                    ],
                    'three-stage': [
                      { label: 'Deposit', percent: 30 },
                      { label: 'Progress', percent: 40 },
                      { label: 'Completion', percent: 30 },
                    ],
                    'four-stage': [
                      { label: 'Deposit', percent: 25 },
                      { label: 'Lockup', percent: 25 },
                      { label: 'Fixout', percent: 25 },
                      { label: 'Completion', percent: 25 },
                    ],
                    'construction': [
                      { label: 'Deposit', percent: 10 },
                      { label: 'Slab Complete', percent: 30 },
                      { label: 'Frame Complete', percent: 30 },
                      { label: 'Completion', percent: 30 },
                    ],
                  };
                  const milestones = presetMap[milestonePreset] || (invoice.paymentMilestones as any[]) || [];
                  const retPct = retentionPercentStr ? parseFloat(retentionPercentStr) : undefined;
                  
                  updateMilestonesMutation.mutate({
                    invoiceId: invoice.id,
                    milestones: milestones.length > 0 ? milestones : undefined,
                    retentionPercent: retPct,
                  }, {
                    onSuccess: () => {
                      setShowMilestonesDialog(false);
                      refetchInvoice();
                      toast({
                        title: "Milestones updated",
                        description: "Payment milestones and retention settings saved.",
                      });
                    },
                    onError: (error: any) => {
                      toast({
                        title: "Error",
                        description: error.message || "Failed to save milestones",
                        variant: "destructive",
                      });
                    }
                  });
                }}
                disabled={updateMilestonesMutation.isPending}
                data-testid="button-save-milestones"
              >
                {updateMilestonesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showEditHistoryDialog} onOpenChange={setShowEditHistoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Edit History
            </DialogTitle>
            <DialogDescription>
              All changes made to this invoice are recorded here.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {editHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No edits recorded yet</p>
            ) : (
              editHistory.map((edit: any) => {
                const fieldLabels: Record<string, string> = {
                  title: 'Title',
                  description: 'Description',
                  notes: 'Notes',
                  dueDate: 'Due Date',
                  clientId: 'Client',
                  status: 'Status',
                  lineItems: 'Line Items',
                };
                return (
                  <div key={edit.id} className="p-3 rounded-lg border space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {fieldLabels[edit.fieldChanged] || edit.fieldChanged}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {edit.editedAt ? new Date(edit.editedAt).toLocaleString('en-AU', { 
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                        }) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      by {edit.editedByName}
                    </p>
                    {edit.fieldChanged !== 'lineItems' ? (
                      <div className="text-xs space-y-0.5">
                        {edit.oldValue && (
                          <p><span className="text-muted-foreground">Was:</span> <span className="line-through text-muted-foreground">{edit.oldValue}</span></p>
                        )}
                        {edit.newValue && (
                          <p><span className="text-muted-foreground">Now:</span> <span className="text-foreground">{edit.newValue}</span></p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Line items were updated</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showVersionsDialog} onOpenChange={setShowVersionsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Invoice Versions
            </DialogTitle>
            <DialogDescription>
              All invoices created for this job. The current invoice is highlighted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {siblingInvoices?.map((inv: any, index: number) => {
              const isCurrent = inv.id === invoiceId;
              return (
                <div
                  key={inv.id}
                  className={`p-3 rounded-lg border ${isCurrent ? 'border-primary bg-primary/5' : 'hover-elevate'}`}
                  data-testid={`version-invoice-${inv.id}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{inv.number || 'Draft'}</span>
                        <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'} className={`text-xs capitalize ${inv.status === 'paid' ? 'bg-green-500' : ''}`}>
                          {inv.status}
                        </Badge>
                        {isCurrent && (
                          <Badge variant="outline" className="text-xs">Current</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="font-medium tabular-nums">${parseFloat(inv.total || '0').toFixed(2)}</span>
                        {inv.createdAt && (
                          <span>Created {new Date(inv.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        )}
                        {inv.paidAt && (
                          <span className="text-green-600">Paid {new Date(inv.paidAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                        )}
                      </div>
                    </div>
                    {!isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowVersionsDialog(false);
                          navigate(`/invoices/${inv.id}`);
                        }}
                        data-testid={`button-view-version-${inv.id}`}
                      >
                        View
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showMyobCreditNoteDialog} onOpenChange={setShowMyobCreditNoteDialog}>
        <AlertDialogContent data-testid="dialog-myob-credit-note">
          <AlertDialogHeader>
            <AlertDialogTitle>MYOB can't void this invoice</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">{myobVoidExplanation}</span>
              <span className="block">
                MYOB AccountRight has no API to void a posted invoice. The standard accounting workaround is to raise a Credit Note that mirrors the original invoice with negative amounts so the balance nets to zero. We can do that for you in one click.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-myob-credit-note">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                raiseMyobCreditNoteMutation.mutate();
              }}
              disabled={raiseMyobCreditNoteMutation.isPending}
              data-testid="button-raise-myob-credit-note"
            >
              {raiseMyobCreditNoteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Raise credit note instead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showQuickbooksCreditNoteDialog} onOpenChange={setShowQuickbooksCreditNoteDialog}>
        <AlertDialogContent data-testid="dialog-quickbooks-credit-note">
          <AlertDialogHeader>
            <AlertDialogTitle>QuickBooks can't void this invoice</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">{quickbooksVoidExplanation}</span>
              <span className="block">
                When QuickBooks won't void a posted invoice (for example once it has payments applied), the standard accounting workaround is to raise a Credit Memo in QuickBooks that mirrors the invoice with negative amounts so the balance nets to zero.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-quickbooks-credit-note">Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}