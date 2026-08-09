import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  Wallet,
  Clock,
  ArrowUpRight,
  Building2,
  CreditCard,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Shield,
  AlertTriangle
} from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ConnectAccountStatus {
  connected: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  requirementsCurrentlyDue?: string[];
  balance?: {
    available: number;
    pending: number;
  };
  error?: string;
}

export default function PayoutsDashboard() {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: connectStatus, isLoading, refetch } = useQuery<ConnectAccountStatus>({
    queryKey: ['/api/stripe-connect/status'],
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      setIsConnecting(true);
      const res = await apiRequest("POST", "/api/stripe-connect/create-account");
      return res.json();
    },
    onSuccess: (data: { onboardingUrl?: string; error?: string }) => {
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to start onboarding",
          variant: "destructive",
        });
      }
      setIsConnecting(false);
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Could not connect to Stripe",
        variant: "destructive",
      });
      setIsConnecting(false);
    },
  });

  const dashboardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/stripe-connect/dashboard");
      return res.json();
    },
    onSuccess: (data: { url?: string }) => {
      if (data.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Could not open dashboard",
        variant: "destructive",
      });
    },
  });

  const onboardingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe-connect/onboarding-link");
      return res.json();
    },
    onSuccess: (data: { url?: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Could not continue onboarding",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <PageShell>
        <div className="p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Payouts</h1>
              <p className="text-muted-foreground">Manage your payment account and view earnings</p>
            </div>
          </div>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </PageShell>
    );
  }

  const isFullySetup = connectStatus?.connected && connectStatus?.chargesEnabled && connectStatus?.payoutsEnabled;
  const needsOnboarding = connectStatus?.connected && !connectStatus?.detailsSubmitted;
  const pendingVerification = connectStatus?.connected && connectStatus?.detailsSubmitted && !isFullySetup;

  return (
    <PageShell>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Payouts</h1>
            <p className="text-muted-foreground">Manage your payment account and view earnings</p>
          </div>
          {isFullySetup && (
            <Button
              variant="outline"
              onClick={() => dashboardMutation.mutate()}
              disabled={dashboardMutation.isPending}
              data-testid="button-open-stripe-dashboard"
            >
              {dashboardMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Stripe Dashboard
            </Button>
          )}
        </div>

        {!connectStatus?.connected ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-6 py-8">
                <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--trade)/0.1)' }}>
                  <Wallet className="h-10 w-10" style={{ color: 'hsl(var(--trade))' }} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Accept Online Payments</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Connect your bank account to accept card payments from clients and receive payouts directly to your account.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                    <CreditCard className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Accept Cards</p>
                      <p className="text-xs text-muted-foreground">Visa, Mastercard, Amex</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                    <Clock className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Fast Payouts</p>
                      <p className="text-xs text-muted-foreground">2-3 business days</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                    <Shield className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Secure</p>
                      <p className="text-xs text-muted-foreground">Powered by Stripe</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    size="lg"
                    onClick={() => connectMutation.mutate()}
                    disabled={isConnecting || connectMutation.isPending}
                    style={{ backgroundColor: 'hsl(var(--trade))', borderColor: 'hsl(var(--trade-border))' }}
                    data-testid="button-connect-stripe"
                  >
                    {isConnecting || connectMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="h-4 w-4 mr-2" />
                        Connect with Stripe
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-3">
                    You'll be redirected to Stripe to complete setup
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : needsOnboarding || pendingVerification ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-6 py-8">
                <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
                  <AlertTriangle className="h-10 w-10 text-amber-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Complete Your Setup</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {needsOnboarding 
                      ? "You need to complete your Stripe account setup to start accepting payments."
                      : "Your account is being verified by Stripe. This usually takes 1-2 business days."}
                  </p>
                </div>

                {connectStatus?.requirementsCurrentlyDue && connectStatus.requirementsCurrentlyDue.length > 0 && (
                  <div className="max-w-md mx-auto text-left bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                    <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">Required Information:</p>
                    <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                      {connectStatus.requirementsCurrentlyDue.slice(0, 5).map((req, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <ChevronRight className="h-3 w-3" />
                          {req.replace(/_/g, ' ').replace(/\./g, ' > ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-4">
                  <Button
                    size="lg"
                    onClick={() => onboardingMutation.mutate()}
                    disabled={onboardingMutation.isPending}
                    style={{ backgroundColor: 'hsl(var(--trade))', borderColor: 'hsl(var(--trade-border))' }}
                    data-testid="button-continue-onboarding"
                  >
                    {onboardingMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="h-4 w-4 mr-2" />
                        Continue Setup
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
              <span>Stripe account active</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="ml-auto"
                data-testid="button-refresh-balance"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Available Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" style={{ color: 'hsl(var(--success))' }}>
                    {formatCurrency(connectStatus?.balance?.available || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Ready to pay out</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Pending Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-muted-foreground">
                    {formatCurrency(connectStatus?.balance?.pending || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Processing (2-3 days)</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Account Status
                </CardTitle>
                <CardDescription>Your Stripe Connect account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${connectStatus?.chargesEnabled ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {connectStatus?.chargesEnabled ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">Card Payments</p>
                      <p className="text-xs text-muted-foreground">
                        {connectStatus?.chargesEnabled ? 'Enabled' : 'Not enabled'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${connectStatus?.payoutsEnabled ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {connectStatus?.payoutsEnabled ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">Payouts</p>
                      <p className="text-xs text-muted-foreground">
                        {connectStatus?.payoutsEnabled ? 'Enabled' : 'Not enabled'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${connectStatus?.detailsSubmitted ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                      {connectStatus?.detailsSubmitted ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">Verification</p>
                      <p className="text-xs text-muted-foreground">
                        {connectStatus?.detailsSubmitted ? 'Complete' : 'Pending'}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => dashboardMutation.mutate()}
                    disabled={dashboardMutation.isPending}
                    data-testid="button-manage-account"
                  >
                    {dashboardMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Building2 className="h-4 w-4 mr-2" />
                    )}
                    Manage Account
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => dashboardMutation.mutate()}
                    disabled={dashboardMutation.isPending}
                    data-testid="button-view-payouts"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    View All Payouts
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="py-6">
                <div className="text-center text-muted-foreground">
                  <p className="text-sm">
                    Payouts are automatically deposited to your bank account every 2-3 business days.
                  </p>
                  <p className="text-sm mt-1">
                    Platform fee: <strong>2.5%</strong> per transaction
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PageShell>
  );
}
