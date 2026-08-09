import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  AlertCircle,
  CreditCard,
  Mail,
  MessageSquare,
  ArrowRight,
  Shield,
  Loader2,
  Sparkles
} from "lucide-react";

interface ServiceReadinessWidgetProps {
  onNavigate?: (path: string) => void;
  compact?: boolean;
}

interface ServiceHealth {
  name: string;
  status: 'ready' | 'demo' | 'error';
  provider: string;
  managed: boolean;
  verified: boolean;
  error: string | null;
  description: string;
}

interface HealthStatus {
  allReady: boolean;
  servicesReady: boolean;
  message: string;
  services: {
    payments: ServiceHealth;
    email: ServiceHealth;
    sms: ServiceHealth;
  };
  checkedAt: string;
}

export default function ServiceReadinessWidget({ 
  onNavigate,
  compact = false 
}: ServiceReadinessWidgetProps) {
  const { data: health, isLoading } = useQuery<HealthStatus>({
    queryKey: ['/api/integrations/health'],
  });
  
  const { data: subscriptionStatus } = useQuery({
    queryKey: ['/api/subscription/status'],
  });

  const { data: usageLimits } = useQuery({
    queryKey: ['/api/subscription/limits'],
  });

  if (isLoading) {
    return (
      <Card data-testid="service-readiness-loading">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Checking services...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const allReady = health?.allReady ?? false;
  const payments = health?.services?.payments;
  const email = health?.services?.email;
  const sms = health?.services?.sms;
  
  const servicesCount = [payments, email, sms].filter(s => s?.status === 'ready').length;
  const totalServices = 3;
  
  const subscription = subscriptionStatus as any;
  const limits = usageLimits as any;
  const isPro = subscription?.hasActiveSubscription || subscription?.plan === 'pro';
  const isTrialing = subscription?.isTrialing;

  const getStatusIcon = (status?: string) => {
    if (status === 'ready') return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    if (status === 'error') return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />;
    return <Shield className="h-3.5 w-3.5 text-blue-500" />;
  };

  const getStatusText = (status?: string) => {
    if (status === 'ready') return 'Live';
    if (status === 'error') return 'Issue';
    return 'Demo';
  };

  if (compact) {
    return (
      <Card 
        className="hover-elevate cursor-pointer" 
        onClick={() => onNavigate?.('/integrations')}
        data-testid="service-readiness-compact"
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                allReady ? 'bg-green-100 dark:bg-green-900/50' : 'bg-blue-100 dark:bg-blue-900/50'
              }`}>
                {allReady ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Shield className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {allReady ? 'All Services Ready' : 'Demo Mode'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {servicesCount}/{totalServices} services active
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="service-readiness-widget">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              allReady ? 'bg-green-100 dark:bg-green-900/50' : 'bg-blue-100 dark:bg-blue-900/50'
            }`}>
              {allReady ? (
                <Sparkles className="h-5 w-5 text-green-600" />
              ) : (
                <Shield className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold">
                {allReady ? 'Ready for Business' : 'System Status'}
              </p>
              <p className="text-xs text-muted-foreground">
                {allReady 
                  ? 'All systems verified and working' 
                  : 'Explore features in demo mode'}
              </p>
            </div>
          </div>
          {isPro ? (
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
              <Sparkles className="h-3 w-3 mr-1" />
              Pro
            </Badge>
          ) : isTrialing ? (
            <Badge variant="outline" className="border-amber-400 text-amber-600">
              Trial
            </Badge>
          ) : (
            <Badge variant="secondary">Free</Badge>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div 
            className="flex flex-col items-center p-2 rounded-lg bg-muted/30 cursor-pointer hover-elevate"
            onClick={() => onNavigate?.('/integrations')}
            data-testid="service-payments"
          >
            <div className="flex items-center gap-1 mb-1">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              {getStatusIcon(payments?.status)}
            </div>
            <span className="text-[10px] text-muted-foreground">Payments</span>
            <span className="text-[10px] font-medium">{getStatusText(payments?.status)}</span>
          </div>
          
          <div 
            className="flex flex-col items-center p-2 rounded-lg bg-muted/30 cursor-pointer hover-elevate"
            onClick={() => onNavigate?.('/integrations')}
            data-testid="service-email"
          >
            <div className="flex items-center gap-1 mb-1">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {getStatusIcon(email?.status)}
            </div>
            <span className="text-[10px] text-muted-foreground">Email</span>
            <span className="text-[10px] font-medium">{getStatusText(email?.status)}</span>
          </div>
          
          <div 
            className="flex flex-col items-center p-2 rounded-lg bg-muted/30 cursor-pointer hover-elevate"
            onClick={() => onNavigate?.('/integrations')}
            data-testid="service-sms"
          >
            <div className="flex items-center gap-1 mb-1">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              {getStatusIcon(sms?.status)}
            </div>
            <span className="text-[10px] text-muted-foreground">SMS</span>
            <span className="text-[10px] font-medium">{getStatusText(sms?.status)}</span>
          </div>
        </div>

        {!isPro && limits && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Usage This Month</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                onClick={() => onNavigate?.('/settings?tab=billing')}
                data-testid="button-upgrade"
              >
                Upgrade
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span>Quotes</span>
                <span className="text-muted-foreground">
                  {limits.quotesUsed || 0}/{limits.quotesLimit || 10}
                </span>
              </div>
              <Progress 
                value={((limits.quotesUsed || 0) / (limits.quotesLimit || 10)) * 100} 
                className="h-1.5" 
              />
            </div>
            
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span>Invoices</span>
                <span className="text-muted-foreground">
                  {limits.invoicesUsed || 0}/{limits.invoicesLimit || 5}
                </span>
              </div>
              <Progress 
                value={((limits.invoicesUsed || 0) / (limits.invoicesLimit || 5)) * 100} 
                className="h-1.5" 
              />
            </div>
            
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span>Jobs</span>
                <span className="text-muted-foreground">
                  {limits.jobsUsed || 0}/{limits.jobsLimit || 5}
                </span>
              </div>
              <Progress 
                value={((limits.jobsUsed || 0) / (limits.jobsLimit || 5)) * 100} 
                className="h-1.5" 
              />
            </div>
          </div>
        )}

        {!allReady && (
          <div className="pt-2 border-t space-y-2">
            <p className="text-xs text-muted-foreground">
              <Shield className="h-3 w-3 inline mr-1" />
              <strong>No setup required</strong> - We handle payments, email, and SMS for you
            </p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              You're in demo mode while testing. When you publish your app, real payments and notifications 
              activate automatically. Your clients won't see anything until you're ready.
            </p>
          </div>
        )}
        
        {!isPro && limits && (limits.quotesUsed >= limits.quotesLimit || limits.invoicesUsed >= limits.invoicesLimit || limits.jobsUsed >= limits.jobsLimit) && (
          <div className="pt-2 border-t">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2">
              <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
                You've reached your free plan limit
              </p>
              <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">
                Upgrade to Pro for unlimited quotes, invoices, and jobs - plus your own branding.
              </p>
              <Button 
                size="sm" 
                className="mt-2 w-full h-7 text-xs"
                onClick={() => onNavigate?.('/settings?tab=billing')}
              >
                Upgrade to Pro - $49.99/month
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
