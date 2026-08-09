import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, typography } from '../lib/design-tokens';
import { PressableRow } from './ui/PressableRow';

type EmptyStateType = 
  | 'jobs' 
  | 'clients' 
  | 'quotes' 
  | 'invoices' 
  | 'receipts' 
  | 'team' 
  | 'messages' 
  | 'notifications'
  | 'search'
  | 'documents'
  | 'time'
  | 'payments'
  | 'general';

interface EmptyStateConfig {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  colorKey: 'primary' | 'info' | 'success' | 'warning' | 'muted' | 'destructive';
}

const emptyStateConfigs: Record<EmptyStateType, EmptyStateConfig> = {
  jobs: {
    icon: 'briefcase',
    title: 'No jobs yet',
    description: 'Create your first job to start tracking your work',
    actionLabel: 'Create Job',
    colorKey: 'info',
  },
  clients: {
    icon: 'users',
    title: 'No clients yet',
    description: 'Add your first client to get started',
    actionLabel: 'Add Client',
    colorKey: 'primary',
  },
  quotes: {
    icon: 'file-text',
    title: 'No quotes yet',
    description: 'Create a quote to send to your clients',
    actionLabel: 'Create Quote',
    colorKey: 'warning',
  },
  invoices: {
    icon: 'file',
    title: 'No invoices yet',
    description: 'Create an invoice when you complete a job',
    actionLabel: 'Create Invoice',
    colorKey: 'success',
  },
  receipts: {
    icon: 'check-circle',
    title: 'No receipts yet',
    description: 'Receipts are created when invoices are paid',
    colorKey: 'success',
  },
  team: {
    icon: 'user-plus',
    title: 'No team members',
    description: 'Invite team members to collaborate on jobs',
    actionLabel: 'Invite Member',
    colorKey: 'info',
  },
  messages: {
    icon: 'message-circle',
    title: 'No messages yet',
    description: 'Start a conversation with your team or clients',
    colorKey: 'primary',
  },
  notifications: {
    icon: 'bell',
    title: 'All caught up!',
    description: 'You have no new notifications',
    colorKey: 'muted',
  },
  search: {
    icon: 'search',
    title: 'No results found',
    description: 'Try adjusting your search or filters',
    colorKey: 'muted',
  },
  documents: {
    icon: 'folder',
    title: 'No documents yet',
    description: 'Your quotes, invoices, and receipts will appear here',
    colorKey: 'info',
  },
  time: {
    icon: 'clock',
    title: 'No time entries',
    description: 'Start tracking time on your jobs',
    actionLabel: 'Start Timer',
    colorKey: 'warning',
  },
  payments: {
    icon: 'credit-card',
    title: 'No payments yet',
    description: 'Payment transactions will appear here',
    colorKey: 'success',
  },
  general: {
    icon: 'inbox',
    title: 'Nothing here yet',
    description: 'Content will appear here once available',
    colorKey: 'muted',
  },
};

function getColorValues(colorKey: string, colors: ThemeColors) {
  switch (colorKey) {
    case 'info': return { fg: colors.info, bg: colors.infoLight };
    case 'success': return { fg: colors.success, bg: colors.successLight };
    case 'warning': return { fg: colors.warning, bg: colors.warningLight };
    case 'destructive': return { fg: colors.destructive, bg: `${colors.destructive}15` };
    case 'muted': return { fg: colors.mutedForeground, bg: `${colors.mutedForeground}15` };
    case 'primary':
    default: return { fg: colors.primary, bg: colors.primaryLight };
  }
}

interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({ 
  type, 
  title, 
  description, 
  actionLabel, 
  onAction,
  compact = false,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const config = emptyStateConfigs[type] || emptyStateConfigs.general;
  const colorVals = getColorValues(config.colorKey, colors);
  
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;
  const displayActionLabel = actionLabel || config.actionLabel;
  
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={[
        styles.iconContainer, 
        compact && styles.iconContainerCompact,
        { backgroundColor: colorVals.bg }
      ]}>
        <Feather 
          name={config.icon} 
          size={compact ? 28 : 40} 
          color={colorVals.fg} 
        />
      </View>
      
      <Text style={[
        styles.title, 
        compact && styles.titleCompact,
        { color: colors.foreground }
      ]}>
        {displayTitle}
      </Text>
      
      <Text style={[
        styles.description, 
        compact && styles.descriptionCompact,
        { color: colors.mutedForeground }
      ]}>
        {displayDescription}
      </Text>
      
      {displayActionLabel && onAction && (
        <PressableRow style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={onAction} >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
          <Text style={[styles.actionText, { color: colors.primaryForeground }]}>
            {displayActionLabel}
          </Text>
        </PressableRow>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  containerCompact: {
    paddingVertical: spacing.xl,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconContainerCompact: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  titleCompact: {
    fontSize: typography.sizes.lg,
  },
  description: {
    fontSize: typography.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  descriptionCompact: {
    fontSize: typography.sizes.sm,
    maxWidth: 240,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.lg,
  },
  actionText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
  },
});
