import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { HardHat, FileText, Download, CheckCircle2, XCircle, DollarSign, Building2, Loader2, Receipt, Eye, CreditCard } from "lucide-react";
import { apiRequest, queryClient, getSessionToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SubInvoice {
  id: string;
  invoiceNumber: string;
  docType: string;
  title: string | null;
  status: string;
  gstEnabled: boolean;
  subtotalAmount: string;
  gstAmount: string;
  totalAmount: string;
  createdAt: string | null;
  dueDate: string | null;
  subcontractorName: string;
  accountingBillId: string | null;
  accountingProvider: string | null;
  paymentToken?: string | null;
}

interface SubInvoiceItem {
  id: string;
  description: string;
  hours: string | null;
  rate: string | null;
  quantity: string | null;
  unitPrice: string | null;
  amount: string;
  jobId: string | null;
}

interface SubInvoiceDetail extends SubInvoice {
  items: SubInvoiceItem[];
  subcontractorEmail?: string | null;
}

interface PaymentDetails {
  bankBsb?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  abn?: string | null;
  payId?: string | null;
}

const PAY_METHODS: { value: string; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'payid', label: 'PayID' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
];

function providerLabel(provider: string | null | undefined): string {
  switch (provider) {
    case 'xero': return 'Xero';
    case 'quickbooks':
    case 'qbo': return 'QuickBooks';
    case 'myob': return 'MYOB';
    default: return 'Accounting';
  }
}

const fmtAud = (n: number | string) => {
  const val = typeof n === 'string' ? parseFloat(n) : n;
  return `$${(val || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-AU') : '—');

function statusClasses(status: string): string {
  switch (status) {
    case 'submitted': return 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700';
    case 'approved': return 'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700';
    case 'paid': return 'text-green-600 dark:text-green-400 border-green-300 dark:border-green-700';
    case 'rejected': return 'text-red-600 dark:text-red-400 border-red-300 dark:border-red-700';
    default: return 'text-muted-foreground';
  }
}

async function downloadPdf(url: string, filename: string): Promise<void> {
  const token = getSessionToken();
  const res = await fetch(url, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

async function openPdf(url: string): Promise<void> {
  const token = getSessionToken();
  const res = await fetch(url, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Failed to open');
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const win = window.open(objectUrl, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}

export default function SubcontractorInvoices({ embedded = false }: { embedded?: boolean } = {}) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [payInvoice, setPayInvoice] = useState<SubInvoice | null>(null);

  // Deep link: open a specific invoice when the email CTA points here with
  // ?invoice=<id>, then strip the param so refresh/close doesn't re-open it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('invoice');
    if (id) {
      setDetailId(id);
      params.delete('invoice');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, []);
  const [rejectInvoice, setRejectInvoice] = useState<SubInvoice | null>(null);

  // Pay form state
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const listKey = statusFilter === 'all'
    ? ['/api/business/subcontractor-invoices']
    : ['/api/business/subcontractor-invoices', { status: statusFilter }];

  const { data: invoices, isLoading } = useQuery<SubInvoice[]>({
    queryKey: listKey,
    staleTime: 60 * 1000,
  });

  const { data: connected } = useQuery<{ provider: string | null }>({
    queryKey: ['/api/business/accounting/connected'],
    staleTime: 5 * 60 * 1000,
  });
  const provider = connected?.provider || null;

  const { data: detail, isLoading: detailLoading } = useQuery<SubInvoiceDetail>({
    queryKey: ['/api/subcontractor/invoices', detailId],
    enabled: !!detailId,
  });

  const { data: paymentDetails, isLoading: payDetailsLoading } = useQuery<PaymentDetails | null>({
    queryKey: ['/api/business/subcontractor-invoices', detailId, 'payment-details'],
    enabled: !!detailId,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/business/subcontractor-invoices'] });
    if (detailId) queryClient.invalidateQueries({ queryKey: ['/api/subcontractor/invoices', detailId] });
  };

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, rejectionReason }: { id: string; status: string; rejectionReason?: string }) => {
      await apiRequest('PATCH', `/api/business/subcontractor-invoices/${id}/status`, { status, rejectionReason });
    },
    onSuccess: (_d, vars) => {
      invalidateAll();
      toast({ title: `Invoice ${vars.status}`, description: 'The subcontractor has been notified.' });
      setRejectInvoice(null);
      setRejectReason('');
    },
    onError: (e: any) => toast({ title: 'Action failed', description: String(e?.message || e).replace(/^\d+:\s*/, ''), variant: 'destructive' }),
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!payInvoice) return;
      const res = await apiRequest('POST', `/api/business/subcontractor-invoices/${payInvoice.id}/pay`, {
        method: payMethod,
        paidAt: payDate ? new Date(payDate).toISOString() : new Date().toISOString(),
        reference: payReference.trim() || undefined,
        notes: payNotes.trim() || undefined,
        sendRemittance: true,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateAll();
      toast({ title: 'Payment recorded', description: data?.remittanceSent ? 'Remittance advice emailed to the subcontractor.' : 'Payment recorded.' });
      setPayInvoice(null);
    },
    onError: (e: any) => toast({ title: 'Payment failed', description: String(e?.message || e).replace(/^\d+:\s*/, ''), variant: 'destructive' }),
  });

  const pushMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/business/subcontractor-invoices/${id}/push-bill`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateAll();
      toast({
        title: data?.alreadyPushed ? 'Already pushed' : 'Bill pushed',
        description: `${providerLabel(data?.provider || provider)} bill ${data?.alreadyPushed ? 'already exists' : 'created'}.`,
      });
    },
    onError: (e: any) => toast({ title: 'Push failed', description: String(e?.message || e).replace(/^\d+:\s*/, ''), variant: 'destructive' }),
  });

  const remittanceMutation = useMutation({
    mutationFn: async (inv: SubInvoice) => {
      await downloadPdf(`/api/business/subcontractor-invoices/${inv.id}/remittance`, `Remittance-${inv.invoiceNumber}.pdf`);
    },
    onError: () => toast({ title: 'Download failed', description: 'Could not download the remittance advice.', variant: 'destructive' }),
  });

  const viewPdfMutation = useMutation({
    mutationFn: async (inv: SubInvoice) => {
      await openPdf(`/api/subcontractor/invoices/${inv.id}/pdf`);
    },
    onError: () => toast({ title: 'Could not open invoice', description: 'The invoice PDF failed to load.', variant: 'destructive' }),
  });

  const openPay = (inv: SubInvoice) => {
    setPayInvoice(inv);
    setPayMethod('bank_transfer');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayReference('');
    setPayNotes('');
  };

  const linkedJobCount = useMemo(() => {
    if (!detail?.items) return 0;
    return new Set(detail.items.filter(i => i.jobId).map(i => i.jobId)).size;
  }, [detail]);

  const busy = statusMutation.isPending || payMutation.isPending || pushMutation.isPending;

  return (
    <div className={embedded ? "space-y-4" : "p-4 md:p-6 max-w-7xl mx-auto space-y-4"}>
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <HardHat className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
            <div>
              <h2 className="text-lg font-semibold">Subcontractor Invoices</h2>
              <p className="text-sm text-muted-foreground">Review, approve, pay, and push incoming invoices</p>
            </div>
          </div>
        </div>
      )}

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="grid w-full grid-cols-5">
          {STATUS_FILTERS.map(f => (
            <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !invoices || invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-25" />
            <p className="text-sm font-medium">No invoices found</p>
            <p className="text-sm text-muted-foreground">
              {statusFilter === 'all' ? 'No subcontractors have submitted invoices yet.' : `No ${statusFilter} invoices.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Invoice</th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 hidden sm:table-cell">From</th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5 hidden md:table-cell">Date</th>
                    <th className="text-right font-medium text-muted-foreground px-3 py-2.5 hidden lg:table-cell">GST</th>
                    <th className="text-right font-medium text-muted-foreground px-3 py-2.5">Total</th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2.5">Status</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => {
                    const synced = !!inv.accountingBillId;
                    return (
                      <tr key={inv.id} className="border-b last:border-0 hover-elevate">
                        <td className="px-4 py-2.5">
                          <button
                            className="text-left"
                            onClick={() => setDetailId(inv.id)}
                            data-testid={`button-view-invoice-${inv.id}`}
                          >
                            <span className="font-medium block">{inv.invoiceNumber}</span>
                            {inv.docType === 'quote' && (
                              <span className="text-xs text-muted-foreground">Quote</span>
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 hidden sm:table-cell truncate max-w-[160px]">{inv.subcontractorName}</td>
                        <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">{fmtDate(inv.createdAt)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums hidden lg:table-cell text-muted-foreground">
                          {inv.gstEnabled ? fmtAud(inv.gstAmount) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums">{fmtAud(inv.totalAmount)}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className={`text-xs capitalize ${statusClasses(inv.status)}`}>{inv.status}</Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <Button
                              size="sm" variant="outline"
                              disabled={viewPdfMutation.isPending}
                              onClick={() => viewPdfMutation.mutate(inv)}
                              data-testid={`button-view-pdf-${inv.id}`}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />View PDF
                            </Button>
                            {inv.status === 'submitted' && (
                              <Button
                                size="sm" variant="outline"
                                disabled={busy}
                                onClick={() => statusMutation.mutate({ id: inv.id, status: 'approved' })}
                                data-testid={`button-approve-${inv.id}`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                              </Button>
                            )}
                            {(inv.status === 'submitted' || inv.status === 'approved') && inv.docType !== 'quote' && (
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => openPay(inv)}
                                data-testid={`button-pay-${inv.id}`}
                              >
                                <DollarSign className="h-3.5 w-3.5 mr-1" />Pay
                              </Button>
                            )}
                            {(inv.status === 'submitted' || inv.status === 'approved') && inv.docType !== 'quote' && inv.paymentToken && (
                              <Button
                                size="sm" variant="outline"
                                onClick={() => window.open(`/pay/${inv.paymentToken}`, '_blank')}
                                data-testid={`button-pay-card-${inv.id}`}
                              >
                                <CreditCard className="h-3.5 w-3.5 mr-1" />Pay by card
                              </Button>
                            )}
                            {inv.status === 'submitted' && (
                              <Button
                                size="sm" variant="ghost"
                                disabled={busy}
                                onClick={() => { setRejectInvoice(inv); setRejectReason(''); }}
                                data-testid={`button-reject-${inv.id}`}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                              </Button>
                            )}
                            {inv.status === 'paid' && (
                              <Button
                                size="sm" variant="outline"
                                disabled={remittanceMutation.isPending}
                                onClick={() => remittanceMutation.mutate(inv)}
                                data-testid={`button-remittance-${inv.id}`}
                              >
                                <Download className="h-3.5 w-3.5 mr-1" />Remittance
                              </Button>
                            )}
                            {(inv.status === 'approved' || inv.status === 'paid') && provider && inv.docType !== 'quote' && (
                              <Button
                                size="sm" variant="outline"
                                disabled={busy || synced}
                                onClick={() => pushMutation.mutate(inv.id)}
                                data-testid={`button-push-${inv.id}`}
                              >
                                <Building2 className="h-3.5 w-3.5 mr-1" />
                                {synced ? `Synced to ${providerLabel(inv.accountingProvider || provider)}` : `Push to ${providerLabel(provider)}`}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detail ? detail.invoiceNumber : 'Invoice'}
              {detail && (
                <Badge variant="outline" className={`ml-2 text-xs capitalize ${statusClasses(detail.status)}`}>{detail.status}</Badge>
              )}
            </DialogTitle>
            {detail && (
              <DialogDescription>
                From {detail.subcontractorName}{detail.title ? ` · ${detail.title}` : ''}
              </DialogDescription>
            )}
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Line items */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />Line Items
                </p>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {detail.items.map(it => (
                        <tr key={it.id} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <span className="block">{it.description}</span>
                            {it.hours && (
                              <span className="text-xs text-muted-foreground">{parseFloat(it.hours).toFixed(2)} hrs{it.rate ? ` @ ${fmtAud(it.rate)}/hr` : ''}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">{fmtAud(it.amount)}</td>
                        </tr>
                      ))}
                      {detail.items.length === 0 && (
                        <tr><td className="px-3 py-3 text-center text-muted-foreground">No line items</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {linkedJobCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-1.5">Linked to {linkedJobCount} job{linkedJobCount === 1 ? '' : 's'}</p>
                )}
              </div>

              {/* Totals */}
              <div className="rounded-md bg-muted/50 border p-3 space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{fmtAud(detail.subtotalAmount)}</span>
                </div>
                {detail.gstEnabled && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">GST</span>
                    <span className="tabular-nums">{fmtAud(detail.gstAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2 font-semibold pt-1 border-t">
                  <span>Total</span>
                  <span className="tabular-nums">{fmtAud(detail.totalAmount)}</span>
                </div>
              </div>

              {/* Payment details */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />Payment Details
                </p>
                {payDetailsLoading ? (
                  <Skeleton className="h-20" />
                ) : paymentDetails && (paymentDetails.bankAccountNumber || paymentDetails.payId) ? (
                  <div className="rounded-md border p-3 space-y-1.5 text-sm">
                    <DetailRow label="Account Name" value={paymentDetails.bankAccountName} />
                    <DetailRow label="BSB" value={paymentDetails.bankBsb} />
                    <DetailRow label="Account Number" value={paymentDetails.bankAccountNumber} />
                    <DetailRow label="PayID" value={paymentDetails.payId} />
                    <DetailRow label="ABN" value={paymentDetails.abn} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">This subcontractor hasn't added payment details yet.</p>
                )}
              </div>
            </div>
          )}

          {detail && (
            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" disabled={viewPdfMutation.isPending} onClick={() => viewPdfMutation.mutate(detail)}>
                <Eye className="h-4 w-4 mr-1.5" />View PDF
              </Button>
              {detail.status === 'submitted' && (
                <>
                  <Button variant="ghost" disabled={busy} onClick={() => { setRejectInvoice(detail); setRejectReason(''); }}>
                    <XCircle className="h-4 w-4 mr-1.5" />Reject
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => statusMutation.mutate({ id: detail.id, status: 'approved' })}>
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />Approve
                  </Button>
                </>
              )}
              {(detail.status === 'approved' || detail.status === 'paid') && provider && detail.docType !== 'quote' && (
                <Button variant="outline" disabled={busy || !!detail.accountingBillId} onClick={() => pushMutation.mutate(detail.id)}>
                  <Building2 className="h-4 w-4 mr-1.5" />
                  {detail.accountingBillId ? `Synced to ${providerLabel(detail.accountingProvider || provider)}` : `Push to ${providerLabel(provider)}`}
                </Button>
              )}
              {detail.status === 'paid' && (
                <Button variant="outline" disabled={remittanceMutation.isPending} onClick={() => remittanceMutation.mutate(detail)}>
                  <Download className="h-4 w-4 mr-1.5" />Remittance
                </Button>
              )}
              {(detail.status === 'submitted' || detail.status === 'approved') && detail.docType !== 'quote' && (
                <Button disabled={busy} onClick={() => openPay(detail)}>
                  <DollarSign className="h-4 w-4 mr-1.5" />Pay
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay dialog */}
      <Dialog open={!!payInvoice} onOpenChange={(o) => !o && setPayInvoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            {payInvoice && (
              <DialogDescription>
                {payInvoice.invoiceNumber} · {fmtAud(payInvoice.totalAmount)} to {payInvoice.subcontractorName}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Method</Label>
              <div className="flex flex-wrap gap-2">
                {PAY_METHODS.map(m => (
                  <Button
                    key={m.value}
                    type="button"
                    size="sm"
                    variant={payMethod === m.value ? 'default' : 'outline'}
                    onClick={() => setPayMethod(m.value)}
                    data-testid={`button-method-${m.value}`}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="payDate" className="mb-1.5 block">Payment Date</Label>
              <Input id="payDate" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} data-testid="input-pay-date" />
            </div>
            <div>
              <Label htmlFor="payRef" className="mb-1.5 block">Reference</Label>
              <Input id="payRef" value={payReference} onChange={(e) => setPayReference(e.target.value)} placeholder="e.g. bank transfer ref" data-testid="input-pay-reference" />
            </div>
            <div>
              <Label htmlFor="payNotes" className="mb-1.5 block">Notes</Label>
              <Textarea id="payNotes" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Optional notes" className="resize-none" rows={3} data-testid="input-pay-notes" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayInvoice(null)} disabled={payMutation.isPending}>Cancel</Button>
            <Button onClick={() => payMutation.mutate()} disabled={payMutation.isPending} data-testid="button-submit-payment">
              {payMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Record & Send Remittance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectInvoice} onOpenChange={(o) => !o && setRejectInvoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Invoice</DialogTitle>
            {rejectInvoice && (
              <DialogDescription>{rejectInvoice.invoiceNumber} from {rejectInvoice.subcontractorName}</DialogDescription>
            )}
          </DialogHeader>
          <div>
            <Label htmlFor="rejectReason" className="mb-1.5 block">Reason (optional)</Label>
            <Textarea id="rejectReason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Let the subcontractor know why" className="resize-none" rows={3} data-testid="input-reject-reason" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectInvoice(null)} disabled={statusMutation.isPending}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={statusMutation.isPending}
              onClick={() => rejectInvoice && statusMutation.mutate({ id: rejectInvoice.id, status: 'rejected', rejectionReason: rejectReason.trim() || undefined })}
              data-testid="button-confirm-reject"
            >
              {statusMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Reject Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  );
}
