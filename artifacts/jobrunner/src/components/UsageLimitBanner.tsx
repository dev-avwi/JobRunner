import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Briefcase, 
  FileText, 
  Users, 
  Zap, 
  ArrowRight,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { Link } from "wouter";

interface UsageInfo {
  jobs: { used: number; limit: number; remaining: number };
  invoices: { used: number; limit: number; remaining: number };
  quotes: { used: number; limit: number; remaining: number };
  clients: { used: number; limit: number; remaining: number };
  isUnlimited: boolean;
  subscriptionTier: string;
}

interface UsageLimitBannerProps {
  variant?: 'compact' | 'full';
  showUpgrade?: boolean;
}

export default function UsageLimitBanner({ variant = 'compact', showUpgrade = true }: UsageLimitBannerProps) {
  const { data: usage, isLoading } = useQuery<UsageInfo>({
    queryKey: ['/api/usage'],
  });

  if (isLoading || !usage) {
    return null;
  }

  if (usage.isUnlimited) {
    return null;
  }

  const getUsagePercent = (used: number, limit: number) => {
    if (limit === -1) return 0; // unlimited
    return Math.min(100, Math.round((used / limit) * 100));
  };

  const getUsageStatus = (used: number, limit: number) => {
    if (limit === -1) return 'unlimited';
    const percent = getUsagePercent(used, limit);
    if (percent >= 100) return 'exceeded';
    if (percent >= 80) return 'warning';
    return 'ok';
  };

  const jobsPercent = getUsagePercent(usage.jobs.used, usage.jobs.limit);
  const invoicesPercent = getUsagePercent(usage.invoices.used, usage.invoices.limit);
  const jobsStatus = getUsageStatus(usage.jobs.used, usage.jobs.limit);
  const invoicesStatus = getUsageStatus(usage.invoices.used, usage.invoices.limit);

  const hasWarning = jobsStatus === 'warning' || invoicesStatus === 'warning';
  const hasExceeded = jobsStatus === 'exceeded' || invoicesStatus === 'exceeded';

  if (variant === 'compact') {
    // Only show if there's a warning or exceeded status
    if (!hasWarning && !hasExceeded) {
      return null;
    }

    return (
      <div 
        className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${
          hasExceeded 
            ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' 
            : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
        }`}
        data-testid="usage-limit-banner"
      >
        {hasExceeded ? (
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        )}
        
        <span className={`text-sm ${hasExceeded ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
          {hasExceeded ? (
            <>Monthly limit reached. </>
          ) : (
            <>Running low on monthly usage. </>
          )}
          {usage.jobs.limit > 0 && (
            <span className="font-medium">{usage.jobs.remaining} jobs</span>
          )}
          {usage.invoices.limit > 0 && usage.jobs.limit > 0 && ', '}
          {usage.invoices.limit > 0 && (
            <span className="font-medium">{usage.invoices.remaining} invoices</span>
          )}
          {' remaining.'}
        </span>
        
        {showUpgrade && (
          <Link href="/billing">
            <Button size="sm" variant={hasExceeded ? "destructive" : "default"} data-testid="button-upgrade">
              Upgrade
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        )}
      </div>
    );
  }

  // Full variant - shows detailed usage
  return (
    <Card className="border-primary/20" data-testid="usage-limit-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Free Plan</Badge>
            <span className="text-sm text-muted-foreground">Resets monthly</span>
          </div>
          {showUpgrade && (
            <Link href="/billing">
              <Button size="sm" data-testid="button-upgrade-full">
                <Zap className="mr-1 h-3 w-3" />
                Upgrade to Pro
              </Button>
            </Link>
          )}
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <UsageItem
            icon={FileText}
            label="Quotes"
            used={usage.quotes.used}
            limit={usage.quotes.limit}
            status={getUsageStatus(usage.quotes.used, usage.quotes.limit)}
          />
          <UsageItem
            icon={Briefcase}
            label="Jobs"
            used={usage.jobs.used}
            limit={usage.jobs.limit}
            status={jobsStatus}
          />
          <UsageItem
            icon={FileText}
            label="Invoices"
            used={usage.invoices.used}
            limit={usage.invoices.limit}
            status={invoicesStatus}
          />
          <UsageItem
            icon={Users}
            label="Clients"
            used={usage.clients.used}
            limit={usage.clients.limit}
            status={getUsageStatus(usage.clients.used, usage.clients.limit)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function UsageItem({ 
  icon: Icon, 
  label, 
  used, 
  limit, 
  status 
}: { 
  icon: any; 
  label: string; 
  used: number; 
  limit: number; 
  status: 'ok' | 'warning' | 'exceeded' | 'unlimited';
}) {
  const percent = limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      
      {limit === -1 ? (
        <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="h-3 w-3" />
          Unlimited
        </div>
      ) : (
        <>
          <Progress 
            value={percent} 
            className={`h-2 ${
              status === 'exceeded' ? '[&>div]:bg-red-500' :
              status === 'warning' ? '[&>div]:bg-amber-500' : ''
            }`}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{used} / {limit}</span>
            <span className={
              status === 'exceeded' ? 'text-red-600 font-medium' :
              status === 'warning' ? 'text-amber-600 font-medium' : ''
            }>
              {limit - used} left
            </span>
          </div>
        </>
      )}
    </div>
  );
}
