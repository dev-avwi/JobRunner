import { SearchableSelect } from "@/components/ui/searchable-select";
import JobPicker from "@/components/JobPicker";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { isDedicatedNumberError, GET_NUMBER_TOAST, GET_NUMBER_URL } from "@/lib/dedicatedNumber";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useLocation, useSearch } from "wouter";
import { useIntegrationHealth, isStripeReady } from "@/hooks/use-integration-health";
import { 
  QrCode, 
  Link2, 
  Mail, 
  Copy, 
  Check, 
  Plus, 
  Loader2, 
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Share2,
  Wifi,
  CreditCard,
  FileText,
  Banknote,
  Receipt,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
  Zap,
  Smartphone,
  Building2,
  Info,
  Send,
  MessageSquare,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format, formatDistanceToNow } from "date-fns";

interface PaymentRequest {
  id: string;
  amount: string;
  gstAmount: string;
  description: string;
  reference: string | null;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  token: string;
  expiresAt: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  createdAt: string;
  paymentUrl?: string;
  clientId?: string | null;
  invoiceId?: string | null;
  jobId?: string | null;
  notificationsSent?: Array<{ type?: string; phone?: string; email?: string; sentAt: string }> | null;
}

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface Invoice {
  id: string;
  number: string;
  title: string;
  total: string | number;
  status: string;
  clientId: string;
  jobId?: string | null;
  dueDate?: string | null;
}

interface Job {
  id: string;
  title: string;
  address?: string | null;
  clientId?: string | null;
  status: string;
}

interface Receipt {
  id: string;
  receiptNumber: string;
  amount: string;
  gstAmount?: string | null;
  paymentMethod: string;
  paymentReference?: string | null;
  paidAt: string | null;
  clientId?: string | null;
  invoiceId?: string | null;
  jobId?: string | null;
  notes?: string | null;
  createdAt: string;
}

type PaymentMethodType = 'card' | 'bank_transfer' | 'becs_debit';

interface PaymentMethodRecommendation {
  recommended: PaymentMethodType;
  strength: 'suggested' | 'recommended' | 'strongly_recommended';
  reason: string;
  savings: number;
}

function getPaymentMethodRecommendation(amount: number): PaymentMethodRecommendation {
  const cardFeePercent = 0.0195;
  const cardFeeFixed = 0.30;
  const cardFee = amount * cardFeePercent + cardFeeFixed;
  const becsFee = 0.50;
  
  if (amount < 200) {
    return {
      recommended: 'card',
      strength: 'suggested',
      reason: 'Quick & convenient for smaller amounts',
      savings: 0,
    };
  } else if (amount <= 1000) {
    return {
      recommended: 'bank_transfer',
      strength: 'recommended',
      reason: `Saves ~$${cardFee.toFixed(2)} in processing fees`,
      savings: cardFee,
    };
  } else {
    return {
      recommended: 'bank_transfer',
      strength: 'strongly_recommended',
      reason: `Saves ~$${cardFee.toFixed(2)} in processing fees`,
      savings: cardFee,
    };
  }
}

function calculateFee(amount: number, method: PaymentMethodType): { fee: number; feeString: string } {
  if (method === 'card') {
    const fee = amount * 0.0195 + 0.30;
    return { fee, feeString: `~$${fee.toFixed(2)} fee` };
  } else if (method === 'becs_debit') {
    return { fee: 0.50, feeString: '~$0.50 flat fee' };
  } else {
    return { fee: 0, feeString: 'No fees' };
  }
}

interface PaymentMethodSelectorProps {
  amount: number;
  selectedMethod: PaymentMethodType;
  onMethodChange: (method: PaymentMethodType) => void;
}

function PaymentMethodSelector({ amount, selectedMethod, onMethodChange }: PaymentMethodSelectorProps) {
  const recommendation = getPaymentMethodRecommendation(amount);
  
  const methods: Array<{
    id: PaymentMethodType;
    label: string;
    description: string;
    icon: typeof CreditCard;
  }> = [
    {
      id: 'card',
      label: 'Card',
      description: 'Quick & Easy - ~1.95% + $0.30 fee',
      icon: CreditCard,
    },
    {
      id: 'bank_transfer',
      label: 'Bank Transfer',
      description: 'No fees - Details shown on invoice',
      icon: Building2,
    },
    {
      id: 'becs_debit',
      label: 'BECS Direct Debit',
      description: '~$0.50 flat fee',
      icon: Banknote,
    },
  ];

  return (
    <div className="space-y-2">
      <Label>Payment Method</Label>
      <div className="grid gap-2">
        {methods.map((method) => {
          const isSelected = selectedMethod === method.id;
          const isRecommended = recommendation.recommended === method.id;
          const { feeString } = calculateFee(amount, method.id);
          const Icon = method.icon;
          
          return (
            <div
              key={method.id}
              onClick={() => onMethodChange(method.id)}
              className={`relative flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                isSelected 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-muted-foreground/50'
              }`}
              data-testid={`payment-method-${method.id}`}
            >
              <div className={`rounded-lg p-2 ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-medium text-sm ${isSelected ? 'text-primary' : ''}`}>
                    {method.label}
                  </span>
                  {isRecommended && amount > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge 
                          variant={recommendation.strength === 'strongly_recommended' ? 'default' : 'secondary'}
                          className={`text-xs ${recommendation.strength === 'strongly_recommended' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                          data-testid="badge-recommended"
                        >
                          {recommendation.strength === 'strongly_recommended' ? 'Best Value' : 'Recommended'}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-sm">{recommendation.reason}</p>
                        {recommendation.savings > 0 && (
                          <p className="text-xs text-emerald-400 mt-1">
                            Save ${recommendation.savings.toFixed(2)} compared to card payment
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {amount > 0 ? feeString : method.description}
                </p>
              </div>
              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                isSelected ? 'border-primary' : 'border-muted-foreground/50'
              }`}>
                {isSelected && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {amount > 200 && selectedMethod === 'card' && (
        <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg mt-2">
          <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Consider Bank Transfer to save ~${calculateFee(amount, 'card').fee.toFixed(2)} in fees
          </p>
        </div>
      )}
    </div>
  );
}

export default function CollectPayment() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { data: integrationHealth } = useIntegrationHealth();
  const stripeConnected = isStripeReady(integrationHealth);
  
  // Track if we've processed URL params to avoid re-opening dialogs
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRecordPaymentDialog, setShowRecordPaymentDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showTapToPayDialog, setShowTapToPayDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("qr");
  
  const [newAmount, setNewAmount] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newReference, setNewReference] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType>("card");
  
  const [recordAmount, setRecordAmount] = useState("");
  const [recordInvoiceId, setRecordInvoiceId] = useState("");
  const [recordClientId, setRecordClientId] = useState("");
  const [recordPaymentMethod, setRecordPaymentMethod] = useState("cash");
  const [recordReference, setRecordReference] = useState("");
  const [recordNotes, setRecordNotes] = useState("");
  
  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptDescription, setReceiptDescription] = useState("");
  const [receiptPaymentMethod, setReceiptPaymentMethod] = useState("cash");
  const [receiptReference, setReceiptReference] = useState("");
  const [receiptClientId, setReceiptClientId] = useState<string | null>(null);
  const [receiptInvoiceId, setReceiptInvoiceId] = useState<string | null>(null);
  const [receiptJobId, setReceiptJobId] = useState<string>("");
  
  const [sharePhone, setSharePhone] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  
  const [tapToPayAmount, setTapToPayAmount] = useState("");
  const [tapToPayDescription, setTapToPayDescription] = useState("");
  const [tapToPayClientId, setTapToPayClientId] = useState("");
  const [tapToPayJobId, setTapToPayJobId] = useState("");
  const [tapToPayInvoiceId, setTapToPayInvoiceId] = useState("");
  const [tapToPayRequest, setTapToPayRequest] = useState<PaymentRequest | null>(null);

  const [showAllExpired, setShowAllExpired] = useState(false);
  const [expiredSearch, setExpiredSearch] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  const { data: paymentRequests, isLoading } = useQuery<PaymentRequest[]>({
    queryKey: ['/api/payment-requests'],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices'],
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: receipts } = useQuery<Receipt[]>({
    queryKey: ['/api/receipts'],
  });

  const unpaidInvoices = invoices?.filter(inv => inv.status !== 'paid') || [];

  useEffect(() => {
    if (selectedInvoiceId && invoices) {
      const invoice = invoices.find(inv => inv.id === selectedInvoiceId);
      if (invoice) {
        const totalStr = typeof invoice.total === 'number' 
          ? invoice.total.toFixed(2) 
          : String(invoice.total || '0.00');
        setNewAmount(totalStr);
        setNewDescription(`Payment for ${[invoice.number, invoice.title].filter(Boolean).join(': ') || 'Invoice'}`);
        setNewReference(invoice.number);
        setSelectedClientId(invoice.clientId);
        if (invoice.jobId && !selectedJobId) setSelectedJobId(invoice.jobId);
      }
    }
  }, [selectedInvoiceId, invoices]);

  useEffect(() => {
    if (recordInvoiceId && invoices) {
      const invoice = invoices.find(inv => inv.id === recordInvoiceId);
      if (invoice) {
        const totalStr = typeof invoice.total === 'number' 
          ? invoice.total.toFixed(2) 
          : String(invoice.total || '0.00');
        setRecordAmount(totalStr);
        setRecordReference(invoice.number);
        setRecordClientId(invoice.clientId);
      }
    }
  }, [recordInvoiceId, invoices]);

  useEffect(() => {
    if (receiptInvoiceId && invoices) {
      const invoice = invoices.find(inv => inv.id === receiptInvoiceId);
      if (invoice) {
        const totalStr = typeof invoice.total === 'number' 
          ? invoice.total.toFixed(2) 
          : String(invoice.total || '0.00');
        setReceiptAmount(totalStr);
        setReceiptDescription(`Payment for ${[invoice.number, invoice.title].filter(Boolean).join(': ') || 'Invoice'}`);
        setReceiptReference(invoice.number);
        setReceiptClientId(invoice.clientId);
        if (invoice.jobId && !receiptJobId) setReceiptJobId(invoice.jobId);
      }
    }
  }, [receiptInvoiceId, invoices]);

  // Auto-fill QR Payment when invoice is selected
  useEffect(() => {
    if (tapToPayInvoiceId && invoices) {
      const invoice = invoices.find(inv => inv.id === tapToPayInvoiceId);
      if (invoice) {
        const totalStr = typeof invoice.total === 'number' 
          ? invoice.total.toFixed(2) 
          : String(invoice.total || '0.00');
        setTapToPayAmount(totalStr);
        setTapToPayDescription(`Payment for ${[invoice.number, invoice.title].filter(Boolean).join(': ') || 'Invoice'}`);
        setTapToPayClientId(invoice.clientId);
        if (invoice.jobId) setTapToPayJobId(invoice.jobId);
      }
    }
  }, [tapToPayInvoiceId, invoices]);

  // Handle URL parameters from job detail navigation
  useEffect(() => {
    if (urlParamsProcessed || !invoices) return;
    
    const params = new URLSearchParams(searchString);
    const invoiceId = params.get('invoiceId');
    const jobId = params.get('jobId');
    const method = params.get('method');
    
    if (invoiceId) {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        const totalStr = typeof invoice.total === 'number' 
          ? invoice.total.toFixed(2) 
          : String(invoice.total || '0.00');
        
        // Pre-fill data for tap to pay
        setTapToPayAmount(totalStr);
        setTapToPayDescription(`Payment for ${[invoice.number, invoice.title].filter(Boolean).join(': ') || 'Invoice'}`);
        setTapToPayInvoiceId(invoiceId);
        setTapToPayClientId(invoice.clientId);
        if (jobId) setTapToPayJobId(jobId);
        else if (invoice.jobId) setTapToPayJobId(invoice.jobId);
        
        // Also set up create dialog data
        setSelectedInvoiceId(invoiceId);
        setSelectedClientId(invoice.clientId);
        if (jobId) setSelectedJobId(jobId);
        else if (invoice.jobId) setSelectedJobId(invoice.jobId);
        
        // Open the appropriate dialog based on method parameter
        if (method === 'qr') {
          setShowTapToPayDialog(true);
        } else if (method === 'link') {
          setShowCreateDialog(true);
        } else {
          // Default to tap to pay
          setShowTapToPayDialog(true);
        }
        
        setUrlParamsProcessed(true);
      }
    }
  }, [searchString, invoices, urlParamsProcessed]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/payment-requests', data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
      setShowCreateDialog(false);
      resetCreateForm();
      setSelectedRequest(data);
      setShowShareDialog(true);
      toast({
        title: data.isDemoMode ? "Demo payment link created" : "Payment request created",
        description: data.isDemoMode 
          ? "This is a demo link for testing. Connect Stripe for real payments." 
          : "Share the QR code or link with your customer",
      });
    },
    onError: (error: any) => {
      const isStripeError = error.message?.includes('stripeNotConnected') || error.message?.includes('Stripe account not connected');
      toast({
        title: isStripeError ? "Stripe Not Connected" : "Failed to create payment request",
        description: isStripeError 
          ? "Connect your Stripe account in Settings > Payments to accept online payments." 
          : (error.message || "Please try again"),
        variant: "destructive",
        action: isStripeError ? (
          <ToastAction altText="Go to Settings" onClick={() => navigate('/settings')}>
            Go to Settings
          </ToastAction>
        ) : undefined,
      });
    },
  });

  const tapToPayMutation = useMutation({
    mutationFn: async (data: { amount: string; description: string; invoiceId?: string; clientId?: string; jobId?: string }) => {
      const parsedAmount = parseFloat(data.amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Please enter a valid amount');
      }
      const response = await apiRequest('POST', '/api/payment-requests', {
        amount: parsedAmount,
        description: data.description.trim() || 'QR Payment',
        expiresInHours: 1,
        invoiceId: data.invoiceId || undefined,
        clientId: data.clientId || undefined,
        jobId: data.jobId || undefined,
      });
      const result = await response.json();
      if (!result.paymentUrl && !result.token) {
        throw new Error('Payment request created but URL not available');
      }
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
      setTapToPayRequest(data);
      toast({
        title: data.isDemoMode ? "Demo QR code ready" : "Ready for payment",
        description: data.isDemoMode 
          ? "This is a demo QR code for testing. Connect Stripe for real payments."
          : "Show the QR code to your customer",
      });
    },
    onError: (error: any) => {
      const isStripeError = error.message?.includes('stripeNotConnected') || error.message?.includes('Stripe account not connected');
      toast({
        title: isStripeError ? "Stripe Not Connected" : "Failed to create payment request",
        description: isStripeError 
          ? "Connect your Stripe account in Settings > Payments to accept online payments." 
          : (error.message || "Please try again"),
        variant: "destructive",
        action: isStripeError ? (
          <ToastAction altText="Go to Settings" onClick={() => navigate('/settings')}>
            Go to Settings
          </ToastAction>
        ) : undefined,
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('POST', `/api/payment-requests/${id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
      toast({ title: "Payment request cancelled" });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { invoiceId: string; amount: string; paymentMethod: string; reference?: string; notes?: string }) => {
      const response = await apiRequest('POST', `/api/invoices/${data.invoiceId}/record-payment`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
      setShowRecordPaymentDialog(false);
      resetRecordForm();
      toast({
        title: "Payment recorded",
        description: "Invoice has been marked as paid",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to record payment",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async ({ id, email }: { id: string; email: string }) => {
      await apiRequest('POST', `/api/payment-requests/${id}/send-email`, { email });
    },
    onSuccess: () => {
      setShareEmail("");
      toast({
        title: "Email sent",
        description: "Payment link sent via email",
      });
    },
    onError: () => {
      toast({
        title: "Failed to send email",
        variant: "destructive",
      });
    },
  });

  // State for SMS sending
  const [isSendingSms, setIsSendingSms] = useState(false);
  
  // Open SMS app with pre-composed message
  const openSmsApp = (phone: string, paymentLink: string, description: string, amount: number) => {
    const formattedAmount = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount / 100);
    const message = `Hi! Here's your payment link for ${description || 'your payment'} (${formattedAmount}): ${paymentLink}`;
    const smsUrl = `sms:${phone}?body=${encodeURIComponent(message)}`;
    window.open(smsUrl, '_self');
  };

  // Handle SMS send with direct error handling
  const handleSendSms = async (id: string, phone: string) => {
    setIsSendingSms(true);
    try {
      const response = await apiRequest('POST', `/api/payment-requests/${id}/send-sms`, { phone });
      const data = await response.json();
      
      // Success!
      setSharePhone("");
      toast({
        title: "SMS sent",
        description: "Payment link sent via SMS",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/payment-requests'] });
    } catch (error: any) {
      if (isDedicatedNumberError(error)) {
        toast({
          ...GET_NUMBER_TOAST,
          action: (
            <ToastAction altText="Get number" onClick={() => navigate(GET_NUMBER_URL)}>
              Get number
            </ToastAction>
          ),
        });
        setIsSendingSms(false);
        return;
      }
      // Always show error toast
      const rawMessage = error?.message || "Failed to send SMS";
      const lowerMessage = rawMessage.toLowerCase();
      
      // Check if it's a "not configured" type error
      const isNotConfigured = lowerMessage.includes('not configured') || 
                              lowerMessage.includes('twilio') ||
                              lowerMessage.includes('set up') ||
                              lowerMessage.includes('authentication') ||
                              lowerMessage.includes('credentials') ||
                              lowerMessage.includes('invalid username');
      
      // Get current request details for manual SMS fallback
      const currentRequest = selectedRequest;
      const paymentLink = currentRequest?.paymentUrl || `${window.location.origin}/pay/${id}`;
      
      if (isNotConfigured) {
        toast({
          title: "SMS error",
          description: "SMS could not be sent. Tap 'Open SMS App' to send manually.",
          variant: "destructive",
          action: (
            <ToastAction
              altText="Open SMS App"
              onClick={() => openSmsApp(phone, paymentLink, currentRequest?.description || '', Number(currentRequest?.amount) || 0)}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Open SMS App
            </ToastAction>
          ),
        });
      } else {
        // Try to extract a user-friendly message
        let displayMessage = rawMessage;
        try {
          if (rawMessage.includes(': {')) {
            const jsonPart = rawMessage.substring(rawMessage.indexOf(': ') + 2);
            const parsed = JSON.parse(jsonPart);
            displayMessage = parsed.error || parsed.message || displayMessage;
          }
        } catch {
          // Keep original message
        }
        
        toast({
          title: "Failed to send SMS",
          description: "Tap 'Open SMS App' to send manually.",
          variant: "destructive",
          action: (
            <ToastAction
              altText="Open SMS App"
              onClick={() => openSmsApp(phone, paymentLink, currentRequest?.description || '', Number(currentRequest?.amount) || 0)}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Open SMS App
            </ToastAction>
          ),
        });
      }
    } finally {
      setIsSendingSms(false);
    }
  };

  const receiptMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/receipts', data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/receipts'] });
      setShowReceiptDialog(false);
      resetReceiptForm();
      toast({
        title: "Receipt generated",
        description: `Receipt ${data.receiptNumber} created`,
      });
      navigate(`/receipts/${data.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate receipt",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const resetCreateForm = () => {
    setNewAmount("");
    setNewDescription("");
    setNewReference("");
    setSelectedClientId("");
    setSelectedInvoiceId("");
    setSelectedJobId("");
    setExpiresInHours("24");
    setSelectedPaymentMethod("card");
  };

  const resetRecordForm = () => {
    setRecordAmount("");
    setRecordInvoiceId("");
    setRecordClientId("");
    setRecordPaymentMethod("cash");
    setRecordReference("");
    setRecordNotes("");
  };

  const resetReceiptForm = () => {
    setReceiptAmount("");
    setReceiptDescription("");
    setReceiptPaymentMethod("cash");
    setReceiptReference("");
    setReceiptClientId(null);
    setReceiptInvoiceId(null);
    setReceiptJobId("");
  };

  const getPaymentUrl = (request: PaymentRequest) => {
    if (request.paymentUrl) return request.paymentUrl;
    const baseUrl = window.location.origin;
    return `${baseUrl}/pay/${request.token}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">Pending</Badge>;
      case 'paid':
        return <Badge className="bg-emerald-500">Paid</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInvoiceNumber = (invoiceId: string | null | undefined) => {
    if (!invoiceId || !invoices) return null;
    const invoice = invoices.find(i => i.id === invoiceId);
    return invoice?.number;
  };

  const getClientName = (clientId: string | null | undefined) => {
    if (!clientId || !clients) return null;
    const client = clients.find(c => c.id === clientId);
    return client?.name;
  };

  const getJobTitle = (jobId: string | null | undefined) => {
    if (!jobId || !jobs) return null;
    const job = jobs.find(j => j.id === jobId);
    return job?.title;
  };

  const handleRegenerate = (request: PaymentRequest) => {
    cancelMutation.mutate(request.id);
    createMutation.mutate({
      amount: parseFloat(request.amount),
      description: request.description,
      clientId: request.clientId || undefined,
      invoiceId: request.invoiceId || undefined,
      jobId: request.jobId || undefined,
      expiresInHours: 24,
    });
  };

  const isExpiredRequest = (r: PaymentRequest) => {
    return r.expiresAt && new Date(r.expiresAt) < new Date();
  };

  const pendingRequests = paymentRequests?.filter(r => r.status === 'pending' && !isExpiredRequest(r)) || [];
  const expiredRequests = paymentRequests?.filter(r => r.status === 'pending' && isExpiredRequest(r)) || [];
  const completedRequests = paymentRequests?.filter(r => r.status !== 'pending') || [];
  
  const totalPending = pendingRequests.reduce((sum, r) => sum + parseFloat(r.amount), 0);
  const totalReceived = completedRequests.filter(r => r.status === 'paid').reduce((sum, r) => sum + parseFloat(r.amount), 0);

  return (
    <PageShell>
      <div className="animate-fade-up">
        <PageHeader
          title="Collect Payment"
          subtitle="Get paid on-site or send payment links"
          leading={<DollarSign className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />}
        />
      </div>

      {!stripeConnected && (
        <div className="feed-card overflow-visible animate-fade-up stagger-delay-1" style={{ borderColor: 'hsl(35 90% 50% / 0.3)' }} data-testid="banner-demo-mode">
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-100 dark:bg-amber-900/30">
                <Zap className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <span className="text-sm font-semibold">Demo Mode</span>
                <p className="ios-caption">Payment links work for testing. Connect Stripe for real payments.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/integrations')} data-testid="button-setup-stripe">
              Connect Stripe
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 animate-fade-up stagger-delay-2">
        <div className="feed-card card-accent p-4 text-center col-span-1" data-testid="kpi-outstanding">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
            <DollarSign className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
          </div>
          <p className="text-2xl font-bold tracking-tight" style={{ color: 'hsl(var(--trade))' }}>${totalPending.toFixed(0)}</p>
          <p className="ios-label mt-1">Outstanding</p>
        </div>
        <div className="feed-card p-4 text-center" data-testid="kpi-pending-count">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 bg-amber-100 dark:bg-amber-900/30">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight">{pendingRequests.length}</p>
          <p className="ios-label mt-1">Pending</p>
        </div>
        <div className="feed-card p-4 text-center" data-testid="kpi-received">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-emerald-600">${totalReceived.toFixed(0)}</p>
          <p className="ios-label mt-1">Received</p>
        </div>
      </div>

      <div className="card-accent overflow-visible animate-fade-up stagger-delay-3" data-testid="card-collect-payment">
        <div className="p-5">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--trade))' }}>
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg tracking-tight">Collect Payment</h3>
                <p className="ios-caption">Get paid in-person or remotely</p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="tap" className="w-full">
            <div className="feed-card p-1 mb-4">
              <TabsList className="grid w-full grid-cols-3 bg-transparent">
                <TabsTrigger value="tap" className="gap-2 rounded-xl data-[state=active]:shadow-sm" data-testid="tab-tap-to-pay">
                  <Smartphone className="h-4 w-4" />
                  Tap to Pay
                </TabsTrigger>
                <TabsTrigger value="qr" className="gap-2 rounded-xl data-[state=active]:shadow-sm" data-testid="tab-qr-code">
                  <QrCode className="h-4 w-4" />
                  QR Code
                </TabsTrigger>
                <TabsTrigger value="link" className="gap-2 rounded-xl data-[state=active]:shadow-sm" data-testid="tab-send-link">
                  <Link2 className="h-4 w-4" />
                  Send Link
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="tap" className="space-y-4">
              <div className="text-center py-6 rounded-2xl" style={{ backgroundColor: 'hsl(var(--trade) / 0.05)' }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                  <Smartphone className="h-8 w-8" style={{ color: 'hsl(var(--trade))' }} />
                </div>
                <h4 className="font-semibold mb-1">Contactless Payment</h4>
                <p className="ios-caption max-w-xs mx-auto">
                  Customer taps their card or phone on your device to pay instantly
                </p>
              </div>
              <div className="feed-card p-3 flex items-start gap-2" data-testid="info-tap-to-pay-web">
                <AlertTriangle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="ios-caption">
                  Tap to Pay is only available on iPhone XS+ with iOS 16.4+. On web, use QR Code or Send Link instead.
                </p>
              </div>
              <Button 
                className="w-full h-12 text-base" 
                style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
                onClick={() => setShowTapToPayDialog(true)}
                data-testid="button-start-tap-to-pay"
              >
                <Smartphone className="h-5 w-5 mr-2" />
                Start Tap to Pay
              </Button>
            </TabsContent>

            <TabsContent value="qr" className="space-y-4">
              <div className="text-center py-6 rounded-2xl" style={{ backgroundColor: 'hsl(var(--trade) / 0.05)' }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                  <QrCode className="h-8 w-8" style={{ color: 'hsl(var(--trade))' }} />
                </div>
                <h4 className="font-semibold mb-1">QR Code Payment</h4>
                <p className="ios-caption max-w-xs mx-auto">
                  Show a QR code for customer to scan and pay from their phone
                </p>
              </div>
              <Button 
                className="w-full h-12 text-base" 
                style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
                onClick={() => setShowTapToPayDialog(true)}
                data-testid="button-show-qr"
              >
                <QrCode className="h-5 w-5 mr-2" />
                Generate QR Code
              </Button>
            </TabsContent>

            <TabsContent value="link" className="space-y-4">
              <div className="text-center py-6 rounded-2xl" style={{ backgroundColor: 'hsl(var(--trade) / 0.05)' }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                  <Link2 className="h-8 w-8" style={{ color: 'hsl(var(--trade))' }} />
                </div>
                <h4 className="font-semibold mb-1">Payment Link</h4>
                <p className="ios-caption max-w-xs mx-auto">
                  Create a payment link to send via email, SMS, or copy to clipboard
                </p>
              </div>
              <Button 
                className="w-full h-12 text-base" 
                style={{ backgroundColor: 'hsl(var(--trade))', color: 'white' }}
                onClick={() => setShowCreateDialog(true)}
                data-testid="button-create-link"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Payment Link
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div 
        className="feed-card card-press overflow-visible cursor-pointer animate-fade-up stagger-delay-4" 
        onClick={() => setShowRecordPaymentDialog(true)}
        data-testid="card-record-payment"
      >
        <div className="p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 flex-shrink-0">
            <Banknote className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Record Manual Payment</p>
            <p className="ios-caption">Cash, bank transfer, or other payment method</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <div className="section-gap">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : pendingRequests.length === 0 && expiredRequests.length === 0 && completedRequests.length === 0 ? (
          <div className="feed-card animate-fade-up stagger-delay-5">
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                <QrCode className="h-10 w-10" style={{ color: 'hsl(var(--trade))' }} />
              </div>
              <h3 className="text-lg font-semibold mb-1">No payment requests yet</h3>
              <p className="ios-caption text-center max-w-sm">
                Create your first payment request above to start collecting payments from customers
              </p>
            </div>
          </div>
        ) : (
          <>
            {pendingRequests.length > 0 && (
              <div className="animate-fade-up stagger-delay-5">
                <p className="ios-label mb-3">ACTIVE REQUESTS</p>
                <div className="feed-gap">
                  {pendingRequests.map((request, idx) => (
                    <div key={request.id} className={`feed-card card-press overflow-visible animate-fade-up stagger-delay-${Math.min(idx + 1, 8)}`} data-testid={`request-${request.id}`}>
                      <div className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                              <DollarSign className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-lg tracking-tight">${parseFloat(request.amount).toFixed(2)}</p>
                              <p className="text-sm font-medium truncate max-w-[200px]">{request.description}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="ios-caption">
                                  {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                                </p>
                                {request.clientId && getClientName(request.clientId) && (
                                  <>
                                    <span className="ios-caption">·</span>
                                    <span className="ios-caption">{getClientName(request.clientId)}</span>
                                  </>
                                )}
                                {request.invoiceId && getInvoiceNumber(request.invoiceId) && (
                                  <>
                                    <span className="ios-caption">·</span>
                                    <span
                                      className="text-[13px] cursor-pointer hover:underline"
                                      style={{ color: 'hsl(var(--trade))' }}
                                      onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${request.invoiceId}`); }}
                                    >
                                      {getInvoiceNumber(request.invoiceId)}
                                    </span>
                                  </>
                                )}
                                {request.jobId && getJobTitle(request.jobId) && (
                                  <>
                                    <span className="ios-caption">·</span>
                                    <span
                                      className="text-[13px] cursor-pointer hover:underline"
                                      style={{ color: 'hsl(var(--trade))' }}
                                      onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${request.jobId}`); }}
                                    >
                                      {getJobTitle(request.jobId)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowShareDialog(true);
                              }}
                              data-testid={`button-share-${request.id}`}
                            >
                              <Share2 className="h-4 w-4 mr-1" />
                              Share
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => cancelMutation.mutate(request.id)}
                              data-testid={`button-cancel-${request.id}`}
                            >
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(expiredRequests.length > 0 || completedRequests.length > 0) && (() => {
              const filteredExpired = expiredSearch
                ? expiredRequests.filter(r =>
                    r.description.toLowerCase().includes(expiredSearch.toLowerCase()) ||
                    (r.clientId && getClientName(r.clientId)?.toLowerCase().includes(expiredSearch.toLowerCase())) ||
                    r.amount.includes(expiredSearch)
                  )
                : expiredRequests;
              const visibleExpired = showAllExpired ? filteredExpired : filteredExpired.slice(0, 15);

              const filteredHistory = historySearch
                ? completedRequests.filter(r =>
                    r.description.toLowerCase().includes(historySearch.toLowerCase()) ||
                    (r.clientId && getClientName(r.clientId)?.toLowerCase().includes(historySearch.toLowerCase())) ||
                    r.amount.includes(historySearch)
                  )
                : completedRequests;
              const visibleHistory = showAllHistory ? filteredHistory : filteredHistory.slice(0, 15);

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-up stagger-delay-6">
                  {expiredRequests.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                        <p className="ios-label">EXPIRED REQUESTS ({expiredRequests.length})</p>
                        {expiredRequests.length > 15 && (
                          <div className="relative flex-1 max-w-[200px]">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              placeholder="Search..."
                              value={expiredSearch}
                              onChange={(e) => setExpiredSearch(e.target.value)}
                              className="h-7 pl-7 text-xs"
                            />
                          </div>
                        )}
                      </div>
                      <div className="feed-gap">
                        {visibleExpired.map((request) => (
                          <div key={request.id} className="feed-card opacity-75" data-testid={`request-expired-${request.id}`}>
                            <div className="p-3">
                              <div className="flex items-start gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-muted">
                                  <Clock className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                    <p className="font-bold">${parseFloat(request.amount).toFixed(2)}</p>
                                    {getStatusBadge('expired')}
                                  </div>
                                  <p className="text-sm font-medium truncate">{request.description}</p>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="ios-caption">
                                      {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                                    </p>
                                    {request.clientId && getClientName(request.clientId) && (
                                      <>
                                        <span className="ios-caption">·</span>
                                        <span className="ios-caption">{getClientName(request.clientId)}</span>
                                      </>
                                    )}
                                    {request.invoiceId && getInvoiceNumber(request.invoiceId) && (
                                      <>
                                        <span className="ios-caption">·</span>
                                        <span
                                          className="text-[13px] cursor-pointer hover:underline"
                                          style={{ color: 'hsl(var(--trade))' }}
                                          onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${request.invoiceId}`); }}
                                        >
                                          {getInvoiceNumber(request.invoiceId)}
                                        </span>
                                      </>
                                    )}
                                    {request.jobId && getJobTitle(request.jobId) && (
                                      <>
                                        <span className="ios-caption">·</span>
                                        <span
                                          className="text-[13px] cursor-pointer hover:underline"
                                          style={{ color: 'hsl(var(--trade))' }}
                                          onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${request.jobId}`); }}
                                        >
                                          {getJobTitle(request.jobId)}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRegenerate(request)}
                                  disabled={createMutation.isPending || cancelMutation.isPending}
                                  data-testid={`button-regenerate-${request.id}`}
                                >
                                  <RefreshCw className={`h-4 w-4 mr-1 ${createMutation.isPending ? 'animate-spin' : ''}`} />
                                  Regenerate
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => cancelMutation.mutate(request.id)}
                                  data-testid={`button-cancel-${request.id}`}
                                >
                                  <XCircle className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {filteredExpired.length > 15 && !showAllExpired && (
                        <Button
                          variant="ghost"
                          className="w-full mt-2"
                          onClick={() => setShowAllExpired(true)}
                        >
                          Show all {filteredExpired.length} expired
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                      {showAllExpired && filteredExpired.length > 15 && (
                        <Button
                          variant="ghost"
                          className="w-full mt-2"
                          onClick={() => setShowAllExpired(false)}
                        >
                          Show less
                          <ChevronUp className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  )}

                  {completedRequests.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                        <p className="ios-label">HISTORY ({completedRequests.length})</p>
                        {completedRequests.length > 15 && (
                          <div className="relative flex-1 max-w-[200px]">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              placeholder="Search..."
                              value={historySearch}
                              onChange={(e) => setHistorySearch(e.target.value)}
                              className="h-7 pl-7 text-xs"
                            />
                          </div>
                        )}
                      </div>
                      <div className="feed-gap">
                        {visibleHistory.map((request) => (
                          <div
                            key={request.id}
                            className="feed-card card-press overflow-visible cursor-pointer"
                            onClick={() => {
                              if (request.invoiceId) {
                                navigate(`/invoices/${request.invoiceId}`);
                              } else if (request.jobId) {
                                navigate(`/jobs/${request.jobId}`);
                              }
                            }}
                          >
                            <div className="p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                    request.status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'
                                  }`}>
                                    {request.status === 'paid' ? (
                                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                                    ) : (
                                      <XCircle className="h-5 w-5 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold">${parseFloat(request.amount).toFixed(2)}</p>
                                    <div className="flex items-center gap-2">
                                      <span className="ios-caption truncate max-w-[140px]">{request.description}</span>
                                      {request.clientId && getClientName(request.clientId) && (
                                        <>
                                          <span className="ios-caption">·</span>
                                          <span className="ios-caption truncate max-w-[100px]">{getClientName(request.clientId)}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  {getStatusBadge(request.status)}
                                  <p className="ios-caption mt-1">
                                    {format(new Date(request.createdAt), 'MMM d')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {filteredHistory.length > 15 && !showAllHistory && (
                        <Button
                          variant="ghost"
                          className="w-full mt-2"
                          onClick={() => setShowAllHistory(true)}
                        >
                          Show all {filteredHistory.length} payments
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                      {showAllHistory && filteredHistory.length > 15 && (
                        <Button
                          variant="ghost"
                          className="w-full mt-2"
                          onClick={() => setShowAllHistory(false)}
                        >
                          Show less
                          <ChevronUp className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* QR Payment Dialog */}
      <Dialog open={showTapToPayDialog} onOpenChange={(open) => {
        if (!open) {
          setShowTapToPayDialog(false);
          setTapToPayAmount("");
          setTapToPayDescription("");
          setTapToPayInvoiceId("");
          setTapToPayClientId("");
          setTapToPayJobId("");
          setTapToPayRequest(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              QR Payment
            </DialogTitle>
            <DialogDescription>
              Generate a QR code for customer to scan and pay
            </DialogDescription>
          </DialogHeader>

          {!tapToPayRequest ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={tapToPayAmount}
                    onChange={(e) => setTapToPayAmount(e.target.value)}
                    className="pl-8 text-2xl font-bold h-14"
                    autoFocus
                    data-testid="input-tap-to-pay-amount"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  placeholder="What's this for?"
                  value={tapToPayDescription}
                  onChange={(e) => setTapToPayDescription(e.target.value)}
                  data-testid="input-tap-to-pay-description"
                />
              </div>

              <div className="space-y-2">
                <Label>Link to Invoice (optional)</Label>
                <SearchableSelect
                  value={tapToPayInvoiceId || "_none"}
                  onValueChange={(value) => setTapToPayInvoiceId(value === "_none" ? "" : value)}
                  placeholder="Select invoice to auto-fill"
                  searchPlaceholder="Search invoices..."
                  emptyMessage="No unpaid invoices found."
                  options={[
                    { value: "_none", label: "No invoice (quick collect)" },
                    ...unpaidInvoices.map((invoice) => ({
                      value: invoice.id,
                      label: `${invoice.number} - ${invoice.title} ($${typeof invoice.total === 'number' ? invoice.total.toFixed(2) : invoice.total})`,
                    })),
                  ]}
                  data-testid="select-tap-to-pay-invoice"
                />
              </div>

              <div className="space-y-2">
                <Label>Client (optional)</Label>
                <SearchableSelect
                  value={tapToPayClientId || "_none"}
                  onValueChange={(value) => setTapToPayClientId(value === "_none" ? "" : value)}
                  placeholder="Select client"
                  searchPlaceholder="Search clients..."
                  emptyMessage="No clients found."
                  options={[
                    { value: "_none", label: "No client" },
                    ...(clients?.map((client) => ({ value: client.id, label: client.name })) || []),
                  ]}
                  data-testid="select-tap-to-pay-client"
                />
              </div>

              <div className="space-y-2">
                <Label>Job (optional)</Label>
                <JobPicker
                  value={tapToPayJobId}
                  onChange={setTapToPayJobId}
                  label={null}
                  filterJobs={(job) => job.status !== 'cancelled' && (!tapToPayClientId || job.clientId === tapToPayClientId)}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowTapToPayDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => tapToPayMutation.mutate({
                    amount: tapToPayAmount,
                    description: tapToPayDescription,
                    invoiceId: tapToPayInvoiceId || undefined,
                    clientId: tapToPayClientId || undefined,
                    jobId: tapToPayJobId || undefined,
                  })}
                  disabled={!tapToPayAmount || parseFloat(tapToPayAmount) <= 0 || tapToPayMutation.isPending}
                  data-testid="button-create-tap-to-pay"
                >
                  {tapToPayMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <QrCode className="h-4 w-4 mr-2" />
                      Show QR
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                <p className="text-3xl font-bold" style={{ color: 'hsl(var(--trade))' }}>
                  ${parseFloat(tapToPayRequest.amount).toFixed(2)}
                </p>
              </div>

              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-lg shadow-inner">
                  <QRCodeSVG
                    value={getPaymentUrl(tapToPayRequest)}
                    size={180}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="text-sm text-muted-foreground text-center mt-3">
                  Customer scans to pay
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Expires in 1 hour</span>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTapToPayRequest(null);
                    setTapToPayAmount("");
                    setTapToPayDescription("");
                    setTapToPayInvoiceId("");
                    setTapToPayClientId("");
                    setTapToPayJobId("");
                  }}
                >
                  New Payment
                </Button>
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(getPaymentUrl(tapToPayRequest))}
                >
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  Copy Link
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Request Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Payment Request</DialogTitle>
            <DialogDescription>
              Create a payment link to send to your customer
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Link to Invoice (optional)</Label>
              <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                <SelectTrigger data-testid="select-invoice">
                  <SelectValue placeholder="Select invoice to auto-fill" />
                </SelectTrigger>
                <SelectContent>
                  {unpaidInvoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.number} - ${typeof invoice.total === 'number' ? invoice.total.toFixed(2) : invoice.total}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="pl-8"
                  data-testid="input-amount"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Payment for services"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                data-testid="input-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Reference (optional)</Label>
              <Input
                placeholder="Invoice number or reference"
                value={newReference}
                onChange={(e) => setNewReference(e.target.value)}
                data-testid="input-reference"
              />
            </div>

            <PaymentMethodSelector
              amount={parseFloat(newAmount) || 0}
              selectedMethod={selectedPaymentMethod}
              onMethodChange={setSelectedPaymentMethod}
            />

            <div className="space-y-2">
              <Label>Expires in</Label>
              <Select value={expiresInHours} onValueChange={setExpiresInHours}>
                <SelectTrigger data-testid="select-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="72">3 days</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate({
                amount: parseFloat(newAmount),
                description: newDescription,
                reference: newReference || undefined,
                clientId: selectedClientId || undefined,
                invoiceId: selectedInvoiceId || undefined,
                jobId: selectedJobId || undefined,
                expiresInHours: parseInt(expiresInHours),
                paymentMethod: selectedPaymentMethod,
              })}
              disabled={!newAmount || !newDescription || createMutation.isPending}
              data-testid="button-create-request"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showRecordPaymentDialog} onOpenChange={setShowRecordPaymentDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a cash or bank transfer payment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <SearchableSelect
                value={recordClientId}
                onValueChange={(value) => {
                  setRecordClientId(value);
                  setRecordInvoiceId("");
                }}
                placeholder="Select client"
                searchPlaceholder="Search clients..."
                emptyMessage="No clients found."
                options={clients?.map((client) => ({ value: client.id, label: client.name })) || []}
                data-testid="select-record-client"
              />
            </div>

            <div className="space-y-2">
              <Label>Invoice</Label>
              <SearchableSelect
                value={recordInvoiceId}
                onValueChange={setRecordInvoiceId}
                placeholder="Select invoice"
                searchPlaceholder="Search invoices..."
                emptyMessage="No unpaid invoices found."
                options={unpaidInvoices
                  .filter(inv => !recordClientId || inv.clientId === recordClientId)
                  .map((invoice) => ({
                    value: invoice.id,
                    label: `${invoice.number} - $${typeof invoice.total === 'number' ? invoice.total.toFixed(2) : invoice.total}`,
                  }))}
                data-testid="select-record-invoice"
              />
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={recordAmount}
                  onChange={(e) => setRecordAmount(e.target.value)}
                  className="pl-8"
                  data-testid="input-record-amount"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={recordPaymentMethod} onValueChange={setRecordPaymentMethod}>
                <SelectTrigger data-testid="select-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reference (optional)</Label>
              <Input
                placeholder="Transaction reference"
                value={recordReference}
                onChange={(e) => setRecordReference(e.target.value)}
                data-testid="input-record-reference"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Add any notes"
                value={recordNotes}
                onChange={(e) => setRecordNotes(e.target.value)}
                data-testid="input-record-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecordPaymentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => recordPaymentMutation.mutate({
                invoiceId: recordInvoiceId,
                amount: recordAmount,
                paymentMethod: recordPaymentMethod,
                reference: recordReference || undefined,
                notes: recordNotes || undefined,
              })}
              disabled={!recordInvoiceId || !recordAmount || recordPaymentMutation.isPending}
              data-testid="button-record-submit"
            >
              {recordPaymentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Record Payment"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Share Payment Link</DialogTitle>
            <DialogDescription>
              ${selectedRequest ? parseFloat(selectedRequest.amount).toFixed(2) : '0.00'} - {selectedRequest?.description}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="qr">QR Code</TabsTrigger>
                <TabsTrigger value="link">Link</TabsTrigger>
                <TabsTrigger value="send">Send</TabsTrigger>
              </TabsList>

              <TabsContent value="qr" className="mt-4">
                <div className="flex flex-col items-center">
                  <div className="bg-white p-4 rounded-lg shadow-inner">
                    <QRCodeSVG
                      value={getPaymentUrl(selectedRequest)}
                      size={180}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Customer scans this code with their phone camera to pay
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="link" className="mt-4">
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={getPaymentUrl(selectedRequest)}
                      readOnly
                      className="font-mono text-sm"
                      data-testid="input-payment-link"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(getPaymentUrl(selectedRequest))}
                      data-testid="button-copy-link"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Share this link via any messaging app
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="send" className="mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Send via Email</Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="Enter email address"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        data-testid="input-email"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => sendEmailMutation.mutate({ id: selectedRequest.id, email: shareEmail })}
                        disabled={!shareEmail || sendEmailMutation.isPending}
                        data-testid="button-send-email"
                      >
                        {sendEmailMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Send via SMS</Label>
                    <div className="flex gap-2">
                      <Input
                        type="tel"
                        placeholder="Enter phone number"
                        value={sharePhone}
                        onChange={(e) => setSharePhone(e.target.value)}
                        data-testid="input-phone"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleSendSms(selectedRequest.id, sharePhone)}
                        disabled={!sharePhone || isSendingSms}
                        data-testid="button-send-sms"
                      >
                        {isSendingSms ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {selectedRequest.notificationsSent && (selectedRequest.notificationsSent as any[]).length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">Previously sent:</p>
                      {(selectedRequest.notificationsSent as any[]).slice(-3).map((notification: any, idx: number) => (
                        <p key={idx} className="text-xs text-muted-foreground">
                          {notification.type === 'sms' ? 'SMS' : 'Email'}: {notification.phone || notification.email} ({new Date(notification.sentAt).toLocaleDateString()} {new Date(notification.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Receipt</DialogTitle>
            <DialogDescription>
              Create a receipt for a completed payment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Link to Invoice (optional)</Label>
              <Select value={receiptInvoiceId || ""} onValueChange={(v) => setReceiptInvoiceId(v || null)}>
                <SelectTrigger data-testid="select-receipt-invoice">
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  {invoices?.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.number} - ${typeof invoice.total === 'number' ? invoice.total.toFixed(2) : invoice.total}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={receiptAmount}
                  onChange={(e) => setReceiptAmount(e.target.value)}
                  className="pl-8"
                  data-testid="input-receipt-amount"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Payment description"
                value={receiptDescription}
                onChange={(e) => setReceiptDescription(e.target.value)}
                data-testid="input-receipt-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={receiptPaymentMethod} onValueChange={setReceiptPaymentMethod}>
                <SelectTrigger data-testid="select-receipt-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiptDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => receiptMutation.mutate({
                amount: parseFloat(receiptAmount),
                description: receiptDescription,
                paymentMethod: receiptPaymentMethod,
                paymentReference: receiptReference || undefined,
                clientId: receiptClientId || undefined,
                invoiceId: receiptInvoiceId || undefined,
                jobId: receiptJobId || undefined,
              })}
              disabled={!receiptAmount || !receiptDescription || receiptMutation.isPending}
              data-testid="button-generate-receipt"
            >
              {receiptMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Receipt className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
