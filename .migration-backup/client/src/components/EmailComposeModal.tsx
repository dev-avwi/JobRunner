import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, getAuthHeaders} from "@/lib/queryClient";
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
  ExternalLink
} from "lucide-react";

interface EmailComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'quote' | 'invoice';
  documentId: string;
  clientName: string;
  clientEmail: string;
  documentNumber: string;
  documentTitle: string;
  total: string;
  businessName?: string;
  publicUrl?: string;
  onSend?: (customSubject: string, customMessage: string) => Promise<void> | void;
}

interface AIEmailSuggestion {
  subject: string;
  greeting: string;
  body: string;
  closing: string;
  fullMessage: string;
}

export default function EmailComposeModal({
  isOpen,
  onClose,
  type,
  documentId,
  clientName,
  clientEmail,
  documentNumber,
  documentTitle,
  total,
  businessName,
  publicUrl
}: EmailComposeModalProps) {
  const { toast } = useToast();
  const { canUseAIFeatures } = useFeatureAccess();
  const [activeTab, setActiveTab] = useState<string>("compose");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // Fetch email templates
  const { data: templates = [] } = useQuery<MessageTemplate[]>({
    queryKey: ['/api/message-templates', 'email'],
    queryFn: async () => {
      const res = await fetch('/api/message-templates?channel=email', { credentials: 'include', headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
    enabled: isOpen,
  });

  // Get the first name from client name
  const clientFirstName = clientName?.split(' ')[0] || 'there';

  // Set default subject and message based on type
  useEffect(() => {
    if (isOpen) {
      const docType = type === 'quote' ? 'Quote' : 'Invoice';
      const defaultSubject = `${docType} #${documentNumber} from ${businessName || 'our business'} - ${documentTitle}`;
      const defaultMessage = type === 'quote' 
        ? `G'day ${clientFirstName},\n\nThanks for getting in touch! Please find attached your quote for "${documentTitle}".\n\nThe total comes to ${formatCurrency(total)}. If you have any questions or would like to discuss anything, just give us a bell.\n\nLooking forward to working with you!\n\nCheers`
        : `G'day ${clientFirstName},\n\nPlease find attached your invoice for "${documentTitle}".\n\nThe total amount due is ${formatCurrency(total)}. You can pay online using the secure link in the email.\n\nIf you have any questions, don't hesitate to give us a ring.\n\nThanks heaps for your custom!\n\nCheers`;
      
      setSubject(defaultSubject);
      setMessage(defaultMessage);
    }
  }, [isOpen, type, documentNumber, documentTitle, total, businessName, clientFirstName]);

  const formatCurrency = (amount: string | number) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(value || 0);
  };

  // Apply merge fields to template text
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
      .replace(/\{document_number\}/g, documentNumber || '');
  };

  // Handle template selection
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

  // AI email suggestion mutation
  const generateAISuggestion = async () => {
    setIsGeneratingAI(true);
    try {
      const response = await fetch('/api/ai/email-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type,
          clientName,
          clientFirstName,
          documentNumber,
          documentTitle,
          total,
          businessName
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate suggestion');
      }

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

  // Send email via backend (respects user's email preference in Settings)
  const handleSendEmail = async () => {
    setIsSending(true);
    try {
      const endpoint = type === 'quote' 
        ? `/api/quotes/${documentId}/email-with-pdf`
        : `/api/invoices/${documentId}/email-with-pdf`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customSubject: subject,
          customMessage: message
        })
      });

      // Parse response safely
      let result;
      try {
        result = await response.json();
      } catch {
        result = { message: 'Server error - please try again' };
      }

      if (!response.ok) {
        // Use tradie-friendly error fields from backend
        toast({
          title: result.title || "Couldn't create email",
          description: result.fix || result.message || "Please try the manual Gmail option instead.",
          variant: "destructive"
        });
        return;
      }

      // Handle automatic mode (SendGrid) - email already sent
      if (result.sent) {
        toast({
          title: `${type === 'quote' ? 'Quote' : 'Invoice'} sent!`,
          description: `Email sent to ${result.recipientEmail} with PDF attached.`,
        });
        
        // Invalidate both detail and list caches to refresh status everywhere
        const cacheKey = type === 'quote' ? '/api/quotes' : '/api/invoices';
        queryClient.invalidateQueries({ queryKey: [cacheKey, documentId] });
        queryClient.invalidateQueries({ queryKey: [cacheKey] });
        
        onClose();
        return;
      }

      // Handle manual mode (Gmail draft) - open the draft URL
      if (result.draftUrl) {
        window.open(result.draftUrl, '_blank');
        toast({
          title: "Gmail draft created!",
          description: `PDF attached automatically. Review and click Send in Gmail.`,
        });
        
        // Invalidate both detail and list caches to refresh status everywhere
        const cacheKey = type === 'quote' ? '/api/quotes' : '/api/invoices';
        queryClient.invalidateQueries({ queryKey: [cacheKey, documentId] });
        queryClient.invalidateQueries({ queryKey: [cacheKey] });
        
        onClose();
      } else {
        toast({
          title: "Something went wrong",
          description: "No draft URL was returned. Please try the manual Gmail option.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Gmail draft error:', error);
      toast({
        title: "Connection error",
        description: "Couldn't connect to the server. Check your internet and try again.",
        variant: "destructive"
      });
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

  // Open in user's mail app with composed message
  const handleOpenMailApp = () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter both subject and message.",
        variant: "destructive"
      });
      return;
    }

    // Build the email body with public URL if available
    let fullBody = message;
    if (publicUrl) {
      fullBody += `\n\n---\nView ${type === 'quote' ? 'Quote' : 'Invoice'}: ${publicUrl}`;
    }

    const mailtoUrl = `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;
    
    window.open(mailtoUrl, '_blank');
    
    toast({
      title: "Email opened in your mail app",
      description: "Your composed message is ready. The link to view the document online is included in the email body.",
    });
    
    // Invalidate caches in case user wants to track this
    const cacheKey = type === 'quote' ? '/api/quotes' : '/api/invoices';
    queryClient.invalidateQueries({ queryKey: [cacheKey, documentId] });
    queryClient.invalidateQueries({ queryKey: [cacheKey] });
  };

  // Quick tone adjustments with Australian English
  const adjustTone = (tone: 'formal' | 'friendly' | 'brief') => {
    const tones = {
      formal: type === 'quote'
        ? `Dear ${clientFirstName},\n\nPlease find attached the quotation for "${documentTitle}" as requested.\n\nThe quoted amount is ${formatCurrency(total)}. This quote remains valid for 30 days from the date of issue.\n\nShould you have any queries or require clarification, please do not hesitate to contact us.\n\nKind regards`
        : `Dear ${clientFirstName},\n\nPlease find attached your tax invoice for "${documentTitle}".\n\nThe total amount payable is ${formatCurrency(total)}. Payment is due within the terms specified on the invoice.\n\nShould you have any queries regarding this invoice, please do not hesitate to contact us.\n\nKind regards`,
      friendly: type === 'quote'
        ? `Hey ${clientFirstName}!\n\nGreat chatting with you - here's the quote we discussed for "${documentTitle}".\n\nIt comes to ${formatCurrency(total)} all up. Let me know if you've got any questions or want to tweak anything!\n\nCheers mate`
        : `Hey ${clientFirstName}!\n\nJust popping this invoice through for "${documentTitle}".\n\nThe total is ${formatCurrency(total)}. You can pay online using the link below - super easy!\n\nThanks heaps for your custom - really appreciate it!\n\nCheers mate`,
      brief: type === 'quote'
        ? `Hi ${clientFirstName},\n\nAttached: Quote for "${documentTitle}" - ${formatCurrency(total)}.\n\nAny questions, just ask.\n\nCheers`
        : `Hi ${clientFirstName},\n\nAttached: Invoice for "${documentTitle}" - ${formatCurrency(total)}.\n\nPayment link included.\n\nCheers`
    };
    setMessage(tones[tone]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send {type === 'quote' ? 'Quote' : 'Invoice'} Email
          </DialogTitle>
          <DialogDescription>
            Customise your email before sending to {clientName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
              <TabsTrigger value="compose" className="flex items-center gap-2">
                <Edit3 className="h-4 w-4" />
                Compose
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="compose" className="flex-1 mt-4 min-h-0">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {/* Recipient Info */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{clientName}</p>
                      <p className="text-xs text-muted-foreground truncate">{clientEmail}</p>
                    </div>
                    <Badge variant="secondary" className="flex-shrink-0">
                      {type === 'quote' ? 'Quote' : 'Invoice'} #{documentNumber}
                    </Badge>
                  </div>

                  {/* AI Suggestion Button and Template Selector */}
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
                    {/* Template Selector */}
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
                    <span className="text-xs text-muted-foreground">or choose a tone:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => adjustTone('friendly')}
                      className="text-xs"
                    >
                      Friendly
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => adjustTone('formal')}
                      className="text-xs"
                    >
                      Formal
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => adjustTone('brief')}
                      className="text-xs"
                    >
                      Brief
                    </Button>
                  </div>

                  {/* Subject Field */}
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

                  {/* Message Field */}
                  <div className="space-y-2">
                    <Label htmlFor="email-message">Your Message</Label>
                    <Textarea
                      id="email-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Write your message here..."
                      className="min-h-[200px] resize-none"
                      data-testid="input-email-message"
                    />
                    <p className="text-xs text-muted-foreground">
                      The {type} details, payment link, and your business info will be added automatically.
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="preview" className="flex-1 overflow-auto mt-4">
              <ScrollArea className="h-[400px]">
                <Card className="border-2">
                  <CardContent className="p-0">
                    {/* Email Header Preview */}
                    <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-white rounded-t-lg">
                      <div className="flex items-center gap-3 mb-4">
                        <Building className="h-8 w-8" />
                        <div>
                          <h3 className="font-bold text-lg">{businessName || 'Your Business'}</h3>
                          <p className="text-sm opacity-90">{type === 'quote' ? 'Quote' : 'Tax Invoice'} #{documentNumber}</p>
                        </div>
                      </div>
                    </div>

                    {/* Email Body Preview */}
                    <div className="p-6 space-y-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-medium">To:</span>
                        <span>{clientName} &lt;{clientEmail}&gt;</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground border-b pb-4">
                        <span className="font-medium">Subject:</span>
                        <span className="font-medium text-foreground">{subject || '(No subject)'}</span>
                      </div>

                      {/* Message Preview */}
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message || '(No message)'}
                      </div>

                      {/* Auto-included sections preview */}
                      <div className="mt-6 pt-4 border-t border-dashed space-y-3">
                        <p className="text-xs text-muted-foreground italic">
                          The following will be included automatically:
                        </p>
                        
                        <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Document:</span>
                            <span className="font-medium">{documentTitle}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total:</span>
                            <span className="font-bold text-primary">{formatCurrency(total)}</span>
                          </div>
                        </div>

                        {type === 'quote' && (
                          <div className="bg-primary/10 p-4 rounded-lg text-center">
                            <Button variant="default" size="sm" disabled className="pointer-events-none">
                              <Check className="h-4 w-4 mr-2" />
                              View & Accept Quote
                            </Button>
                            <p className="text-xs text-muted-foreground mt-2">
                              Client can accept with digital signature
                            </p>
                          </div>
                        )}

                        {type === 'invoice' && (
                          <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg text-center">
                            <Button variant="default" size="sm" disabled className="pointer-events-none bg-green-600">
                              Pay Now
                            </Button>
                            <p className="text-xs text-muted-foreground mt-2">
                              Secure online payment via Stripe
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer - Send Options */}
        <div className="space-y-3 pt-4 border-t flex-shrink-0">
          {/* Two Send Options */}
          <div className="grid grid-cols-2 gap-3">
            {/* Primary Action - Use JobRunner (backend send) */}
            <Button 
              onClick={handleSendEmail}
              disabled={!subject.trim() || !message.trim() || isSending}
              className="h-11"
              data-testid="button-send-email"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Use JobRunner
                </>
              )}
            </Button>

            {/* Secondary Action - Open in Mail App */}
            <Button 
              variant="outline"
              onClick={handleOpenMailApp}
              disabled={!subject.trim() || !message.trim() || isSending}
              className="h-11"
              data-testid="button-open-mail-app"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Email App
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground text-center">
            JobRunner sends automatically with PDF attached. Email App opens your mail with the message and online viewing link.
          </p>

          {/* Copy Link Option for sharing */}
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

          {/* Cancel */}
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
