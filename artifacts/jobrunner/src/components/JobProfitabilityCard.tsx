import { useQuery } from "@tanstack/react-query";
import { getSessionToken } from "@/lib/queryClient";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Target, FileDown, Loader2, ChevronDown, ChevronRight, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

interface MarkupData {
  captured: number;
  materialMarkupPct: number | null;
  equipmentMarkupPct: number | null;
  subcontractorMarkupPct: number | null;
  defaultMaterialMarkupPct?: number;
  defaultEquipmentMarkupPct?: number;
  defaultSubcontractorMarkupPct?: number;
}

interface BudgetData {
  budgetedCost: number;
  actualCost: number;
  variance: number;
  trafficLight: "green" | "amber" | "red";
  percentUsed: number;
}

interface HistoricalComparison {
  avgMargin: number;
  jobCount: number;
  jobType: string;
}

interface PhaseCostData {
  id: string | null;
  phaseCode: string | null;
  name: string;
  status: string | null;
  costs: {
    labour: number;
    subcontractor: number;
    materials: number;
    purchaseOrders: number;
    total: number;
  };
  hours: number;
  variations: { approvedTotal: number; pendingTotal: number };
}

interface ProfitabilityData {
  jobId: string;
  jobTitle: string;
  jobStatus: string;
  clientName: string;
  quoted: { amount: number; gst: number; quoteNumber: string } | null;
  revenue: { invoiced: number; pending: number; received: number };
  costs: {
    labour: number;
    subcontractor: number;
    materials: number;
    materialsSellPrice?: number;
    otherExpenses: number;
    total: number;
  };
  markup?: MarkupData;
  budget?: BudgetData | null;
  profit: { amount: number; margin: number; vsQuote: number | null; isNegative?: boolean };
  hours: { total: number; billable: number; nonBillable: number };
  status: "profitable" | "tight" | "loss";
  historicalComparison?: HistoricalComparison | null;
  materials: Array<{
    id: string;
    name: string;
    quantity: number;
    unitCost: number;
    unitPrice?: number;
    totalCost: number;
    totalPrice?: number;
    markupPercent?: string;
    supplier: string;
    status: string;
  }>;
  phases?: PhaseCostData[];
}

function getStatusColor(status: string) {
  switch (status) {
    case "profitable":
      return {
        text: "text-green-600 dark:text-green-400",
        bg: "bg-green-500",
        light: "bg-green-500/10",
      };
    case "tight":
      return {
        text: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500",
        light: "bg-amber-500/10",
      };
    case "loss":
      return {
        text: "text-red-600 dark:text-red-400",
        bg: "bg-red-500",
        light: "bg-red-500/10",
      };
    default:
      return {
        text: "text-muted-foreground",
        bg: "bg-muted-foreground",
        light: "bg-muted",
      };
  }
}

function TrafficLight({ color }: { color: "green" | "amber" | "red" }) {
  const colorMap = {
    green: "bg-green-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };
  const labelMap = {
    green: "Under budget",
    amber: "Near limit",
    red: "Over budget",
  };
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${colorMap[color]}`} />
      <span className="text-xs text-muted-foreground">{labelMap[color]}</span>
    </span>
  );
}

function PhaseBreakdownSection({ phases }: { phases: PhaseCostData[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="pt-2 border-t">
      <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2">
        <Layers className="h-3 w-3" />
        Costs by phase
      </div>
      <div className="space-y-1">
        {phases.map((phase) => {
          const key = phase.id ?? "unallocated";
          const isOpen = expanded.has(key);
          return (
            <div key={key} className="rounded-md border">
              <button
                type="button"
                className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-muted/50 rounded-md"
                onClick={() => toggle(key)}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  {phase.phaseCode && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                      {phase.phaseCode}
                    </Badge>
                  )}
                  <span className="text-sm truncate">{phase.name}</span>
                </span>
                <span className="text-sm font-medium shrink-0 ml-2">
                  {formatCurrency(phase.costs.total)}
                </span>
              </button>
              {isOpen && (
                <div className="px-3 pb-2 pt-0.5 space-y-1 pl-8">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Labour{phase.hours > 0 ? ` (${phase.hours.toFixed(1)}hrs)` : ""}
                    </span>
                    <span className="text-xs">{formatCurrency(phase.costs.labour)}</span>
                  </div>
                  {phase.costs.subcontractor > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Subcontractors</span>
                      <span className="text-xs">{formatCurrency(phase.costs.subcontractor)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Materials</span>
                    <span className="text-xs">{formatCurrency(phase.costs.materials)}</span>
                  </div>
                  {phase.costs.purchaseOrders > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Purchase orders</span>
                      <span className="text-xs">{formatCurrency(phase.costs.purchaseOrders)}</span>
                    </div>
                  )}
                  {phase.variations.approvedTotal > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Approved variations</span>
                      <span className="text-xs text-green-600 dark:text-green-400">
                        +{formatCurrency(phase.variations.approvedTotal)}
                      </span>
                    </div>
                  )}
                  {phase.variations.pendingTotal > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Pending variations</span>
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        {formatCurrency(phase.variations.pendingTotal)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function JobProfitabilityCard({ jobId }: { jobId: string }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadCostReport = async () => {
    setIsDownloading(true);
    try {
      const token = getSessionToken();
      const res = await fetch(`/api/jobs/${jobId}/cost-report`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error("Failed to generate report");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cost-report-${jobId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Cost report download failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const { data, isLoading } = useQuery<ProfitabilityData>({
    queryKey: ["/api/jobs", jobId, "profitability"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/jobs/${jobId}/profitability`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error("Failed to fetch profitability");
      return res.json();
    },
    enabled: !!jobId,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // Include PO and variation totals in the "has data" check so early-stage jobs
  // with only a quote or approved variation still show the header + download button.
  const hasFinancialData =
    data.revenue.invoiced > 0 ||
    data.revenue.pending > 0 ||
    data.costs.total > 0 ||
    !!data.budget ||
    (data as any).purchaseOrders?.total > 0 ||
    (data as any).variations?.approvedTotal > 0 ||
    (data as any).variations?.pendingTotal > 0 ||
    !!data.quoted?.amount;

  const colors = getStatusColor(data.status);
  const marginCapped = Math.min(Math.max(data.profit.margin, 0), 100);
  const markupCaptured = data.markup?.captured ?? 0;
  const showMarkup = markupCaptured > 0;
  const historical = data.historicalComparison;
  const marginDelta = historical ? Math.round((data.profit.margin - historical.avgMargin) * 10) / 10 : null;

  // Shared card header — always rendered so the download button is always accessible.
  const cardHeader = (
    <CardHeader className="pb-2">
      <div className="flex items-center gap-2 flex-wrap">
        <DollarSign className="h-4 w-4" style={{ color: "hsl(var(--trade))" }} />
        <CardTitle className="text-sm font-medium">Job Costing</CardTitle>
        {data.profit.isNegative && (
          <Badge variant="destructive" className="text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" /> Loss
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7 gap-1 text-xs"
          onClick={handleDownloadCostReport}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <FileDown className="h-3 w-3" />
          )}
          Cost Report
        </Button>
      </div>
    </CardHeader>
  );

  if (!hasFinancialData) {
    return (
      <Card>
        {cardHeader}
        <CardContent>
          <p className="text-sm text-muted-foreground">No financial data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={data.profit.isNegative ? "border-red-300 dark:border-red-800" : ""}>
      {data.profit.isNegative && (
        <div className="rounded-t-lg bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800 px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            This job is currently running at a loss
          </p>
        </div>
      )}
      {cardHeader}
      <CardContent className="space-y-3">
        {data.quoted?.amount ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Quoted</span>
            <span className="text-sm font-medium">{formatCurrency(data.quoted.amount)}</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Revenue</span>
          <span className="text-sm font-medium">{formatCurrency(data.revenue.invoiced)}</span>
        </div>

        {data.revenue.pending > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Pending</span>
            <span className="text-sm text-amber-600 dark:text-amber-400">
              {formatCurrency(data.revenue.pending)}
            </span>
          </div>
        )}

        <div className="pt-2 border-t">
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2">Costs</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Labour{data.hours.total > 0 ? ` (${Number(data.hours.total).toFixed(1)}hrs)` : ""}
              </span>
              <span className="text-sm">{formatCurrency(data.costs.labour)}</span>
            </div>
            {data.costs.subcontractor > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Subcontractors</span>
                <span className="text-sm">{formatCurrency(data.costs.subcontractor)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Materials (cost)</span>
              <span className="text-sm">{formatCurrency(data.costs.materials)}</span>
            </div>
            {showMarkup && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  Markup captured
                </span>
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                  +{formatCurrency(markupCaptured)}
                </span>
              </div>
            )}
            {data.costs.otherExpenses > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Other</span>
                <span className="text-sm">{formatCurrency(data.costs.otherExpenses)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t">
              <span className="text-sm text-muted-foreground font-medium">Total costs</span>
              <span className="text-sm font-medium">{formatCurrency(data.costs.total)}</span>
            </div>
          </div>
        </div>

        {/* Phase-level cost breakdown (project jobs with phases) */}
        {data.phases && data.phases.length > 0 && (
          <PhaseBreakdownSection phases={data.phases} />
        )}

        {/* Budget vs Actual */}
        {data.budget && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2">
              <Target className="h-3 w-3" />
              Budget vs Actual
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Budget</span>
                <span className="text-sm">{formatCurrency(data.budget.budgetedCost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Actual</span>
                <span className="text-sm">{formatCurrency(data.budget.actualCost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Variance</span>
                <span
                  className={`text-sm font-medium ${
                    data.budget.variance <= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {data.budget.variance > 0 ? "+" : ""}
                  {formatCurrency(data.budget.variance)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <TrafficLight color={data.budget.trafficLight} />
                <span className="text-xs text-muted-foreground">
                  {data.budget.percentUsed.toFixed(0)}% of budget used
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <div className="flex items-center gap-1 text-muted-foreground text-xs mb-2">Result</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Profit</span>
              <span className={`text-sm font-medium ${colors.text}`}>
                {formatCurrency(data.profit.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Margin</span>
              <span className={`text-sm font-medium ${colors.text}`}>
                {data.profit.margin.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${colors.bg}`}
              style={{ width: `${marginCapped}%` }}
            />
          </div>
          <p className={`text-xs ${colors.text}`}>{data.profit.margin.toFixed(1)}% margin</p>
        </div>

        {data.profit.vsQuote != null && data.profit.vsQuote !== 0 && (
          <p className="text-xs text-muted-foreground">
            {formatCurrency(Math.abs(data.profit.vsQuote))}{" "}
            {data.profit.vsQuote < 0 ? "under" : "over"} quoted
          </p>
        )}

        {/* Historical comparison */}
        {historical && marginDelta !== null && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1.5">
              Historical comparison
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2 space-y-1">
              <p className="text-xs text-muted-foreground">
                Last {historical.jobCount} similar jobs averaged{" "}
                <span className="font-medium text-foreground">
                  {historical.avgMargin.toFixed(1)}%
                </span>{" "}
                margin
              </p>
              <p className="text-xs flex items-center gap-1">
                {marginDelta >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={
                    marginDelta >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }
                >
                  {marginDelta >= 0 ? "+" : ""}
                  {marginDelta.toFixed(1)}% vs typical
                </span>
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
