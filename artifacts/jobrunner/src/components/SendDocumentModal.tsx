import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useLocation } from "wouter";
import { isDedicatedNumberError, GET_NUMBER_TOAST, GET_NUMBER_URL } from "@/lib/dedicatedNumber";
import { queryClient, apiRequest, getSessionToken } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import type { MessageTemplate } from "@shared/schema";
import { useFeatureAccess } from "@/hooks/use-subscription";
import { 
  Mail, 
  Send, 
  Eye, 
  Edit3,
  User,
  Building,
  Loader2,
  Check,
  Wand2,
  Copy,
  CheckCheck,
  FileText,
  MessageSquare,
  Phone
} from "lucide-react";
import { SmsSetupPrompt } from "./SmsSetupPrompt";

type DocumentType = 'quote' | 'invoice' | 'receipt';
type DeliveryMethod = 'email' | 'sms' | 'both';

interface SendDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: DocumentType;
  documentId: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  documentNumber: string;
  documentTitle: string;
  total: string;
  businessName?: string;
  publicUrl?: string;
  includeBeforePhotos?: boolean;
  includeAfterPhotos?: boolean;
  excludeNotes?: boolean;
}

interface AIEmailSuggestion {
  subject: string;
  greeting: string;
  body: string;
  closing: string;
  fullMessage: string;
}

interface TwilioStatus {
  configured: boolean;
  connected: boolean;
  hasPhoneNumber?: boolean;
}

const SMS_MAX_LENGTH = 160;
const SMS_SEGMENT_LENGTH = 153;

function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Remove all whitespace
  let formatted = phone.replace(/\s+/g, '');
  // If already in international format, return as-is
  if (formatted.startsWith('+')) {
    return formatted;
  }
  // Convert Australian local format (0412...) to international
  if (formatted.startsWith('0')) {
    return '+61' + formatted.slice(1);
  }
  // If starts with 61 (international without +), add +
  if (formatted.startsWith('61') && formatted.length >= 11) {
    return '+' + formatted;
  }
  // Default: assume Australian and prepend +61
  return '+61' + formatted;
}

function formatDisplayPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 11 && digits.startsWith('61')) {
    return `+61 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return phone;
}

function getSmsSegmentCount(message: string): number {
  if (message.length <= SMS_MAX_LENGTH) return 1;
  return Math.ceil(message.length / SMS_SEGMENT_LENGTH);
}

export default function SendDocumentModal({
  isOpen,
  onClose,
  type,
  documentId,
  clientName,
  clientEmail,
  clientPhone,
  documentNumber,
  documentTitle,
  total,
  businessName,
  publicUrl,
  includeBeforePhotos,
  includeAfterPhotos,
  excludeNotes,
}: SendDocumentModalProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { canUseAIFeatures } = useFeatureAccess();
  const [activeTab, setActiveTab] = useState<string>("compose");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("email");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedSmsTemplate, setSelectedSmsTemplate] = useState<string>("");
  const [phoneInput, setPhoneInput] = useState(clientPhone || "");
  const [showSmsSetupGuide, setShowSmsSetupGuide] = useState(false);

  const clientFirstName = clientName?.split(' ')[0] || 'there';

  const { data: templates = [] } = useQuery<MessageTemplate[]>({
    queryKey: ['/api/message-templates', 'email'],
    queryFn: async () => {
      const token = getSessionToken();
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/message-templates?channel=email', { 
        credentials: 'include',
        headers,
      });
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
    enabled: isOpen,
  });

  const { data: smsTemplates = [] } = useQuery<MessageTemplate[]>({
    queryKey: ['/api/message-templates', 'sms'],
    queryFn: async () => {
      const token = getSessionToken();
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/message-templates?channel=sms', { 
        credentials: 'include',
        headers,
      });
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
    enabled: isOpen,
  });

  const { data: twilioStatus } = useQuery<TwilioStatus>({
    queryKey: ['/api/sms/status'],
    enabled: isOpen,
    staleTime: 60000,
  });

  const isSmsAvailable = twilioStatus?.connected === true;
  const hasClientPhone = !!clientPhone || !!phoneInput;
  const hasClientEmail = !!clientEmail;

  const getDocTypeLabel = () => {
    switch (type) {
      case 'quote': return 'Quote';
      case 'invoice': return 'Invoice';
      case 'receipt': return 'Receipt';
      default: return 'Document';
    }
  };

  const formatCurrency = (amount: string | number) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(value || 0);
  };

  const generateSmsMessage = () => {
    const docType = getDocTypeLabel().toLowerCase();
    const amount = formatCurrency(total);
    const business = businessName || 'our business';
    
    if (type === 'quote') {
      return `G'day ${clientFirstName}! Your quote #${documentNumber} (${amount}) from ${business} is ready. View it here: ${publicUrl || '[link]'}`;
    } else if (type === 'invoice') {
      return `Hi ${clientFirstName}, invoice #${documentNumber} for ${amount} from ${business} is ready. Pay online: ${publicUrl || '[link]'}`;
    } else {
      return `Hi ${clientFirstName}, your receipt #${documentNumber} for ${amount} from ${business}. View: ${publicUrl || '[link]'}`;
    }
  };

  useEffect(() => {
    if (isOpen) {
      const docType = getDocTypeLabel();
      const defaultSubject = `${docType} #${documentNumber} from ${businessName || 'our business'} - ${documentTitle}`;
      const defaultMessage = type === 'quote' 
        ? `G'day ${clientFirstName},\n\nThanks for getting in touch! Please find attached your quote for "${documentTitle}".\n\nThe total comes to ${formatCurrency(total)}. If you have any questions or would like to discuss anything, just give us a bell.\n\nLooking forward to working with you!\n\nCheers`
        : type === 'invoice'
        ? `G'day ${clientFirstName},\n\nPlease find attached your invoice for "${documentTitle}".\n\nThe total amount due is ${formatCurrency(total)}. You can pay online using the secure link in the email.\n\nIf you have any questions, don't hesitate to give us a ring.\n\nThanks heaps for your custom!\n\nCheers`
        : `G'day ${clientFirstName},\n\nPlease find attached your receipt for "${documentTitle}".\n\nPayment received: ${formatCurrency(total)}.\n\nThanks for your business!\n\nCheers`;
      
      setSubject(defaultSubject);
      setMessage(defaultMessage);
      setSmsMessage(generateSmsMessage());
      setPhoneInput(clientPhone || "");
      setShowSmsSetupGuide(false);
      
      if (!hasClientEmail && isSmsAvailable && hasClientPhone) {
        setDeliveryMethod('sms');
      } else {
        setDeliveryMethod('email');
      }
    }
  }, [isOpen, type, documentNumber, documentTitle, total, businessName, clientFirstName, clientPhone, publicUrl]);

  const applyMergeFields = (text: string) => {
    if (!text) return text;
    return text
      .replace(/\{client_name\}/g, clientName || '')
      .replace(/\{client_first_name\}/g, clientFirstName || '')
      .replace(/\{business_name\}/g, businessName || '')
      .replace(/\{job_title\}/g, documentTitle || '')
      .replace(/\{amount\}/g, formatCurrency(total))
      .replace(/\{quote_number\}/g, type === 'quote' ? documentNumber : '')
      .replace(/\{invoice_number\}/g, type === 'invoice' ? documentNumber : '')
      .replace(/\{receipt_number\}/g, type === 'receipt' ? documentNumber : '')
      .replace(/\{document_number\}/g, documentNumber || '');
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t: MessageTemplate) => t.id === templateId);
    if (template) {
      if (template.subject) {
        setSubject(applyMergeFields(template.subject));
      }
      setMessage(applyMergeFields(template.body));
      toast({
        title: "Template applied",
        description: `"${template.name}" template loaded. Feel free to customise!`,
      });
    }
  };

  const handleSmsTemplateSelect = (templateId: string) => {
    setSelectedSmsTemplate(templateId);
    const template = smsTemplates.find((t: MessageTemplate) => t.id === templateId);
    if (template) {
      setSmsMessage(applyMergeFields(template.body));
      toast({
        title: "Template applied",
        description: `"${template.name}" SMS template loaded. Feel free to customise!`,
      });
    }
  };

  const generateAISuggestion = async () => {
    setIsGeneratingAI(true);
    try {
      const response = await apiRequest('POST', '/api/ai/email-suggestion', {
        type,
        clientName,
        clientFirstName,
        documentNumber,
        documentTitle,
        total,
        businessName
      });

      const suggestion: AIEmailSuggestion = await response.json();
      
      setSubject(suggestion.subject);
      setMessage(suggestion.fullMessage);
      
      toast({
        title: "AI Suggestion Ready",
        description: "Your email has been drafted. Feel free to customise it!",
      });
    } catch (error) {
      toast({
        title: "Couldn't generate suggestion",
        description: "No worries - you can write your own message below.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const sendEmail = async (): Promise<boolean> => {
    try {
      const endpoint = type === 'quote' 
        ? `/api/quotes/${documentId}/email-with-pdf`
        : type === 'invoice'
        ? `/api/invoices/${documentId}/email-with-pdf`
        : `/api/receipts/${documentId}/email`;
      
      const response = await apiRequest('POST', endpoint, {
        customSubject: subject,
        customMessage: message,
        includeBeforePhotos,
        includeAfterPhotos,
        excludeNotes,
      });

      let result;
      try {
        result = await response.json();
      } catch {
        result = { message: 'Server error - please try again' };
      }

      if (result.sent) {
        toast({
          title: `Email sent!`,
          description: `${getDocTypeLabel()} sent to ${result.recipientEmail || clientEmail}`,
        });
        return true;
      }

      if (result.draftUrl) {
        window.open(result.draftUrl, '_blank');
        toast({
          title: "Gmail draft created!",
          description: `PDF attached automatically. Review and click Send in Gmail.`,
        });
        return true;
      }

      toast({
        title: "Email couldn't be sent",
        description: result.error || result.message || "The email service may not be configured. Check your email settings.",
        variant: "destructive"
      });
      return false;
    } catch (error: any) {
      console.error('Email send error:', error);
      let errorMessage = "Couldn't connect to the server. Check your internet and try again.";
      let errorTitle = "Connection error";
      try {
        const rawMsg = error.message || '';
        const jsonStr = rawMsg.replace(/^\d{3}:\s*/, '');
        const parsed = JSON.parse(jsonStr);
        if (parsed.title) errorTitle = parsed.title;
        if (parsed.message) errorMessage = parsed.message;
        if (parsed.fix) errorMessage = parsed.fix;
      } catch {
        if (error.message && !error.message.includes('<!DOCTYPE') && !error.message.match(/^\d{3}:\s*\{/)) {
          errorMessage = error.message;
        }
      }
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive"
      });
      return false;
    }
  };

  const sendSms = async (): Promise<boolean> => {
    const phone = phoneInput || clientPhone;
    if (!phone) {
      toast({
        title: "No phone number",
        description: "Please enter a phone number to send an SMS.",
        variant: "destructive"
      });
      return false;
    }

    try {
      // Use the dedicated document-specific SMS endpoints
      const endpoint = type === 'quote' 
        ? `/api/quotes/${documentId}/send-sms`
        : type === 'invoice'
        ? `/api/invoices/${documentId}/send-sms`
        : `/api/receipts/${documentId}/send-sms`;
      
      const response = await apiRequest('POST', endpoint, {
        phone: formatPhoneNumber(phone),
        customMessage: smsMessage !== generateSmsMessage() ? smsMessage : undefined,
      });

      let result;
      try {
        result = await response.json();
      } catch {
        result = {};
      }

      // Check if the response indicates an error (some backends return 200 with error field)
      if (result.error) {
        if (result.code === 'DEDICATED_NUMBER_REQUIRED' || isDedicatedNumberError(result.error)) {
          toast({
            ...GET_NUMBER_TOAST,
            action: (
              <ToastAction altText="Get number" onClick={() => navigate(GET_NUMBER_URL)}>
                Get number
              </ToastAction>
            ),
          });
          return false;
        }
        // If SMS isn't configured, show the setup guide
        if (result.notConfigured) {
          setShowSmsSetupGuide(true);
          toast({
            title: "SMS error",
            description: "SMS could not be sent. Please try again later.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Couldn't send SMS",
            description: result.error || "Please try again.",
            variant: "destructive"
          });
        }
        return false;
      }

      toast({
        title: "SMS sent!",
        description: `Message sent to ${formatDisplayPhone(phone)}`,
      });
      return true;
    } catch (error: any) {
      console.error('SMS send error:', error);
      // apiRequest throws on non-2xx with format "status: message"
      let errorMessage = "Couldn't connect to the server. Check your internet and try again.";
      if (error.message) {
        // Parse "404: Not found" style errors from apiRequest
        const parts = error.message.split(': ');
        if (parts.length > 1 && !isNaN(parseInt(parts[0]))) {
          errorMessage = parts.slice(1).join(': ');
        } else {
          errorMessage = error.message;
        }
      }
      
      // Missing dedicated business number → friendly "get a number" prompt
      if (isDedicatedNumberError(error)) {
        toast({
          ...GET_NUMBER_TOAST,
          action: (
            <ToastAction altText="Get number" onClick={() => navigate(GET_NUMBER_URL)}>
              Get number
            </ToastAction>
          ),
        });
        return false;
      }
      
      // Detect "not configured" errors and show setup guide
      const isNotConfigured = errorMessage.toLowerCase().includes('not configured') || 
                              errorMessage.toLowerCase().includes('set up');
      if (isNotConfigured) {
        setShowSmsSetupGuide(true);
        toast({
          title: "SMS error",
          description: "SMS could not be sent. Please try again later.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Couldn't send SMS",
          description: errorMessage,
          variant: "destructive"
        });
      }
      return false;
    }
  };

  const handleSend = async () => {
    setIsSending(true);
    
    try {
      let emailSuccess = true;
      let smsSuccess = true;

      if (deliveryMethod === 'email' || deliveryMethod === 'both') {
        emailSuccess = await sendEmail();
      }

      if (deliveryMethod === 'sms' || deliveryMethod === 'both') {
        smsSuccess = await sendSms();
      }

      if ((deliveryMethod === 'email' && emailSuccess) || 
          (deliveryMethod === 'sms' && smsSuccess) ||
          (deliveryMethod === 'both' && (emailSuccess || smsSuccess))) {
        const cacheKey = type === 'quote' ? '/api/quotes' : type === 'invoice' ? '/api/invoices' : '/api/receipts';
        queryClient.invalidateQueries({ queryKey: [cacheKey, documentId] });
        queryClient.invalidateQueries({ queryKey: [cacheKey] });
        
        if (deliveryMethod === 'both') {
          if (emailSuccess && smsSuccess) {
            toast({
              title: `${getDocTypeLabel()} sent via Email & SMS!`,
              description: "Your client will receive both notifications.",
            });
          }
          if (emailSuccess && !smsSuccess) {
            toast({
              title: "Email sent, SMS failed",
              description: "The email was sent but the SMS couldn't be delivered.",
              variant: "destructive"
            });
          }
          if (!emailSuccess && smsSuccess) {
            toast({
              title: "SMS sent, email failed",
              description: "The SMS was sent but the email couldn't be delivered.",
              variant: "destructive"
            });
          }
        }
        
        onClose();
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyLink = async () => {
    if (publicUrl) {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      toast({
        title: "Link copied",
        description: "You can paste this link anywhere to share the " + type,
      });
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const adjustTone = (tone: 'formal' | 'friendly' | 'brief') => {
    const tones = {
      formal: type === 'quote'
        ? `Dear ${clientFirstName},\n\nPlease find attached the quotation for "${documentTitle}" as requested.\n\nThe quoted amount is ${formatCurrency(total)}. This quote remains valid for 30 days from the date of issue.\n\nShould you have any queries or require clarification, please do not hesitate to contact us.\n\nKind regards`
        : type === 'invoice'
        ? `Dear ${clientFirstName},\n\nPlease find attached your tax invoice for "${documentTitle}".\n\nThe total amount payable is ${formatCurrency(total)}. Payment is due within the terms specified on the invoice.\n\nShould you have any queries regarding this invoice, please do not hesitate to contact us.\n\nKind regards`
        : `Dear ${clientFirstName},\n\nPlease find attached your receipt for "${documentTitle}".\n\nPayment received: ${formatCurrency(total)}.\n\nThank you for your business.\n\nKind regards`,
      friendly: type === 'quote'
        ? `Hey ${clientFirstName}!\n\nGreat chatting with you - here's the quote we discussed for "${documentTitle}".\n\nIt comes to ${formatCurrency(total)} all up. Let me know if you've got any questions or want to tweak anything!\n\nCheers mate`
        : type === 'invoice'
        ? `Hey ${clientFirstName}!\n\nJust popping this invoice through for "${documentTitle}".\n\nThe total is ${formatCurrency(total)}. You can pay online using the link below - super easy!\n\nThanks heaps for your custom - really appreciate it!\n\nCheers mate`
        : `Hey ${clientFirstName}!\n\nJust confirming we received your payment for "${documentTitle}".\n\nAmount: ${formatCurrency(total)}\n\nThanks heaps!\n\nCheers mate`,
      brief: type === 'quote'
        ? `Hi ${clientFirstName},\n\nAttached: Quote for "${documentTitle}" - ${formatCurrency(total)}.\n\nAny questions, just ask.\n\nCheers`
        : type === 'invoice'
        ? `Hi ${clientFirstName},\n\nAttached: Invoice for "${documentTitle}" - ${formatCurrency(total)}.\n\nPayment link included.\n\nCheers`
        : `Hi ${clientFirstName},\n\nAttached: Receipt for "${documentTitle}" - ${formatCurrency(total)}.\n\nCheers`
    };
    setMessage(tones[tone]);
  };

  const smsCharCount = smsMessage.length;
  const smsSegments = getSmsSegmentCount(smsMessage);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send {getDocTypeLabel()}
          </DialogTitle>
          <DialogDescription>
            Send to {clientName} via email, SMS, or both
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{clientName}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {clientEmail && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {clientEmail}
                  </span>
                )}
                {(clientPhone || phoneInput) && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {formatDisplayPhone(phoneInput || clientPhone || '')}
                  </span>
                )}
              </div>
            </div>
            <Badge variant="secondary" className="flex-shrink-0">
              {getDocTypeLabel()} #{documentNumber}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Delivery Method</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={deliveryMethod === 'email' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDeliveryMethod('email')}
                disabled={!hasClientEmail}
                className="flex items-center gap-2"
                data-testid="button-delivery-email"
              >
                <Mail className="h-4 w-4" />
                Email
              </Button>
              <Button
                variant={deliveryMethod === 'sms' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setDeliveryMethod('sms');
                  if (!isSmsAvailable) {
                    setShowSmsSetupGuide(true);
                  } else {
                    setShowSmsSetupGuide(false);
                  }
                }}
                className="flex items-center gap-2"
                data-testid="button-delivery-sms"
              >
                <MessageSquare className="h-4 w-4" />
                SMS
              </Button>
              <Button
                variant={deliveryMethod === 'both' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  if (hasClientEmail) {
                    setDeliveryMethod('both');
                    if (!isSmsAvailable) {
                      setShowSmsSetupGuide(true);
                    } else {
                      setShowSmsSetupGuide(false);
                    }
                  }
                }}
                disabled={!hasClientEmail}
                className="flex items-center gap-2"
                data-testid="button-delivery-both"
              >
                <Send className="h-4 w-4" />
                Both
              </Button>
            </div>
            {showSmsSetupGuide && !isSmsAvailable && (
              <SmsSetupPrompt variant="inline" onSetupClick={onClose} />
            )}
          </div>
        </div>

        <Separator className="my-2" />

        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="compose" className="flex items-center gap-2">
                <Edit3 className="h-4 w-4" />
                Compose
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="compose" className="mt-4">
                <div className="space-y-4">
                  {(deliveryMethod === 'email' || deliveryMethod === 'both') && (
                    <div className="space-y-4 p-4 rounded-lg border bg-card">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Mail className="h-4 w-4 text-primary" />
                        Email Message
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {canUseAIFeatures && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={generateAISuggestion}
                          disabled={isGeneratingAI}
                          className="flex items-center gap-2"
                          data-testid="button-ai-suggestion"
                        >
                          {isGeneratingAI ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wand2 className="h-4 w-4" />
                          )}
                          AI Suggestion
                        </Button>
                        )}
                        {templates.length > 0 && (
                          <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                            <SelectTrigger className="w-[180px]" data-testid="select-email-template">
                              <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                              <SelectValue placeholder="Use template" />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.map((template: MessageTemplate) => (
                                <SelectItem 
                                  key={template.id} 
                                  value={template.id}
                                  data-testid={`template-${template.id}`}
                                >
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <span className="text-xs text-muted-foreground">Tone:</span>
                        <Button variant="ghost" size="sm" onClick={() => adjustTone('friendly')} className="text-xs">
                          Friendly
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => adjustTone('formal')} className="text-xs">
                          Formal
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => adjustTone('brief')} className="text-xs">
                          Brief
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email-subject">Subject</Label>
                        <Input
                          id="email-subject"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="Email subject line..."
                          data-testid="input-email-subject"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email-message">Message</Label>
                        <Textarea
                          id="email-message"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Write your message here..."
                          className="min-h-[150px] resize-none"
                          data-testid="input-email-message"
                        />
                        <p className="text-xs text-muted-foreground">
                          The {type} details, payment link, and your business info will be added automatically.
                        </p>
                      </div>
                    </div>
                  )}

                  {(deliveryMethod === 'sms' || deliveryMethod === 'both') && (
                    <div className="space-y-4 p-4 rounded-lg border bg-card">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <MessageSquare className="h-4 w-4 text-green-600" />
                          SMS Message
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={smsCharCount > 160 ? "secondary" : "outline"} className="text-xs">
                            {smsCharCount} chars
                          </Badge>
                          {smsSegments > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              {smsSegments} segments
                            </Badge>
                          )}
                        </div>
                      </div>

                      {!clientPhone && (
                        <div className="space-y-2">
                          <Label htmlFor="sms-phone">Phone Number</Label>
                          <Input
                            id="sms-phone"
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value)}
                            placeholder="0412 345 678"
                            data-testid="input-sms-phone"
                          />
                          <p className="text-xs text-muted-foreground">
                            Australian mobile number (will be formatted to +61)
                          </p>
                        </div>
                      )}

                      {smsTemplates.length > 0 && (
                        <div className="space-y-2">
                          <Label>SMS Template</Label>
                          <Select value={selectedSmsTemplate} onValueChange={handleSmsTemplateSelect}>
                            <SelectTrigger data-testid="select-sms-template">
                              <SelectValue placeholder="Choose an SMS template..." />
                            </SelectTrigger>
                            <SelectContent>
                              {smsTemplates.map((t: MessageTemplate) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="sms-message">Message</Label>
                        <Textarea
                          id="sms-message"
                          value={smsMessage}
                          onChange={(e) => setSmsMessage(e.target.value)}
                          placeholder="SMS message..."
                          className="min-h-[100px] resize-none"
                          data-testid="input-sms-message"
                        />
                        <p className="text-xs text-muted-foreground">
                          {smsCharCount <= 160 
                            ? "Standard SMS (160 chars). Keep it short!" 
                            : `Multi-part SMS (${smsSegments} messages). May cost more.`}
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSmsMessage(generateSmsMessage()); setSelectedSmsTemplate(""); }}
                        className="text-xs"
                        data-testid="button-reset-sms"
                      >
                        Reset to default
                      </Button>
                    </div>
                  )}
                </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
                <div className="space-y-4">
                  {(deliveryMethod === 'email' || deliveryMethod === 'both') && (
                    <Card className="border-2">
                      <CardContent className="p-0">
                        <div className="bg-gradient-to-r from-primary to-primary/80 p-4 text-white rounded-t-lg">
                          <div className="flex items-center gap-3">
                            <Building className="h-6 w-6" />
                            <div>
                              <h3 className="font-bold">{businessName || 'Your Business'}</h3>
                              <p className="text-sm opacity-90">{getDocTypeLabel()} #{documentNumber}</p>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium">To:</span>
                            <span>{clientName} &lt;{clientEmail}&gt;</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground border-b pb-3">
                            <span className="font-medium">Subject:</span>
                            <span className="font-medium text-foreground">{subject || '(No subject)'}</span>
                          </div>

                          <div className="whitespace-pre-wrap text-sm leading-relaxed">
                            {message || '(No message)'}
                          </div>

                          <div className="mt-4 pt-3 border-t border-dashed">
                            <p className="text-xs text-muted-foreground italic mb-2">
                              Auto-included: {type} details + payment link
                            </p>
                            <div className="bg-muted/50 p-3 rounded-lg text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total:</span>
                                <span className="font-bold text-primary">{formatCurrency(total)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {(deliveryMethod === 'sms' || deliveryMethod === 'both') && (
                    <Card className="border-2 border-green-200 dark:border-green-900">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <MessageSquare className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">SMS Preview</span>
                          <Badge variant="outline" className="text-xs ml-auto">
                            To: {formatDisplayPhone(phoneInput || clientPhone || '')}
                          </Badge>
                        </div>
                        
                        <div className="bg-green-50 dark:bg-green-950/50 p-4 rounded-lg">
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm max-w-[280px]">
                            <p className="text-sm whitespace-pre-wrap">{smsMessage}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 text-right">
                            {smsCharCount} characters • {smsSegments} SMS
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-3 pt-4 border-t">
          <Button 
            onClick={handleSend}
            disabled={
              isSending || 
              (deliveryMethod === 'email' && (!subject.trim() || !message.trim())) ||
              (deliveryMethod === 'sms' && (!smsMessage.trim() || (!clientPhone && !phoneInput))) ||
              (deliveryMethod === 'both' && (!subject.trim() || !message.trim() || !smsMessage.trim() || (!clientPhone && !phoneInput)))
            }
            className="w-full h-11"
            data-testid="button-send-document"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send via {deliveryMethod === 'both' ? 'Email & SMS' : deliveryMethod === 'email' ? 'Email' : 'SMS'}
              </>
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            {deliveryMethod === 'email' && "PDF is attached automatically."}
            {deliveryMethod === 'sms' && "SMS includes a link to view online."}
            {deliveryMethod === 'both' && "Email includes PDF. SMS includes view link."}
          </p>

          {publicUrl && (
            <div className="flex items-center justify-center gap-2 pt-2 border-t">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleCopyLink}
                className="text-xs"
                data-testid="button-copy-link"
              >
                {copiedLink ? (
                  <>
                    <CheckCheck className="h-3 w-3 mr-1 text-green-500" />
                    Link Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy link to share
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
