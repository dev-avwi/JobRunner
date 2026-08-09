import { Button } from "@/components/ui/button";
import { useFeatureAccess } from "@/hooks/use-subscription";
import { Link } from "wouter";
import { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  X,
} from "lucide-react";

export default function DashboardUpgradeCard() {
  const { subscriptionTier, isFoundingMember, isLoading } = useFeatureAccess();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || isFoundingMember || dismissed) {
    return null;
  }

  if (subscriptionTier !== 'free') {
    return null;
  }

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg bg-primary/[0.06] dark:bg-primary/[0.12] border border-primary/15 px-3.5 py-2.5 mb-3"
      data-testid="dashboard-upgrade-card"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/10 flex-shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <p className="text-sm text-foreground truncate">
          <span className="font-medium">Try Pro free for 7 days</span>
          <span className="text-muted-foreground hidden sm:inline"> — unlimited jobs, AI quoting & more</span>
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Link href="/subscription">
          <Button size="sm" variant="default" className="h-7 text-xs px-3">
            Start trial
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-md text-muted-foreground hover-elevate"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
