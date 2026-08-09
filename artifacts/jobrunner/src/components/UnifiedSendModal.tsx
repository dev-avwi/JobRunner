import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Mail, 
  MessageSquare, 
  Send, 
  Loader2, 
  Copy, 
  Check, 
  ExternalLink,
  AlertTriangle 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useLocation } from "wouter";
import { isDedicatedNumberError, GET_NUMBER_TOAST, GET_NUMBER_URL } from "@/lib/dedicatedNumber";
import { useIntegrationHealth, isTwilioReady, isSendGridReady, isEmailReady } from "@/hooks/use-integration-health";

interface UnifiedSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: 'quote' | 'invoice' | 'job' | 'receipt';
  documentId: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  documentTitle?: string;
  previewUrl?: string;
  defaultTab?: 'email' | 'sms';
}

const SMS_TEMPLATES = {
  quote: [
    { id: 'sent', label: "Quote ready", message: "Hi! I've sent through your quote. Have a look and let me know if you've got any questions or want to go ahead." },
    { id: 'followup', label: "Follow up", message: "Hi! Just following up on the quote I sent. Let me know if you have any questions or need any changes." },
  ],
  invoice: [
    { id: 'sent', label: "Invoice sent", message: "Hi! I've sent through your invoice. You can pay online using the link in the email. Thanks for your business!" },
    { id: 'reminder', label: "Payment reminder", message: "Hi! Just a friendly reminder that your invoice is due. Let me know if you have any questions." },
  ],
  job: [
    { id: 'omw', label: "On my way", message: "G'day! Just letting you know I'm on my way now. Should be there in about 20 minutes." },
    { id: 'arrived', label: "Just arrived", message: "Hi! I've just arrived. I'm ready to get started on the job." },
    { id: 'done', label: "Job complete", message: "All done! The job's been completed. Let me know if you have any questions." },
    { id: 'confirm', label: "Confirm appointment", message: "Just confirming our appointment. Please reply to let me know you're still available." },
  ],
  receipt: [
    { id: 'thanks', label: "Payment thanks", message: "Thanks for your payment! Your receipt has been sent to your email." },
  ],
};

export function UnifiedSendModal({
  open,
  onOpenChange,
  documentType,
  documentId,
  recipientName,
  recipientEmail,
  recipientPhone,
  documentTitle,
  previewUrl,
  defaultTab,
}: UnifiedSendModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<'email' | 'sms'>(defaultTab || 'email');
  const [smsMessage, setSmsMessage] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [copied, setCopied] = useState(false);

  const { data: integrationHealth } = useIntegrationHealth();
  const twilioConnected = isTwilioReady(integrationHealth);
  const sendGridConnected = isSendGridReady(integrationHealth) || isEmailReady(integrationHealth);

  useEffect(() => {
    if (open) {
      const typeLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1);
      setEmailSubject(`Your ${typeLabel} from JobRunner`);
      setEmailBody(`Hi ${recipientName},\n\nPlease find your ${documentType} attached.\n\nIf you have any questions, please don't hesitate to reach out.\n\nCheers!`);
      setSmsMessage(SMS_TEMPLATES[documentType]?.[0]?.message || '');
    }
  }, [open, documentType, recipientName]);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, open]);

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/${documentType}s/${documentId}/send`, {
        method: 'email',
        subject: emailSubject,
        body: emailBody,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email sent!",
        description: `${documentType.charAt(0).toUpperCase() + documentType.slice(1)} sent to ${recipientEmail}`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/${documentType}s`, documentId] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send email",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const sendSmsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/sms/send', {
        clientPhone: recipientPhone,
        message: smsMessage,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "SMS sent!",
        description: `Message sent to ${recipientPhone}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sms/conversations'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      if (isDedicatedNumberError(error)) {
        toast({
          ...GET_NUMBER_TOAST,
          action: (
            <ToastAction altText="Get number" onClick={() => { onOpenChange(false); navigate(GET_NUMBER_URL); }}>
              Get number
            </ToastAction>
          ),
        });
        return;
      }
      toast({
        title: "Failed to send SMS",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(smsMessage);
      setCopied(true);
      toast({ title: "Copied!", description: "Message copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleOpenSmsApp = () => {
    let formattedPhone = recipientPhone?.replace(/\s+/g, '').replace(/^0/, '+61') || '';
    if (formattedPhone && !formattedPhone.startsWith('+')) {
      formattedPhone = '+61' + formattedPhone.replace(/^61/, '');
    }
    const encodedMessage = encodeURIComponent(smsMessage);
    window.open(`sms:${formattedPhone}?body=${encodedMessage}`, '_blank');
    toast({ title: "Opening SMS app", description: "Your messaging app should open now" });
  };

  const handleOpenMailClient = () => {
    const mailto = `mailto:${recipientEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailto, '_blank');
    toast({ title: "Opening email client", description: "Your email app should open now" });
  };

  const applyTemplate = (templateMessage: string) => {
    setSmsMessage(templateMessage);
  };

  const hasEmail = !!recipientEmail;
  const hasPhone = !!recipientPhone;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Send {documentType.charAt(0).toUpperCase() + documentType.slice(1)}
          </DialogTitle>
          <DialogDescription>
            Choose how to send {documentTitle ? `"${documentTitle}"` : `this ${documentType}`} to {recipientName}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'email' | 'sms')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email" disabled={!hasEmail} className="gap-2">
              <Mail className="h-4 w-4" />
              Email
              {!hasEmail && <span className="text-xs">(no email)</span>}
            </TabsTrigger>
            <TabsTrigger value="sms" disabled={!hasPhone} className="gap-2">
              <MessageSquare className="h-4 w-4" />
              SMS
              {!hasPhone && <span className="text-xs">(no phone)</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4 mt-4">
            {!sendGridConnected && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Email not fully configured</p>
                  <p className="text-amber-700 dark:text-amber-300">
                    Opens your email app instead. <a href="/integrations" className="underline">Set up SendGrid</a> for in-app sending.
                  </p>
                </div>
              </div>
            )}

            <div>
              <Label>To</Label>
              <Input value={recipientEmail || ''} readOnly className="mt-1.5 bg-muted" />
            </div>

            <div>
              <Label>Subject</Label>
              <Input 
                value={emailSubject} 
                onChange={(e) => setEmailSubject(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Message</Label>
              <Textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="mt-1.5 min-h-[120px]"
              />
            </div>

            <div className="flex gap-2">
              {sendGridConnected ? (
                <Button
                  onClick={() => sendEmailMutation.mutate()}
                  disabled={sendEmailMutation.isPending || !emailSubject.trim() || !emailBody.trim()}
                  className="flex-1 gap-2"
                >
                  {sendEmailMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send Email
                </Button>
              ) : (
                <Button
                  onClick={handleOpenMailClient}
                  className="flex-1 gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Email App
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sms" className="space-y-4 mt-4">

            <div>
              <Label>To</Label>
              <Input value={recipientPhone || ''} readOnly className="mt-1.5 bg-muted" />
            </div>

            <div>
              <Label>Quick Templates</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(SMS_TEMPLATES[documentType] || []).map((template) => (
                  <Badge
                    key={template.id}
                    variant="outline"
                    className="cursor-pointer hover-elevate"
                    onClick={() => applyTemplate(template.message)}
                  >
                    {template.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label>Message</Label>
              <Textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                placeholder="Type your message..."
                className="mt-1.5 min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {smsMessage.length} characters
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => sendSmsMutation.mutate()}
                disabled={sendSmsMutation.isPending || !smsMessage.trim()}
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
              >
                {sendSmsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send SMS
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
