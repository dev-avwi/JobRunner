import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Circle, 
  ChevronRight, 
  ChevronDown,
  CreditCard,
  Mail,
  Building2,
  Palette,
  Users,
  Smartphone,
  ExternalLink,
  Loader2,
  Clock,
  Sparkles,
  X,
  HelpCircle
} from "lucide-react";
import { SiStripe, SiGmail } from "react-icons/si";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StripeConnectStatus {
  connected: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  businessName?: string;
}

interface BusinessSettings {
  id: string;
  businessName?: string;
  abn?: string;
  contactEmail?: string;
  contactPhone?: string;
  logoUrl?: string;
  primaryColor?: string;
}

interface SetupChecklistProps {
  onNavigate?: (path: string) => void;
  compact?: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export default function SetupChecklist({ 
  onNavigate, 
  compact = false,
  dismissible = false,
  onDismiss 
}: SetupChecklistProps) {
  const { toast } = useToast();
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  
  const { data: health } = useQuery<any>({
    queryKey: ['/api/integrations/health'],
    staleTime: 30000,
  });
  
  const { data: businessSettings } = useQuery<BusinessSettings>({
    queryKey: ['/api/business-settings'],
    staleTime: 60000,
  });
  
  const { data: teamMembers } = useQuery<any[]>({
    queryKey: ['/api/team-members'],
    staleTime: 60000,
  });

  const connectStripeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/stripe-connect/onboard');
      return response;
    },
    onSuccess: (data: any) => {
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to start Stripe setup. Please try again.",
        variant: "destructive",
      });
    },
  });

  const stripeConnect = health?.stripeConnect as StripeConnectStatus | undefined;
  const stripeConnected = stripeConnect?.connected && stripeConnect?.chargesEnabled && stripeConnect?.payoutsEnabled;
  const stripePartiallyConnected = stripeConnect?.connected && (!stripeConnect?.chargesEnabled || !stripeConnect?.payoutsEnabled);
  
  const hasBusinessProfile = !!(businessSettings?.businessName && businessSettings?.abn);
  const hasBranding = !!(businessSettings?.logoUrl || businessSettings?.primaryColor);
  const hasTeam = (teamMembers?.length || 0) > 0;
  const emailReady = health?.services?.email?.status === 'ready';

  const steps = [
    {
      id: 'business',
      title: 'Add Your Business Details',
      description: 'Your business name, ABN, and contact info',
      icon: Building2,
      completed: hasBusinessProfile,
      timeEstimate: '2 mins',
      action: () => onNavigate?.('/settings?tab=business'),
      helpText: "This info appears on your quotes and invoices. You'll need your ABN (Australian Business Number).",
      steps: [
        "Go to Settings",
        "Fill in your business name and ABN",
        "Add your contact email and phone",
        "Add your business address"
      ]
    },
    {
      id: 'branding',
      title: 'Add Your Logo & Brand',
      description: 'Make quotes and invoices look professional',
      icon: Palette,
      completed: hasBranding,
      timeEstimate: '2 mins',
      action: () => onNavigate?.('/settings'),
      helpText: "Upload your logo and pick your brand colour. This makes your documents look professional and helps clients recognise your business.",
      steps: [
        "Go to Settings",
        "Click 'Upload Logo'",
        "Choose your brand colour",
        "Your logo will appear on all quotes and invoices"
      ]
    },
    {
      id: 'stripe',
      title: 'Set Up Online Payments',
      description: 'Get paid directly to your bank account',
      icon: CreditCard,
      completed: stripeConnected,
      inProgress: stripePartiallyConnected,
      timeEstimate: '5-10 mins',
      action: () => {
        if (stripeConnected) {
          onNavigate?.('/integrations');
        } else {
          connectStripeMutation.mutate();
        }
      },
      isPending: connectStripeMutation.isPending,
      helpText: "Connect Stripe to accept card payments online. Customers can pay invoices with one click, and money goes straight to your bank account (usually within 2-3 days).",
      requirements: [
        "Valid Australian bank account",
        "Photo ID (driver's licence or passport)",
        "About 5-10 minutes to complete verification"
      ],
      steps: [
        "Click 'Connect Stripe' to start",
        "You'll be taken to Stripe's secure website",
        "Enter your business and bank details",
        "Verify your identity (usually instant)",
        "That's it - you can accept payments!"
      ],
      fees: "2.5% + 30c per transaction. No monthly fees."
    },
    {
      id: 'email',
      title: 'Email Setup',
      description: 'Send quotes and invoices to clients',
      icon: Mail,
      completed: true,
      timeEstimate: 'Already done',
      action: () => onNavigate?.('/integrations'),
      helpText: "Good news - email already works! When you send a quote or invoice, it opens Gmail with everything ready. Just hit send.",
      steps: [
        "This is already set up for you",
        "Click 'Send' on any quote or invoice",
        "A Gmail draft opens with the PDF attached",
        "Review and click Send in Gmail"
      ]
    },
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);
  const allComplete = completedCount === steps.length;

  if (allComplete && dismissible) {
    return null;
  }

  if (compact) {
    return (
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  {allComplete 
                    ? "You're all set up!" 
                    : `${completedCount} of ${steps.length} setup steps done`
                  }
                </p>
                <Progress value={progress} className="h-2 mt-1" />
              </div>
            </div>
            <Button 
              size="sm" 
              variant={allComplete ? "outline" : "default"}
              onClick={() => onNavigate?.('/integrations')}
              data-testid="button-view-setup"
            >
              {allComplete ? "View" : "Continue Setup"}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative">
      {dismissible && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 h-8 w-8"
          onClick={onDismiss}
          data-testid="button-dismiss-setup"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Get Your Business Set Up</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              Complete these steps to start sending quotes and getting paid
            </p>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">{completedCount} of {steps.length} complete</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-2">
        {steps.map((step, index) => {
          const isExpanded = expandedStep === step.id;
          const StepIcon = step.icon;
          
          return (
            <Collapsible 
              key={step.id} 
              open={isExpanded}
              onOpenChange={(open) => setExpandedStep(open ? step.id : null)}
            >
              <div 
                className={`rounded-lg border transition-colors ${
                  step.completed 
                    ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                    : step.inProgress
                    ? 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'
                    : 'bg-card border-border hover:border-primary/50'
                }`}
              >
                <CollapsibleTrigger asChild>
                  <div 
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    data-testid={`setup-step-${step.id}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      step.completed 
                        ? 'bg-green-100 dark:bg-green-900/50' 
                        : step.inProgress
                        ? 'bg-orange-100 dark:bg-orange-900/50'
                        : 'bg-muted'
                    }`}>
                      {step.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                      ) : step.inProgress ? (
                        <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      ) : (
                        <StepIcon className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium text-sm ${step.completed ? 'text-green-700 dark:text-green-300' : ''}`}>
                          {step.title}
                        </p>
                        {step.completed ? (
                          <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0 text-xs">
                            Done
                          </Badge>
                        ) : step.inProgress ? (
                          <Badge variant="outline" className="bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border-0 text-xs">
                            Almost done
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {step.timeEstimate}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {step.description}
                      </p>
                    </div>
                    
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="px-3 pb-3 pt-0 border-t border-border/50 mt-0">
                    <div className="pt-3 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {step.helpText}
                      </p>
                      
                      {step.requirements && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">
                            What you'll need:
                          </p>
                          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                            {step.requirements.map((req, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <Circle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                {req}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {step.steps && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-foreground">Steps:</p>
                          <ol className="text-xs text-muted-foreground space-y-1.5">
                            {step.steps.map((s, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-[10px] font-medium">
                                  {i + 1}
                                </span>
                                {s}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      
                      {step.fees && (
                        <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground flex items-center gap-2">
                          <CreditCard className="w-3 h-3" />
                          <span><strong>Fees:</strong> {step.fees}</span>
                        </div>
                      )}
                      
                      {!step.completed && step.action && (
                        <Button 
                          onClick={step.action}
                          disabled={step.isPending}
                          className="w-full mt-2"
                          data-testid={`button-setup-${step.id}`}
                        >
                          {step.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : step.id === 'stripe' ? (
                            <SiStripe className="w-4 h-4 mr-2" />
                          ) : (
                            <StepIcon className="w-4 h-4 mr-2" />
                          )}
                          {step.inProgress ? 'Complete Setup' : `Set Up ${step.title.replace('Add Your ', '').replace('Set Up ', '')}`}
                        </Button>
                      )}
                      
                      {step.completed && step.action && (
                        <Button 
                          variant="outline"
                          onClick={step.action}
                          className="w-full mt-2"
                          size="sm"
                        >
                          View Settings
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
        
        {allComplete && (
          <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
            <p className="font-medium text-green-800 dark:text-green-200">
              You're all set up!
            </p>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              Start creating jobs, sending quotes, and getting paid.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
