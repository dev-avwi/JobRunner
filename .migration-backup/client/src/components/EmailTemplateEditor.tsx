import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Eye,
  Sparkles,
  Smile,
  Briefcase,
  MessageSquare,
  Check,
  Copy,
  RotateCcw,
  Send,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type EmailTone = 'friendly' | 'professional' | 'brief';

interface MergeField {
  key: string;
  label: string;
  value: string;
}

interface EmailTemplateEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: EmailTemplate) => void;
  actionType: 'invoice' | 'quote' | 'reminder' | 'confirmation' | 'receipt';
  initialSubject?: string;
  initialBody?: string;
  recipientEmail?: string;
  recipientName?: string;
  mergeFields?: MergeField[];
  businessName?: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
  tone: EmailTone;
}

const TONE_PRESETS: Record<EmailTone, { label: string; icon: typeof Smile; description: string }> = {
  friendly: {
    label: "Friendly",
    icon: Smile,
    description: "Casual, warm Australian tone",
  },
  professional: {
    label: "Professional",
    icon: Briefcase,
    description: "Formal business language",
  },
  brief: {
    label: "Brief",
    icon: MessageSquare,
    description: "Short and to the point",
  },
};

const getToneTemplate = (
  tone: EmailTone,
  actionType: string,
  recipientFirstName: string,
  mergeFields: MergeField[]
): { subject: string; body: string } => {
  const getFieldValue = (key: string) => mergeFields.find(f => f.key === key)?.value || `{{${key}}}`;
  
  const templates: Record<EmailTone, Record<string, { subject: string; body: string }>> = {
    friendly: {
      invoice: {
        subject: `Invoice #${getFieldValue('invoiceNumber')} from ${getFieldValue('businessName')}`,
        body: `G'day ${recipientFirstName}!\n\nHope you're doing well! Here's your invoice for the work we did on "${getFieldValue('jobTitle')}".\n\nTotal: ${getFieldValue('total')}\n\nYou can pay online using the link below - quick and easy!\n\nCheers,\n${getFieldValue('businessName')}`
      },
      quote: {
        subject: `Quote #${getFieldValue('quoteNumber')} from ${getFieldValue('businessName')}`,
        body: `G'day ${recipientFirstName}!\n\nThanks for getting in touch! Here's your quote for "${getFieldValue('jobTitle')}".\n\nTotal: ${getFieldValue('total')}\n\nHave a look and let me know if you've got any questions. Happy to chat through the details!\n\nCheers,\n${getFieldValue('businessName')}`
      },
      reminder: {
        subject: `Friendly reminder: Invoice #${getFieldValue('invoiceNumber')}`,
        body: `G'day ${recipientFirstName}!\n\nJust a quick heads up - your invoice for "${getFieldValue('jobTitle')}" is due soon.\n\nTotal: ${getFieldValue('total')}\n\nNo stress, just wanted to make sure it didn't slip through the cracks! You can pay online anytime.\n\nCheers,\n${getFieldValue('businessName')}`
      },
      confirmation: {
        subject: `Booking confirmed: ${getFieldValue('jobTitle')}`,
        body: `G'day ${recipientFirstName}!\n\nJust confirming we're all locked in for "${getFieldValue('jobTitle')}" on ${getFieldValue('scheduledDate')}.\n\nWe'll give you a buzz when we're on our way. See you then!\n\nCheers,\n${getFieldValue('businessName')}`
      },
      receipt: {
        subject: `Payment received - thanks ${recipientFirstName}!`,
        body: `G'day ${recipientFirstName}!\n\nThanks heaps for your payment of ${getFieldValue('total')} for "${getFieldValue('jobTitle')}"!\n\nYour receipt is attached. Really appreciate your business - hope to work with you again!\n\nCheers,\n${getFieldValue('businessName')}`
      }
    },
    professional: {
      invoice: {
        subject: `Invoice #${getFieldValue('invoiceNumber')} - ${getFieldValue('businessName')}`,
        body: `Dear ${recipientFirstName},\n\nPlease find attached your invoice for "${getFieldValue('jobTitle')}".\n\nAmount Due: ${getFieldValue('total')}\nDue Date: ${getFieldValue('dueDate')}\n\nPayment can be made via the secure link provided.\n\nIf you have any questions, please don't hesitate to contact us.\n\nKind regards,\n${getFieldValue('businessName')}`
      },
      quote: {
        subject: `Quotation #${getFieldValue('quoteNumber')} - ${getFieldValue('businessName')}`,
        body: `Dear ${recipientFirstName},\n\nThank you for your enquiry. Please find attached our quotation for "${getFieldValue('jobTitle')}".\n\nQuoted Amount: ${getFieldValue('total')}\nValid Until: ${getFieldValue('validUntil')}\n\nShould you have any questions or require clarification, please contact us at your convenience.\n\nKind regards,\n${getFieldValue('businessName')}`
      },
      reminder: {
        subject: `Payment Reminder: Invoice #${getFieldValue('invoiceNumber')}`,
        body: `Dear ${recipientFirstName},\n\nThis is a courtesy reminder that invoice #${getFieldValue('invoiceNumber')} for "${getFieldValue('jobTitle')}" remains outstanding.\n\nAmount Due: ${getFieldValue('total')}\n\nPlease arrange payment at your earliest convenience. If you have already made this payment, please disregard this notice.\n\nKind regards,\n${getFieldValue('businessName')}`
      },
      confirmation: {
        subject: `Appointment Confirmation: ${getFieldValue('jobTitle')}`,
        body: `Dear ${recipientFirstName},\n\nThis email confirms your appointment for "${getFieldValue('jobTitle')}" scheduled for ${getFieldValue('scheduledDate')}.\n\nWe will notify you upon arrival. If you need to reschedule, please contact us as soon as possible.\n\nKind regards,\n${getFieldValue('businessName')}`
      },
      receipt: {
        subject: `Payment Receipt - ${getFieldValue('businessName')}`,
        body: `Dear ${recipientFirstName},\n\nThank you for your payment of ${getFieldValue('total')} for "${getFieldValue('jobTitle')}".\n\nYour receipt is attached for your records.\n\nWe appreciate your business and look forward to serving you again.\n\nKind regards,\n${getFieldValue('businessName')}`
      }
    },
    brief: {
      invoice: {
        subject: `Invoice ${getFieldValue('invoiceNumber')} - ${getFieldValue('total')}`,
        body: `Hi ${recipientFirstName},\n\nInvoice attached for ${getFieldValue('jobTitle')}.\nTotal: ${getFieldValue('total')}\n\nPay online via the link.\n\n${getFieldValue('businessName')}`
      },
      quote: {
        subject: `Quote ${getFieldValue('quoteNumber')} - ${getFieldValue('total')}`,
        body: `Hi ${recipientFirstName},\n\nQuote attached for ${getFieldValue('jobTitle')}.\nTotal: ${getFieldValue('total')}\n\nLet me know if you have questions.\n\n${getFieldValue('businessName')}`
      },
      reminder: {
        subject: `Reminder: Invoice ${getFieldValue('invoiceNumber')} due`,
        body: `Hi ${recipientFirstName},\n\nQuick reminder - invoice ${getFieldValue('invoiceNumber')} for ${getFieldValue('total')} is due.\n\nPay anytime via the link.\n\n${getFieldValue('businessName')}`
      },
      confirmation: {
        subject: `Confirmed: ${getFieldValue('scheduledDate')}`,
        body: `Hi ${recipientFirstName},\n\nConfirmed for ${getFieldValue('jobTitle')} on ${getFieldValue('scheduledDate')}.\n\nSee you then.\n\n${getFieldValue('businessName')}`
      },
      receipt: {
        subject: `Payment received - ${getFieldValue('total')}`,
        body: `Hi ${recipientFirstName},\n\nPayment received for ${getFieldValue('jobTitle')}. Receipt attached.\n\nThanks!\n\n${getFieldValue('businessName')}`
      }
    }
  };

  return templates[tone][actionType] || templates[tone].invoice;
};

export default function EmailTemplateEditor({
  isOpen,
  onClose,
  onSave,
  actionType,
  initialSubject = "",
  initialBody = "",
  recipientEmail = "",
  recipientName = "there",
  mergeFields = [],
  businessName = "Your Business",
}: EmailTemplateEditorProps) {
  const { toast } = useToast();
  const [tone, setTone] = useState<EmailTone>('friendly');
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [hasManualEdits, setHasManualEdits] = useState(false);

  const recipientFirstName = recipientName.split(' ')[0];

  const defaultMergeFields: MergeField[] = [
    { key: 'businessName', label: 'Business Name', value: businessName },
    { key: 'clientName', label: 'Client Name', value: recipientName },
    { key: 'clientFirstName', label: 'First Name', value: recipientFirstName },
    { key: 'total', label: 'Total Amount', value: '$0.00' },
    { key: 'jobTitle', label: 'Job Title', value: 'Job' },
    { key: 'invoiceNumber', label: 'Invoice #', value: '001' },
    { key: 'quoteNumber', label: 'Quote #', value: '001' },
    { key: 'dueDate', label: 'Due Date', value: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-AU') },
    { key: 'validUntil', label: 'Valid Until', value: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-AU') },
    { key: 'scheduledDate', label: 'Scheduled Date', value: new Date().toLocaleDateString('en-AU') },
    ...mergeFields,
  ];

  useEffect(() => {
    if (isOpen && !hasManualEdits) {
      const template = getToneTemplate(tone, actionType, recipientFirstName, defaultMergeFields);
      setSubject(initialSubject || template.subject);
      setBody(initialBody || template.body);
    }
  }, [isOpen, tone, actionType, hasManualEdits]);

  const handleToneChange = (newTone: EmailTone) => {
    setTone(newTone);
    if (!hasManualEdits) {
      const template = getToneTemplate(newTone, actionType, recipientFirstName, defaultMergeFields);
      setSubject(template.subject);
      setBody(template.body);
    }
  };

  const handleReset = () => {
    const template = getToneTemplate(tone, actionType, recipientFirstName, defaultMergeFields);
    setSubject(template.subject);
    setBody(template.body);
    setHasManualEdits(false);
    toast({
      title: "Template Reset",
      description: `Restored ${TONE_PRESETS[tone].label.toLowerCase()} template`,
    });
  };

  const handleSubjectChange = (value: string) => {
    setSubject(value);
    setHasManualEdits(true);
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    setHasManualEdits(true);
  };

  const insertMergeField = (field: MergeField) => {
    const placeholder = `{{${field.key}}}`;
    setBody(prev => prev + placeholder);
    setHasManualEdits(true);
    toast({
      title: "Field Added",
      description: `${field.label} will be replaced with actual value when sent`,
    });
  };

  const getPreviewContent = (text: string) => {
    let preview = text;
    defaultMergeFields.forEach(field => {
      preview = preview.replace(new RegExp(`\\{\\{${field.key}\\}\\}`, 'g'), field.value);
    });
    return preview;
  };

  const handleSave = () => {
    onSave({
      subject,
      body,
      tone,
    });
    toast({
      title: "Template Saved",
      description: "Your email template has been updated",
    });
    onClose();
  };

  const copyToClipboard = () => {
    const previewBody = getPreviewContent(body);
    navigator.clipboard.writeText(previewBody);
    toast({
      title: "Copied!",
      description: "Email content copied to clipboard",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Edit Email Template
          </DialogTitle>
          <DialogDescription>
            Customize what gets sent to {recipientName} ({recipientEmail || 'no email'})
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="mb-4">
            <Label className="text-sm font-medium mb-2 block">Tone</Label>
            <div className="flex gap-2">
              {(Object.keys(TONE_PRESETS) as EmailTone[]).map((t) => {
                const preset = TONE_PRESETS[t];
                const Icon = preset.icon;
                return (
                  <Button
                    key={t}
                    variant={tone === t ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleToneChange(t)}
                    className="flex-1"
                    data-testid={`tone-${t}`}
                  >
                    <Icon className="h-4 w-4 mr-1.5" />
                    {preset.label}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {TONE_PRESETS[tone].description}
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')}>
            <TabsList className="w-full">
              <TabsTrigger value="edit" className="flex-1">
                <Sparkles className="h-4 w-4 mr-1.5" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex-1">
                <Eye className="h-4 w-4 mr-1.5" />
                Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  placeholder="Enter email subject..."
                  data-testid="input-email-subject"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="body">Message</Label>
                  <div className="flex gap-1">
                    {hasManualEdits && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleReset}
                        className="h-6 text-xs"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  placeholder="Enter your message..."
                  rows={8}
                  className="resize-none"
                  data-testid="input-email-body"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Insert merge fields (auto-filled when sent)</Label>
                <div className="flex flex-wrap gap-1">
                  {defaultMergeFields.slice(0, 6).map((field) => (
                    <Badge
                      key={field.key}
                      variant="secondary"
                      className="cursor-pointer hover-elevate text-xs"
                      onClick={() => insertMergeField(field)}
                    >
                      {field.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">To</p>
                      <p className="text-sm font-medium">{recipientName} &lt;{recipientEmail}&gt;</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={copyToClipboard}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Subject</p>
                    <p className="font-medium">{getPreviewContent(subject)}</p>
                  </div>
                  
                  <Separator />
                  
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Message</p>
                      <div className="text-sm whitespace-pre-wrap bg-muted/30 rounded-lg p-3">
                        {getPreviewContent(body)}
                      </div>
                    </div>
                  </ScrollArea>

                  <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                    This is how the email will look when sent
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-1.5" />
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-template">
            <Check className="h-4 w-4 mr-1.5" />
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
