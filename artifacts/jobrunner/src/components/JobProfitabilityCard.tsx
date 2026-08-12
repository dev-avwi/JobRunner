import { useQuery } from "@tanstack/react-query";
import { getSessionToken } from "@/lib/queryClient";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

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

export default function JobProfitabilityCard({ jobId }: { jobId: string }) {
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

  const hasFinancialData =
    data.revenue.invoiced > 0 || data.revenue.pending > 0 || data.costs.total > 0 || !!data.budget;

  if (!hasFinancialData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <DollarSign className="h-4 w-4" style={{ color: "hsl(var(--trade))" }} />
            <CardTitle className="text-sm font-medium">Profitability</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No financial data yet</p>
        </CardContent>
      </Card>
    );
  }

  const colors = getStatusColor(data.status);
  const marginCapped = Math.min(Math.max(data.profit.margin, 0), 100);
  const markupCaptured = data.markup?.captured ?? 0;
  const showMarkup = markupCaptured > 0;
  const historical = data.historicalComparison;
  const marginDelta = historical ? Math.round((data.profit.margin - historical.avgMargin) * 10) / 10 : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <DollarSign className="h-4 w-4" style={{ color: "hsl(var(--trade))" }} />
          <CardTitle className="text-sm font-medium">Profitability</CardTitle>
          {data.profit.isNegative && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" /> Loss
            </Badge>
          )}
        </div>
      </CardHeader>
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
