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
  Calendar,
  Shield,
  Clock,
  HelpCircle,
  ArrowRight,
  MapPin,
  User,
  FileText,
  Lock,
  Zap,
  Bell
} from "lucide-react";

interface GoogleCalendarSetupGuideProps {
  isConnected: boolean;
  isConfigured: boolean;
  email?: string;
  onConnect: () => void;
  isConnecting: boolean;
}

export default function GoogleCalendarSetupGuide({
  isConnected,
  isConfigured,
  email,
  onConnect,
  isConnecting
}: GoogleCalendarSetupGuideProps) {
  const [expandedSection, setExpandedSection] = useState<string | undefined>();

  const steps = [
    {
      id: "why",
      title: "Why Connect Calendar",
      description: "See all jobs in your Google Calendar",
      completed: true,
      icon: <Zap className="w-4 h-4" />
    },
    {
      id: "connect",
      title: "Click 'Connect Calendar'",
      description: "One-click Google OAuth connection",
      completed: isConnected || isConfigured === false,
      icon: <Calendar className="w-4 h-4" />
    },
    {
      id: "login",
      title: "Sign In With Google",
      description: "Use your existing Google account",
      completed: isConnected,
      icon: <Lock className="w-4 h-4" />
    },
    {
      id: "grant",
      title: "Grant Calendar Access",
      description: "Authorize JobRunner to add events",
      completed: isConnected,
      icon: <Shield className="w-4 h-4" />
    },
    {
      id: "ready",
      title: "You're Connected!",
      description: "Jobs sync automatically to calendar",
      completed: isConnected,
      icon: <CheckCircle2 className="w-4 h-4" />
    }
  ];

  const completedSteps = steps.filter(s => s.completed).length;

  return (
    <div className="space-y-4" data-testid="google-calendar-setup-guide">
      {/* Guide Header */}
      <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg border border-dashed">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Setup Guide</span>
        </div>
        {isConnected ? (
          <Badge 
            className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
            data-testid="badge-google-calendar-status"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        ) : (
          <Badge variant="outline" data-testid="badge-google-calendar-status">
            {completedSteps}/{steps.length} Steps
          </Badge>
        )}
      </div>

      {/* Connected Email Display */}
      {isConnected && email && (
        <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm font-medium text-green-800 dark:text-green-200" data-testid="text-google-calendar-email">
            Connected to: {email}
          </p>
        </div>
      )}

      {/* Benefits Banner */}
      {!isConnected && (
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Never miss a job appointment again!
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs" data-testid="list-google-calendar-features">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Calendar className="w-3 h-3" />
              <span>Auto sync jobs</span>
            </div>
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Bell className="w-3 h-3" />
              <span>Smart reminders</span>
            </div>
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <MapPin className="w-3 h-3" />
              <span>Location details</span>
            </div>
          </div>
        </div>
      )}

      {/* Connected Features List */}
      {isConnected && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Features enabled:</p>
          <ul className="text-xs text-muted-foreground space-y-1.5" data-testid="list-google-calendar-features">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              Sync scheduled jobs to calendar
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              Automatic event reminders
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              View upcoming events
            </li>
          </ul>
        </div>
      )}

      {/* What Syncs */}
      {!isConnected && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">What syncs to calendar:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
              <FileText className="w-3 h-3 text-primary" />
              <span>Job title & time</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
              <User className="w-3 h-3 text-primary" />
              <span>Client details</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
              <MapPin className="w-3 h-3 text-primary" />
              <span>Job address</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
              <Bell className="w-3 h-3 text-primary" />
              <span>Auto reminders</span>
            </div>
          </div>
        </div>
      )}

      {/* Progress Steps */}
      {!isConnected && (
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
      )}

      {/* Action Button */}
      {!isConnected && isConfigured && (
        <Button
          onClick={onConnect}
          disabled={isConnecting}
          className="w-full"
          data-testid="button-google-calendar-connect"
        >
          {isConnecting ? (
            "Connecting..."
          ) : (
            <>
              <Calendar className="w-4 h-4 mr-2" />
              Connect Google Calendar
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      )}

      {/* Not Configured Message */}
      {!isConfigured && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>API credentials required:</strong> Google Calendar integration needs to be configured by your administrator. 
            The Google API credentials (Client ID & Secret) must be added to the system first.
          </p>
        </div>
      )}

      {/* Security Note */}
      {!isConnected && (
        <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
          <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Your data is secure. JobRunner uses official Google OAuth2 integration. 
            We never see your Google password and you can disconnect anytime.
          </p>
        </div>
      )}

      {/* FAQ Accordion */}
      <Accordion type="single" collapsible value={expandedSection} onValueChange={setExpandedSection} data-testid="accordion-google-calendar-faq">
        <AccordionItem value="what-is-calendar" className="border-b-0">
          <AccordionTrigger className="text-sm py-2 hover:no-underline" data-testid="accordion-trigger-google-calendar-what-is">
            What is Google Calendar integration?
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground pb-3">
            Google Calendar integration allows JobRunner to automatically sync your scheduled jobs 
            to your Google Calendar. This means all your job appointments appear alongside your personal 
            events, making it easy to see your complete schedule at a glance. You'll get reminders 
            before each job, helping you stay organized and never miss an appointment.
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="what-syncs" className="border-b-0">
          <AccordionTrigger className="text-sm py-2 hover:no-underline" data-testid="accordion-trigger-google-calendar-syncs">
            What data is synced to the calendar?
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground pb-3">
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span><strong>Job title:</strong> The name of the job appears as the event title</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span><strong>Client name:</strong> Who the job is for</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span><strong>Job address:</strong> Location appears in the event, with map links</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span><strong>Scheduled time:</strong> Start and end times for the job</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span><strong>Job notes:</strong> Any notes are included in the event description</span>
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="how-long" className="border-b-0">
          <AccordionTrigger className="text-sm py-2 hover:no-underline" data-testid="accordion-trigger-google-calendar-setup-time">
            How long does setup take?
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground pb-3">
            <ul className="space-y-1.5">
              <li className="flex items-start gap-2">
                <Clock className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                <span><strong>Connection:</strong> Less than 1 minute - just click and authorize</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                <span><strong>Initial sync:</strong> Existing scheduled jobs sync within seconds</span>
              </li>
              <li className="flex items-start gap-2">
                <Calendar className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span><strong>Ongoing:</strong> New jobs automatically sync when scheduled</span>
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="disconnect" className="border-b-0">
          <AccordionTrigger className="text-sm py-2 hover:no-underline" data-testid="accordion-trigger-google-calendar-disconnect">
            How do I disconnect?
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground pb-3">
            You can disconnect Google Calendar at any time by clicking the disconnect button 
            on this integrations page. When you disconnect:
            <ul className="space-y-1.5 mt-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Existing calendar events remain in your Google Calendar</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>No new jobs will sync until you reconnect</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>You can reconnect anytime with one click</span>
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
            href="https://support.google.com/calendar" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
            data-testid="link-google-calendar-support"
          >
            Google Calendar Help
          </a>{" "}
          or contact support.
        </p>
      </div>
    </div>
  );
}
