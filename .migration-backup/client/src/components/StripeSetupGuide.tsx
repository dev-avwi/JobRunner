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
  Circle,
  CreditCard,
  Building2,
  BanknoteIcon,
  Shield,
  Clock,
  HelpCircle,
  ExternalLink,
  ArrowRight,
  Smartphone,
  Mail,
  AlertTriangle,
  Info
} from "lucide-react";

interface StripeSetupGuideProps {
  isConnected: boolean;
  isPartiallyConnected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onConnect: () => void;
  onOpenDashboard: () => void;
  isConnecting: boolean;
}

export default function StripeSetupGuide({
  isConnected,
  isPartiallyConnected,
  chargesEnabled,
  payoutsEnabled,
  onConnect,
  onOpenDashboard,
  isConnecting
}: StripeSetupGuideProps) {
  const [expandedSection, setExpandedSection] = useState<string | undefined>();

  const steps = [
    {
      id: "connect",
      title: "Connect Your Account",
      description: "Link your business to Stripe Express",
      completed: isPartiallyConnected || isConnected,
      icon: <CreditCard className="w-4 h-4" />
    },
    {
      id: "verify",
      title: "Verify Your Identity",
      description: "Confirm your business details with Stripe",
      completed: chargesEnabled,
      icon: <Shield className="w-4 h-4" />
    },
    {
      id: "bank",
      title: "Add Bank Account",
      description: "Where you'll receive your payments",
      completed: payoutsEnabled,
      icon: <Building2 className="w-4 h-4" />
    },
    {
      id: "ready",
      title: "Start Collecting Payments",
      description: "You're all set to get paid online",
      completed: isConnected,
      icon: <BanknoteIcon className="w-4 h-4" />
    }
  ];

  const completedSteps = steps.filter(s => s.completed).length;

  return (
    <div className="space-y-4" data-testid="stripe-setup-guide">
      {/* Guide Header */}
      <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg border border-dashed">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Setup Guide</span>
        </div>
        {isConnected ? (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Complete
          </Badge>
        ) : (
          <Badge variant="outline">
            {completedSteps}/{steps.length} Steps
          </Badge>
        )}
      </div>

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
      {!isConnected && (
        <Button
          onClick={isPartiallyConnected ? onOpenDashboard : onConnect}
          disabled={isConnecting}
          className="w-full"
          data-testid="button-stripe-setup-action"
        >
          {isConnecting ? (
            "Connecting..."
          ) : isPartiallyConnected ? (
            <>
              Complete Verification
              <ExternalLink className="w-4 h-4 ml-2" />
            </>
          ) : (
            <>
              Connect Stripe
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      )}

      {/* FAQ Accordion */}
      <Accordion type="single" collapsible value={expandedSection} onValueChange={setExpandedSection} data-testid="accordion-stripe-faq">
        <AccordionItem value="what-is-stripe" className="border-b-0">
          <AccordionTrigger className="text-sm py-2 hover:no-underline" data-testid="accordion-trigger-stripe-what-is">
            What is Stripe?
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground pb-3">
            Stripe is a trusted payment processor used by millions of businesses worldwide. 
            It securely handles card payments and deposits money directly into your bank account. 
            JobRunner uses Stripe Express, which means you get a simple setup process and 
            Stripe handles all the security and compliance.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="how-much" className="border-b-0">
          <AccordionTrigger className="text-sm py-2 hover:no-underline" data-testid="accordion-trigger-stripe-cost">
            How much does it cost?
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground pb-3">
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span><strong>No monthly fees</strong> - only pay when you receive payments</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span><strong>Transaction fee:</strong> 1.75% + 30c per successful payment</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span><strong>JobRunner fee:</strong> 2.5% platform fee on transactions</span>
              </li>
              <li className="flex items-start gap-2">
                <Info className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                <span>Example: $500 invoice = You receive ~$478 after all fees</span>
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="how-long" className="border-b-0">
          <AccordionTrigger className="text-sm py-2 hover:no-underline" data-testid="accordion-trigger-stripe-timing">
            How long until I receive payments?
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground pb-3">
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <Clock className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                <span><strong>Setup time:</strong> 5-10 minutes to connect</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                <span><strong>Verification:</strong> Usually instant, sometimes 1-2 days</span>
              </li>
              <li className="flex items-start gap-2">
                <BanknoteIcon className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span><strong>Payouts:</strong> 2-3 business days to your bank</span>
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="what-need" className="border-b-0">
          <AccordionTrigger className="text-sm py-2 hover:no-underline" data-testid="accordion-trigger-stripe-requirements">
            What do I need to connect?
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground pb-3">
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <Building2 className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span>Your ABN (Australian Business Number)</span>
              </li>
              <li className="flex items-start gap-2">
                <Smartphone className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span>Mobile phone for verification code</span>
              </li>
              <li className="flex items-start gap-2">
                <BanknoteIcon className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span>Bank account details (BSB & account number)</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span>Photo ID (driver's licence or passport)</span>
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="how-works" className="border-b-0">
          <AccordionTrigger className="text-sm py-2 hover:no-underline" data-testid="accordion-trigger-stripe-client-payments">
            How do my clients pay?
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground pb-3">
            <ol className="space-y-1.5 list-decimal list-inside">
              <li>You send an invoice with "Online Payment" enabled</li>
              <li>Client receives email with a "Pay Now" button</li>
              <li>They click it and pay securely via card</li>
              <li>You get notified instantly when paid</li>
              <li>Money arrives in your bank in 2-3 days</li>
            </ol>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Support Link */}
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground text-center">
          Need help? Check our{" "}
          <a 
            href="https://stripe.com/au/connect" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
            data-testid="link-stripe-connect-faq"
          >
            Stripe Connect FAQ
          </a>{" "}
          or contact support.
        </p>
      </div>
    </div>
  );
}
