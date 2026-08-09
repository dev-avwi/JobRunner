import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  FolderOpen,
  Key,
  Info
} from "lucide-react";
import { SiMyob } from "react-icons/si";

interface MyobSetupGuideProps {
  isConnected: boolean;
  isConfigured: boolean;
  companyName?: string;
  cfCredentialsSet?: boolean;
  onConnect: () => void;
  isConnecting: boolean;
}

export default function MyobSetupGuide({
  isConnected,
  isConfigured,
  companyName,
  cfCredentialsSet,
  onConnect,
  isConnecting
}: MyobSetupGuideProps) {
  const [expandedSection, setExpandedSection] = useState<string | undefined>();

  const steps = [
    {
      id: "why",
      title: "Why Connect MYOB",
      description: "Sync invoices & contacts automatically",
      completed: true,
      icon: <Zap className="w-4 h-4" />
    },
    {
      id: "connect",
      title: "Click 'Connect to MYOB'",
      description: "One-click OAuth connection",
      completed: isConnected || isConfigured === false,
      icon: <SiMyob className="w-4 h-4" />
    },
    {
      id: "login",
      title: "Log Into Your MYOB Account",
      description: "Use your my.MYOB credentials",
      completed: isConnected,
      icon: <Lock className="w-4 h-4" />
    },
    {
      id: "company",
      title: "Select Your Company File",
      description: "Choose which business to connect",
      completed: isConnected && companyName,
      icon: <FolderOpen className="w-4 h-4" />
    },
    {
      id: "credentials",
      title: "Enter Company File Credentials",
      description: "If your file is password protected",
      completed: isConnected && cfCredentialsSet,
      icon: <Key className="w-4 h-4" />
    },
    {
      id: "ready",
      title: "You're Connected!",
      description: "Start syncing invoices & contacts",
      completed: isConnected && cfCredentialsSet,
      icon: <CheckCircle2 className="w-4 h-4" />
    }
  ];

  const completedSteps = steps.filter(s => s.completed).length;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
            MYOB Setup Guide
          </CardTitle>
          {isConnected && cfCredentialsSet ? (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline">
              {completedSteps}/{steps.length} Steps
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Benefits Banner */}
        {!isConnected && (
          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
              Never manually enter invoices in MYOB again!
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                <RefreshCw className="w-3 h-3" />
                <span>Auto sync</span>
              </div>
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                <Calculator className="w-3 h-3" />
                <span>Australian GST</span>
              </div>
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                <FileText className="w-3 h-3" />
                <span>Auto invoices</span>
              </div>
            </div>
          </div>
        )}

        {/* What Syncs */}
        {!isConnected && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">What syncs:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                <Users className="w-3 h-3 text-primary" />
                <span>Contacts ↔ Clients</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                <FileText className="w-3 h-3 text-primary" />
                <span>Invoices → MYOB</span>
              </div>
            </div>
          </div>
        )}

        {/* Progress Steps */}
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

        {/* Company File Credentials Note */}
        {!isConnected && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <p className="font-medium">About MYOB Company File Credentials</p>
              <p className="mt-1">
                If your MYOB company file is password protected, you'll need to enter those credentials 
                after connecting. These are different from your my.MYOB login - they're the username 
                and password you use to open the company file in MYOB.
              </p>
            </div>
          </div>
        )}

        {/* Action Button */}
        {!isConnected && isConfigured && (
          <Button
            onClick={onConnect}
            disabled={isConnecting}
            className="w-full bg-[#6B21A8] hover:bg-[#581c87] text-white"
            data-testid="button-myob-connect"
          >
            {isConnecting ? (
              "Connecting..."
            ) : (
              <>
                Connect to MYOB
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        )}

        {/* Not Configured Message */}
        {!isConfigured && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>API credentials required:</strong> MYOB integration needs to be configured by your administrator. 
              The MYOB API credentials (Client ID & Secret) must be added to the system first.
            </p>
          </div>
        )}

        {/* Security Note */}
        {!isConnected && (
          <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
            <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Your data is secure. JobRunner uses official MYOB OAuth2 integration. 
              We never see your MYOB password and you can disconnect anytime.
            </p>
          </div>
        )}

        {/* FAQ Accordion */}
        <Accordion type="single" collapsible value={expandedSection} onValueChange={setExpandedSection}>
          <AccordionItem value="what-is-myob" className="border-b-0">
            <AccordionTrigger className="text-sm py-2 hover:no-underline">
              What is MYOB?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground pb-3">
              MYOB (Mind Your Own Business) is one of Australia's most popular accounting software solutions, 
              used by hundreds of thousands of businesses. It helps you manage invoices, expenses, payroll, 
              and tax compliance. Connecting JobRunner to MYOB means your invoices and client details 
              sync automatically, saving you hours of manual data entry.
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
                  <span><strong>Clients ↔ Customers:</strong> Two-way sync keeps details up to date</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Invoices → MYOB:</strong> Send invoices from JobRunner, they appear in MYOB</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Payments:</strong> When invoices are paid, status syncs back</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span><strong>GST:</strong> Australian tax codes handled automatically</span>
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="company-file" className="border-b-0">
            <AccordionTrigger className="text-sm py-2 hover:no-underline">
              What are company file credentials?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground pb-3">
              MYOB company files can have their own username and password (separate from your my.MYOB account). 
              If your accountant or bookkeeper set up your MYOB file with a password, you'll need those credentials 
              to allow JobRunner to access your data. Common scenarios:
              <ul className="space-y-1.5 mt-2">
                <li className="flex items-start gap-2">
                  <Info className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span><strong>No password:</strong> Many files use "Administrator" with no password</span>
                </li>
                <li className="flex items-start gap-2">
                  <Info className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span><strong>With password:</strong> Enter the credentials you use in MYOB desktop</span>
                </li>
                <li className="flex items-start gap-2">
                  <Info className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Not sure?:</strong> Ask your accountant or check MYOB settings</span>
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
                  <span><strong>Connection:</strong> Under 3 minutes - click, authorize, select company</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Credentials:</strong> Additional minute if file is password protected</span>
                </li>
                <li className="flex items-start gap-2">
                  <RefreshCw className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Ongoing:</strong> Automatic syncing in background</span>
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="disconnect" className="border-b-0">
            <AccordionTrigger className="text-sm py-2 hover:no-underline">
              Can I disconnect later?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground pb-3">
              Yes, absolutely! You can disconnect MYOB at any time from this integrations page. 
              Your existing data in both JobRunner and MYOB will remain - 
              only the automatic syncing will stop. You can reconnect whenever you like.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="security" className="border-b-0">
            <AccordionTrigger className="text-sm py-2 hover:no-underline">
              Is my data secure?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground pb-3">
              Yes. We use MYOB's official OAuth2 integration which means:
              <ul className="space-y-1.5 mt-2">
                <li className="flex items-start gap-2">
                  <Shield className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>We never see or store your my.MYOB password</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Company file credentials are encrypted securely</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>All data is encrypted in transit and at rest</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>You can revoke access anytime from here</span>
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Support Link */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Need help? Check{" "}
            <a 
              href="https://help.myob.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              MYOB Help
            </a>{" "}
            or contact support.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
