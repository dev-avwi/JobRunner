import { useQuery } from "@tanstack/react-query";
import { getSessionToken } from "@/lib/queryClient";
import { DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

interface ProfitabilityData {
  jobId: string;
  jobTitle: string;
  jobStatus: string;
  clientName: string;
  quoted: { amount: number; gst: number; quoteNumber: string } | null;
  revenue: { invoiced: number; pending: number; received: number };
  costs: { labour: number; subcontractor: number; materials: number; otherExpenses: number; total: number };
  profit: { amount: number; margin: number; vsQuote: number | null };
  hours: { total: number; billable: number; nonBillable: number };
  status: "profitable" | "tight" | "loss";
  materials: Array<{
    id: string;
    name: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
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
      };
    case "tight":
      return {
        text: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500",
      };
    case "loss":
      return {
        text: "text-red-600 dark:text-red-400",
        bg: "bg-red-500",
      };
    default:
      return {
        text: "text-muted-foreground",
        bg: "bg-muted-foreground",
      };
  }
}

export default function JobProfitabilityCard({ jobId }: { jobId: string }) {
  const { data, isLoading } = useQuery<ProfitabilityData>({
    queryKey: ["/api/jobs", jobId, "profitability"],
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/jobs/${jobId}/profitability`, { credentials: "include", headers: token ? { 'Authorization': `Bearer ${token}` } : undefined });
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

  const hasFinancialData = data.revenue.invoiced > 0 || data.revenue.pending > 0 || data.costs.total > 0;

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

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <DollarSign className="h-4 w-4" style={{ color: "hsl(var(--trade))" }} />
          <CardTitle className="text-sm font-medium">Profitability</CardTitle>
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
              <span className="text-sm text-muted-foreground">Materials</span>
              <span className="text-sm">{formatCurrency(data.costs.materials)}</span>
            </div>
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
      </CardContent>
    </Card>
  );
}
