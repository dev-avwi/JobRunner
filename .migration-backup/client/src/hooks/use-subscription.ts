import { useQuery } from "@tanstack/react-query";

export interface FreemiumLimits {
  jobsPerMonth: number;
  canUploadLogo: boolean;
  canCustomizeBranding: boolean;
  canAddTeamMembers: boolean;
  canUseAIFeatures: boolean;
}

export interface UsageCounts {
  jobsCreatedThisMonth: number;
  remainingJobs: number;
  subscriptionTier: 'free' | 'pro' | 'team' | 'business' | 'trial';
  canCreateJob: boolean;
  nextResetDate: Date;
  betaLifetimeAccess?: boolean;
  isBeta?: boolean;
}

export function useSubscriptionUsage() {
  return useQuery<UsageCounts>({
    queryKey: ['/api/subscription/usage'],
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
}

export function useFeatureAccess() {
  const { data: usage, isLoading } = useSubscriptionUsage();
  
  const tier = usage?.subscriptionTier ?? 'free';
  const isBeta = usage?.isBeta ?? false;
  const isFoundingMember = usage?.betaLifetimeAccess ?? false;
  const isPaidTier = tier === 'pro' || tier === 'team' || tier === 'business' || tier === 'trial';
  const canPurchaseAddons = isLoading ? true : (isBeta || isFoundingMember || isPaidTier);

  return {
    canUploadLogo: isLoading ? true : tier !== 'free',
    canCustomizeBranding: isLoading ? true : tier !== 'free',
    canAddTeamMembers: isLoading ? false : tier === 'business' || tier === 'team',
    canUseAIFeatures: isLoading ? true : tier !== 'free',
    canCreateJob: usage?.canCreateJob ?? true,
    canPurchaseAddons,
    isFoundingMember,
    isBeta,
    subscriptionTier: tier,
    jobsRemaining: usage?.remainingJobs ?? 5,
    jobsUsed: usage?.jobsCreatedThisMonth ?? 0,
    isLoading,
  };
}
