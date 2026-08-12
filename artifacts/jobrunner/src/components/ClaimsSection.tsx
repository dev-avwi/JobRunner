/**
 * ClaimsSection — progress claims for large construction / engineering jobs.
 *
 * Shows a list of claims for a job, allows creating new claims with a
 * schedule-of-values wizard, and lets the user submit / approve / mark-paid
 * each claim. Approved claims are pushed to Xero automatically.
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus, FileText, ChevronDown, ChevronUp, Download, Check, X,
  Loader2, DollarSign, ClipboardList, ExternalLink, Trash2, Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// ─── types ────────────────────────────────────────────────────────────────────

export type ClaimStatus = "draft" | "submitted" | "approved" | "paid";

export interface Claim {
  id: string;
  jobId: string;
  claimNumber: string;
  status: ClaimStatus;
  claimDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  subtotal: string;
  gstAmount: string;
  total: string;
  retentionPercent: string | null;
  retentionAmount: string | null;
  notes: string | null;
  xeroInvoiceId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface ClaimLineItem {
  id: string;
  claimId: string;
  phaseId: string | null;
  description: string;
  contractValue: string;
  previouslyClaimed: string;
  thisClaim: string;
  retentionPercent: string | null;
  sortOrder: number;
  // computed by API
  balance?: number;
  cumulativePct?: number;
  retentionAmount?: number;
}

interface ScheduleOfValues {
  contractValueTotal: number;
  previouslyClaimedTotal: number;
  thisClaimTotal: number;
  retentionTotal: number;
  subtotal: number;
  gstAmount: number;
  total: number;
  balanceTotal: number;
}

interface JobPhaseOption {
  id: string;
  phaseCode: string;
  name: string;
  bookedHours: string | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ClaimStatus, { label: string; className: string }> = {
  draft:     { label: "Draft",     className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  submitted: { label: "Submitted", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  approved:  { label: "Approved",  className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  paid:      { label: "Paid",      className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
};

function fmt(v: string | number | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  return `$${(isNaN(n) ? 0 : n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  try { return format(new Date(d), "d MMM yyyy"); } catch { return d; }
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  jobId: string;
  isTradie?: boolean;
}

export function ClaimsSection({ jobId, isTradie = false }: Props) {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewWizard, setShowNewWizard] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Claim | null>(null);

  const { data: claims = [], isLoading } = useQuery<Claim[]>({
    queryKey: [`/api/jobs/${jobId}/claims`],
    enabled: !!jobId,
  });

  const { data: phases = [] } = useQuery<JobPhaseOption[]>({
    queryKey: [`/api/jobs/${jobId}/phases`],
    enabled: !!jobId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/claims`] });

  const submitMutation = useMutation({
    mutationFn: (claimId: string) =>
      apiRequest("POST", `/api/jobs/${jobId}/claims/${claimId}/submit`),
    onSuccess: () => { invalidate(); toast({ title: "Claim submitted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: (claimId: string) =>
      apiRequest("POST", `/api/jobs/${jobId}/claims/${claimId}/approve`),
    onSuccess: (data: any) => {
      invalidate();
      const msg = data?.xero?.xeroInvoiceId
        ? "Claim approved and pushed to Xero"
        : data?.xero?.error
          ? `Claim approved (Xero: ${data.xero.error})`
          : "Claim approved";
      toast({ title: msg });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const paidMutation = useMutation({
    mutationFn: (claimId: string) =>
      apiRequest("POST", `/api/jobs/${jobId}/claims/${claimId}/mark-paid`),
    onSuccess: () => { invalidate(); toast({ title: "Claim marked as paid" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (claimId: string) =>
      apiRequest("DELETE", `/api/jobs/${jobId}/claims/${claimId}`),
    onSuccess: () => { invalidate(); setDeleteTarget(null); toast({ title: "Claim deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleDownloadPDF = (claim: Claim) => {
    window.open(`/api/jobs/${jobId}/claims/${claim.id}/pdf`, "_blank");
  };

  return (
    <Card data-testid="card-claims">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" style={{ color: "hsl(var(--trade))" }} />
            <CardTitle className="text-sm font-medium">Progress Claims</CardTitle>
            {claims.length > 0 && (
              <Badge variant="secondary" className="text-xs">{claims.length}</Badge>
            )}
          </div>
          {!isTradie && (
            <Button size="sm" variant="ghost" onClick={() => setShowNewWizard(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New Claim
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-2">
        {isLoading && (
          <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading claims…
          </div>
        )}

        {!isLoading && claims.length === 0 && (
          <p className="text-sm text-muted-foreground py-3 text-center">
            No progress claims yet.{!isTradie && " Create one to start billing by milestone."}
          </p>
        )}

        {claims.map((claim) => (
          <ClaimRow
            key={claim.id}
            claim={claim}
            jobId={jobId}
            isTradie={isTradie}
            isExpanded={expandedId === claim.id}
            onToggle={() => setExpandedId(expandedId === claim.id ? null : claim.id)}
            onSubmit={() => submitMutation.mutate(claim.id)}
            onApprove={() => approveMutation.mutate(claim.id)}
            onMarkPaid={() => paidMutation.mutate(claim.id)}
            onDownloadPDF={() => handleDownloadPDF(claim)}
            onDelete={() => setDeleteTarget(claim)}
            isSubmitting={submitMutation.isPending}
            isApproving={approveMutation.isPending}
            isMarkingPaid={paidMutation.isPending}
          />
        ))}
      </CardContent>

      {/* New claim wizard */}
      {showNewWizard && (
        <NewClaimWizard
          jobId={jobId}
          phases={phases}
          onClose={() => setShowNewWizard(false)}
          onCreated={() => { invalidate(); setShowNewWizard(false); }}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Claim {deleteTarget?.claimNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this draft claim and all its line items. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── ClaimRow ─────────────────────────────────────────────────────────────────

interface ClaimRowProps {
  claim: Claim;
  jobId: string;
  isTradie: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  onMarkPaid: () => void;
  onDownloadPDF: () => void;
  onDelete: () => void;
  isSubmitting: boolean;
  isApproving: boolean;
  isMarkingPaid: boolean;
}

function ClaimRow({
  claim, jobId, isTradie, isExpanded, onToggle,
  onSubmit, onApprove, onMarkPaid, onDownloadPDF, onDelete,
  isSubmitting, isApproving, isMarkingPaid,
}: ClaimRowProps) {
  const cfg = STATUS_CONFIG[claim.status] ?? STATUS_CONFIG.draft;

  const { data: detail, isLoading: detailLoading } = useQuery<{
    claim: Claim;
    lineItems: ClaimLineItem[];
    scheduleOfValues: ScheduleOfValues;
  }>({
    queryKey: [`/api/jobs/${jobId}/claims/${claim.id}`],
    enabled: isExpanded,
  });

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={onToggle}
      >
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{claim.claimNumber}</span>
            <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
            {claim.xeroInvoiceId && (
              <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                Xero ✓
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {fmtDate(claim.claimDate)}
            {claim.periodStart && claim.periodEnd && ` · ${fmtDate(claim.periodStart)} – ${fmtDate(claim.periodEnd)}`}
            {" · "}
            <span className="font-medium text-foreground">{fmt(claim.total)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onDownloadPDF(); }}>
            <Download className="h-3.5 w-3.5" />
          </Button>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t px-4 py-3 space-y-4">
          {detailLoading && (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}

          {detail && (
            <>
              {/* Schedule of Values table */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Schedule of Values</p>
                <div className="overflow-x-auto rounded border text-xs">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="p-2 text-left font-medium">Description</th>
                        <th className="p-2 text-right font-medium">Contract Value</th>
                        <th className="p-2 text-right font-medium">Prev. Claimed</th>
                        <th className="p-2 text-right font-medium text-blue-700 dark:text-blue-300">This Claim</th>
                        <th className="p-2 text-right font-medium">Cumulative %</th>
                        <th className="p-2 text-right font-medium">Retention</th>
                        <th className="p-2 text-right font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lineItems.map((li, i) => (
                        <tr key={li.id} className={i % 2 === 0 ? "" : "bg-muted/30"}>
                          <td className="p-2">{li.description}</td>
                          <td className="p-2 text-right">{fmt(li.contractValue)}</td>
                          <td className="p-2 text-right">{fmt(li.previouslyClaimed)}</td>
                          <td className="p-2 text-right font-semibold text-blue-700 dark:text-blue-300">{fmt(li.thisClaim)}</td>
                          <td className="p-2 text-right text-muted-foreground">{li.cumulativePct?.toFixed(1) ?? "-"}%</td>
                          <td className="p-2 text-right">{fmt(li.retentionAmount)}</td>
                          <td className="p-2 text-right">{fmt(li.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/60 font-semibold">
                      <tr>
                        <td className="p-2">Totals</td>
                        <td className="p-2 text-right">{fmt(detail.scheduleOfValues.contractValueTotal)}</td>
                        <td className="p-2 text-right">{fmt(detail.scheduleOfValues.previouslyClaimedTotal)}</td>
                        <td className="p-2 text-right text-blue-700 dark:text-blue-300">{fmt(detail.scheduleOfValues.thisClaimTotal)}</td>
                        <td className="p-2 text-right text-muted-foreground">-</td>
                        <td className="p-2 text-right">{fmt(detail.scheduleOfValues.retentionTotal)}</td>
                        <td className="p-2 text-right">{fmt(detail.scheduleOfValues.balanceTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Summary box */}
              <div className="flex justify-end">
                <div className="text-xs space-y-1 min-w-[240px]">
                  <div className="flex justify-between gap-8"><span className="text-muted-foreground">This Claim</span><span>{fmt(detail.scheduleOfValues.thisClaimTotal)}</span></div>
                  <div className="flex justify-between gap-8"><span className="text-muted-foreground">Less Retention</span><span>-{fmt(detail.scheduleOfValues.retentionTotal)}</span></div>
                  <div className="flex justify-between gap-8 border-t pt-1"><span className="text-muted-foreground">Subtotal</span><span>{fmt(detail.scheduleOfValues.subtotal)}</span></div>
                  {parseFloat(detail.claim.gstAmount) > 0 && (
                    <div className="flex justify-between gap-8"><span className="text-muted-foreground">GST (10%)</span><span>{fmt(detail.scheduleOfValues.gstAmount)}</span></div>
                  )}
                  <div className="flex justify-between gap-8 border-t pt-1 font-bold text-sm"><span>Total Due</span><span>{fmt(detail.scheduleOfValues.total)}</span></div>
                </div>
              </div>

              {claim.notes && (
                <p className="text-xs text-muted-foreground border-t pt-2">{claim.notes}</p>
              )}

              {/* Action buttons */}
              {!isTradie && (
                <div className="flex items-center gap-2 flex-wrap border-t pt-2">
                  {claim.status === "draft" && (
                    <>
                      <Button size="sm" variant="outline" onClick={onSubmit} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                        Submit Claim
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    </>
                  )}
                  {claim.status === "submitted" && (
                    <Button size="sm" variant="outline" onClick={onApprove} disabled={isApproving}>
                      {isApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                      Approve &amp; Push to Xero
                    </Button>
                  )}
                  {claim.status === "approved" && (
                    <Button size="sm" variant="outline" onClick={onMarkPaid} disabled={isMarkingPaid}>
                      {isMarkingPaid ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <DollarSign className="h-3.5 w-3.5 mr-1" />}
                      Mark Paid
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={onDownloadPDF}>
                    <Download className="h-3.5 w-3.5 mr-1" /> PDF
                  </Button>
                  {claim.xeroInvoiceId && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Xero #{claim.xeroInvoiceId.slice(0, 8)}…
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── NewClaimWizard ───────────────────────────────────────────────────────────

interface WizardProps {
  jobId: string;
  phases: JobPhaseOption[];
  onClose: () => void;
  onCreated: () => void;
}

interface WizardLineItem {
  phaseId?: string;
  description: string;
  contractValue: string;
  previouslyClaimed: string;
  thisClaim: string;
  retentionPercent: string;
}

const EMPTY_LINE: WizardLineItem = {
  description: "", contractValue: "0.00", previouslyClaimed: "0.00", thisClaim: "0.00", retentionPercent: "",
};

function NewClaimWizard({ jobId, phases, onClose, onCreated }: WizardProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    claimDate: format(new Date(), "yyyy-MM-dd"),
    periodStart: "",
    periodEnd: "",
    retentionPercent: "5.00",
    notes: "",
  });
  const [lineItems, setLineItems] = useState<WizardLineItem[]>(
    phases.length > 0
      ? phases.map((p) => ({
          phaseId: p.id,
          description: `${p.phaseCode} – ${p.name}`,
          contractValue: "0.00",
          previouslyClaimed: "0.00",
          thisClaim: "0.00",
          retentionPercent: "",
        }))
      : [{ ...EMPTY_LINE }],
  );

  const updateLine = (idx: number, field: keyof WizardLineItem, value: string) => {
    setLineItems((prev) => prev.map((li, i) => i === idx ? { ...li, [field]: value } : li));
  };

  const addLine = () => setLineItems((prev) => [...prev, { ...EMPTY_LINE }]);

  const removeLine = (idx: number) => setLineItems((prev) => prev.filter((_, i) => i !== idx));

  const totals = useMemo(() => {
    let contractValueTotal = 0, thisClaimTotal = 0, prevTotal = 0, retTotal = 0;
    for (const li of lineItems) {
      const cv = parseFloat(li.contractValue) || 0;
      const prev = parseFloat(li.previouslyClaimed) || 0;
      const tc = parseFloat(li.thisClaim) || 0;
      const rp = parseFloat(li.retentionPercent || form.retentionPercent) || 0;
      contractValueTotal += cv;
      prevTotal += prev;
      thisClaimTotal += tc;
      retTotal += tc * rp / 100;
    }
    return { contractValueTotal, prevTotal, thisClaimTotal, retTotal, subtotal: thisClaimTotal - retTotal };
  }, [lineItems, form.retentionPercent]);

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/jobs/${jobId}/claims`, {
        ...form,
        lineItems: lineItems.map((li, i) => ({ ...li, sortOrder: i })),
      }),
    onSuccess: () => { toast({ title: "Claim created" }); onCreated(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Progress Claim</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">Claim Date</Label>
              <Input type="date" value={form.claimDate} onChange={(e) => setForm((f) => ({ ...f, claimDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Period From</Label>
              <Input type="date" value={form.periodStart} onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Period To</Label>
              <Input type="date" value={form.periodEnd} onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Default Retention %</Label>
              <Input
                type="number" step="0.01" min="0" max="100"
                value={form.retentionPercent}
                onChange={(e) => setForm((f) => ({ ...f, retentionPercent: e.target.value }))}
              />
            </div>
          </div>

          {/* Schedule of values */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Schedule of Values</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-xs border rounded">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="p-2 text-left font-medium">Description / Phase</th>
                    <th className="p-2 text-right font-medium w-28">Contract Value</th>
                    <th className="p-2 text-right font-medium w-28">Prev. Claimed</th>
                    <th className="p-2 text-right font-medium w-28 text-blue-700 dark:text-blue-300">This Claim</th>
                    <th className="p-2 text-right font-medium w-20">Ret %</th>
                    <th className="p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "" : "bg-muted/30"}>
                      <td className="p-1">
                        <Input
                          className="h-7 text-xs"
                          value={li.description}
                          onChange={(e) => updateLine(idx, "description", e.target.value)}
                          placeholder="Phase / description"
                        />
                      </td>
                      <td className="p-1">
                        <Input className="h-7 text-xs text-right" type="number" step="0.01" value={li.contractValue} onChange={(e) => updateLine(idx, "contractValue", e.target.value)} />
                      </td>
                      <td className="p-1">
                        <Input className="h-7 text-xs text-right" type="number" step="0.01" value={li.previouslyClaimed} onChange={(e) => updateLine(idx, "previouslyClaimed", e.target.value)} />
                      </td>
                      <td className="p-1">
                        <Input className="h-7 text-xs text-right" type="number" step="0.01" value={li.thisClaim} onChange={(e) => updateLine(idx, "thisClaim", e.target.value)} />
                      </td>
                      <td className="p-1">
                        <Input className="h-7 text-xs text-right" type="number" step="0.01" placeholder={form.retentionPercent} value={li.retentionPercent} onChange={(e) => updateLine(idx, "retentionPercent", e.target.value)} />
                      </td>
                      <td className="p-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLine(idx)} disabled={lineItems.length === 1}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button size="sm" variant="ghost" className="mt-2" onClick={addLine}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Line
            </Button>
          </div>

          {/* Live totals */}
          <div className="flex justify-end">
            <div className="text-xs space-y-1 min-w-[220px] text-right">
              <div className="flex justify-between gap-6"><span className="text-muted-foreground">Contract Value</span><span>{fmt(totals.contractValueTotal)}</span></div>
              <div className="flex justify-between gap-6"><span className="text-muted-foreground">This Claim</span><span>{fmt(totals.thisClaimTotal)}</span></div>
              <div className="flex justify-between gap-6"><span className="text-muted-foreground">Less Retention</span><span>-{fmt(totals.retTotal)}</span></div>
              <div className="flex justify-between gap-6 border-t pt-1 font-bold"><span>Net This Claim</span><span>{fmt(totals.subtotal)}</span></div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea rows={2} placeholder="Payment terms, reference, special conditions…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Create Claim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
