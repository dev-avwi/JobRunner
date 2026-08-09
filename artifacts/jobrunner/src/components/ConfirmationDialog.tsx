import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  details?: {
    label: string;
    value: string;
  }[];
  confirmLabel?: string;
  confirmVariant?: "default" | "destructive";
  onConfirm: () => Promise<void>;
  isPending?: boolean;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  details,
  confirmLabel = "Confirm",
  confirmVariant = "default",
  onConfirm,
  isPending = false,
}: ConfirmationDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {details && details.length > 0 && (
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            {details.map((detail, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{detail.label}</span>
                <Badge variant="secondary" className="font-mono">
                  {detail.value}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isPending}
            className={confirmVariant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            style={confirmVariant === "default" ? { backgroundColor: "hsl(var(--trade))", color: "white" } : undefined}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
