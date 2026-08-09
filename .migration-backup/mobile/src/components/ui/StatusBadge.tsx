import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '../../lib/theme';

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced' | 'draft' | 'sent' | 'accepted' | 'rejected' | 'paid' | 'overdue';

interface StatusBadgeProps {
  status: JobStatus | string;
  size?: 'sm' | 'default' | 'lg';
}

function getStatusConfig(colors: ThemeColors): Record<string, { bg: string; text: string; dot: string; label: string }> {
  return {
    // Job statuses - ServiceM8 style workflow (matching web labels)
    pending: { 
      bg: colors.pendingBg,
      text: colors.pending,
      dot: colors.pending,
      label: 'New'  // Web uses "New" for pending
    },
    scheduled: { 
      bg: colors.scheduledBg,
      text: colors.scheduled,
      dot: colors.scheduled,
      label: 'Scheduled'
    },
    in_progress: { 
      bg: colors.inProgressBg,
      text: colors.inProgress,
      dot: colors.inProgress,
      label: 'In Progress'
    },
    done: { 
      bg: colors.doneBg,
      text: colors.done,
      dot: colors.done,
      label: 'Completed'  // Web uses "Completed" for done
    },
    invoiced: { 
      bg: colors.invoicedBg,
      text: colors.invoiced,
      dot: colors.invoiced,
      label: 'Invoiced'
    },
    
    // Quote/Invoice statuses (matching web)
    draft: {
      bg: colors.muted,  // Web uses secondary/slate for draft
      text: colors.mutedForeground,
      dot: colors.mutedForeground,
      label: 'Draft'
    },
    sent: {
      bg: colors.invoicedBg,  // Purple to match web
      text: colors.invoiced,
      dot: colors.invoiced,
      label: 'Sent'
    },
    accepted: {
      bg: colors.successLight,
      text: colors.success,
      dot: colors.success,
      label: 'Accepted'
    },
    rejected: {
      bg: colors.destructiveLight,
      text: colors.destructive,
      dot: colors.destructive,
      label: 'Declined'  // Web uses "Declined" for rejected
    },
    expired: {
      bg: colors.muted,
      text: colors.mutedForeground,
      dot: colors.mutedForeground,
      label: 'Expired'
    },
    paid: {
      bg: colors.successLight,
      text: colors.success,
      dot: colors.success,
      label: 'Paid'
    },
    overdue: {
      bg: colors.destructiveLight,
      text: colors.destructive,
      dot: colors.destructive,
      label: 'Overdue'
    },
    partial: {
      bg: colors.warningLight,
      text: colors.warning,
      dot: colors.warning,
      label: 'Partial'
    },
  };
}

export function StatusBadge({ status, size = 'default' }: StatusBadgeProps) {
  const { colors } = useTheme();
  
  const statusConfig = useMemo(() => getStatusConfig(colors), [colors]);
  
  const config = statusConfig[status] || { 
    bg: colors.muted, 
    text: colors.mutedForeground,
    dot: colors.mutedForeground,
    label: status.replace(/_/g, ' ')
  };

  const isSmall = size === 'sm';
  const isLarge = size === 'lg';

  return (
    <View style={[
      styles.badge, 
      { backgroundColor: config.bg },
      isSmall && styles.badgeSmall,
      isLarge && styles.badgeLarge,
    ]}>
      <View style={[
        styles.dot, 
        { backgroundColor: config.dot },
        isSmall && styles.dotSmall,
        isLarge && styles.dotLarge,
      ]} />
      <Text 
        style={[
          styles.text, 
          { color: config.text },
          isSmall && styles.textSmall,
          isLarge && styles.textLarge,
        ]}
        numberOfLines={1}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    gap: 6,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  badgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotLarge: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
    letterSpacing: 0,
  },
  textSmall: {
    fontSize: 11,
  },
  textLarge: {
    fontSize: 13,
  },
});

export default StatusBadge;
