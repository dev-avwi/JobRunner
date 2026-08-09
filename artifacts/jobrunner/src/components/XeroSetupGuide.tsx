import { useState } from "react";
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
  Zap
} from "lucide-react";
import { SiXero } from "react-icons/si";

interface XeroSetupGuideProps {
  isConnected: boolean;
  isConfigured: boolean;
  tenantName?: string;
  onConnect: () => void;
  isConnecting: boolean;
}

export default function XeroSetupGuide({
  isConnected,
  isConfigured,
  tenantName,
  onConnect,
  isConnecting
}: XeroSetupGuideProps) {
  const [expandedSection, setExpandedSection] = useState<string | undefined>();

  const steps = [
    {
      id: "why",
      title: "Why Connect Xero",
      description: "Sync invoices & contacts automatically",
      completed: true,
      icon: <Zap className="w-4 h-4" />
    },
    {
      id: "connect",
      title: "Click 'Connect to Xero'",
      description: "One-click OAuth connection",
      completed: isConnected || isConfigured === false,
      icon: <SiXero className="w-4 h-4" />
    },
    {
      id: "login",
      title: "Log Into Your Xero Account",
      description: "Use your existing Xero credentials",
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

  return (
    <div className="space-y-4" data-testid="xero-setup-guide">
      {/* Guide Header */}
      <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg border border-dashed">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Setup Guide</span>
        </div>
        {isConnected ? (
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

      {/* Benefits Banner */}
      {!isConnected && (
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Never manually enter invoices in Xero again!
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <RefreshCw className="w-3 h-3" />
              <span>Two-way sync</span>
            </div>
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Calculator className="w-3 h-3" />
              <span>Australian GST</span>
            </div>
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
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
              <span>Invoices → Xero</span>
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

      {/* Action Button */}
      {!isConnected && isConfigured && (
        <Button
          onClick={onConnect}
          disabled={isConnecting}
          className="w-full bg-[#13B5EA] hover:bg-[#0d9bc7] text-white"
          data-testid="button-xero-connect"
        >
          {isConnecting ? (
            "Connecting..."
          ) : (
            <>
              Connect to Xero
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      )}

      {/* Not Configured Message */}
      {!isConfigured && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>API credentials required:</strong> Xero integration needs to be configured by your administrator. 
            The Xero API credentials (Client ID & Secret) must be added to the system first.
          </p>
        </div>
      )}

      {/* Security Note */}
      {!isConnected && (
        <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
          <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Your data is secure. JobRunner uses official Xero OAuth2 integration. 
            We never see your Xero password and you can disconnect anytime.
          </p>
        </div>
      )}

      {/* FAQ Accordion */}
      <Accordion type="single" collapsible value={expandedSection} onValueChange={setExpandedSection} data-testid="accordion-xero-faq">
        <AccordionItem value="what-is-xero" className="border-b-0">
          <AccordionTrigger className="text-sm py-2 hover:no-underline" data-testid="accordion-trigger-xero-what-is">
            What is Xero?
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground pb-3">
            Xero is a popular cloud accounting software used by over 3 million businesses worldwide. 
            It helps you manage invoices, expenses, payroll, and tax compliance. 
            Connecting JobRunner to Xero means your invoices and client details sync automatically, 
            saving you hours of manual data entry.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="what-syncs" className="border-b-0">
          <AccordionTrigger className="text-sm py-2 hover:no-underline" data-testid="accordion-trigger-xero-syncs">
            What data is synced?
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground pb-3">
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span><strong>Clients ↔ Contacts:</strong> Two-way sync keeps details up to date</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span><strong>Invoices → Xero:</strong> Send invoices from JobRunner, they appear in Xero</span>
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

        <AccordionItem value="how-long" className="border-b-0">
          <AccordionTrigger className="text-sm py-2 hover:no-underline" data-testid="accordion-trigger-xero-setup-time">
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
                <span><strong>Ongoing:</strong> Automatic syncing in background</span>
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="disconnect" className="border-b-0">
          <AccordionTrigger className="text-sm py-2 hover:no-underline" data-testid="accordion-trigger-xero-disconnect">
            Can I disconnect later?
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground pb-3">
            Yes, absolutely! You can disconnect Xero at any time from this integrations page. 
            Your existing data in both JobRunner and Xero will remain - 
            only the automatic syncing will stop. You can reconnect whenever you like.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="security" className="border-b-0">
          <AccordionTrigger className="text-sm py-2 hover:no-underline" data-testid="accordion-trigger-xero-security">
            Is my data secure?
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground pb-3">
            Yes. We use Xero's official OAuth2 integration which means:
            <ul className="space-y-1.5 mt-2">
              <li className="flex items-start gap-2">
                <Shield className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>We never see or store your Xero password</span>
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
                <span>You can revoke access anytime from Xero or here</span>
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
            href="https://central.xero.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
            data-testid="link-xero-central"
          >
            Xero Central
          </a>{" "}
          or contact support.
        </p>
      </div>
    </div>
  );
}
