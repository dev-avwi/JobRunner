import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useUserRole } from "@/hooks/use-user-role";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { FileText, Copy, Receipt, Plus, Download, Trash2 } from "lucide-react";

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
  accountingBillId?: string | null;
  accountingSyncedAt?: string | null;
}

interface UnbilledJob {
  jobId: string;
  jobTitle: string;
  businessOwnerId: string;
  businessName: string;
  totalHours: number;
  hourlyRate: number;
  materialsCost: number;
  totalAmount: number;
  timeEntries: { id: string }[];
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

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<string>("");
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [rateOverrides, setRateOverrides] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [withdrawTarget, setWithdrawTarget] = useState<SubInvoice | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

  const { data: unbilled, isLoading: unbilledLoading } = useQuery<UnbilledJob[]>({
    queryKey: ["/api/subcontractor/unbilled-work"],
    enabled: createOpen,
  });

  // All workspaces the subbie belongs to (so any business can be picked, even
  // when it has no unbilled work yet), merged with businesses seen in unbilled work.
  const { data: dashboard } = useQuery<{ businesses?: Array<{ id: string; name: string }> }>({
    queryKey: ["/api/subcontractor/dashboard"],
    enabled: createOpen,
    staleTime: 60_000,
  });
  const businessMap = new Map<string, string>();
  (dashboard?.businesses || []).forEach((b) => businessMap.set(b.id, b.name));
  (unbilled || []).forEach((u) => businessMap.set(u.businessOwnerId, u.businessName));
  const businesses = Array.from(businessMap.entries());
  const businessJobs = (unbilled || []).filter((u) => u.businessOwnerId === selectedBusiness);

  // Effective rate/total per job, honouring any manual rate the subbie typed in.
  const effectiveRate = (j: UnbilledJob) => {
    const raw = rateOverrides[j.jobId];
    if (raw !== undefined && raw !== "") {
      const n = parseFloat(raw);
      if (isFinite(n) && n > 0) return n;
    }
    return j.hourlyRate;
  };
  const effectiveTotal = (j: UnbilledJob) =>
    Math.round((j.totalHours * effectiveRate(j) + j.materialsCost) * 100) / 100;
  const selectedTotal = businessJobs
    .filter((j) => selectedJobs.has(j.jobId))
    .reduce((sum, j) => sum + effectiveTotal(j), 0);

  const resetCreate = () => {
    setCreateOpen(false);
    setSelectedBusiness("");
    setSelectedJobs(new Set());
    setRateOverrides({});
    setNotes("");
    setDueDate("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const items = businessJobs
        .filter((j) => selectedJobs.has(j.jobId))
        .map((j) => {
          const raw = rateOverrides[j.jobId];
          const n = raw !== undefined && raw !== "" ? parseFloat(raw) : NaN;
          const hasOverride = isFinite(n) && n > 0 && n !== j.hourlyRate;
          return {
            jobId: j.jobId,
            timeEntryIds: j.timeEntries.map((t) => t.id),
            ...(hasOverride ? { hourlyRate: n } : {}),
          };
        });
      return apiRequest("POST", "/api/subcontractor/invoices", {
        businessOwnerId: selectedBusiness,
        items,
        notes: notes || undefined,
        dueDate: dueDate || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Invoice sent", description: "The business owner has been notified." });
      resetCreate();
      queryClient.invalidateQueries({ queryKey: ["/api/subcontractor/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subcontractor/unbilled-work"] });
    },
    onError: (e: any) => {
      toast({ title: "Couldn't create invoice", description: e?.message || undefined, variant: "destructive" });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/subcontractor/invoices/${id}`),
    onSuccess: () => {
      toast({ title: "Invoice withdrawn" });
      setWithdrawTarget(null);
      queryClient.invalidateQueries({ queryKey: ["/api/subcontractor/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subcontractor/unbilled-work"] });
    },
    onError: (e: any) => {
      toast({ title: "Couldn't withdraw invoice", description: e?.message || undefined, variant: "destructive" });
    },
  });

  const downloadPdf = async (inv: SubInvoice) => {
    setDownloadingId(inv.id);
    try {
      const token = localStorage.getItem("jobrunner_session_token");
      const res = await fetch(`/api/subcontractor/invoices/${inv.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      });
      if (!res.ok) throw new Error("PDF failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Couldn't download PDF", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

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

  const canWithdraw = (inv: SubInvoice) =>
    (inv.status === "draft" || inv.status === "submitted") && !inv.accountingBillId && !inv.accountingSyncedAt;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-my-invoices-title">My Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Invoices and quotes you've sent to the businesses you work with.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-new-sub-invoice">
          <Plus className="h-4 w-4 mr-1.5" />
          New invoice
        </Button>
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
              Use "New invoice" to bill a business for your completed work.
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
                <div className="mt-3 flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={downloadingId === inv.id}
                    onClick={() => downloadPdf(inv)}
                    data-testid={`button-pdf-${inv.id}`}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    {downloadingId === inv.id ? "Preparing..." : "PDF"}
                  </Button>
                  {inv.paymentToken && inv.status !== "paid" && (
                    <Button size="sm" variant="outline" onClick={() => copyPaymentLink(inv.paymentToken!)} data-testid={`button-copy-pay-link-${inv.id}`}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy payment link
                    </Button>
                  )}
                  {canWithdraw(inv) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setWithdrawTarget(inv)}
                      data-testid={`button-withdraw-${inv.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Withdraw
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) resetCreate(); else setCreateOpen(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New invoice</DialogTitle>
          </DialogHeader>

          {unbilledLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          ) : businesses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              You're not part of any business yet. Join a business first, then you can invoice them for your work.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Bill to</Label>
                <Select
                  value={selectedBusiness}
                  onValueChange={(v) => { setSelectedBusiness(v); setSelectedJobs(new Set()); }}
                >
                  <SelectTrigger data-testid="select-invoice-business">
                    <SelectValue placeholder="Choose a business" />
                  </SelectTrigger>
                  <SelectContent>
                    {businesses.map(([id, name]) => (
                      <SelectItem key={id} value={id}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedBusiness && businessJobs.length === 0 && (
                <p className="text-sm text-muted-foreground py-1">
                  No unbilled work for this business yet. Work shows up here once a job you're assigned to is completed and you've tracked time on it.
                </p>
              )}

              {selectedBusiness && businessJobs.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Unbilled jobs</Label>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {businessJobs.map((j) => (
                      <label
                        key={j.jobId}
                        className="flex items-start gap-2.5 rounded-md border p-3 cursor-pointer hover-elevate"
                        data-testid={`row-unbilled-${j.jobId}`}
                      >
                        <Checkbox
                          checked={selectedJobs.has(j.jobId)}
                          onCheckedChange={(checked) => {
                            setSelectedJobs((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(j.jobId); else next.delete(j.jobId);
                              return next;
                            });
                          }}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{j.jobTitle}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{j.totalHours}h @</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">$</span>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                className="h-8 w-24 text-sm"
                                value={rateOverrides[j.jobId] ?? String(j.hourlyRate)}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onChange={(e) =>
                                  setRateOverrides((prev) => ({ ...prev, [j.jobId]: e.target.value }))
                                }
                                data-testid={`input-rate-${j.jobId}`}
                              />
                              <span className="text-xs text-muted-foreground">/h</span>
                            </div>
                            {j.materialsCost > 0 && (
                              <span className="text-xs text-muted-foreground">+ materials {formatMoney(j.materialsCost)}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-medium shrink-0">{formatMoney(effectiveTotal(j))}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selectedBusiness && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="invoice-due-date">Due date (optional)</Label>
                      <Input
                        id="invoice-due-date"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        data-testid="input-invoice-due-date"
                      />
                    </div>
                    <div className="flex items-end justify-end pb-1">
                      <p className="text-sm">
                        Total: <span className="font-semibold">{formatMoney(selectedTotal)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invoice-notes">Notes (optional)</Label>
                    <Textarea
                      id="invoice-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Anything the business owner should know"
                      data-testid="input-invoice-notes"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={resetCreate}>Cancel</Button>
            <Button
              disabled={!selectedBusiness || selectedJobs.size === 0 || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              data-testid="button-send-sub-invoice"
            >
              {createMutation.isPending ? "Sending..." : "Send invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!withdrawTarget} onOpenChange={(open) => { if (!open) setWithdrawTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw invoice {withdrawTarget?.invoiceNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the invoice and frees up the work so you can bill it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => withdrawTarget && withdrawMutation.mutate(withdrawTarget.id)}
              data-testid="button-confirm-withdraw"
            >
              Withdraw
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
