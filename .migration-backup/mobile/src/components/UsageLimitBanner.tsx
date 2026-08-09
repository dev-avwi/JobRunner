import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme, ThemeColors } from '../lib/theme';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { spacing, radius, typography } from '../lib/design-tokens';
import { PressableRow } from './ui/PressableRow';

interface UsageInfo {
  jobs: { used: number; limit: number; remaining: number };
  invoices: { used: number; limit: number; remaining: number };
  quotes: { used: number; limit: number; remaining: number };
  clients: { used: number; limit: number; remaining: number };
  isUnlimited: boolean;
  subscriptionTier: string;
}

interface UsageLimitBannerProps {
  variant?: 'compact' | 'detailed';
}

export default function UsageLimitBanner({ variant = 'compact' }: UsageLimitBannerProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { data: usage, isLoading } = useQuery<UsageInfo | null>({
    queryKey: ['usage'],
    queryFn: async () => {
      const response = await api.get<UsageInfo>('/api/usage');
      return response.data ?? null;
    },
  });

  if (isLoading || !usage) {
    return null;
  }

  if (usage.isUnlimited) {
    return null;
  }

  if (!usage.jobs || !usage.invoices) {
    return null;
  }

  const getUsagePercent = (used: number, limit: number) => {
    if (limit === -1) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  };

  const getUsageStatus = (used: number, limit: number) => {
    if (limit === -1) return 'unlimited';
    const percent = getUsagePercent(used, limit);
    if (percent >= 100) return 'exceeded';
    if (percent >= 80) return 'warning';
    return 'ok';
  };

  const jobsStatus = getUsageStatus(usage.jobs.used, usage.jobs.limit);
  const invoicesStatus = getUsageStatus(usage.invoices.used, usage.invoices.limit);

  const hasWarning = jobsStatus === 'warning' || invoicesStatus === 'warning';
  const hasExceeded = jobsStatus === 'exceeded' || invoicesStatus === 'exceeded';

  if (!hasWarning && !hasExceeded) {
    return null;
  }

  const bannerStyle = hasExceeded ? styles.bannerExceeded : styles.bannerWarning;
  const iconColor = hasExceeded ? colors.error : colors.warning;
  const textStyle = hasExceeded ? styles.textExceeded : styles.textWarning;

  return (
    <View style={[styles.banner, bannerStyle]}>
      <View style={styles.content}>
        <Feather name="alert-triangle" size={16} color={iconColor} />
        <View style={styles.textContainer}>
          <Text style={textStyle}>
            {hasExceeded ? 'Monthly limit reached. ' : 'Running low on usage. '}
          </Text>
          <Text style={[textStyle, styles.bold]}>
            {usage.jobs.remaining} jobs, {usage.invoices.remaining} invoices remaining.
          </Text>
        </View>
      </View>
      <PressableRow style={[styles.upgradeButton, hasExceeded ? styles.upgradeButtonExceeded : styles.upgradeButtonWarning]} onPress={() => router.push('/more/subscription')} >
        <Text style={[styles.upgradeButtonText, !hasExceeded && { color: colors.primaryForeground }]}>View Plan</Text>
        <Feather name="arrow-right" size={12} color={hasExceeded ? colors.white : colors.primaryForeground} />
      </PressableRow>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderWidth: 1,
  },
  bannerWarning: {
    backgroundColor: colors.warning + '15',
    borderColor: colors.warning + '30',
  },
  bannerExceeded: {
    backgroundColor: colors.error + '15',
    borderColor: colors.error + '30',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  textWarning: {
    color: colors.warning,
    fontSize: typography.sizes.xs,
  },
  textExceeded: {
    color: colors.error,
    fontSize: typography.sizes.xs,
  },
  bold: {
    fontWeight: '600',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    gap: 4,
  },
  upgradeButtonWarning: {
    backgroundColor: colors.primary,
  },
  upgradeButtonExceeded: {
    backgroundColor: colors.error,
  },
  upgradeButtonText: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
});
