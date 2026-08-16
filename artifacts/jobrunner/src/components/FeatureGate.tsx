import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFeatureAccess } from "@/hooks/use-subscription";
import { useUserRole } from "@/hooks/use-user-role";
import { Lock, Crown, Users, ArrowRight, Sparkles, Zap } from "lucide-react";
import { Link } from "wouter";

type RequiredTier = 'pro' | 'team' | 'business';

interface FeatureGateProps {
  children: React.ReactNode;
  requiredTier: RequiredTier;
  featureName?: string;
  description?: string;
  compact?: boolean;
}

const TIER_RANK: Record<string, number> = {
  free: 0,
  pro: 2,
  trial: 3, // trial grants full team-level access so users can actually try the features
  team: 3,
  business: 4,
};

function hasSufficientTier(userTier: string, requiredTier: RequiredTier): boolean {
  return (TIER_RANK[userTier] ?? 0) >= (TIER_RANK[requiredTier] ?? 0);
}

const TIER_INFO: Record<RequiredTier, { label: string; icon: typeof Crown; color: string; features: string[] }> = {
  pro: {
    label: 'Pro',
    icon: Crown,
    color: 'hsl(var(--trade))',
    features: [
      'Unlimited jobs, quotes & invoices',
      'AI-powered quote generation',
      'Custom templates & branding',
      'SMS & email reminders',
      'Automated follow-ups',
      'Advanced reporting',
    ],
  },
  team: {
    label: 'Team',
    icon: Users,
    color: 'hsl(217.2 91.2% 59.8%)',
    features: [
      'Everything in Pro',
      'Team member management',
      'Role-based permissions',
      'Staff scheduling & dispatch',
      'GPS job tracking',
      'Team chat & collaboration',
    ],
  },
  business: {
    label: 'Business',
    icon: Users,
    color: 'hsl(142 71% 45%)',
    features: [
      'Everything in Team',
      'Up to 15 team members',
      'Advanced reporting & insights',
      'Priority support',
      'Full business management',
      'Custom workflows',
    ],
  },
};

export default function FeatureGate({
  children,
  requiredTier,
  featureName,
  description,
  compact = false,
}: FeatureGateProps) {
  const { subscriptionTier, isLoading, isFoundingMember } = useFeatureAccess();
  const { isOwner, isLoading: roleLoading } = useUserRole();

  if (isLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center space-y-3">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isFoundingMember || hasSufficientTier(subscriptionTier, requiredTier)) {
    return <>{children}</>;
  }

  // Team members / subcontractors working inside a business are covered by the
  // business's seat — never show them a personal upgrade/trial pitch. If the
  // effective (owner-inherited) tier doesn't cover this feature, tell them to
  // ask the owner instead.
  if (!isOwner) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">
                {featureName || 'This feature'} isn't included in your business's plan
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Ask the business owner to upgrade their plan to unlock this for the team.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tierInfo = TIER_INFO[requiredTier];
  const TierIcon = tierInfo.icon;
  const isFreeToPro = subscriptionTier === 'free' && requiredTier === 'pro';
  const isToTeam = requiredTier === 'team';
  const isProToTeam = (subscriptionTier === 'pro' || subscriptionTier === 'trial') && requiredTier === 'team';
  const ctaText = isProToTeam ? 'Upgrade to Team' : 'Start 7-Day Free Trial';
  const ctaSubtext = isProToTeam ? 'Team plan is $99.99/mo flat — includes up to 5 team members' : 'No credit card required to start your trial';

  if (compact) {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none opacity-30 blur-[2px]">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px] rounded-lg">
          <Card className="max-w-sm w-full mx-4 shadow-lg">
            <CardContent className="p-4 text-center space-y-3">
              <div
                className="mx-auto w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${tierInfo.color}15` }}
              >
                <Lock className="w-5 h-5" style={{ color: tierInfo.color }} />
              </div>
              <div>
                <p className="font-semibold text-sm">
                  {featureName || 'This feature'} requires {tierInfo.label}
                </p>
                {description && (
                  <p className="text-xs text-muted-foreground mt-1">{description}</p>
                )}
              </div>
              <Link href="/subscription">
                <Button size="sm" className="w-full">
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                  Upgrade to {tierInfo.label}
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[60vh]">
      <div className="pointer-events-none select-none opacity-20 blur-[3px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center pt-16 bg-background/40 backdrop-blur-[1px]">
        <Card className="max-w-md w-full mx-4 shadow-xl border-2" style={{ borderColor: `${tierInfo.color}30` }}>
          <CardHeader className="text-center pb-2">
            <div
              className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3"
              style={{ backgroundColor: `${tierInfo.color}12` }}
            >
              <TierIcon className="w-7 h-7" style={{ color: tierInfo.color }} />
            </div>
            <CardTitle className="text-xl">
              {featureName ? `${featureName} is a ${tierInfo.label} feature` : `Upgrade to ${tierInfo.label}`}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {description || (isFreeToPro
                ? 'Unlock powerful tools to grow your trade business.'
                : isToTeam
                ? 'Scale your operations with team management tools.'
                : `This feature requires the ${tierInfo.label} plan.`)}
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              {tierInfo.features.map((feature, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tierInfo.color }} />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <Link href="/subscription">
                <Button className="w-full" size="lg">
                  <Zap className="w-4 h-4 mr-2" />
                  {ctaText}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <p className="text-xs text-center text-muted-foreground">
                {ctaSubtext}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function FeatureGateInline({
  requiredTier,
  featureName,
  children,
}: {
  requiredTier: RequiredTier;
  featureName?: string;
  children?: React.ReactNode;
}) {
  const { subscriptionTier, isLoading, isFoundingMember } = useFeatureAccess();
  const { isOwner, isLoading: roleLoading } = useUserRole();

  if (isLoading || roleLoading || isFoundingMember || hasSufficientTier(subscriptionTier, requiredTier)) {
    return <>{children}</>;
  }

  const tierInfo = TIER_INFO[requiredTier];

  // Members inside a business never get a personal upgrade pitch — billing is
  // the owner's concern.
  if (!isOwner) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed">
        <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-muted-foreground flex-1">
          {featureName || 'This feature'} isn't included in your business's plan
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed">
      <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="text-sm text-muted-foreground flex-1">
        {featureName || 'This feature'} requires {tierInfo.label}
      </span>
      <Link href="/subscription">
        <Badge className="cursor-pointer">
          Upgrade
        </Badge>
      </Link>
    </div>
  );
}
