import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Check, 
  X, 
  Crown, 
  Users, 
  Shield,
  Clock,
  CreditCard,
  Sparkles,
  Loader2,
  ChevronRight,
  Calendar,
  ArrowRight,
  Zap,
  ExternalLink,
  Gift,
  Phone,
  MessageCircle,
  Bot,
  Link2,
  Headphones,
  Globe,
  PhoneCall,
  UserCheck,
  Mail,
  MapPin,
  CheckCircle
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";

interface SubscriptionStatus {
  tier: 'free' | 'trial' | 'pro' | 'team' | 'business';
  status: string;
  isTrial?: boolean;
  daysRemaining?: number | null;
  trialEndsAt: string | null;
  nextBillingDate: string | null;
  cancelAtPeriodEnd: boolean;
  paymentMethod: {
    last4: string;
    brand: string;
  } | null;
  seats?: number;
  teamMemberCount?: number;
  totalBillableUsers?: number;
  isBeta?: boolean;
  betaUser?: boolean;
  betaLifetimeAccess?: boolean;
  betaCohortNumber?: number | null;
  canUpgrade: boolean;
  canDowngrade: boolean;
  addons?: {
    dedicatedNumber: string | null;
    smsMode: string;
    aiReceptionistEnabled: boolean;
    aiReceptionistMode: string;
    aiReceptionistApprovalStatus?: string;
  };
}

const tiers = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'For solo operators just getting started',
    features: [
      { text: 'Unlimited quotes', included: true },
      { text: '25 jobs per month', included: true },
      { text: '25 invoices per month', included: true },
      { text: '50 clients', included: true },
      { text: 'Unlimited jobs', included: false },
      { text: 'AI-powered features', included: false },
      { text: 'SMS notifications', included: false },
      { text: 'Team management', included: false },
    ],
    cta: 'Current Plan',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 49.99,
    description: 'For growing trade businesses',
    features: [
      { text: 'Unlimited jobs', included: true },
      { text: 'Unlimited quotes & invoices', included: true },
      { text: 'AI quote generator', included: true },
      { text: 'AI photo analysis', included: true },
      { text: 'SMS & email reminders', included: true },
      { text: 'Custom templates & branding', included: true },
      { text: 'Automated follow-ups', included: true },
      { text: 'Team management', included: false },
    ],
    cta: 'Start 7-Day Free Trial',
    popular: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: 99.99,
    description: 'For small teams up to 5 workers',
    features: [
      { text: 'Everything in Pro', included: true },
      { text: 'Up to 5 team members', included: true },
      { text: 'Team management & permissions', included: true },
      { text: 'Staff scheduling', included: true },
      { text: 'Time tracking', included: true },
      { text: 'GPS job tracking', included: true },
      { text: 'Team chat', included: true },
      { text: 'Priority support', included: true },
    ],
    cta: 'Start 7-Day Free Trial',
    isContactSales: false,
    popular: false,
  },
  {
    id: 'business',
    name: 'Business',
    price: 199.99,
    description: 'For growing businesses up to 15 workers',
    features: [
      { text: 'Everything in Team', included: true },
      { text: 'Up to 15 team members', included: true },
      { text: 'Advanced reporting & analytics', included: true },
      { text: 'Multi-crew dispatch', included: true },
      { text: 'Bulk operations', included: true },
      { text: 'API access', included: true },
      { text: 'White-glove onboarding', included: true },
      { text: 'Dedicated account manager', included: true },
    ],
    cta: 'Start 7-Day Free Trial',
    isContactSales: false,
    popular: false,
  },
];

const handleContactSales = () => {
  window.location.href = "mailto:admin@avwebinnovation.com?subject=JobRunner%20Team%20Plan%20Enquiry&body=Hi%20JobRunner%20Team%20(AV%20Web%20Innovation)%2C%0A%0AI'm%20interested%20in%20the%20JobRunner%20Team%20plan%20for%20my%20business.%0A%0ABusiness%20Name%3A%20%0ANumber%20of%20Team%20Members%3A%20%0APhone%3A%20%0A%0AThanks!";
};

export default function SubscriptionPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: status, isLoading: statusLoading } = useQuery<SubscriptionStatus>({
    queryKey: ['/api/subscription/status'],
  });

  // After returning from Stripe checkout the webhook can be delayed, so the page
  // may still show "Free". Reconcile straight from Stripe, then refresh.
  const reconciledRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true' && !reconciledRef.current) {
      reconciledRef.current = true;
      (async () => {
        try {
          await apiRequest('POST', '/api/subscription/reconcile');
          toast({
            title: "Subscription updated",
            description: "Your plan is now active.",
          });
        } catch {
          toast({
            title: "Almost there",
            description: "Your payment went through. If your plan doesn't update shortly, please refresh.",
          });
        } finally {
          queryClient.invalidateQueries({ queryKey: ['/api/subscription/status'] });
        }
      })();
      // Clean the success flag out of the URL so a refresh doesn't re-run this.
      params.delete('success');
      const cleaned = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, '', cleaned);
    }
  }, [toast]);

  const createCheckoutMutation = useMutation({
    mutationFn: async ({ tier }: { tier: string }) => {
      const response = await apiRequest('POST', '/api/subscription/create-checkout', { tier });
      return response.json();
    },
    onSuccess: (data: { url?: string; betaAccess?: boolean; message?: string; tier?: string }) => {
      if (data.betaAccess) {
        queryClient.invalidateQueries({ queryKey: ['/api/subscription/status'] });
        toast({
          title: "Access Granted!",
          description: data.message || `${data.tier} access unlocked — free for Early Access members!`,
        });
        return;
      }
      // Production mode: redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const manageSubscriptionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/subscription/manage');
      return response.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal.",
        variant: "destructive",
      });
    },
  });

  const aiReceptionistCheckoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/subscription/ai-receptionist-checkout');
      return response.json();
    },
    onSuccess: (data: { url?: string; betaAccess?: boolean; provisioning?: boolean; message?: string }) => {
      if (data.betaAccess && data.provisioning) {
        toast({
          title: "Setting Up AI Receptionist",
          description: data.message || "Your AI Receptionist is being set up...",
        });
        setLocation('/ai-receptionist');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to start AI Receptionist checkout.",
        variant: "destructive",
      });
    },
  });

  const handleStartTrial = (tier: string) => {
    createCheckoutMutation.mutate({ tier });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const isCurrentTier = (tierId: string) => {
    if (!status) return tierId === 'free';
    return status.tier === tierId || (tierId === 'free' && status.tier === 'free');
  };

  const isOnTrial = !!status && (status.isTrial === true || status.status === 'trialing' || status.tier === 'trial');
  const hasActiveSubscription = status && (status.tier === 'pro' || status.tier === 'team' || status.tier === 'business' || isOnTrial);
  const hasPaidPlan = hasActiveSubscription || status?.isBeta;

  if (statusLoading) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading subscription details...</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4 py-6">
          {status?.isBeta && (
            <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-0 px-4 py-1.5">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Early Access
            </Badge>
          )}
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {status?.betaLifetimeAccess
              ? 'All features included as a Founding Member'
              : 'Simple pricing for every trade business'}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {status?.betaLifetimeAccess
              ? 'You have lifetime free access to all features. Thank you for being an early supporter!'
              : 'Start free and upgrade when you\'re ready. Every plan includes a 7-day free trial.'}
          </p>
          
          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4 text-green-600" />
              <span>No credit card for trial</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="w-4 h-4 text-green-600" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 text-green-600" />
              <span>7-day free trial on all plans</span>
            </div>
          </div>
        </div>

        {/* Your Billing Summary */}
        <Card data-testid="card-billing-summary">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Your Billing Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  {(status?.tier === 'business') ? (
                    <Crown className="w-4 h-4 text-primary" />
                  ) : (status?.tier === 'team') ? (
                    <Users className="w-4 h-4 text-primary" />
                  ) : (status?.tier === 'pro' || isOnTrial) ? (
                    <Crown className="w-4 h-4 text-primary" />
                  ) : (
                    <Zap className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Plan</span>
                </div>
                <p className="font-semibold capitalize">
                  {(status?.tier && status.tier !== 'free' ? status.tier : 'Free')} Plan{isOnTrial ? ' (Trial)' : ''}
                </p>
                {status?.isBeta && (
                  <Badge variant="outline" className="mt-1 border-green-400 text-green-600 bg-green-50 text-xs">
                    <Gift className="w-3 h-3 mr-1" />
                    Founding Member
                  </Badge>
                )}
              </div>

              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Business Number</span>
                </div>
                {status?.addons?.dedicatedNumber ? (
                  <>
                    <p className="font-semibold">{status.addons.dedicatedNumber}</p>
                    <p className="text-xs text-muted-foreground">~$3/mo + $0.06/SMS</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-muted-foreground">Shared Number</p>
                    <p className="text-xs text-muted-foreground">Using platform number</p>
                  </>
                )}
              </div>

              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Headphones className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Receptionist</span>
                </div>
                {status?.addons?.aiReceptionistEnabled ? (
                  <>
                    <p className="font-semibold text-green-600">Active</p>
                    <p className="text-xs text-muted-foreground capitalize">{status.addons.aiReceptionistMode?.replace(/_/g, ' ') || 'Enabled'} · $30/mo</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-muted-foreground">Not Active</p>
                    <p className="text-xs text-muted-foreground">$30/mo add-on</p>
                  </>
                )}
              </div>

              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Team</span>
                </div>
                {(status?.teamMemberCount && status.teamMemberCount > 0) ? (
                  <>
                    <p className="font-semibold">{status.totalBillableUsers} user{(status.totalBillableUsers || 0) !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted-foreground">1 owner + {status.teamMemberCount} member{status.teamMemberCount !== 1 ? 's' : ''}</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-muted-foreground">Solo</p>
                    <p className="text-xs text-muted-foreground">No team members</p>
                  </>
                )}
              </div>
            </div>

            {status?.nextBillingDate && !status?.isBeta && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                <Calendar className="w-4 h-4" />
                <span>Next billing: {formatDate(status.nextBillingDate)}</span>
              </div>
            )}

            {!status?.isBeta && hasActiveSubscription && (
              <div className="flex justify-end pt-1">
                <Button 
                  variant="outline"
                  onClick={() => manageSubscriptionMutation.mutate()}
                  disabled={manageSubscriptionMutation.isPending}
                  data-testid="button-manage-subscription"
                >
                  {manageSubscriptionMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Manage Billing
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier) => (
            <Card 
              key={tier.id}
              className={`relative ${tier.popular ? 'border-primary shadow-lg ring-2 ring-primary/20' : ''}`}
              data-testid={`card-pricing-${tier.id}`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-4 pt-6">
                <div className="flex items-center gap-2 mb-2">
                  {tier.id === 'free' && <Zap className="w-5 h-5 text-muted-foreground" />}
                  {tier.id === 'pro' && <Crown className="w-5 h-5 text-primary" />}
                  {tier.id === 'team' && <Users className="w-5 h-5 text-primary" />}
                  {tier.id === 'business' && <Crown className="w-5 h-5 text-primary" />}
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">{tier.description}</p>
                <div className="pt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${tier.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {(() => {
                  const isCurrent = isCurrentTier(tier.id);
                  const isFoundingMember = status?.betaLifetimeAccess;
                  const userTierRank = { free: 0, pro: 2, trial: 3, team: 3, business: 4 }[status?.tier || 'free'] ?? 0;
                  const thisTierRank = { free: 0, pro: 2, trial: 3, team: 3, business: 4 }[tier.id] ?? 0;
                  const isDowngrade = thisTierRank < userTierRank;
                  const isUpgrade = thisTierRank > userTierRank;

                  if (isFoundingMember) {
                    return (
                      <Button variant="outline" className="w-full" disabled data-testid={`button-plan-${tier.id}`}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Included Free
                      </Button>
                    );
                  }

                  if (isCurrent || (tier.id === 'free' && !isUpgrade)) {
                    return (
                      <Button variant="outline" className="w-full" disabled data-testid={`button-plan-${tier.id}`}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Current Plan
                      </Button>
                    );
                  }

                  if (isDowngrade) {
                    return (
                      <Button variant="outline" className="w-full" disabled data-testid={`button-plan-${tier.id}`}>
                        Downgrade
                      </Button>
                    );
                  }

                  if (isUpgrade && tier.id !== 'free') {
                    return (
                      <>
                        <Button
                          className="w-full"
                          onClick={() => handleStartTrial(tier.id)}
                          disabled={createCheckoutMutation.isPending}
                          data-testid={`button-plan-${tier.id}`}
                        >
                          {createCheckoutMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Zap className="w-4 h-4 mr-2" />
                          )}
                          {isOnTrial ? 'Upgrade Now' : 'Start 7-Day Free Trial'}
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                          {isOnTrial ? 'Upgrade your subscription' : 'No credit card required to start'}
                        </p>
                      </>
                    );
                  }

                  return (
                    <Button variant="outline" className="w-full" disabled data-testid={`button-plan-${tier.id}`}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Current Plan
                    </Button>
                  );
                })()}

                {/* Features List */}
                <ul className="space-y-3">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-5 h-5 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                      )}
                      <span className={feature.included ? '' : 'text-muted-foreground/60'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add-On: Dedicated Number & AI Receptionist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              Add-On: Dedicated Business Number
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Get your own Australian phone number for two-way client texting. Available on Pro and Team plans.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <MessageCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Two-Way SMS</p>
                  <p className="text-xs text-muted-foreground">Send and receive texts from clients directly in JobRunner</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Bot className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">AI Receptionist</p>
                  <p className="text-xs text-muted-foreground">AI detects job requests from incoming texts and creates leads automatically</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Link2 className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Auto-Link to Jobs</p>
                  <p className="text-xs text-muted-foreground">Messages automatically match to the right client and job</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Phone className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Your Own Number</p>
                  <p className="text-xs text-muted-foreground">Professional Australian mobile or local number just for your business</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">~$3 AUD/month + ~$0.06 per SMS</p>
                <p className="text-xs text-muted-foreground">Billed through Twilio. Cancel anytime.</p>
              </div>
              {hasPaidPlan ? (
                <Button 
                  variant="outline"
                  onClick={() => setLocation('/chat?setup=number')}
                >
                  <Phone className="h-4 w-4 mr-1.5" />
                  {status?.addons?.dedicatedNumber ? 'Manage Number' : 'Set Up in Chat Hub'}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  <Shield className="h-4 w-4 mr-1.5" />
                  Requires Pro or Team Plan
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              All plans include two-way SMS through the shared JobRunner platform number. 
              A dedicated number means customers see your business number instead of the shared one — great for your website, Google listing, and business cards.
            </p>
          </CardContent>
        </Card>

        {/* Add-On: AI Receptionist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-blue-600" />
              Add-On: AI Receptionist
              <Badge variant="outline" className="ml-auto text-xs">$30/month</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              AI-powered phone answering for your trade business. Never miss a call again — the AI answers in your business name, 
              captures leads, and transfers calls to your team when they're available.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Phone className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Dedicated Number</p>
                  <p className="text-xs text-muted-foreground">Your own Australian number — customers see your business, not JobRunner</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Bot className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">24/7 AI Answering</p>
                  <p className="text-xs text-muted-foreground">Answers calls in your business name with a natural Australian voice</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <UserCheck className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Auto Lead Capture</p>
                  <p className="text-xs text-muted-foreground">Captures caller details, job type, and urgency as new leads</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <PhoneCall className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Live Transfer</p>
                  <p className="text-xs text-muted-foreground">Transfers to available team members or takes a message if busy</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">$30 AUD/month</p>
                <p className="text-xs text-muted-foreground">Includes dedicated number, AI voice agent, call logs, and lead capture. Requires Pro or Team plan.</p>
              </div>
              {hasPaidPlan ? (
                (() => {
                  const aiStatus = status?.addons?.aiReceptionistApprovalStatus;
                  if (status?.addons?.aiReceptionistEnabled || aiStatus === 'approved') {
                    return (
                      <Button 
                        variant="outline"
                        onClick={() => setLocation('/ai-receptionist')}
                      >
                        <Headphones className="h-4 w-4 mr-1.5" />
                        Manage AI Receptionist
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    );
                  }
                  if (aiStatus === 'provisioning') {
                    return (
                      <Button 
                        variant="outline"
                        onClick={() => setLocation('/ai-receptionist')}
                      >
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        Setting Up...
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    );
                  }
                  if (aiStatus === 'pending_approval') {
                    return (
                      <Button 
                        variant="outline"
                        onClick={() => setLocation('/ai-receptionist')}
                      >
                        <Clock className="h-4 w-4 mr-1.5" />
                        Pending Review
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    );
                  }
                  return (
                    <Button 
                      variant="default"
                      onClick={() => aiReceptionistCheckoutMutation.mutate()}
                      disabled={aiReceptionistCheckoutMutation.isPending}
                      data-testid="button-add-ai-receptionist"
                    >
                      {aiReceptionistCheckoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <Headphones className="h-4 w-4 mr-1.5" />
                      )}
                      Add AI Receptionist
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  );
                })()
              ) : (
                <Button variant="outline" disabled>
                  <Shield className="h-4 w-4 mr-1.5" />
                  Requires Pro or Team Plan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Add-On: Custom Website */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-purple-600" />
              Add-On: Custom Website
              <Badge variant="outline" className="ml-auto text-xs">Custom Quote</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We build a professional website for your trade business — mobile-friendly, SEO optimised for your local area, 
              and integrated with your JobRunner quote requests.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Globe className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Professional Design</p>
                  <p className="text-xs text-muted-foreground">Custom-built website tailored to your trade and brand</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <MapPin className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Local SEO</p>
                  <p className="text-xs text-muted-foreground">Optimised for your suburb, city, and trade keywords</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Link2 className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">JobRunner Integration</p>
                  <p className="text-xs text-muted-foreground">Quote request forms feed directly into your JobRunner pipeline</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Sparkles className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Hosting Included</p>
                  <p className="text-xs text-muted-foreground">We handle hosting, updates, and ongoing support</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Custom pricing based on your needs</p>
                <p className="text-xs text-muted-foreground">Our team will discuss your requirements and provide a tailored quote.</p>
              </div>
              {hasPaidPlan ? (
                <Button 
                  variant="outline"
                  onClick={() => {
                    window.location.href = "mailto:admin@avwebinnovation.com?subject=Custom%20Website%20Enquiry&body=Hi%20JobRunner%20Team%20(AV%20Web%20Innovation)%2C%0A%0AI'm%20interested%20in%20a%20custom%20website%20for%20my%20trade%20business.%0A%0ABusiness%20Name%3A%20%0ATrade%20Type%3A%20%0ALocation%2FSuburb%3A%20%0APhone%3A%20%0A%0AAnything%20specific%20you'd%20like%3A%20%0A%0AThanks!";
                  }}
                >
                  <Mail className="h-4 w-4 mr-1.5" />
                  Request Custom Website
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  <Shield className="h-4 w-4 mr-1.5" />
                  Requires Pro or Team Plan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* How It Works Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" style={{ color: 'hsl(var(--trade))' }} />
              How upgrading works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-primary">1</span>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Start your free trial</h4>
                  <p className="text-sm text-muted-foreground">
                    Try Pro or Team free for 7 days. No credit card needed to get started.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-primary">2</span>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Explore all features</h4>
                  <p className="text-sm text-muted-foreground">
                    Use unlimited jobs, AI tools, team management, and more during your trial.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-primary">3</span>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Subscribe when you're ready</h4>
                  <p className="text-sm text-muted-foreground">
                    Choose a plan that fits. Cancel anytime — no lock-in contracts.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <div className="text-center py-6">
          <p className="text-muted-foreground">
            Have questions?{' '}
            <a 
              href="mailto:admin@avwebinnovation.com" 
              className="text-primary hover:underline"
              data-testid="link-contact-support"
            >
              Contact our support team
            </a>
          </p>
        </div>
      </div>
    </PageShell>
  );
}
