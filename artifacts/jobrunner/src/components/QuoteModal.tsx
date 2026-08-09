import { useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQuoteWithDetails } from "@/hooks/use-quotes";
import { useBusinessSettings } from "@/hooks/use-business-settings";
import { useClient } from "@/hooks/use-clients";
import { type Quote, type QuoteLineItem, type Client } from "@shared/schema";
import { parseTradieFriendlyError, formatToastDescription } from "@/lib/errorUtils";
import EmailComposeModal from "./EmailComposeModal";
import SmartActionsPanel, { getQuoteSmartActions, type SmartAction } from "./SmartActionsPanel";
import { 
  FileText, 
  Mail, 
  Download, 
  Eye, 
  CheckCircle, 
  Clock,
  X,
  Zap
} from "lucide-react";

// Extended quote type with client data
type QuoteWithClient = Quote & {
  clientName?: string;
  lineItems?: QuoteLineItem[];
  acceptanceToken?: string | null;
};

interface QuoteModalProps {
  quoteId: string;
  isOpen: boolean;
  onClose: () => void;
  onViewFullQuote?: (quoteId: string) => void;
}

export default function QuoteModal({ quoteId, isOpen, onClose, onViewFullQuote }: QuoteModalProps) {
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [showSmartActions, setShowSmartActions] = useState(false);
  const [smartActions, setSmartActions] = useState<SmartAction[]>([]);
  const [isExecutingActions, setIsExecutingActions] = useState(false);
  const { data: apiResponse, isLoading: quoteLoading } = useQuoteWithDetails(quoteId);
  const quote = apiResponse as QuoteWithClient;
  const { data: businessSettings } = useBusinessSettings();
  const { data: clientData } = useClient(quote?.clientId || '') as { data: Client | undefined };
  const { toast } = useToast();

  const formatCurrency = (amount: string | number) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'sent': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'accepted': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const handleOpenEmailCompose = () => {
    if (!quote) return;
    setShowEmailCompose(true);
  };

  const handleSendQuoteEmail = async (customSubject: string, customMessage: string) => {
    if (!quote) return;
    
    // If no subject/message, we're in "Gmail mode" - just mark as sent without sending email
    const skipEmail = !customSubject && !customMessage;
    
    const response = await fetch(`/api/quotes/${quoteId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ customSubject, customMessage, skipEmail })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      const parsedError = parseTradieFriendlyError(errorData);
      throw new Error(formatToastDescription(parsedError));
    }
    
    const recipientName = clientData?.name || quote.clientName || 'the client';
    toast({
      title: skipEmail ? "Quote Ready" : "Quote Sent",
      description: skipEmail 
        ? `Quote ${quote.number} status updated. Send it via Gmail!`
        : `Quote ${quote.number} has been sent to ${recipientName}.`,
    });
    setShowEmailCompose(false);
    onClose();
  };

  const handleViewFullQuote = () => {
    onViewFullQuote?.(quoteId);
    onClose();
  };

  // Check for missing business info before download
  const getMissingBusinessInfo = (): string[] => {
    const warnings: string[] = [];
    if (!businessSettings) return warnings;
    const total = parseFloat(String(quote?.total || '0'));
    if (!businessSettings.abn) {
      if (total > 82.50) {
        warnings.push('ABN required for tax invoices over $82.50');
      } else {
        warnings.push('ABN not set');
      }
    }
    if (!businessSettings.address) warnings.push('Business address not set');
    if (!businessSettings.phone) warnings.push('Phone number not set');
    if (!businessSettings.email) warnings.push('Email not set');
    return warnings;
  };

  const handleDownloadPDF = async () => {
    if (!quote) return;
    
    // Show warning if business info is incomplete
    const warnings = getMissingBusinessInfo();
    if (warnings.length > 0) {
      toast({
        title: "Document Incomplete",
        description: `Please update your business settings: ${warnings.join(', ')}`,
        variant: "destructive",
      });
      // Still allow download but show the warning first
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}/pdf`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Quote-${quote.number || quoteId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "PDF Downloaded",
        description: `Quote ${quote.number} has been downloaded.`,
      });
    } catch (error) {
      const parsedError = parseTradieFriendlyError(error);
      toast({
        title: parsedError.title,
        description: formatToastDescription(parsedError),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Smart Actions handlers
  const initializeSmartActions = () => {
    if (quote && clientData) {
      const actions = getQuoteSmartActions(quote, clientData);
      setSmartActions(actions);
      setShowSmartActions(true);
    }
  };

  const handleActionToggle = (actionId: string, enabled: boolean) => {
    setSmartActions(prev => prev.map(a => 
      a.id === actionId ? { ...a, enabled } : a
    ));
  };

  const handleActionPreview = (actionId: string) => {
    const action = smartActions.find(a => a.id === actionId);
    if (action) {
      toast({
        title: `Preview: ${action.title}`,
        description: action.preview?.message || action.description,
      });
    }
  };

  const handleActionEdit = (actionId: string) => {
    toast({
      title: "Edit Action",
      description: "Opening editor...",
    });
  };

  const handleExecuteActions = async () => {
    setIsExecutingActions(true);
    const enabledActions = smartActions.filter(a => a.enabled && !a.missingRequirements?.length);
    
    for (const action of enabledActions) {
      setSmartActions(prev => prev.map(a => 
        a.id === action.id ? { ...a, status: 'running' } : a
      ));

      try {
        if (action.type === 'create_job') {
          navigate(`/jobs/new?quoteId=${quoteId}&clientId=${quote.clientId}`);
          setSmartActions(prev => prev.map(a => 
            a.id === action.id ? { ...a, status: 'completed' } : a
          ));
          onClose();
          return;
        } else if (action.type === 'send_email') {
          setShowEmailCompose(true);
          setSmartActions(prev => prev.map(a => 
            a.id === action.id ? { ...a, status: 'completed' } : a
          ));
        }
      } catch (error) {
        setSmartActions(prev => prev.map(a => 
          a.id === action.id ? { ...a, status: 'suggested' } : a
        ));
      }
    }

    setIsExecutingActions(false);
  };

  const handleSkipSmartActions = () => {
    setSmartActions(prev => prev.map(a => ({ ...a, enabled: false, status: 'skipped' })));
    setShowSmartActions(false);
    toast({
      title: "Actions skipped",
      description: "You can find these options in the quote details anytime",
    });
  };

  if (quoteLoading || !quote) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading Quote...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Quote Created Successfully!
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-quote-modal"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* Quote Header */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{quote.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    Quote {quote.number} • {quote.clientName || 'Unknown Client'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(quote.status)}>
                    {quote.status === 'draft' && <Clock className="h-3 w-3 mr-1" />}
                    {quote.status === 'sent' && <Mail className="h-3 w-3 mr-1" />}
                    {quote.status === 'accepted' && <CheckCircle className="h-3 w-3 mr-1" />}
                    {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quote Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quote Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {quote.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="text-sm">{quote.description}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Valid Until</p>
                  <p>{quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : 'No expiry'}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Created</p>
                  <p>{quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : 'Unknown'}</p>
                </div>
              </div>

              {/* Line Items */}
              {quote.lineItems && quote.lineItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Line Items</p>
                  <div className="space-y-2">
                    {quote.lineItems.map((item: QuoteLineItem, index: number) => (
                      <div key={index} className="flex justify-between items-start text-sm p-2 bg-muted/50 rounded">
                        <div className="flex-1">
                          <p className="font-medium">{item.description}</p>
                          <p className="text-muted-foreground">
                            Qty: {item.quantity} × {formatCurrency(item.unitPrice || 0)}
                          </p>
                        </div>
                        <p className="font-medium">
                          {formatCurrency(item.total || 0)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(quote.subtotal || 0)}</span>
                </div>
                {businessSettings?.gstEnabled && (
                  <div className="flex justify-between text-sm">
                    <span>GST (10%):</span>
                    <span>{formatCurrency(quote.gstAmount || 0)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatCurrency(quote.total || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Smart Actions for Accepted Quotes */}
          {quote.status === 'accepted' && showSmartActions && smartActions.length > 0 ? (
            <SmartActionsPanel
              title="Quote Accepted - What's Next?"
              subtitle="Choose your next steps - you're in control"
              actions={smartActions}
              onActionToggle={handleActionToggle}
              onActionPreview={handleActionPreview}
              onActionEdit={handleActionEdit}
              onExecuteAll={handleExecuteActions}
              onSkipAll={handleSkipSmartActions}
              isExecuting={isExecutingActions}
              entityType="quote"
              entityStatus={quote.status}
            />
          ) : quote.status === 'accepted' && !showSmartActions ? (
            <div className="space-y-3 pt-4">
              <Button
                onClick={initializeSmartActions}
                className="w-full"
                variant="outline"
                data-testid="button-show-quote-smart-actions"
              >
                <Zap className="h-4 w-4 mr-2" />
                See Suggested Next Steps
              </Button>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleDownloadPDF}
                  variant="default"
                  disabled={isLoading}
                  className="flex-1"
                  data-testid="button-download-quote-pdf"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isLoading ? 'Generating...' : 'Download PDF'}
                </Button>
                <Button
                  onClick={handleViewFullQuote}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-view-full-quote"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              </div>
            </div>
          ) : (
            /* Action Buttons for non-accepted quotes */
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={handleDownloadPDF}
                variant="default"
                disabled={isLoading}
                className="flex-1"
                data-testid="button-download-quote-pdf"
              >
                <Download className="h-4 w-4 mr-2" />
                {isLoading ? 'Generating...' : 'Download PDF'}
              </Button>
              
              {quote.status === 'draft' && (
                <Button
                  onClick={handleOpenEmailCompose}
                  disabled={isLoading}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-send-quote"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send to Client
                </Button>
              )}
              
              <Button
                onClick={handleViewFullQuote}
                variant="outline"
                className="flex-1"
                data-testid="button-view-full-quote"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Email Compose Modal */}
      {quote && (
        <EmailComposeModal
          isOpen={showEmailCompose}
          onClose={() => setShowEmailCompose(false)}
          type="quote"
          documentId={quoteId}
          clientName={clientData?.name || quote.clientName || 'Client'}
          clientEmail={clientData?.email || ''}
          documentNumber={quote.number || quoteId}
          documentTitle={quote.title}
          total={quote.total || '0'}
          businessName={businessSettings?.businessName}
          publicUrl={quote.acceptanceToken ? `${window.location.origin}/q/${quote.acceptanceToken}` : undefined}
          onSend={handleSendQuoteEmail}
        />
      )}
    </Dialog>
  );
}