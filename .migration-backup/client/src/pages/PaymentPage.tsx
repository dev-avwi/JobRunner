import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle, AlertCircle, CreditCard, FileText, Clock, ShieldCheck, Lock, RefreshCw } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

interface InvoiceData {
  id: string;
  number: string;
  title: string;
  status: string;
  total: string;
  subtotal: string;
  gstAmount: string;
  dueDate?: string;
  allowOnlinePayment: boolean;
  depositRequired?: boolean;
  depositAmount?: string;
  depositPaid?: boolean;
  amountPaid?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: string;
    total: string;
  }>;
  client: {
    name: string;
  };
  business: {
    name: string;
    logo?: string;
    abn?: string;
    bankBsb?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
    paymentInstructions?: string;
  };
  paid?: boolean;
  message?: string;
}

interface PaymentRequestData {
  id: string;
  amount: string;
  gstAmount: string;
  description: string;
  reference: string | null;
  status: string;
  expiresAt: string | null;
  businessName: string;
  businessLogo?: string;
  brandColor: string;
  isDemoMode?: boolean;
}

function PaymentForm({ 
  clientSecret, 
  onSuccess, 
  onError 
}: { 
  clientSecret: string; 
  onSuccess: () => void; 
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getPaymentErrorMessage = (error: any): { title: string; description: string } => {
    const code = error?.code || '';
    const declineCode = error?.decline_code || '';
    
    if (code === 'card_declined' || declineCode) {
      if (declineCode === 'insufficient_funds') {
        return { title: 'Insufficient funds', description: 'Your card does not have enough funds. Please try a different card.' };
      }
      if (declineCode === 'expired_card') {
        return { title: 'Card expired', description: 'This card has expired. Please use a different payment method.' };
      }
      return { title: 'Card declined', description: error.message || 'Your card was declined. Please check your details or try a different card.' };
    }
    if (code === 'expired_card') {
      return { title: 'Card expired', description: 'This card has expired. Please use a different payment method.' };
    }
    if (code === 'incorrect_cvc' || code === 'incorrect_number') {
      return { title: 'Invalid card details', description: 'Please double-check your card number and security code.' };
    }
    if (code === 'processing_error') {
      return { title: 'Processing error', description: 'Something went wrong while processing. Please try again in a moment.' };
    }
    if (error?.type === 'api_connection_error' || error?.type === 'api_error') {
      return { title: 'Connection error', description: 'Unable to reach the payment server. Please check your internet and try again.' };
    }
    return { title: 'Payment failed', description: error?.message || 'Something went wrong. Please try again or use a different payment method.' };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (error) {
      const parsed = getPaymentErrorMessage(error);
      setErrorMessage(`${parsed.title}: ${parsed.description}`);
      onError(error.message || "Payment failed");
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={{
        layout: {
          type: 'tabs',
          defaultCollapsed: false,
        },
      }} />
      
      {errorMessage && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { setErrorMessage(null); }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Try Again
          </Button>
        </div>
      )}
      
      <Button 
        type="submit" 
        className="w-full" 
        size="lg"
        disabled={!stripe || isProcessing}
        data-testid="button-pay-now"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            Pay Now
          </>
        )}
      </Button>
    </form>
  );
}

function InvoicePaymentView({ 
  token, 
  invoiceData, 
  isLoading, 
  error 
}: { 
  token: string;
  invoiceData: InvoiceData | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);

  const paymentType = new URLSearchParams(window.location.search).get('paymentType') || 'full';

  const createPaymentIntentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/public/invoice/${token}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentType }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      if (data.publishableKey) {
        setStripePromise(loadStripe(data.publishableKey));
      }
    },
  });

  useEffect(() => {
    if (invoiceData && invoiceData.status !== 'paid' && invoiceData.allowOnlinePayment && !clientSecret && !invoiceData.paid) {
      createPaymentIntentMutation.mutate();
    }
  }, [invoiceData]);

  if (isLoading) {
    return (
      <div data-theme="light" style={{ colorScheme: 'light' }} className="light min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[#2563EB]" />
          <p className="text-slate-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoiceData) {
    return null;
  }

  if (invoiceData.paid || invoiceData.status === 'paid' || paymentSuccess) {
    return (
      <div data-theme="light" style={{ colorScheme: 'light' }} className="light min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-md shadow-xl border border-green-100 overflow-hidden">
          {/* Success header with gradient */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white py-6 px-6 text-center">
            {invoiceData.business.logo && (
              <div className="bg-white/15 p-1 rounded-md backdrop-blur-sm inline-block mx-auto mb-3">
                <img 
                  src={invoiceData.business.logo} 
                  alt={invoiceData.business.name} 
                  className="h-10 max-w-[120px] object-contain"
                />
              </div>
            )}
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold">Payment Successful!</h2>
          </div>
          
          <div className="p-6 text-center">
            <p className="text-slate-600 mb-4">
              Thank you for your payment. A receipt has been sent to your email.
            </p>
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-slate-500">Invoice #{invoiceData.number}</p>
              <p className="font-bold text-2xl text-slate-900 mt-1">
                ${parseFloat(invoiceData.total).toFixed(2)} AUD
              </p>
            </div>
            
            <Button 
              className="w-full bg-green-600 text-white"
              onClick={() => window.open(`/api/public/invoice/${token}/pdf`, '_blank')}
              data-testid="button-download-receipt"
            >
              <FileText className="h-4 w-4 mr-2" />
              Download Receipt
            </Button>
            
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              <span>Securely processed by <strong className="text-slate-700">Stripe</strong></span>
            </div>
            <p className="text-xs text-slate-400 mt-2">Paid to: {invoiceData.business.name}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!invoiceData.allowOnlinePayment) {
    const hasBankDetails = invoiceData.business.bankBsb || invoiceData.business.bankAccountNumber || invoiceData.business.bankAccountName;
    
    return (
      <div data-theme="light" style={{ colorScheme: 'light' }} className="light min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-md shadow-lg border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="p-6 text-center border-b border-slate-100">
            {invoiceData.business.logo ? (
              <img 
                src={invoiceData.business.logo} 
                alt={invoiceData.business.name} 
                className="h-12 max-w-[140px] object-contain mx-auto mb-3"
              />
            ) : null}
            <h1 className="text-xl font-bold text-slate-900">{invoiceData.business.name}</h1>
            <p className="text-sm text-slate-500 mt-1">Invoice #{invoiceData.number}</p>
            <p className="text-2xl font-bold text-[#2563EB] mt-2">${parseFloat(invoiceData.total).toFixed(2)} AUD</p>
          </div>
          
          {/* Bank details if available */}
          {hasBankDetails ? (
            <div className="p-6">
              <div className="bg-green-50 rounded-xl p-4 border border-green-200" data-testid="bank-transfer-details">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <FileText className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-900 text-sm">Pay by Bank Transfer</h3>
                    <p className="text-xs text-green-700">No fees - pay directly to the account below</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {invoiceData.business.bankAccountName && (
                    <div className="col-span-2">
                      <span className="text-green-700 text-xs">Account Name</span>
                      <p className="font-medium text-green-900">{invoiceData.business.bankAccountName}</p>
                    </div>
                  )}
                  {invoiceData.business.bankBsb && (
                    <div>
                      <span className="text-green-700 text-xs">BSB</span>
                      <p className="font-medium text-green-900 font-mono">{invoiceData.business.bankBsb}</p>
                    </div>
                  )}
                  {invoiceData.business.bankAccountNumber && (
                    <div>
                      <span className="text-green-700 text-xs">Account Number</span>
                      <p className="font-medium text-green-900 font-mono">{invoiceData.business.bankAccountNumber}</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-green-700 text-xs">Reference (use this when paying)</span>
                    <p className="font-bold text-green-900">{invoiceData.number}</p>
                  </div>
                </div>
                {invoiceData.business.paymentInstructions && (
                  <p className="text-xs text-green-700 mt-3 pt-3 border-t border-green-200">
                    {invoiceData.business.paymentInstructions}
                  </p>
                )}
              </div>
              
              <Button 
                variant="outline"
                size="sm"
                className="w-full mt-4 border-slate-300 text-slate-700"
                onClick={() => window.open(`/api/public/invoice/${token}/pdf`, '_blank')}
                data-testid="button-download-invoice"
              >
                <FileText className="h-4 w-4 mr-2" />
                Download Invoice
              </Button>
            </div>
          ) : invoiceData.business.paymentInstructions ? (
            <div className="p-6">
              <div className="bg-[#2563EB]/5 rounded-xl p-4 border border-[#2563EB]/20" data-testid="payment-instructions">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-[#2563EB]" />
                  <h3 className="font-semibold text-[#1E40AF] text-sm">Payment Instructions</h3>
                </div>
                <p className="text-sm text-[#1D4ED8] whitespace-pre-wrap">
                  {invoiceData.business.paymentInstructions}
                </p>
              </div>
              
              <Button 
                variant="outline"
                size="sm"
                className="w-full mt-4 border-slate-300 text-slate-700"
                onClick={() => window.open(`/api/public/invoice/${token}/pdf`, '_blank')}
                data-testid="button-download-invoice"
              >
                <FileText className="h-4 w-4 mr-2" />
                Download Invoice
              </Button>
            </div>
          ) : (
            <div className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <p className="text-slate-600">
                Please contact {invoiceData.business.name} for payment options.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const lineItems = invoiceData.lineItems || [];
  const subtotal = parseFloat(invoiceData.subtotal || '0');
  const gstAmount = parseFloat(invoiceData.gstAmount || '0');
  const total = parseFloat(invoiceData.total);

  return (
    <div data-theme="light" style={{ colorScheme: 'light' }} className="light min-h-screen bg-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Branded header with gradient accent */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            {invoiceData.business.logo ? (
              <img 
                src={invoiceData.business.logo} 
                alt={invoiceData.business.name} 
                className="h-16 max-w-[180px] object-contain mx-auto"
              />
            ) : (
              <div className="w-16 h-16 bg-[#2563EB]/10 rounded-full flex items-center justify-center mx-auto">
                <FileText className="h-8 w-8 text-[#2563EB]" />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{invoiceData.business.name}</h1>
          {invoiceData.business.abn && (
            <p className="text-sm text-slate-500">ABN: {invoiceData.business.abn}</p>
          )}
        </div>

        <div className="grid gap-6">
          {/* Payment Card - MOVED TO TOP */}
          {clientSecret && stripePromise && (
            <div className="bg-[#2563EB]/5 rounded-md shadow-xl border-2 border-[#2563EB]/20 overflow-hidden ring-2 ring-[#2563EB]/10">
              <div className="px-6 py-5 border-b border-[#2563EB]/15 bg-white/50 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-[#2563EB]" />
                      <span className="font-bold text-xl text-slate-900">Secure Online Payment</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Lock className="h-3 w-3 text-green-600" />
                      <span className="text-sm font-medium text-slate-600">Encrypted & Secure via Stripe</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Amount Due</p>
                    <p className="text-2xl font-black text-[#2563EB]">${total.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-white">
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <PaymentForm 
                    clientSecret={clientSecret}
                    onSuccess={() => setPaymentSuccess(true)}
                    onError={(error) => console.error('Payment error:', error)}
                  />
                </Elements>
              </div>
              
              {/* Trust badges */}
              <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 backdrop-blur-sm">
                <div className="flex items-center justify-center gap-8 text-xs font-medium text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                    <span>Bank-level Security</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-[#2563EB]" />
                    <span>PCI Compliant</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {createPaymentIntentMutation.isPending && (
            <div className="bg-white rounded-md shadow-lg border-2 border-dashed border-slate-200 p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[#2563EB]" />
              <p className="text-slate-600 font-medium">Setting up your secure payment session...</p>
            </div>
          )}

          {/* Invoice Card - MOVED BELOW */}
          <div className="bg-white rounded-md shadow-lg border border-slate-200 overflow-hidden">
            {/* Invoice Header with Accent */}
            <div className="bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-white/70" />
                  <span className="font-semibold text-lg">Invoice #{invoiceData.number} Details</span>
                </div>
                <span className="bg-white/10 backdrop-blur px-3 py-1 rounded-full text-sm font-medium border border-white/20">
                  {invoiceData.status.toUpperCase()}
                </span>
              </div>
              {invoiceData.title && (
                <p className="text-white/70 text-sm mt-1">{invoiceData.title}</p>
              )}
            </div>
            
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wide mb-1 font-semibold">Bill To</p>
                  <p className="font-bold text-slate-900">{invoiceData.client?.name || 'Customer'}</p>
                </div>
                <div className="text-right">
                  {invoiceData.dueDate && (
                    <>
                      <p className="text-slate-500 text-xs uppercase tracking-wide mb-1 font-semibold">Due Date</p>
                      <p className="font-bold text-slate-900">{formatDate(invoiceData.dueDate)}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                {lineItems.length > 0 && (
                  <div className="space-y-3">
                    {lineItems.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <div>
                          <p className="font-semibold text-slate-900">{item.description}</p>
                          <p className="text-slate-500">
                            {item.quantity} × ${parseFloat(item.unitPrice).toFixed(2)}
                          </p>
                        </div>
                        <p className="font-bold text-slate-900">${parseFloat(item.total).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-100">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>GST (10%)</span>
                  <span>${gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Due</span>
                  <span className="text-slate-900">${total.toFixed(2)} AUD</span>
                </div>
              </div>

              {/* Bank Transfer Details - show if available */}
              {(invoiceData.business.bankBsb || invoiceData.business.bankAccountNumber || invoiceData.business.bankAccountName) && (
                <div className="bg-green-50/50 rounded-xl p-4 border border-green-100" data-testid="bank-transfer-details">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <FileText className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-900 text-sm">Other Payment Methods</h3>
                      <p className="text-xs text-green-700">Bank Transfer</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {invoiceData.business.bankAccountName && (
                      <div className="col-span-2">
                        <span className="text-green-700 text-xs font-semibold">Account Name</span>
                        <p className="font-medium text-green-900">{invoiceData.business.bankAccountName}</p>
                      </div>
                    )}
                    {invoiceData.business.bankBsb && (
                      <div>
                        <span className="text-green-700 text-xs font-semibold">BSB</span>
                        <p className="font-medium text-green-900 font-mono">{invoiceData.business.bankBsb}</p>
                      </div>
                    )}
                    {invoiceData.business.bankAccountNumber && (
                      <div>
                        <span className="text-green-700 text-xs font-semibold">Account Number</span>
                        <p className="font-medium text-green-900 font-mono">{invoiceData.business.bankAccountNumber}</p>
                      </div>
                    )}
                    <div className="col-span-2">
                      <span className="text-green-700 text-xs font-semibold">Payment Reference</span>
                      <p className="font-bold text-green-900">{invoiceData.number}</p>
                    </div>
                  </div>
                  {invoiceData.business.paymentInstructions && (
                    <p className="text-xs text-green-700 mt-3 pt-3 border-t border-green-100">
                      {invoiceData.business.paymentInstructions}
                    </p>
                  )}
                </div>
              )}
              
              {/* Payment Instructions only - when no bank details but has instructions */}
              {!(invoiceData.business.bankBsb || invoiceData.business.bankAccountNumber || invoiceData.business.bankAccountName) && invoiceData.business.paymentInstructions && (
                <div className="bg-[#2563EB]/5 rounded-xl p-4 border border-[#2563EB]/15" data-testid="payment-instructions">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-[#2563EB]" />
                    <h3 className="font-semibold text-[#1E40AF] text-sm">Payment Instructions</h3>
                  </div>
                  <p className="text-sm text-[#1D4ED8] whitespace-pre-wrap italic">
                    {invoiceData.business.paymentInstructions}
                  </p>
                </div>
              )}
              
              <Button 
                variant="outline"
                size="sm"
                className="w-full border-slate-300 text-slate-700 font-semibold"
                onClick={() => window.open(`/api/public/invoice/${token}/pdf`, '_blank')}
                data-testid="button-download-invoice"
              >
                <FileText className="h-4 w-4 mr-2" />
                Download PDF Invoice
              </Button>
            </div>
          </div>

          {createPaymentIntentMutation.isPending && (
            <div className="bg-white rounded-md shadow-lg border border-slate-200 p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[#2563EB]" />
              <p className="text-slate-600">Setting up secure payment...</p>
            </div>
          )}
          
          {/* Footer trust message */}
          <div className="text-center text-xs text-slate-400 py-4">
            <p>Your payment information is encrypted and secure.</p>
            <p className="mt-1">Powered by Stripe</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentRequestView({
  token,
  requestData,
  isLoading,
  error,
}: {
  token: string;
  requestData: PaymentRequestData | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);


  const createPaymentIntentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/public/payment-request/${token}/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      if (data.publishableKey) {
        setStripePromise(loadStripe(data.publishableKey));
      }
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (paymentIntentId: string) => {
      const response = await fetch(`/api/public/payment-request/${token}/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentIntentId, paymentMethod: 'card' }),
      });
      if (!response.ok) {
        throw new Error('Failed to confirm payment');
      }
      return response.json();
    },
    onSuccess: () => {
      setPaymentSuccess(true);
    },
  });

  useEffect(() => {
    if (requestData && requestData.status === 'pending') {
      createPaymentIntentMutation.mutate();
    }
  }, [requestData]);

  if (isLoading) {
    return (
      <div data-theme="light" style={{ colorScheme: 'light' }} className="light min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[#2563EB]" />
          <p className="text-slate-600">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (error || !requestData) {
    return null;
  }

  if (requestData.status === 'paid' || paymentSuccess) {
    return (
      <div data-theme="light" style={{ colorScheme: 'light' }} className="light min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-md shadow-xl border border-green-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white py-6 px-6 text-center">
            {requestData.businessLogo && (
              <div className="bg-white/15 p-1 rounded-md backdrop-blur-sm inline-block mx-auto mb-3">
                <img 
                  src={requestData.businessLogo} 
                  alt={requestData.businessName} 
                  className="h-10 max-w-[120px] object-contain"
                />
              </div>
            )}
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold">Payment Successful!</h2>
          </div>
          
          <div className="p-6 text-center">
            <p className="text-slate-600 mb-4">
              Thank you for your payment to {requestData.businessName}.
            </p>
            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-slate-500">{requestData.description}</p>
              <p className="font-bold text-2xl text-slate-900 mt-2">
                ${parseFloat(requestData.amount).toFixed(2)} AUD
              </p>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              <span>Securely processed by <strong className="text-slate-700">Stripe</strong></span>
            </div>
            <p className="text-xs text-slate-400 mt-2">Paid to: {requestData.businessName}</p>
          </div>
        </div>
      </div>
    );
  }

  if (requestData.status === 'cancelled') {
    return (
      <div data-theme="light" style={{ colorScheme: 'light' }} className="light min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-md shadow-lg border border-red-100 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Payment Cancelled</h2>
          <p className="text-slate-600">
            This payment request has been cancelled by {requestData.businessName}.
          </p>
        </div>
      </div>
    );
  }

  if (requestData.status === 'expired') {
    return (
      <div data-theme="light" style={{ colorScheme: 'light' }} className="light min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-md shadow-lg border border-amber-100 p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Payment Link Expired</h2>
          <p className="text-slate-600">
            This payment request has expired. Please contact {requestData.businessName} for a new payment link.
          </p>
        </div>
      </div>
    );
  }

  const amount = parseFloat(requestData.amount);
  const gstAmount = parseFloat(requestData.gstAmount);

  return (
    <div data-theme="light" style={{ colorScheme: 'light' }} className="light min-h-screen bg-white py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Branded header with logo */}
        <div className="text-center mb-8">
          {requestData.businessLogo ? (
            <img 
              src={requestData.businessLogo} 
              alt={requestData.businessName} 
              className="h-16 max-w-[180px] object-contain mx-auto mb-4"
            />
          ) : (
            <div className="w-16 h-16 bg-[#2563EB]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="h-8 w-8 text-[#2563EB]" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{requestData.businessName}</h1>
          <p className="text-slate-500">Payment Request</p>
        </div>

        <div className="grid gap-6">
          {/* Amount Card */}
          <div className="bg-white rounded-md shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white py-6 px-6 text-center">
              <p className="text-white/70 text-sm mb-2">Amount Due</p>
              <p className="text-4xl font-bold">${amount.toFixed(2)}</p>
              <p className="text-white/70 text-sm mt-1">AUD (includes ${gstAmount.toFixed(2)} GST)</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">For</p>
                <p className="font-medium text-slate-900">{requestData.description}</p>
              </div>
              
              {requestData.reference && (
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Reference</p>
                  <p className="font-medium text-slate-900">{requestData.reference}</p>
                </div>
              )}

              {requestData.expiresAt && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  <Clock className="h-4 w-4" />
                  <span>
                    Expires {new Date(requestData.expiresAt).toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Card */}
          {clientSecret && stripePromise && (
            <div className="bg-white rounded-md shadow-lg border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#2563EB]" />
                  <span className="font-semibold text-lg text-slate-900">Pay Now</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Lock className="h-3 w-3 text-green-600" />
                  <span className="text-sm text-slate-500">Secure payment powered by Stripe</span>
                </div>
              </div>
              <div className="p-6">
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <PaymentForm 
                    clientSecret={clientSecret}
                    onSuccess={() => {
                      const paymentIntentId = clientSecret.split('_secret_')[0];
                      confirmPaymentMutation.mutate(paymentIntentId);
                    }}
                    onError={(error) => console.error('Payment error:', error)}
                  />
                </Elements>
              </div>
              
              {confirmPaymentMutation.isPending && (
                <div className="px-6 py-4 bg-blue-50 border-t border-blue-100">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
                    <p className="text-sm text-blue-700">
                      Confirming your payment... This may take a few moments.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Trust badges */}
              <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 backdrop-blur-sm">
                <div className="flex items-center justify-center gap-8 text-xs font-medium text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                    <span>Bank-level Security</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-[#2563EB]" />
                    <span>PCI Compliant</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {createPaymentIntentMutation.isPending && (
            <div className="bg-white rounded-md shadow-lg border border-slate-200 p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[#2563EB]" />
              <p className="text-slate-600">Setting up secure payment...</p>
            </div>
          )}

          {createPaymentIntentMutation.isError && (
            <div className="bg-white rounded-md shadow-lg border border-red-100 p-8 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <p className="font-semibold text-slate-900 mb-2">Unable to Process Payment</p>
              <p className="text-slate-600 text-sm mb-4">
                {(createPaymentIntentMutation.error as Error)?.message || 'This payment link may have expired or been cancelled.'}
              </p>
              <Button 
                variant="outline"
                onClick={() => createPaymentIntentMutation.mutate()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}
          
          {/* Footer trust message */}
          <div className="text-center text-xs text-slate-400 py-4">
            <p>Your payment information is encrypted and secure.</p>
            <p className="mt-1">Powered by Stripe</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  const [, params] = useRoute("/pay/:token");
  const token = params?.token;

  const { data: invoiceData, isLoading: invoiceLoading, error: invoiceError } = useQuery<InvoiceData>({
    queryKey: ['/api/public/invoice', token],
    queryFn: async () => {
      const response = await fetch(`/api/public/invoice/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Invoice not found');
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  const { data: paymentRequestData, isLoading: requestLoading, error: requestError } = useQuery<PaymentRequestData>({
    queryKey: ['/api/public/payment-request', token],
    queryFn: async () => {
      const response = await fetch(`/api/public/payment-request/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Payment request not found');
      }
      return response.json();
    },
    enabled: !!token && !!invoiceError,
    retry: false,
  });

  if (!token) {
    return (
      <div data-theme="light" style={{ colorScheme: 'light' }} className="light min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-md shadow-lg border border-red-100 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Invalid Payment Link</h2>
          <p className="text-slate-600">
            This payment link appears to be invalid.
          </p>
        </div>
      </div>
    );
  }

  if (invoiceLoading) {
    return (
      <div data-theme="light" style={{ colorScheme: 'light' }} className="light min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[#2563EB]" />
          <p className="text-slate-600">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (invoiceData) {
    return (
      <InvoicePaymentView
        token={token}
        invoiceData={invoiceData}
        isLoading={invoiceLoading}
        error={invoiceError}
      />
    );
  }

  if (requestLoading) {
    return (
      <div data-theme="light" style={{ colorScheme: 'light' }} className="light min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[#2563EB]" />
          <p className="text-slate-600">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (paymentRequestData) {
    return (
      <PaymentRequestView
        token={token}
        requestData={paymentRequestData}
        isLoading={requestLoading}
        error={requestError}
      />
    );
  }

  return (
    <div data-theme="light" style={{ colorScheme: 'light' }} className="light min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-md shadow-lg border border-amber-100 p-8 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Payment Not Found</h2>
        <p className="text-slate-600">
          This payment link may be invalid, expired, or has already been paid.
        </p>
      </div>
    </div>
  );
}
