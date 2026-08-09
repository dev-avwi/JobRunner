import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Banknote,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ConnectStatus {
  connected: boolean;
  stripeAvailable: boolean;
  connectEnabled?: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  message: string;
}

export function StripeConnectIntegration() {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: connectStatus, isLoading, refetch } = useQuery<ConnectStatus>({
    queryKey: ["/api/stripe-connect/status"],
  });

  const [connectNotEnabled, setConnectNotEnabled] = useState(false);
  
  const createAccount = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/stripe-connect/create-account");
    },
    onSuccess: async (data: any) => {
      // Check if this is the "Connect not enabled" response (now returns 200 with flag)
      if (data.connectNotEnabled) {
        setIsConnecting(false);
        setConnectNotEnabled(true);
        toast({
          title: "Coming Soon",
          description: "Online payments are being set up and will be available shortly!",
        });
        return;
      }
      await getAccountLink.mutateAsync();
    },
    onError: (error: any) => {
      setIsConnecting(false);
      
      // Check if this is the "Connect not enabled" error (fallback)
      if (error.message?.includes("coming soon") || error.connectNotEnabled) {
        setConnectNotEnabled(true);
        toast({
          title: "Coming Soon",
          description: "Online payments are being set up and will be available shortly!",
        });
        return;
      }
      
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to create Stripe account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getAccountLink = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/stripe-connect/account-link", { type: "account_onboarding" });
    },
    onSuccess: (data: { url: string }) => {
      setIsConnecting(false);
      window.open(data.url, "_blank");
      toast({
        title: "Stripe Setup",
        description: "Complete your Stripe account setup in the new tab. Return here when done.",
      });
    },
    onError: (error: any) => {
      setIsConnecting(false);
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to open Stripe setup. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getDashboardLink = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/stripe-connect/dashboard-link");
      if (!response.ok) throw new Error("Failed to get dashboard link");
      return response.json();
    },
    onSuccess: (data: { url: string }) => {
      window.open(data.url, "_blank");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open Stripe dashboard.",
        variant: "destructive",
      });
    },
  });

  const handleConnect = async () => {
    setIsConnecting(true);
    if (connectStatus?.accountId) {
      await getAccountLink.mutateAsync();
    } else {
      await createAccount.mutateAsync();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isReady = connectStatus?.chargesEnabled && connectStatus?.payoutsEnabled;
  const needsSetup = connectStatus?.stripeAvailable && !isReady;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Banknote className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Accept Online Payments</CardTitle>
              <p className="text-sm text-muted-foreground">
                Let customers pay invoices with their credit card
              </p>
            </div>
          </div>
          {isReady ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
              <CheckCircle className="h-3 w-3 mr-1" />
              Ready
            </Badge>
          ) : needsSetup ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">
              <AlertCircle className="h-3 w-3 mr-1" />
              Setup Required
            </Badge>
          ) : (
            <Badge variant="outline">Not Available</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connectStatus?.stripeAvailable ? (
          <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
            <p>Payment processing is not configured for this platform. Contact support for assistance.</p>
          </div>
        ) : connectNotEnabled ? (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-100">Coming Soon!</p>
                <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                  Online payments are being set up for the JobRunner platform. 
                  This feature will be available soon and will let your customers pay invoices with their credit card.
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-300 mt-2">
                  In the meantime, you can continue using bank transfers or cash payments.
                </p>
              </div>
            </div>
          </div>
        ) : isReady ? (
          <>
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-100">Online Payments Active</p>
                  <p className="text-sm text-green-700 dark:text-green-200 mt-1">
                    Your customers can pay invoices online with card payments. 
                    When you enable online payment on an invoice, customers will receive a payment link.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => getDashboardLink.mutate()}
                disabled={getDashboardLink.isPending}
                data-testid="button-stripe-dashboard"
              >
                {getDashboardLink.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                View Stripe Dashboard
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => refetch()}
                data-testid="button-refresh-status"
              >
                Refresh Status
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Platform fee: 2.5% per transaction (min $0.50)</p>
              <p>Plus standard Stripe processing fees apply</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <p className="text-sm">
                Connect your bank account to accept credit card payments from customers. 
                Payments go directly to your bank account.
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Customers can pay invoices online
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Funds deposited to your bank account
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Automatic invoice status updates
                </li>
              </ul>
            </div>
            <Button 
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full sm:w-auto"
              data-testid="button-connect-stripe"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Setting up...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  {connectStatus?.accountId ? "Complete Setup" : "Connect Bank Account"}
                </>
              )}
            </Button>
            {connectStatus?.detailsSubmitted && !connectStatus?.chargesEnabled && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Your account is under review. This usually takes 1-2 business days.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
