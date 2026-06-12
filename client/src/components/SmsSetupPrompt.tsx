import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  ExternalLink, 
  Settings, 
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Phone
} from "lucide-react";
import { Link } from "wouter";

interface SmsStatus {
  configured: boolean;
  connected: boolean;
  hasPhoneNumber: boolean;
  enabled: boolean;
  phoneNumber: string | null;
  setupRequired: boolean;
  setupInstructions: {
    title: string;
    description: string;
    steps: string[];
    settingsPath: string;
    learnMoreUrl: string;
  } | null;
}

interface SmsSetupPromptProps {
  variant?: "inline" | "card" | "banner";
  showWhenConfigured?: boolean;
  onSetupClick?: () => void;
}

export function useSmsStatus() {
  return useQuery<SmsStatus>({
    queryKey: ['/api/sms/status'],
    staleTime: 60000,
  });
}

export function SmsSetupPrompt({ 
  variant = "inline", 
  showWhenConfigured = false,
  onSetupClick 
}: SmsSetupPromptProps) {
  const { data: smsStatus } = useSmsStatus();
  const instructions = smsStatus?.setupInstructions;
  return null;

  if (variant === "banner") {
    return (
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            SMS not configured
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            {instructions?.description || "Connect your Twilio account to send SMS messages to clients."}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Link href="/integrations#twilio">
              <Button 
                size="sm" 
                variant="outline" 
                className="gap-1"
                onClick={onSetupClick}
              >
                <Settings className="h-4 w-4" />
                Set Up Twilio
              </Button>
            </Link>
            <a 
              href={instructions?.learnMoreUrl || "https://www.twilio.com/try-twilio"} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="ghost" className="gap-1 text-amber-700 dark:text-amber-300">
                Learn more
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                <MessageSquare className="h-5 w-5 text-amber-600" />
              </div>
              <CardTitle className="text-base">Set Up SMS Messaging</CardTitle>
            </div>
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
              Not Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground mb-4">
            {instructions?.description || "Connect your own Twilio account to send SMS messages, payment links, and reminders directly to your clients' phones."}
          </p>
          
          {instructions?.steps && (
            <div className="space-y-2 mb-4">
              <p className="text-sm font-medium">Quick Setup:</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                {instructions?.steps?.map((step: string, i: number) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Link href="/integrations#twilio">
              <Button size="sm" className="gap-1" onClick={onSetupClick}>
                <Settings className="h-4 w-4" />
                Connect Twilio
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a 
              href={instructions?.learnMoreUrl || "https://www.twilio.com/try-twilio"} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline" className="gap-1">
                Get Free Account
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
      <div className="text-sm flex-1">
        <p className="font-medium text-amber-800 dark:text-amber-200">SMS not configured</p>
        <p className="text-amber-700 dark:text-amber-300">
          You can copy the message or open your SMS app.{" "}
          <Link href="/integrations#twilio" className="underline font-medium" onClick={onSetupClick}>
            Connect Twilio
          </Link>{" "}
          to send in-app SMS.
        </p>
      </div>
    </div>
  );
}

export function SmsConnectedBadge() {
  const { data: smsStatus } = useSmsStatus();

  if (!smsStatus?.connected) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
      <CheckCircle className="h-4 w-4" />
      <span>SMS Connected</span>
      {smsStatus.phoneNumber && (
        <span className="text-muted-foreground">({smsStatus.phoneNumber})</span>
      )}
    </div>
  );
}
