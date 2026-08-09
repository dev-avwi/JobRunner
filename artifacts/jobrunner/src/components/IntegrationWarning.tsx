import { AlertTriangle, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "wouter";
import { useState } from "react";

interface IntegrationWarningProps {
  type: 'twilio' | 'stripe' | 'sendgrid' | 'email';
  variant?: 'banner' | 'inline' | 'toast';
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const integrationInfo = {
  twilio: {
    title: "SMS Not Connected",
    description: "Connect Twilio to send SMS messages to clients. Without it, text messages won't be delivered.",
    action: "Connect Twilio",
    icon: "📱",
  },
  stripe: {
    title: "Payments Not Set Up",
    description: "Connect Stripe to accept card payments and collect deposits from clients.",
    action: "Set Up Payments",
    icon: "💳",
  },
  sendgrid: {
    title: "Email Not Connected",
    description: "Connect SendGrid to send automatic emails. Quotes and invoices will use Gmail links instead.",
    action: "Connect Email",
    icon: "📧",
  },
  email: {
    title: "Email Delivery Limited",
    description: "Email automation is in demo mode. Connect SendGrid to send emails automatically.",
    action: "Set Up Email",
    icon: "✉️",
  },
};

export function IntegrationWarning({ 
  type, 
  variant = 'inline',
  dismissible = false,
  onDismiss,
  className = ""
}: IntegrationWarningProps) {
  const [dismissed, setDismissed] = useState(false);
  const info = integrationInfo[type];

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (variant === 'banner') {
    return (
      <div 
        className={`bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-3 ${className}`}
        data-testid={`banner-warning-${type}`}
      >
        <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-amber-800 dark:text-amber-200 text-sm">
                {info.title}
              </p>
              <p className="text-amber-700 dark:text-amber-300 text-sm mt-0.5">
                {info.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href="/integrations">
              <Button 
                size="sm" 
                variant="outline"
                className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover-elevate"
                data-testid={`button-setup-${type}`}
              >
                <Settings className="h-4 w-4 mr-1" />
                {info.action}
              </Button>
            </Link>
            {dismissible && (
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={handleDismiss}
                className="h-8 w-8 text-amber-600 dark:text-amber-400"
                data-testid={`button-dismiss-${type}-warning`}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <Alert 
        variant="destructive" 
        className={`bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 ${className}`}
        data-testid={`alert-warning-${type}`}
      >
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">{info.title}</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300">
          <span>{info.description}</span>
          <Link href="/integrations">
            <Button 
              size="sm" 
              variant="link" 
              className="p-0 h-auto ml-2 text-amber-700 dark:text-amber-300 underline"
              data-testid={`link-setup-${type}`}
            >
              {info.action} →
            </Button>
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

export function TwilioWarning({ className, compact = false }: { className?: string; compact?: boolean }) {
  return null;
}

export function StripeWarning({ className }: { className?: string }) {
  return <IntegrationWarning type="stripe" variant="inline" className={className} />;
}

export function SendGridWarning({ className }: { className?: string }) {
  return <IntegrationWarning type="sendgrid" variant="inline" className={className} />;
}
