import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConvertQuotePreview } from "@/hooks/use-quotes";
import { ArrowRight, FileText } from "lucide-react";

interface ConvertQuotePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string | null;
  quoteNumber?: string;
  clientName?: string;
  onConfirm: () => void;
  isPending?: boolean;
}

const formatCurrency = (amount: number | string | null | undefined): string => {
  const n = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(Number.isFinite(n) ? n : 0);
};

export default function ConvertQuotePreviewDialog({
  open,
  onOpenChange,
  quoteId,
  quoteNumber,
  clientName,
  onConfirm,
  isPending,
}: ConvertQuotePreviewDialogProps) {
  const { data, isLoading, error } = useConvertQuotePreview(quoteId, open);
  const preview = data as
    | {
        number: string;
        title: string;
        dueDate: string;
        subtotal: string;
        gstAmount: string;
        total: string;
        lineItems: Array<{
          description: string;
          quantity: string | number;
          unitPrice: string | number;
          total: string | number;
        }>;
      }
    | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        data-testid="dialog-convert-quote-preview"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Convert to Invoice
          </DialogTitle>
          <DialogDescription>
            Review what the new invoice will look like before creating it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium text-foreground">
              {quoteNumber || "Quote"}
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
            {isLoading ? (
              <Skeleton className="h-4 w-20" />
            ) : (
              <span className="font-medium text-foreground">
                {preview?.number || "—"}
              </span>
            )}
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive">
              Could not load preview. Please try again.
            </div>
          ) : isLoading || !preview ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <>
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium text-right">
                    {clientName || "—"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Title</span>
                  <span className="font-medium text-right truncate">
                    {preview.title}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Due</span>
                  <span className="font-medium text-right">
                    {new Date(preview.dueDate).toLocaleDateString("en-AU")}
                  </span>
                </div>
              </div>

              <div className="rounded-md border">
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                  {preview.lineItems.length} line item
                  {preview.lineItems.length === 1 ? "" : "s"}
                </div>
                <div className="max-h-40 overflow-y-auto divide-y">
                  {preview.lineItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex justify-between gap-3 px-3 py-2"
                      data-testid={`convert-preview-item-${i}`}
                    >
                      <span className="truncate">{item.description}</span>
                      <span className="text-muted-foreground flex-shrink-0">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(preview.subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST</span>
                  <span>{formatCurrency(preview.gstAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base pt-1 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(preview.total)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-convert-preview-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending || isLoading || !preview || !!error}
            data-testid="button-convert-preview-confirm"
          >
            {isPending ? "Creating..." : "Create Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
