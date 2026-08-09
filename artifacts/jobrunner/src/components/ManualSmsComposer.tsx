import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ExternalLink, Phone, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ManualSmsComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientName?: string;
  recipientPhone: string;
  defaultMessage?: string;
  quickTemplates?: { id: string; label: string; message: string }[];
}

const DEFAULT_TEMPLATES = [
  { id: 'omw', label: "On my way", message: "G'day! Just letting you know I'm on my way now. Should be there in about 20 minutes." },
  { id: 'running-late', label: "Running late", message: "Apologies, I'm running a bit behind schedule. Will be there as soon as I can." },
  { id: 'job-done', label: "Job complete", message: "All done! The job's been completed. Let me know if you have any questions." },
  { id: 'confirm', label: "Confirm appointment", message: "Just confirming our appointment. Please reply to let me know you're still available." },
];

export function ManualSmsComposer({
  open,
  onOpenChange,
  recipientName,
  recipientPhone,
  defaultMessage = "",
  quickTemplates = DEFAULT_TEMPLATES,
}: ManualSmsComposerProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState(defaultMessage);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setMessage(defaultMessage);
      setCopied(false);
    }
  }, [open, defaultMessage]);

  const formatPhoneForSms = (phone: string) => {
    let formatted = phone.replace(/\s+/g, '').replace(/^0/, '+61');
    if (!formatted.startsWith('+')) {
      formatted = '+61' + formatted.replace(/^61/, '');
    }
    return formatted;
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Message copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please select and copy the message manually",
        variant: "destructive",
      });
    }
  };

  const handleOpenSmsApp = () => {
    const formattedPhone = formatPhoneForSms(recipientPhone);
    const encodedMessage = encodeURIComponent(message);
    const smsUrl = `sms:${formattedPhone}?body=${encodedMessage}`;
    window.open(smsUrl, '_blank');
    
    toast({
      title: "Opening SMS app",
      description: "Your phone's messaging app should open now",
    });
  };

  const handleOpenPhone = () => {
    const formattedPhone = formatPhoneForSms(recipientPhone);
    window.open(`tel:${formattedPhone}`, '_blank');
  };

  const applyTemplate = (templateMessage: string) => {
    setMessage(templateMessage);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Send SMS Manually
          </DialogTitle>
          <DialogDescription>
            Compose your message here, then send it using your phone's messaging app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">To</Label>
            <div className="flex items-center gap-2 mt-1.5">
              <Input 
                value={recipientName ? `${recipientName} (${recipientPhone})` : recipientPhone}
                readOnly
                className="bg-muted"
              />
              <Button 
                size="icon" 
                variant="outline" 
                onClick={handleOpenPhone}
                title="Call this number"
              >
                <Phone className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Quick Templates</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {quickTemplates.map((template) => (
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
            <Label className="text-sm font-medium">Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="mt-1.5 min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {message.length} characters
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCopyMessage}
            disabled={!message.trim()}
            className="gap-2"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Message"}
          </Button>
          <Button
            onClick={handleOpenSmsApp}
            disabled={!message.trim()}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <ExternalLink className="h-4 w-4" />
            Open SMS App
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
