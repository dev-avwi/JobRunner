import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, ExternalLink, Mail, User, FileText, DollarSign, Link2, Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SendConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "quote" | "invoice";
  documentId: string;
  documentNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  publicUrl: string;
  pdfUrl?: string;
  businessName?: string;
  onConfirmSend: () => Promise<void>;
  isPending?: boolean;
}

export function SendConfirmationDialog({
  open,
  onOpenChange,
  type,
  documentId,
  documentNumber,
  clientName,
  clientEmail,
  amount,
  publicUrl,
  pdfUrl,
  businessName,
  onConfirmSend,
  isPending = false,
}: SendConfirmationDialogProps) {
  const { toast } = useToast();
  const [linkCopied, setLinkCopied] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  };

  const firstName = clientName.split(" ")[0];
  const typeLabel = type === "quote" ? "Quote" : "Invoice";
  const actionLabel = type === "quote" ? "view and accept" : "view and pay";
  
  const hasPublicUrl = Boolean(publicUrl && publicUrl.length > 0);
  const shortLink = hasPublicUrl 
    ? (publicUrl.length > 60 ? publicUrl.substring(0, 45) + "..." : publicUrl)
    : '';

  const generateEmailSubject = () => {
    return type === "quote"
      ? `Quote ready for you - ${documentNumber}`
      : `Invoice ${documentNumber} - ${formatCurrency(amount)}`;
  };

  const generateEmailBody = () => {
    const linkSection = hasPublicUrl 
      ? `\n\nHave a look when you get a chance${type === 'quote' ? ' and let me know if you want any changes' : ''}:\n${publicUrl}`
      : '';
    
    if (type === "quote") {
      return `G'day ${firstName},

I've put together your quote (${documentNumber}) for ${formatCurrency(amount)}.${hasPublicUrl ? `

Have a look when you get a chance and let me know if you want any changes:
${publicUrl}` : ' I\'ve attached the PDF for your review.'}

Give us a bell if you've got any questions.

Cheers${businessName ? `,\n${businessName}` : ''}`;
    } else {
      return `G'day ${firstName},

Here's your invoice (${documentNumber}) for ${formatCurrency(amount)}.${hasPublicUrl ? `

You can view and pay it here:
${publicUrl}` : ' I\'ve attached the PDF with payment details.'}

Thanks for the work - much appreciated!

Cheers${businessName ? `,\n${businessName}` : ''}`;
    }
  };
  
  const handleDownloadPdf = () => {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
    } else {
      // Use the authenticated PDF endpoint with document ID
      const apiType = type === 'quote' ? 'quotes' : 'invoices';
      window.open(`/api/${apiType}/${documentId}/pdf`, "_blank");
    }
  };

  const handleOpenGmail = () => {
    const subject = encodeURIComponent(generateEmailSubject());
    const body = encodeURIComponent(generateEmailBody());
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(clientEmail)}&su=${subject}&body=${body}`;
    window.open(gmailUrl, "_blank");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setLinkCopied(true);
      toast({
        title: "Link copied",
        description: `${typeLabel} link copied to clipboard`,
      });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Couldn't copy",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  const handleConfirmSend = async () => {
    await onConfirmSend();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send {typeLabel}
          </DialogTitle>
          <DialogDescription>
            Review the details before sending to your client
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Document Details Card */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{typeLabel} Number</span>
              </div>
              <Badge variant="secondary" className="font-mono">
                {documentNumber}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Amount</span>
              </div>
              <span className="font-semibold">{formatCurrency(amount)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Client</span>
              </div>
              <span className="font-medium">{clientName}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>Email</span>
              </div>
              <span className="text-sm font-medium">{clientEmail || <span className="text-muted-foreground italic">No email on file</span>}</span>
            </div>
          </div>

          {/* Actions Row */}
          <div className="flex gap-2">
            {hasPublicUrl && (
              <Button
                variant="outline"
                onClick={handleCopyLink}
                className="flex-1"
                data-testid="button-copy-link"
              >
                {linkCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              className={hasPublicUrl ? "flex-1" : "w-full"}
              data-testid="button-download-pdf"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {hasPublicUrl 
              ? `Your client can ${actionLabel} using the link. Download PDF to attach to email.`
              : 'Download the PDF to email directly to your client.'}
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
            data-testid="button-cancel-send"
          >
            Cancel
          </Button>
          
          {clientEmail && (
            <Button
              variant="outline"
              onClick={handleOpenGmail}
              className="w-full sm:w-auto"
              data-testid="button-open-gmail"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Gmail
            </Button>
          )}
          
          <Button
            onClick={handleConfirmSend}
            disabled={isPending}
            className="w-full sm:w-auto text-white"
            style={{ backgroundColor: "hsl(var(--trade))" }}
            data-testid="button-confirm-send"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Mark as Sent
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
