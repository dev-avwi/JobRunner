import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Circle, 
  Building2, 
  Users, 
  FileText, 
  CreditCard,
  ChevronRight,
  ChevronDown,
  X,
  Clock,
  Loader2,
  Palette,
  Mail,
  Sparkles,
  ExternalLink,
  HelpCircle
} from "lucide-react";
import { SiStripe } from "react-icons/si";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface GettingStartedChecklistProps {
  onNavigate?: (path: string) => void;
  onCreateClient?: () => void;
  onCreateQuote?: () => void;
}

interface StripeConnectStatus {
  connected: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  inProgress?: boolean;
  action: () => void;
  actionLabel: string;
  icon: typeof Building2;
  timeEstimate?: string;
  helpText?: string;
  steps?: string[];
  requirements?: string[];
  fees?: string;
  isPending?: boolean;
  priority: 'high' | 'medium' | 'low';
}

const DISMISS_KEY = 'jobrunner_setup_dismissed_permanently';

export default function GettingStartedChecklist({
  onNavigate,
  onCreateClient,
  onCreateQuote
}: GettingStartedChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  const [permanentlyDismissed, setPermanentlyDismissed] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [isTourActive, setIsTourActive] = useState(false);
  const { toast } = useToast();
  
  // Check localStorage for permanent dismissal on mount
  useEffect(() => {
    const savedDismissed = localStorage.getItem(DISMISS_KEY);
    if (savedDismissed === 'true') {
      setPermanentlyDismissed(true);
    }
  }, []);
  
  // Check if guided tour is active and hide this component
  useEffect(() => {
    const checkTourActive = () => {
      setIsTourActive(document.body.hasAttribute('data-tour-active'));
    };
    
    // Initial check
    checkTourActive();
    
    // Use MutationObserver to detect attribute changes on body
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-tour-active') {
          checkTourActive();
        }
      }
    });
    
    observer.observe(document.body, { attributes: true });
    
    return () => observer.disconnect();
  }, []);
  
  const handleDismissForever = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setPermanentlyDismissed(true);
    toast({
      title: "Setup guide hidden",
      description: "You can access setup anytime from Settings.",
    });
  };
  
  const { data: businessSettings, isLoading: settingsLoading } = useQuery({ 
    queryKey: ["/api/business-settings"],
    staleTime: 60000,
  });
  const { data: user } = useQuery({ queryKey: ["/api/auth/me"] });
  const { data: clients = [], isLoading: clientsLoading } = useQuery({ 
    queryKey: ["/api/clients"],
    staleTime: 60000,
  });
  const { data: quotes = [], isLoading: quotesLoading } = useQuery({ 
    queryKey: ["/api/quotes"],
    staleTime: 60000,
  });
  const { data: health, isLoading: healthLoading } = useQuery<any>({ 
    queryKey: ["/api/integrations/health"],
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });
  
  const dataLoading = settingsLoading || clientsLoading || quotesLoading || healthLoading;

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

  const hasBusinessProfile = !!(businessSettings as any)?.businessName && 
    !!(businessSettings as any)?.abn;
  const hasBranding = !!(businessSettings as any)?.logoUrl || !!(businessSettings as any)?.primaryColor;
  const hasClient = Array.isArray(clients) && clients.length > 0;
  const hasQuote = Array.isArray(quotes) && quotes.length > 0;

  const steps: SetupStep[] = [
    {
      id: "business",
      title: "Add your business details",
      description: "Business name, ABN & contact info",
      completed: hasBusinessProfile,
      action: () => onNavigate?.("/settings?tab=business"),
      actionLabel: "Set up",
      icon: Building2,
      timeEstimate: "2 mins",
      priority: 'high',
      helpText: "This info appears on your quotes and invoices. You'll need your ABN (Australian Business Number).",
      steps: [
        "Go to Settings",
        "Fill in your business name and ABN",
        "Add your contact email and phone",
        "Add your business address"
      ]
    },
    {
      id: "stripe",
      title: "Set up online payments",
      description: "Get paid directly to your bank",
      completed: stripeConnected || false,
      inProgress: stripePartiallyConnected,
      action: () => {
        if (stripeConnected) {
          onNavigate?.("/integrations");
        } else {
          connectStripeMutation.mutate();
        }
      },
      actionLabel: stripePartiallyConnected ? "Complete" : "Connect",
      icon: CreditCard,
      timeEstimate: "5-10 mins",
      priority: 'high',
      isPending: connectStripeMutation.isPending,
      helpText: "Connect Stripe so customers can pay invoices online. Money goes straight to your bank account within 2-3 days.",
      requirements: [
        "Valid Australian bank account",
        "Photo ID (driver's licence or passport)",
        "About 5-10 minutes to complete"
      ],
      steps: [
        "Click 'Connect Stripe' below",
        "Enter your business details on Stripe's website",
        "Add your bank account for payouts",
        "Verify your identity (usually instant)",
        "Done! You can now accept card payments"
      ],
      fees: "2.5% + 30c per payment. No monthly fees."
    },
    {
      id: "branding",
      title: "Add your logo",
      description: "Make quotes look professional",
      completed: hasBranding,
      action: () => onNavigate?.("/settings"),
      actionLabel: "Upload",
      icon: Palette,
      timeEstimate: "1 min",
      priority: 'medium',
      helpText: "Upload your logo so it appears on all your quotes and invoices. This makes your business look professional.",
      steps: [
        "Go to Settings",
        "Click 'Upload Logo'",
        "Choose your brand colour (optional)",
        "Your logo will appear on all documents"
      ]
    },
    {
      id: "client",
      title: "Add your first client",
      description: "Save client details for quoting",
      completed: hasClient,
      action: () => onCreateClient?.() || onNavigate?.("/clients"),
      actionLabel: "Add",
      icon: Users,
      timeEstimate: "1 min",
      priority: 'medium',
      helpText: "Add a client so you can create quotes and invoices for them. You can add more clients anytime.",
      steps: [
        "Click 'Add Client'",
        "Enter their name and contact details",
        "Add their address (for job sites)",
        "Save - you can now create quotes for them"
      ]
    },
    {
      id: "quote",
      title: "Send your first quote",
      description: "Win work with professional quotes",
      completed: hasQuote,
      action: () => onCreateQuote?.() || onNavigate?.("/quotes"),
      actionLabel: "Create",
      icon: FileText,
      timeEstimate: "3 mins",
      priority: 'low',
      helpText: "Create a quote for a client. Once they accept, you can convert it to an invoice with one click.",
      steps: [
        "Click 'Create Quote'",
        "Select a client",
        "Add your line items (materials, labour, etc)",
        "Preview and send to the client"
      ]
    }
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const progressPercentage = (completedCount / steps.length) * 100;
  const allComplete = completedCount === steps.length;
  const highPriorityIncomplete = steps.filter(s => s.priority === 'high' && !s.completed);

  // Hide when loading (prevents flash), tour is active, dismissed, or all steps complete
  if (dataLoading || isTourActive || dismissed || permanentlyDismissed || allComplete) {
    return null;
  }

  return (
    <Card 
      className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5"
      data-testid="getting-started-checklist"
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center bg-primary text-primary-foreground text-sm font-bold"
            >
              {completedCount}/{steps.length}
            </div>
            <div>
              <p className="font-semibold text-sm">Get Set Up</p>
              <p className="text-xs text-muted-foreground">
                {highPriorityIncomplete.length > 0 
                  ? `${highPriorityIncomplete.length} important step${highPriorityIncomplete.length > 1 ? 's' : ''} left`
                  : "Almost there!"
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleDismissForever}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              data-testid="button-dismiss-forever"
            >
              Don't show again
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setDismissed(true)}
              className="h-8 w-8"
              data-testid="button-dismiss-checklist"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <Progress value={progressPercentage} className="h-2 mb-4" />
        
        <div className="space-y-2">
          {steps.map((step) => {
            const isExpanded = expandedStep === step.id;
            
            return (
              <Collapsible 
                key={step.id}
                open={isExpanded}
                onOpenChange={(open) => setExpandedStep(open ? step.id : null)}
              >
                <div 
                  className={`rounded-xl border transition-all ${
                    step.completed 
                      ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                      : step.inProgress
                      ? 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'
                      : step.priority === 'high'
                      ? 'bg-background border-primary/30 hover:border-primary/50'
                      : 'bg-background border-border hover:border-primary/30'
                  }`}
                >
                  <CollapsibleTrigger asChild>
                    <button 
                      className="w-full flex items-center justify-between p-3 cursor-pointer"
                      data-testid={`step-${step.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            step.completed 
                              ? 'bg-green-100 dark:bg-green-900/50' 
                              : step.inProgress
                              ? 'bg-orange-100 dark:bg-orange-900/50'
                              : step.priority === 'high'
                              ? 'bg-primary/20'
                              : 'bg-muted/50'
                          }`}
                        >
                          {step.completed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : step.inProgress ? (
                            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          ) : step.id === 'stripe' ? (
                            <SiStripe className={`h-4 w-4 ${step.priority === 'high' ? 'text-primary' : 'text-muted-foreground'}`} />
                          ) : (
                            <step.icon className={`h-4 w-4 ${step.priority === 'high' ? 'text-primary' : 'text-muted-foreground'}`} />
                          )}
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-medium ${
                              step.completed 
                                ? 'text-green-700 dark:text-green-300' 
                                : step.inProgress 
                                ? 'text-orange-700 dark:text-orange-300'
                                : ''
                            }`}>
                              {step.title}
                            </p>
                            {step.completed ? (
                              <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border-0 text-[10px] px-1.5 py-0">
                                Done
                              </Badge>
                            ) : step.inProgress ? (
                              <Badge variant="outline" className="bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border-0 text-[10px] px-1.5 py-0">
                                Almost done
                              </Badge>
                            ) : step.priority === 'high' ? (
                              <Badge className="bg-primary/20 text-primary border-0 text-[10px] px-1.5 py-0">
                                Important
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!step.completed && step.timeEstimate && (
                          <span className="text-[10px] text-muted-foreground hidden sm:inline">
                            {step.timeEstimate}
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="px-3 pb-3 pt-0 border-t border-border/50">
                      <div className="pt-3 space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {step.helpText}
                        </p>
                        
                        {step.requirements && !step.completed && (
                          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                            <p className="text-xs font-medium text-blue-800 dark:text-blue-200 mb-2">
                              What you'll need:
                            </p>
                            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                              {step.requirements.map((req, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <Circle className="w-2 h-2 mt-1.5 flex-shrink-0 fill-current" />
                                  {req}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {step.steps && !step.completed && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-foreground">How it works:</p>
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
                        
                        {step.fees && !step.completed && (
                          <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground flex items-center gap-2">
                            <CreditCard className="w-3 h-3 flex-shrink-0" />
                            <span><strong>Fees:</strong> {step.fees}</span>
                          </div>
                        )}
                        
                        {!step.completed && (
                          <Button 
                            onClick={step.action}
                            disabled={step.isPending}
                            className="w-full"
                            size="sm"
                            data-testid={`button-${step.id}`}
                          >
                            {step.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : step.id === 'stripe' ? (
                              <SiStripe className="w-4 h-4 mr-2" />
                            ) : (
                              <step.icon className="w-4 h-4 mr-2" />
                            )}
                            {step.actionLabel} {step.id === 'stripe' ? 'Stripe' : ''}
                            {step.id === 'stripe' && <ExternalLink className="w-3 h-3 ml-2" />}
                          </Button>
                        )}
                        
                        {step.completed && (
                          <Button 
                            variant="outline"
                            onClick={step.action}
                            className="w-full"
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
        </div>
        
        <p className="text-[10px] text-muted-foreground text-center mt-3">
          Need help? Check the <button 
            onClick={() => onNavigate?.('/integrations')} 
            className="underline hover:text-primary"
          >
            Integrations page
          </button> for more details
        </p>
      </CardContent>
    </Card>
  );
}
