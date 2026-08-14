/**
 * ProjectHealthRow — compact health indicators shown on project cards in the Jobs list.
 *
 * Three indicators:
 *   1. Phase completion  "3/5 phases done"
 *   2. Claimed %         "60% claimed"  (approved/paid claims ÷ sum of all claim totals)
 *   3. Budget health dot (green / amber / red) based on actuals vs budgetedCost
 *
 * All three are fetched lazily — the component only fires requests when mounted,
 * so the regular jobs list is unaffected.
 */
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, DollarSign, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectHealthRowProps {
  jobId: string;
}

interface Phase {
  id: string;
  status: string;
}

interface Claim {
  id: string;
  status: string; // draft | submitted | approved | paid
  total: string;
}

interface ProfitData {
  budget?: {
    trafficLight: "green" | "amber" | "red";
    percentUsed: number;
  } | null;
}

export default function ProjectHealthRow({ jobId }: ProjectHealthRowProps) {
  const { data: phases = [] } = useQuery<Phase[]>({
    queryKey: [`/api/jobs/${jobId}/phases`],
    staleTime: 60_000,
  });

  const { data: claims = [] } = useQuery<Claim[]>({
    queryKey: [`/api/jobs/${jobId}/claims`],
    staleTime: 60_000,
  });

  const { data: profitability } = useQuery<ProfitData>({
    queryKey: [`/api/jobs/${jobId}/profitability`],
    staleTime: 60_000,
  });

  // Phase completion
  const totalPhases = phases.length;
  const donePhases = phases.filter(
    (p) => p.status === "completed" || p.status === "done"
  ).length;

  // Claimed % — numerator = sum of approved/paid claim totals
  //              denominator = sum of ALL claim totals (represents contract value)
  const allClaimTotal = claims.reduce(
    (sum, c) => sum + parseFloat(c.total || "0"),
    0
  );
  const claimedTotal = claims
    .filter((c) => c.status === "approved" || c.status === "paid")
    .reduce((sum, c) => sum + parseFloat(c.total || "0"), 0);
  const claimedPct =
    allClaimTotal > 0 ? Math.round((claimedTotal / allClaimTotal) * 100) : null;

  // Budget health
  const trafficLight = profitability?.budget?.trafficLight ?? null;
  const trafficLightColor: Record<string, string> = {
    green: "bg-emerald-500",
    amber: "bg-amber-400",
    red: "bg-red-500",
  };
  const trafficLightTitle: Record<string, string> = {
    green: "Budget on track",
    amber: "Budget approaching limit",
    red: "Over budget",
  };

  const hasAny = totalPhases > 0 || claimedPct !== null || trafficLight;
  if (!hasAny) return null;

  return (
    <div
      className="flex items-center gap-3 mt-2 pt-2 border-t border-border/50 flex-wrap"
      data-testid={`project-health-${jobId}`}
    >
      {/* Phase progress */}
      {totalPhases > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
          <span>
            <span className="font-medium text-foreground">
              {donePhases}/{totalPhases}
            </span>{" "}
            phases
          </span>
        </div>
      )}

      {/* Claimed % */}
      {claimedPct !== null && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <DollarSign className="h-3 w-3 text-blue-500 flex-shrink-0" />
          <span>
            <span className="font-medium text-foreground">{claimedPct}%</span>{" "}
            claimed
          </span>
        </div>
      )}

      {/* Budget health dot */}
      {trafficLight && (
        <div
          className="flex items-center gap-1 text-xs text-muted-foreground"
          title={trafficLightTitle[trafficLight]}
        >
          <div
            className={cn(
              "w-2.5 h-2.5 rounded-full flex-shrink-0",
              trafficLightColor[trafficLight]
            )}
          />
          <span>
            {trafficLight === "green"
              ? "On budget"
              : trafficLight === "amber"
              ? "Near limit"
              : "Over budget"}
          </span>
        </div>
      )}
    </div>
  );
}
