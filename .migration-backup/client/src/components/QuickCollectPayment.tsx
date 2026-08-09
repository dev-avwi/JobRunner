import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CreditCard, DollarSign, Building2, QrCode, Smartphone, Loader2, CheckCircle2, Receipt, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface QuickCollectPaymentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  quoteId: string;
  quoteTotal: string;
  quoteGst: string;
  clientName: string;
  clientId: string;
  onSuccess?: (receiptId: string) => void;
}

type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'stripe_link';

const paymentMethods = [
  { id: 'cash' as PaymentMethod, label: 'Cash', icon: DollarSign, description: 'Customer paid in cash', noFees: true },
  { id: 'bank_transfer' as PaymentMethod, label: 'Bank Transfer', icon: Building2, description: 'Direct bank deposit', noFees: true },
  { id: 'card' as PaymentMethod, label: 'Card (EFTPOS)', icon: CreditCard, description: 'Card payment already processed', noFees: true },
  { id: 'stripe_link' as PaymentMethod, label: 'Send Payment Link', icon: Smartphone, description: 'Send link via SMS/email (~1.95% + $0.30 fee)', noFees: false },
];

export default function QuickCollectPayment({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  quoteId,
  quoteTotal,
  quoteGst,
  clientName,
  clientId,
  onSuccess,
}: QuickCollectPaymentProps) {
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [step, setStep] = useState<'method' | 'confirm' | 'success'>('method');
  const [notes, setNotes] = useState('');
  const [adjustedAmount, setAdjustedAmount] = useState(quoteTotal);
  const [resultData, setResultData] = useState<{ receiptId?: string; invoiceId?: string } | null>(null);

  const quickCollectMutation = useMutation({
    mutationFn: async (data: { 
      jobId: string; 
      quoteId: string; 
      paymentMethod: PaymentMethod; 
      amount: string;
      notes?: string;
    }) => {
      const response = await apiRequest('POST', `/api/jobs/${data.jobId}/quick-collect`, data);
      return response.json();
    },
    onSuccess: (data) => {
      setResultData(data);
      setStep('success');
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'linked-documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      toast({
        title: "Payment collected!",
        description: data.paymentLinkSent 
          ? "Payment link sent to customer" 
          : "Invoice created and marked as paid. Receipt generated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to collect payment",
        variant: "destructive",
      });
    },
  });

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setStep('confirm');
  };

  const handleConfirm = () => {
    if (!selectedMethod) return;
    quickCollectMutation.mutate({
      jobId,
      quoteId,
      paymentMethod: selectedMethod,
      amount: adjustedAmount,
      notes: notes || undefined,
    });
  };

  const handleClose = () => {
    setStep('method');
    setSelectedMethod(null);
    setNotes('');
    setAdjustedAmount(quoteTotal);
    setResultData(null);
    onOpenChange(false);
    if (resultData?.receiptId && onSuccess) {
      onSuccess(resultData.receiptId);
    }
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('method');
      setSelectedMethod(null);
    }
  };

  const total = parseFloat(adjustedAmount || '0');
  const gst = parseFloat(quoteGst || '0');
  const subtotal = total - gst;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            Quick Collect Payment
          </DialogTitle>
          <DialogDescription>
            Collect payment for {jobTitle}
          </DialogDescription>
        </DialogHeader>

        {step === 'method' && (
          <div className="space-y-4">
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Amount from quote</p>
                    <p className="text-2xl font-bold" style={{ color: 'hsl(var(--trade))' }}>
                      ${total.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">Inc. GST ${gst.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{clientName}</p>
                    <Badge variant="secondary" className="text-xs">Based on accepted quote</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-medium">Select payment method</Label>
              <div className="grid gap-2">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => handleMethodSelect(method.id)}
                    className="flex items-center gap-3 p-3 rounded-lg border hover-elevate text-left w-full"
                    data-testid={`payment-method-${method.id}`}
                  >
                    <div className="p-2 rounded-lg bg-muted">
                      <method.icon className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{method.label}</p>
                        {method.noFees && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            No Fees
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{method.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'confirm' && selectedMethod && (
          <div className="space-y-4">
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Job</span>
                    <span className="font-medium">{jobTitle}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Client</span>
                    <span className="font-medium">{clientName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Method</span>
                    <Badge variant="outline">
                      {paymentMethods.find(m => m.id === selectedMethod)?.label}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <Label htmlFor="amount" className="text-xs">Amount (can adjust)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={adjustedAmount}
                        onChange={(e) => setAdjustedAmount(e.target.value)}
                        className="pl-7"
                        data-testid="input-payment-amount"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="notes" className="text-xs">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any notes about this payment..."
                      className="min-h-[60px]"
                      data-testid="input-payment-notes"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedMethod !== 'stripe_link' && (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                      No processing fees - you keep 100%!
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                      This will create an invoice marked as paid and generate a receipt automatically.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedMethod === 'stripe_link' && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  A payment link will be sent to the customer. The invoice will be created and marked paid once they complete payment.
                </p>
              </div>
            )}
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-4 text-center py-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Payment Collected!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                ${parseFloat(adjustedAmount).toFixed(2)} from {clientName}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {resultData?.invoiceId && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Invoice created and marked paid
                </div>
              )}
              {resultData?.receiptId && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Receipt className="h-4 w-4" />
                  Receipt generated
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'method' && (
            <Button variant="outline" onClick={handleClose} data-testid="button-cancel-quick-collect">
              Cancel
            </Button>
          )}
          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={handleBack} data-testid="button-back-quick-collect">
                Back
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={quickCollectMutation.isPending}
                style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
                data-testid="button-confirm-quick-collect"
              >
                {quickCollectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : selectedMethod === 'stripe_link' ? (
                  'Send Payment Link'
                ) : (
                  'Confirm Payment'
                )}
              </Button>
            </>
          )}
          {step === 'success' && (
            <Button 
              onClick={handleClose}
              style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
              data-testid="button-done-quick-collect"
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
