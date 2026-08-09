import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  DollarSign
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface DemoPaymentSimulatorProps {
  invoiceId: string;
  invoiceNumber: string;
  invoiceTotal: string;
  clientName: string;
  isOpen: boolean;
  onClose: () => void;
  onPaymentComplete: () => Promise<void> | void;
}

export default function DemoPaymentSimulator({
  invoiceId,
  invoiceNumber,
  invoiceTotal,
  clientName,
  isOpen,
  onClose,
  onPaymentComplete
}: DemoPaymentSimulatorProps) {
  const [step, setStep] = useState<'intro' | 'processing' | 'success' | 'failed'>('intro');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSimulatePayment = async (success: boolean) => {
    setIsProcessing(true);
    setStep('processing');

    await new Promise(resolve => setTimeout(resolve, 2000));

    if (success) {
      try {
        await apiRequest('POST', `/api/invoices/${invoiceId}/mark-paid`, {
          paymentMethod: 'demo',
          paidAt: new Date().toISOString()
        });
        
        // Force refetch of invoice data to update UI
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['/api/invoices'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/invoices', invoiceId] }),
          queryClient.refetchQueries({ queryKey: ['/api/invoices', invoiceId] })
        ]);
        
        setStep('success');
        toast({
          title: "Demo Payment Successful",
          description: `Invoice ${invoiceNumber} has been marked as paid.`,
        });
      } catch (error) {
        setStep('failed');
        toast({
          title: "Error",
          description: "Failed to update invoice status",
          variant: "destructive",
        });
      }
    } else {
      setStep('failed');
    }
    
    setIsProcessing(false);
  };

  const handleClose = async () => {
    try {
      if (step === 'success') {
        // Wait for the parent to refetch invoice data before closing
        await onPaymentComplete();
      }
    } catch (error) {
      // Log but don't block dialog close on refetch failure
      console.error('Failed to refresh invoice data:', error);
    } finally {
      // Always reset state and close dialog
      setStep('intro');
      onClose();
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose();
    }
  };

  const total = parseFloat(invoiceTotal) || 0;
  const stripeFee = (total * 0.0175) + 0.30;
  const platformFee = total * 0.025;
  const netAmount = total - stripeFee - platformFee;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              Demo Payment Simulator
            </DialogTitle>
            <Badge variant="outline" className="border-orange-400 text-orange-600">Demo</Badge>
          </div>
          <DialogDescription>
            This simulates what happens when a client pays your invoice online.
          </DialogDescription>
        </DialogHeader>

        {step === 'intro' && (
          <div className="space-y-4">
            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Invoice</span>
                  <span className="font-medium">{invoiceNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Client</span>
                  <span className="font-medium">{clientName}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-lg font-bold">${total.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>In real mode:</strong> Your client would see a secure Stripe checkout page 
                where they enter their card details. You'd receive an instant notification when they pay.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Fee Breakdown (Demo):</p>
              <div className="text-xs space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Invoice Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Stripe Fee (1.75% + 30c)</span>
                  <span className="text-red-500">-${stripeFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>JobRunner Fee (2.5%)</span>
                  <span className="text-red-500">-${platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium text-foreground pt-1 border-t">
                  <span>You Receive</span>
                  <span className="text-green-600">${netAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => handleSimulatePayment(false)}
                className="flex-1"
                data-testid="button-simulate-failed"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Simulate Failed
              </Button>
              <Button
                onClick={() => handleSimulatePayment(true)}
                className="flex-1"
                data-testid="button-simulate-success"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Simulate Paid
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div>
              <p className="font-medium">Processing Payment...</p>
              <p className="text-sm text-muted-foreground">
                Simulating Stripe payment flow
              </p>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium text-green-700 dark:text-green-300">Payment Successful!</p>
              <p className="text-sm text-muted-foreground">
                Invoice {invoiceNumber} is now marked as paid.
              </p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-left">
              <p className="text-xs text-green-700 dark:text-green-300">
                <strong>What happens in real mode:</strong>
              </p>
              <ul className="text-xs text-green-600 dark:text-green-400 mt-1 space-y-1">
                <li>• You receive an instant email notification</li>
                <li>• Invoice status updates automatically</li>
                <li>• Money deposits to your bank in 2-3 days</li>
                <li>• Client receives a payment receipt</li>
              </ul>
            </div>
            <Button onClick={handleClose} className="w-full" data-testid="button-done">
              Done
            </Button>
          </div>
        )}

        {step === 'failed' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="font-medium text-red-700 dark:text-red-300">Payment Failed</p>
              <p className="text-sm text-muted-foreground">
                Simulated declined card scenario
              </p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-left">
              <p className="text-xs text-red-700 dark:text-red-300">
                <strong>Common reasons for failed payments:</strong>
              </p>
              <ul className="text-xs text-red-600 dark:text-red-400 mt-1 space-y-1">
                <li>• Insufficient funds</li>
                <li>• Card expired or blocked</li>
                <li>• Fraud detection triggered</li>
                <li>• Incorrect card details</li>
              </ul>
              <p className="text-xs text-red-700 dark:text-red-300 mt-2">
                <strong>Your client would be asked to try again or use a different card.</strong>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Close
              </Button>
              <Button onClick={() => setStep('intro')} className="flex-1" data-testid="button-try-again">
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
