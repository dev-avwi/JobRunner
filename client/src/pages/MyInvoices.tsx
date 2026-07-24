import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useUserRole } from "@/hooks/use-user-role";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { FileText, Copy, Receipt } from "lucide-react";

interface SubInvoice {
  id: string;
  docType: string;
  title: string | null;
  status: string;
  invoiceNumber: string;
  subtotalAmount: string;
  gstAmount: string;
  totalAmount: string;
  dueDate: string | null;
  createdAt?: string;
  businessName: string;
  paymentToken: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
};

function formatMoney(v: string | number) {
  const n = Number(v || 0);
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

function formatDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function MyInvoices() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isSubcontractor, isLoading: roleLoading } = useUserRole();

  // This page is subcontractor-only; sidebar hiding alone isn't access control.
  useEffect(() => {
    if (!roleLoading && !isSubcontractor) {
      setLocation("/");
    }
  }, [roleLoading, isSubcontractor, setLocation]);

  const { data: invoices, isLoading, isError } = useQuery<SubInvoice[]>({
    queryKey: ["/api/subcontractor/invoices"],
    enabled: !roleLoading && isSubcontractor,
  });

  if (roleLoading || !isSubcontractor) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-24 w-full rounded-md" />
      </div>
    );
  }

  const copyPaymentLink = (token: string) => {
    const url = `${window.location.origin}/pay/${token}`;
    navigator.clipboard.writeText(url).then(
      () => toast({ title: "Payment link copied" }),
      () => toast({ title: "Couldn't copy link", variant: "destructive" }),
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold" data-testid="text-my-invoices-title">My Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Invoices and quotes you've sent to the businesses you work with.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-md" />
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Couldn't load your invoices. Please try again.
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && (!invoices || invoices.length === 0) && (
        <Card>
          <CardContent className="p-8 text-center">
            <Receipt className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">No invoices yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Invoices you create for a business will show up here. You can create them from the JobRunner mobile app.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && invoices && invoices.length > 0 && (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <Card key={inv.id} data-testid={`card-sub-invoice-${inv.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm truncate">
                        {inv.docType === "quote" ? "Quote" : "Invoice"} {inv.invoiceNumber}
                      </span>
                      <Badge className={`no-default-active-elevate text-[10px] ${STATUS_STYLES[inv.status] || "bg-muted text-muted-foreground"}`}>
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {inv.title || inv.businessName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      To: {inv.businessName}
                      {inv.dueDate ? ` · Due ${formatDate(inv.dueDate)}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-sm">{formatMoney(inv.totalAmount)}</p>
                    <p className="text-xs text-muted-foreground">incl. GST {formatMoney(inv.gstAmount)}</p>
                  </div>
                </div>
                {inv.paymentToken && inv.status !== "paid" && (
                  <div className="mt-3">
                    <Button size="sm" variant="outline" onClick={() => copyPaymentLink(inv.paymentToken!)} data-testid={`button-copy-pay-link-${inv.id}`}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy payment link
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
