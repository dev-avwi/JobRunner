import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Download, Mail, FileText, Receipt, Calendar, CreditCard, Hash, Building, User, MapPin, Phone, AtSign, Loader2, ChevronRight, FolderOpen, Share2 } from "lucide-react";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "./StatusBadge";
import { format } from "date-fns";
import { getTemplateStyles, TemplateId, DEFAULT_TEMPLATE } from "@/lib/document-templates";
import { getSessionToken } from "@/lib/queryClient";

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {};
  const token = getSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

interface ReceiptDetailViewProps {
  receiptId: string;
  onBack?: () => void;
}

interface ReceiptData {
  id: string;
  userId: string;
  invoiceId: string | null;
  receiptNumber: string;
  amount: number;
  gstAmount: number | null;
  paymentMethod: string;
  paymentReference: string | null;
  paidAt: string | null;
  clientId: string | null;
  notes: string | null;
  createdAt: string;
}

interface ClientData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface InvoiceData {
  id: string;
  number: string;
  title: string | null;
  jobId: string | null;
}

interface JobData {
  id: string;
  title: string;
  address: string | null;
}

export default function ReceiptDetailView({ receiptId, onBack }: ReceiptDetailViewProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [, navigate] = useLocation();
  const { data: businessSettings } = useBusinessSettings();
  const { toast } = useToast();

  const brandColor = businessSettings?.brandColor || '#2563eb';
  const templateId = (businessSettings?.documentTemplate as TemplateId) || DEFAULT_TEMPLATE;
  const templateStyles = getTemplateStyles(templateId, brandColor);
  const { template, primaryColor, headingStyle } = templateStyles;

  const { data: receipt, isLoading } = useQuery<ReceiptData>({
    queryKey: ['/api/receipts', receiptId],
    queryFn: async () => {
      const response = await fetch(`/api/receipts/${receiptId}?_t=${Date.now()}`, { 
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch receipt');
      return response.json();
    }
  });

  const { data: client } = useQuery<ClientData>({
    queryKey: ['/api/clients', receipt?.clientId],
    queryFn: async () => {
      if (!receipt?.clientId) return null;
      const response = await fetch(`/api/clients/${receipt.clientId}`, { 
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch client');
      return response.json();
    },
    enabled: !!receipt?.clientId
  });

  const { data: invoice } = useQuery<InvoiceData>({
    queryKey: ['/api/invoices', receipt?.invoiceId],
    queryFn: async () => {
      if (!receipt?.invoiceId) return null;
      const response = await fetch(`/api/invoices/${receipt.invoiceId}`, { 
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch invoice');
      return response.json();
    },
    enabled: !!receipt?.invoiceId
  });

  const { data: job } = useQuery<JobData>({
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

  const handlePrint = () => {
    if (!receipt || !businessSettings) {
      toast({ title: "Error", description: "Document not ready to print", variant: "destructive" });
      return;
    }

    const formatPaymentMethod = (method: string) => {
      const methods: Record<string, string> = {
        card: 'Card Payment',
        bank_transfer: 'Bank Transfer',
        cash: 'Cash',
        cheque: 'Cheque',
        eftpos: 'EFTPOS',
        other: 'Other'
      };
      return methods[method] || method;
    };

    const amount = typeof receipt.amount === 'string' ? parseFloat(receipt.amount) : (receipt.amount || 0);
    const gstAmount = typeof receipt.gstAmount === 'string' ? parseFloat(receipt.gstAmount) : (receipt.gstAmount || 0);
    const color = primaryColor || '#2563eb';

    const logoHtml = businessSettings.logoUrl ? `<img src="${businessSettings.logoUrl}" alt="Logo" style="max-width: 150px; max-height: 60px; object-fit: contain; margin-bottom: 12px;" crossorigin="anonymous" />` : '';

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>Receipt ${receipt.receiptNumber || ''}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #1a1a1a;
      background: white;
    }
    .document { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 30px; padding-bottom: 16px; border-bottom: 3px solid ${color}; }
    .company-name { font-size: 22px; font-weight: 700; color: ${color}; margin-bottom: 8px; }
    .company-details { color: #666; font-size: 10px; line-height: 1.6; }
    .document-title { font-size: 28px; font-weight: 700; color: ${color}; text-transform: uppercase; letter-spacing: 1px; text-align: right; }
    .document-number { color: #666; margin-top: 4px; text-align: right; }
    .info-section { display: flex; justify-content: space-between; margin-bottom: 24px; gap: 40px; }
    .info-block { flex: 1; }
    .info-label { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 6px; font-weight: 600; letter-spacing: 0.5px; }
    .info-value { color: #1a1a1a; line-height: 1.6; }
    .info-value strong { font-weight: 600; }
    .payment-details { background: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 24px; }
    .payment-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .payment-row:last-child { border-bottom: none; }
    .payment-row.total { border-top: 2px solid ${color}; border-bottom: none; padding-top: 12px; margin-top: 8px; }
    .payment-row.total span { font-size: 16px; font-weight: 700; color: ${color}; }
    .notes { background: #f0f0f0; padding: 16px; border-radius: 6px; margin-bottom: 20px; }
    .notes-title { font-weight: 600; margin-bottom: 8px; color: #1a1a1a; }
    .thank-you { text-align: center; margin-top: 30px; padding: 20px; background: linear-gradient(135deg, ${color}10, ${color}05); border-radius: 6px; }
    .thank-you-text { font-size: 14px; font-weight: 600; color: ${color}; }
    @media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
  </style>
</head>
<body>
  <div class="document">
    <div class="header">
      <div>
        ${logoHtml}
        <div class="company-name">${businessSettings.businessName || 'Your Business'}</div>
        <div class="company-details">
          ${businessSettings.abn ? `<div>ABN: ${businessSettings.abn}</div>` : ''}
          ${businessSettings.address ? `<div>${businessSettings.address}</div>` : ''}
          ${businessSettings.phone ? `<div>Phone: ${businessSettings.phone}</div>` : ''}
          ${businessSettings.email ? `<div>Email: ${businessSettings.email}</div>` : ''}
        </div>
      </div>
      <div>
        <div class="document-title">RECEIPT</div>
        <div class="document-number">${receipt.receiptNumber || ''}</div>
      </div>
    </div>
    
    <div class="info-section">
      <div class="info-block">
        <div class="info-label">Received From</div>
        <div class="info-value">
          <strong>${client?.name || 'Customer'}</strong><br/>
          ${client?.address || ''}<br/>
          ${client?.email || ''}<br/>
          ${client?.phone || ''}
        </div>
      </div>
      <div class="info-block">
        <div class="info-label">Receipt Details</div>
        <div class="info-value">
          <strong>Date:</strong> ${receipt.paidAt ? new Date(receipt.paidAt).toLocaleDateString('en-AU') : new Date(receipt.createdAt).toLocaleDateString('en-AU')}<br/>
          ${invoice?.number ? `<strong>Invoice:</strong> ${invoice.number}` : ''}
        </div>
      </div>
    </div>

    <div class="payment-details">
      <div class="payment-row">
        <span>Payment Method</span>
        <span style="font-weight: 600;">${formatPaymentMethod(receipt.paymentMethod)}</span>
      </div>
      ${receipt.paymentReference ? `
        <div class="payment-row">
          <span>Reference</span>
          <span>${receipt.paymentReference}</span>
        </div>
      ` : ''}
      ${gstAmount > 0 ? `
        <div class="payment-row">
          <span>GST Included</span>
          <span>$${gstAmount.toFixed(2)}</span>
        </div>
      ` : ''}
      <div class="payment-row total">
        <span>Amount Paid</span>
        <span>$${amount.toFixed(2)}</span>
      </div>
    </div>

    ${receipt.notes ? `
      <div class="notes">
        <div class="notes-title">Notes</div>
        <div style="color: #666;">${receipt.notes}</div>
      </div>
    ` : ''}

    <div class="thank-you">
      <div class="thank-you-text">Thank you for your payment!</div>
    </div>
  </div>
</body>
</html>`;

    // Create blob URL for better iOS/Safari compatibility
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    
    const printWindow = window.open(blobUrl, '_blank');
    if (!printWindow) {
      URL.revokeObjectURL(blobUrl);
      toast({ title: "Error", description: "Please allow popups to print", variant: "destructive" });
      return;
    }

    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
          URL.revokeObjectURL(blobUrl);
        };
      }, 500);
    };
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
    
    const pdfUrl = `/api/receipts/${receiptId}/pdf`;
    const filename = `Receipt-${receipt?.receiptNumber || receiptId}.pdf`;
    
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
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "PDF Downloaded",
          description: `${filename} has been saved.`,
        });
      }
    } catch (error) {
      console.error('PDF download error:', error);
      toast({
        title: "Download Failed",
        description: "Unable to download PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!client?.email) {
      toast({
        title: "No Email Address",
        description: "This client doesn't have an email address on file.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/receipts/${receiptId}/send-email`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: client.email })
      });

      if (!response.ok) throw new Error('Failed to send email');

      toast({
        title: "Receipt Sent",
        description: `Receipt emailed to ${client.email}`,
      });
    } catch (error) {
      toast({
        title: "Send Failed",
        description: "Unable to send receipt. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(cents / 100);
  };

  const formatPaymentMethod = (method: string) => {
    const methods: Record<string, string> = {
      'card': 'Card Payment',
      'tap_to_pay': 'Tap to Pay',
      'bank_transfer': 'Bank Transfer',
      'cash': 'Cash',
      'cheque': 'Cheque',
      'eftpos': 'EFTPOS',
      'stripe': 'Online Payment',
      'manual': 'Manual Payment',
      'other': 'Other',
    };
    return methods[method?.toLowerCase()] || method;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-semibold">Receipt Not Found</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>This receipt could not be found or may have been deleted.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const subtotal = receipt.gstAmount ? receipt.amount - receipt.gstAmount : receipt.amount;
  const gst = receipt.gstAmount || 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Logical breadcrumb navigation */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4 print:hidden">
        <button 
          onClick={() => navigate('/documents?tab=receipts')} 
          className="hover:text-foreground transition-colors flex items-center gap-1"
          data-testid="breadcrumb-documents"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Documents
        </button>
        {invoice && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <button 
              onClick={() => navigate(`/invoices/${invoice.id}`)} 
              className="hover:text-foreground transition-colors"
              data-testid="breadcrumb-invoice"
            >
              Invoice {invoice.number}
            </button>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">{receipt.receiptNumber}</span>
      </div>

      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack || (() => navigate('/documents?tab=receipts'))} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">Payment Receipt</h1>
            <p className="text-sm text-muted-foreground">{receipt.receiptNumber}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting} data-testid="button-print">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveAsPDF} disabled={isPrinting} data-testid="button-download-pdf">
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            const publicUrl = `${window.location.origin}/receipts/${receiptId}/view`;
            const text = `Payment Receipt ${receipt.receiptNumber} - ${formatCurrency(receipt.amount)}`;
            if (navigator.share) {
              navigator.share({ title: 'Payment Receipt', text, url: publicUrl }).catch(() => {
                navigator.clipboard.writeText(publicUrl);
                toast({ title: "Link Copied", description: "Receipt link copied to clipboard" });
              });
            } else {
              navigator.clipboard.writeText(publicUrl);
              toast({ title: "Link Copied", description: "Receipt link copied to clipboard" });
            }
          }} data-testid="button-share-receipt">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          {client?.email && (
            <Button variant="outline" size="sm" onClick={handleSendEmail} data-testid="button-send-email">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
          )}
        </div>
      </div>

      <Card 
        className="bg-white shadow-lg border overflow-hidden print:shadow-none" 
        style={{ fontFamily: template.fontFamily, fontSize: template.baseFontSize, fontWeight: template.bodyWeight, backgroundColor: 'white' }}
      >
        <div 
          className="p-6 sm:p-8"
          style={{ borderBottom: template.showHeaderDivider ? `${template.headerBorderWidth} solid ${primaryColor}` : 'none', backgroundColor: 'white' }}
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
                RECEIPT
              </h2>
              <p className="text-gray-600 mt-1">{receipt.receiptNumber}</p>
              {receipt.paidAt && (
                <p className="text-gray-600 mt-1">
                  {format(new Date(receipt.paidAt), 'd MMMM yyyy, h:mm a')}
                </p>
              )}
              <div className="mt-2">
                <StatusBadge status="paid" />
              </div>
            </div>
          </div>
        </div>

        <CardContent className="p-6 sm:p-8" style={{ backgroundColor: 'white' }}>

          <div className="flex flex-col sm:flex-row gap-8 mb-8">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Received From</p>
              <div className="text-gray-800">
                <p className="font-semibold">{client?.name || 'Customer'}</p>
                {client?.address && <p>{client.address}</p>}
                {client?.email && <p>{client.email}</p>}
                {client?.phone && <p>{client.phone}</p>}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Receipt Details</p>
              <div className="text-gray-800 space-y-1">
                <p><strong>Date:</strong> {receipt.paidAt ? format(new Date(receipt.paidAt), 'd MMMM yyyy') : format(new Date(receipt.createdAt), 'd MMMM yyyy')}</p>
                <p><strong>Method:</strong> {formatPaymentMethod(receipt.paymentMethod)}</p>
                {receipt.paymentReference && (
                  <p><strong>Reference:</strong> {receipt.paymentReference}</p>
                )}
              </div>
            </div>
          </div>

          <div className="border-2 border-green-500 rounded-lg p-5 mb-6" style={{ backgroundColor: '#f0fdf4' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-green-700">
                Payment Received
              </h3>
              <span className="px-3 py-1 bg-green-500 text-white rounded-full text-xs font-semibold uppercase">
                Paid
              </span>
            </div>
            
            {gst > 0 && (
              <>
                <div className="flex justify-between py-2 border-b border-green-200">
                  <span className="text-sm text-green-700">Subtotal (excl. GST)</span>
                  <span className="font-medium text-green-700">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-green-200">
                  <span className="text-sm text-green-700">GST (10%)</span>
                  <span className="font-medium text-green-700">{formatCurrency(gst)}</span>
                </div>
              </>
            )}
            
            <div className="flex justify-between pt-3 mt-2 border-t-2 border-green-500">
              <span className="text-lg font-bold text-green-700">
                Amount Paid {gst > 0 ? '(incl. GST)' : ''}
              </span>
              <span className="text-lg font-bold text-green-700">
                {formatCurrency(receipt.amount)}
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="p-3 border rounded-md">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Payment Method</p>
              <p className="font-medium text-sm">{formatPaymentMethod(receipt.paymentMethod)}</p>
            </div>
            <div className="p-3 border rounded-md">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Transaction ID</p>
              <p className="font-medium text-sm break-all">{receipt.id}</p>
            </div>
            {receipt.paidAt && (
              <div className="p-3 border rounded-md">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Date & Time</p>
                <p className="font-medium text-sm">{format(new Date(receipt.paidAt), 'd MMMM yyyy, h:mm a')}</p>
              </div>
            )}
            {receipt.paymentReference && (
              <div className="p-3 border rounded-md">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Reference</p>
                <p className="font-medium text-sm">{receipt.paymentReference}</p>
              </div>
            )}
          </div>

          {invoice && (
            <div 
              className="p-4 border rounded-md border-l-4 mb-4 cursor-pointer hover-elevate transition-colors" 
              style={{ borderLeftColor: brandColor }}
              onClick={() => navigate(`/invoices/${invoice.id}`)}
              data-testid="link-invoice-reference"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Invoice Reference</p>
              <p className="font-medium underline hover:no-underline" style={{ color: brandColor }}>
                Invoice #{invoice.number}
              </p>
              {invoice.title && <p className="text-sm text-muted-foreground">{invoice.title}</p>}
            </div>
          )}

          {job && (
            <div 
              className="p-4 border rounded-md border-l-4 mb-6 cursor-pointer hover-elevate transition-colors" 
              style={{ borderLeftColor: brandColor }}
              onClick={() => navigate(`/jobs/${job.id}`)}
              data-testid="link-job-reference"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Job Reference</p>
              <p className="font-medium underline hover:no-underline" style={{ color: brandColor }}>{job.title}</p>
              {job.address && <p className="text-sm text-muted-foreground">{job.address}</p>}
            </div>
          )}

          <div className="text-center py-6 rounded-lg mb-6" style={{ backgroundColor: `${brandColor}08` }}>
            <p className="text-lg font-semibold" style={{ color: brandColor }}>
              Thank you for your payment!
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This receipt confirms your payment has been received and processed.
            </p>
          </div>

          <div className="pt-4 border-t text-center text-xs text-muted-foreground">
            <p>Payment Receipt from {businessSettings?.businessName || 'Your Business'}</p>
            {businessSettings?.abn && <p>ABN: {businessSettings.abn}</p>}
            <p className="mt-2">Generated by JobRunner</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
