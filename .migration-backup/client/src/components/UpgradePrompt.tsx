import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, Crown, Users, Zap, ArrowRight, Lock, PartyPopper } from "lucide-react";
import { Link } from "wouter";
import { useFeatureAccess } from "@/hooks/use-subscription";

interface UpgradePromptProps {
  trigger?: "job-limit" | "logo-upload" | "branding" | "ai-features" | "team-members";
  onClose?: () => void;
  compact?: boolean;
  targetTier?: 'pro' | 'team' | 'business';
}

const triggerMessages: Record<string, { title: string; description: string }> = {
  'job-limit': {
    title: 'Monthly job limit reached',
    description: 'Upgrade to Pro for unlimited jobs, quotes, and invoices.',
  },
  'logo-upload': {
    title: 'Custom branding is a Pro feature',
    description: 'Upload your logo and customise your documents with Pro.',
  },
  'branding': {
    title: 'Custom branding requires Pro',
    description: 'Personalise quotes and invoices with your business branding.',
  },
  'ai-features': {
    title: 'AI features require Pro',
    description: 'Unlock AI-powered quote generation, photo analysis, and more.',
  },
  'team-members': {
    title: 'Team management requires the Team plan',
    description: 'Add workers, assign jobs, track time, and manage your crew.',
  },
};

const proFeatures = [
  "Unlimited jobs, quotes & invoices",
  "Custom logo & branding",
  "AI-powered quote generation",
  "Automatic invoice reminders",
  "SMS & email notifications",
  "Advanced reporting & analytics",
];

const teamFeatures = [
  "Everything in Pro",
  "Up to 5 team members",
  "Team management & permissions",
  "Staff scheduling & dispatch",
  "GPS job tracking",
  "Team chat & collaboration",
];

const businessFeatures = [
  "Everything in Team",
  "Up to 15 team members",
  "Advanced reporting & analytics",
  "Multi-crew dispatch",
  "API access",
  "Dedicated account manager",
];

const TIER_PRICE: Record<'pro' | 'team' | 'business', number> = {
  pro: 49,
  team: 99,
  business: 199,
};

const TIER_LABEL: Record<'pro' | 'team' | 'business', string> = {
  pro: 'Pro',
  team: 'Team',
  business: 'Business',
};

export default function UpgradePrompt({ 
  trigger = "job-limit", 
  onClose,
  compact = false,
  targetTier,
}: UpgradePromptProps) {
  const { subscriptionTier, isFoundingMember } = useFeatureAccess();

  if (isFoundingMember) {
    if (compact) {
      return (
        <Alert
          className="border"
          style={{
            borderColor: 'hsl(var(--trade) / 0.2)',
            backgroundColor: 'hsl(var(--trade) / 0.05)',
          }}
        >
          <Sparkles className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
          <AlertDescription style={{ color: 'hsl(var(--trade))' }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span>All features included as a Founding Member!</span>
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Free
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-6" data-testid="upgrade-prompt">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <PartyPopper className="h-6 w-6 text-green-600" />
            <h2 className="text-2xl font-bold">All Features Included!</h2>
          </div>
          <p className="text-muted-foreground max-w-md mx-auto">
            Enjoy all features at no cost as a Founding Member. Thank you for your early support!
          </p>
        </div>
        {onClose && (
          <div className="flex justify-center">
            <Button onClick={onClose} data-testid="button-close-beta-info">
              Got it, thanks!
            </Button>
          </div>
        )}
      </div>
    );
  }

  const effectiveTier: 'pro' | 'team' | 'business' = targetTier || (trigger === 'team-members' ? 'team' : 'pro');
  const msg = triggerMessages[trigger];
  const features = effectiveTier === 'business' ? businessFeatures : effectiveTier === 'team' ? teamFeatures : proFeatures;
  const TierIcon = effectiveTier === 'team' ? Users : Crown;
  const tierLabel = TIER_LABEL[effectiveTier];
  const tierPrice = TIER_PRICE[effectiveTier];

  if (compact) {
    return (
      <Alert className="border border-primary/20 bg-primary/5">
        <Lock className="h-4 w-4 text-primary" />
        <AlertDescription>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm">{msg.description}</span>
            <Link href="/subscription">
              <Button size="sm">
                <Zap className="w-3 h-3 mr-1" />
                Upgrade
              </Button>
            </Link>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6" data-testid="upgrade-prompt">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center space-x-2">
          <TierIcon className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">{msg.title}</h2>
        </div>
        <p className="text-muted-foreground max-w-md mx-auto">{msg.description}</p>
      </div>

      <div className="max-w-md mx-auto">
        <Card className="relative border-primary/30 shadow-lg">
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <Badge className="bg-primary text-primary-foreground">
              {tierLabel} Plan
            </Badge>
          </div>

          <CardHeader className="text-center pt-8">
            <CardTitle className="flex items-center justify-center space-x-2">
              <TierIcon className="h-5 w-5 text-primary" />
              <span>Unlock {tierLabel} Features</span>
            </CardTitle>
            <div className="space-y-1">
              <div className="text-3xl font-bold">
                ${tierPrice}
                <span className="text-base font-normal text-muted-foreground">/mo</span>
              </div>
              <p className="text-sm text-muted-foreground">7-day free trial included</p>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <Link href="/subscription">
              <Button className="w-full" size="lg" data-testid="button-upgrade-now">
                <Zap className="w-4 h-4 mr-2" />
                Start 7-Day Free Trial
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>

            {onClose && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={onClose}
                data-testid="button-close-upgrade"
              >
                Maybe later
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
