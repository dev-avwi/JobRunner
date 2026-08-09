import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Mail, Printer, CheckCircle2, Receipt, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { format } from "date-fns";
import { apiRequest, getSessionToken } from "@/lib/queryClient";

interface ReceiptPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptId?: string;
  paymentData?: {
    amount: number;
    description?: string;
    paymentMethod?: string;
    invoiceId?: string;
    invoiceNumber?: string;
    quoteId?: string;
    quoteNumber?: string;
    clientId?: string;
    clientName?: string;
    clientEmail?: string;
    paidAt?: string;
  };
}

interface ReceiptData {
  id: string;
  receiptNumber: string;
  amount: number;
  gstAmount?: number;
  paymentMethod: string;
  paymentReference?: string;
  paidAt: string;
  clientId?: string;
  invoiceId?: string;
  notes?: string;
}

export default function ReceiptPreviewModal({ 
  open, 
  onOpenChange, 
  receiptId,
  paymentData 
}: ReceiptPreviewModalProps) {
  const { toast } = useToast();
  const { data: businessSettings } = useBusinessSettings();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const brandColor = businessSettings?.brandColor || '#2563eb';

  useEffect(() => {
    if (open && receiptId) {
      fetchReceipt();
    } else if (open && paymentData) {
      setReceipt({
        id: 'preview',
        receiptNumber: 'RCPT-PREVIEW',
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod || 'card',
        paidAt: paymentData.paidAt || new Date().toISOString(),
        clientId: paymentData.clientId,
        invoiceId: paymentData.invoiceId,
      });
    }
  }, [open, receiptId, paymentData]);

  const fetchReceipt = async () => {
    if (!receiptId) return;
    setIsLoading(true);
    try {
      const token = getSessionToken();
      const response = await fetch(`/api/receipts/${receiptId}?_t=${Date.now()}`, { credentials: 'include', headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
      if (response.ok) {
        const data = await response.json();
        setReceipt(data);
      }
    } catch (error) {
      console.error('Failed to fetch receipt:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!receiptId && !paymentData) return;
    setIsDownloading(true);
    
    try {
      if (receiptId) {
        const pdfToken = getSessionToken();
        const response = await fetch(`/api/receipts/${receiptId}/pdf`, { credentials: 'include', headers: pdfToken ? { 'Authorization': `Bearer ${pdfToken}` } : undefined });
        if (!response.ok) throw new Error('Failed to download PDF');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Receipt-${receipt?.receiptNumber || receiptId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast({ title: "PDF Downloaded", description: "Receipt saved successfully" });
      } else {
        toast({ title: "Preview Only", description: "Save the payment first to download PDF", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Download Failed", description: "Unable to download PDF", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    const email = paymentData?.clientEmail;
    if (!email) {
      toast({ title: "No Email", description: "Client email not available", variant: "destructive" });
      return;
    }

    setIsSendingEmail(true);
    try {
      if (receiptId) {
        await apiRequest("POST", `/api/receipts/${receiptId}/send-email`, { email });
        toast({ title: "Receipt Sent", description: `Emailed to ${email}` });
      } else if (paymentData) {
        await apiRequest("POST", "/api/payments/send-receipt", {
          email,
          amount: paymentData.amount,
          description: paymentData.description,
          invoiceId: paymentData.invoiceId,
          invoiceNumber: paymentData.invoiceNumber,
          clientName: paymentData.clientName,
          method: 'email',
        });
        toast({ title: "Receipt Sent", description: `Emailed to ${email}` });
      }
    } catch (error) {
      toast({ title: "Send Failed", description: "Unable to send receipt email", variant: "destructive" });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handlePrint = () => {
    if (!receipt || !businessSettings) {
      toast({ title: "Error", description: "Receipt not ready to print", variant: "destructive" });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "Error", description: "Please allow popups to print", variant: "destructive" });
      return;
    }

    const amount = receipt.amount >= 100 ? receipt.amount / 100 : receipt.amount;
    const gstAmount = receipt.gstAmount ? (receipt.gstAmount >= 100 ? receipt.gstAmount / 100 : receipt.gstAmount) : 0;
    const clientName = paymentData?.clientName || 'Customer';

    const logoHtml = businessSettings.logoUrl ? `<img src="${businessSettings.logoUrl}" alt="Logo" style="max-width: 150px; max-height: 60px; object-fit: contain; margin-bottom: 12px;" />` : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt ${receipt.receiptNumber || ''}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            line-height: 1.5;
            color: #1a1a1a;
            background: white;
          }
          .document { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 30px; padding-bottom: 16px; border-bottom: 3px solid ${brandColor}; }
          .company-name { font-size: 22px; font-weight: 700; color: ${brandColor}; margin-bottom: 8px; }
          .company-details { color: #666; font-size: 10px; line-height: 1.6; }
          .document-title { font-size: 28px; font-weight: 700; color: ${brandColor}; text-transform: uppercase; letter-spacing: 1px; text-align: right; }
          .document-number { color: #666; margin-top: 4px; text-align: right; }
          .info-section { display: flex; justify-content: space-between; margin-bottom: 24px; gap: 40px; }
          .info-block { flex: 1; }
          .info-label { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 6px; font-weight: 600; letter-spacing: 0.5px; }
          .info-value { color: #1a1a1a; line-height: 1.6; }
          .payment-details { background: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 24px; }
          .payment-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .payment-row:last-child { border-bottom: none; }
          .payment-row.total { border-top: 2px solid ${brandColor}; border-bottom: none; padding-top: 12px; margin-top: 8px; }
          .payment-row.total span { font-size: 16px; font-weight: 700; color: ${brandColor}; }
          .thank-you { text-align: center; margin-top: 30px; padding: 20px; background: linear-gradient(135deg, ${brandColor}10, ${brandColor}05); border-radius: 6px; }
          .thank-you-text { font-size: 14px; font-weight: 600; color: ${brandColor}; }
          @media print {
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          }
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
                <strong>${clientName}</strong>
              </div>
            </div>
            <div class="info-block">
              <div class="info-label">Receipt Details</div>
              <div class="info-value">
                <strong>Date:</strong> ${receipt.paidAt ? new Date(receipt.paidAt).toLocaleDateString('en-AU') : new Date().toLocaleDateString('en-AU')}<br/>
                ${paymentData?.invoiceNumber ? `<strong>Invoice:</strong> ${paymentData.invoiceNumber}` : ''}
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

          <div class="thank-you">
            <div class="thank-you-text">Thank you for your payment!</div>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    
    // Add a delay to ensure styles and content are fully loaded before printing
    setTimeout(() => {
      if (printWindow) {
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.onafterprint = function() { printWindow.close(); };
        }, 100);
      }
    }, 800);
  };

  const formatCurrency = (amount: number) => {
    const value = amount >= 100 ? amount / 100 : amount;
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(value);
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
      'stripe_connect': 'Online Payment',
      'manual': 'Manual Payment',
      'other': 'Other',
    };
    return methods[method?.toLowerCase()] || method;
  };

  const displayAmount = receipt?.amount || paymentData?.amount || 0;
  const displayMethod = receipt?.paymentMethod || paymentData?.paymentMethod || 'card';
  const displayDate = receipt?.paidAt || paymentData?.paidAt || new Date().toISOString();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Payment Received</DialogTitle>
              <DialogDescription>
                {receipt?.receiptNumber || 'Receipt Preview'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            <Card className="overflow-hidden border-green-200 dark:border-green-800">
              <CardContent className="p-0">
                <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-green-100 text-sm">Amount Paid</p>
                      <p className="text-3xl font-bold mt-1">{formatCurrency(displayAmount)}</p>
                    </div>
                    <Badge className="bg-white/20 text-white hover:bg-white/30">
                      Paid
                    </Badge>
                  </div>
                </div>
                
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Date</p>
                      <p className="font-medium text-sm mt-1">
                        {format(new Date(displayDate), 'd MMM yyyy, h:mm a')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Method</p>
                      <p className="font-medium text-sm mt-1">{formatPaymentMethod(displayMethod)}</p>
                    </div>
                  </div>

                  {(paymentData?.invoiceNumber || paymentData?.quoteNumber) && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Reference</p>
                        <p className="font-medium text-sm mt-1">
                          {paymentData?.invoiceNumber && `Invoice #${paymentData.invoiceNumber}`}
                          {paymentData?.quoteNumber && `Quote #${paymentData.quoteNumber} Deposit`}
                        </p>
                      </div>
                    </>
                  )}

                  {paymentData?.clientName && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Received From</p>
                        <p className="font-medium text-sm mt-1">{paymentData.clientName}</p>
                        {paymentData.clientEmail && (
                          <p className="text-xs text-muted-foreground">{paymentData.clientEmail}</p>
                        )}
                      </div>
                    </>
                  )}

                  {paymentData?.description && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Description</p>
                        <p className="text-sm mt-1">{paymentData.description}</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadPDF}
                disabled={isDownloading || (!receiptId && !paymentData)}
                data-testid="button-download-receipt-pdf"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download PDF
              </Button>
              
              {paymentData?.clientEmail && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSendEmail}
                  disabled={isSendingEmail}
                  data-testid="button-email-receipt"
                >
                  {isSendingEmail ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Email Receipt
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrint}
                data-testid="button-print-receipt"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>

            <div className="text-center pt-4 border-t">
              <p className="text-sm font-medium" style={{ color: brandColor }}>
                {businessSettings?.businessName || 'Your Business'}
              </p>
              {businessSettings?.abn && (
                <p className="text-xs text-muted-foreground">ABN: {businessSettings.abn}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Thank you for your payment!
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
