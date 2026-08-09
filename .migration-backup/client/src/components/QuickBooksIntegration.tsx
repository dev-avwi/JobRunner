import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CheckCircle2,
  RefreshCw,
  Shield,
  Clock,
  HelpCircle,
  ArrowRight,
  FileText,
  Users,
  Calculator,
  Lock,
  Zap,
  XCircle,
  Loader2
} from "lucide-react";

interface QuickBooksIntegrationProps {
  isConnected: boolean;
  isConfigured: boolean;
  companyName?: string;
  lastSyncAt?: Date | string;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
  isConnecting: boolean;
  isSyncing: boolean;
  syncError?: string;
}

export default function QuickBooksIntegration({
  isConnected,
  isConfigured,
  companyName,
  lastSyncAt,
  onConnect,
  onDisconnect,
  onSync,
  isConnecting,
  isSyncing,
  syncError
}: QuickBooksIntegrationProps) {
  const [expandedSection, setExpandedSection] = useState<string | undefined>();

  const steps = [
    {
      id: "why",
      title: "Why Connect QuickBooks",
      description: "Sync invoices & contacts automatically",
      completed: true,
      icon: <Zap className="w-4 h-4" />
    },
    {
      id: "connect",
      title: "Click 'Connect to QuickBooks'",
      description: "One-click OAuth connection",
      completed: isConnected || isConfigured === false,
      icon: <Calculator className="w-4 h-4" />
    },
    {
      id: "login",
      title: "Log Into Your Intuit Account",
      description: "Use your existing QuickBooks credentials",
      completed: isConnected,
      icon: <Lock className="w-4 h-4" />
    },
    {
      id: "grant",
      title: "Grant JobRunner Access",
      description: "Authorize secure data sync",
      completed: isConnected,
      icon: <Shield className="w-4 h-4" />
    },
    {
      id: "ready",
      title: "You're Connected!",
      description: "Start syncing invoices & contacts",
      completed: isConnected,
      icon: <CheckCircle2 className="w-4 h-4" />
    }
  ];

  const completedSteps = steps.filter(s => s.completed).length;

  const formatLastSync = (date: Date | string | undefined) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleString();
  };

  return (
    <Card className="overflow-visible" data-testid="quickbooks-integration-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2CA01C] flex items-center justify-center">
              <span className="text-white font-bold text-lg">QB</span>
            </div>
            <div>
              <CardTitle className="text-lg">QuickBooks Online</CardTitle>
              <CardDescription>
                {isConnected && companyName 
                  ? `Connected to ${companyName}` 
                  : "Sync invoices and contacts with QuickBooks"}
              </CardDescription>
            </div>
          </div>
          {isConnected ? (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline">Not Connected</Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isConnected ? (
          <div className="space-y-4">
            {lastSyncAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Last synced: {formatLastSync(lastSyncAt)}</span>
              </div>
            )}

            {syncError && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                  <XCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Sync Error</span>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{syncError}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={onSync} 
                disabled={isSyncing}
                className="flex-1"
                data-testid="button-quickbooks-sync"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={onDisconnect}
                data-testid="button-quickbooks-disconnect"
              >
                Disconnect
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">What syncs:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                  <Users className="w-3 h-3 text-primary" />
                  <span>Clients → Customers</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                  <FileText className="w-3 h-3 text-primary" />
                  <span>Invoices → QuickBooks</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg border border-dashed">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Setup Guide</span>
              </div>
              <Badge variant="outline">
                {completedSteps}/{steps.length} Steps
              </Badge>
            </div>

            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Never manually enter invoices in QuickBooks again!
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <RefreshCw className="w-3 h-3" />
                  <span>Two-way sync</span>
                </div>
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <Calculator className="w-3 h-3" />
                  <span>Australian GST</span>
                </div>
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <FileText className="w-3 h-3" />
                  <span>Auto invoices</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">What syncs:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                  <Users className="w-3 h-3 text-primary" />
                  <span>Clients → Customers</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                  <FileText className="w-3 h-3 text-primary" />
                  <span>Invoices → QuickBooks</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {steps.map((step, index) => (
                <div 
                  key={step.id}
                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    step.completed 
                      ? 'bg-green-50 dark:bg-green-950/20' 
                      : index === completedSteps 
                        ? 'bg-primary/5 border border-primary/20' 
                        : 'bg-muted/30'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.completed 
                      ? 'bg-green-500 text-white' 
                      : index === completedSteps 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {step.completed ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <span className="text-xs font-medium">{index + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${step.completed ? 'text-green-700 dark:text-green-300' : ''}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                  {step.completed && (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>

            {isConfigured && (
              <Button
                onClick={onConnect}
                disabled={isConnecting}
                className="w-full bg-[#2CA01C] hover:bg-[#248017] text-white"
                data-testid="button-quickbooks-connect"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Connect to QuickBooks
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            )}

            {!isConfigured && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>API credentials required:</strong> QuickBooks integration needs to be configured by your administrator. 
                  The QuickBooks API credentials (Client ID & Secret) must be added to the system first.
                </p>
              </div>
            )}

            <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
              <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Your data is secure. JobRunner uses official Intuit OAuth2 integration. 
                We never see your QuickBooks password and you can disconnect anytime.
              </p>
            </div>

            <Accordion type="single" collapsible value={expandedSection} onValueChange={setExpandedSection}>
              <AccordionItem value="what-is-quickbooks" className="border-b-0">
                <AccordionTrigger className="text-sm py-2 hover:no-underline">
                  What is QuickBooks?
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground pb-3">
                  QuickBooks Online is one of the most popular cloud accounting software solutions, 
                  used by millions of businesses worldwide. It helps you manage invoices, expenses, 
                  payroll, and tax compliance. Connecting JobRunner to QuickBooks means your 
                  invoices and client details sync automatically, saving you hours of manual data entry.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="what-syncs" className="border-b-0">
                <AccordionTrigger className="text-sm py-2 hover:no-underline">
                  What data is synced?
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground pb-3">
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span><strong>Clients → Customers:</strong> Your JobRunner clients become QuickBooks customers</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span><strong>Invoices → QuickBooks:</strong> Send invoices from JobRunner, they appear in QuickBooks</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span><strong>Payments:</strong> When invoices are paid in QuickBooks, status syncs back</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span><strong>GST:</strong> Australian tax handling included</span>
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="how-long" className="border-b-0">
                <AccordionTrigger className="text-sm py-2 hover:no-underline">
                  How long does setup take?
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground pb-3">
                  <ul className="space-y-1.5">
                    <li className="flex items-start gap-2">
                      <Clock className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span><strong>Connection:</strong> Under 2 minutes - just click and authorize</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Clock className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span><strong>Initial sync:</strong> A few seconds for contacts and settings</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <RefreshCw className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span><strong>Ongoing:</strong> Manual sync with one-click button</span>
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="security" className="border-b-0">
                <AccordionTrigger className="text-sm py-2 hover:no-underline">
                  Is my data secure?
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground pb-3">
                  Yes. We use Intuit's official OAuth2 integration which means:
                  <ul className="space-y-1.5 mt-2">
                    <li className="flex items-start gap-2">
                      <Shield className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>We never see or store your QuickBooks password</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Shield className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>You authorize exactly what permissions we have</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Shield className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>All data is encrypted in transit and at rest</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Shield className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>You can revoke access anytime from QuickBooks or here</span>
                    </li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground text-center">
                Need help? Check{" "}
                <a 
                  href="https://quickbooks.intuit.com/learn-support/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  QuickBooks Support
                </a>{" "}
                or contact support.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
