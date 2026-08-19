/**
 * SetupSummary - shows a compact read-only summary of configured advanced setup data.
 */
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../lib/theme';
import { spacing, typography, fontWeights } from '../../lib/design-tokens';
import type { ProjectSetupData } from './types';

interface Props {
  data: ProjectSetupData;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.primary + '10',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary + '30',
      padding: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    headerText: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.primary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    label: {
      fontSize: typography.sizes.sm,
      color: colors.mutedForeground,
      flex: 1,
    },
    value: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
    },
  });
}

export function SetupSummary({ data }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { phases, purchaseOrders, claimStages, checklistItems, requiredInformation, documents, financialSettings: fs } = data;

  const totalClaimPct = claimStages.reduce((acc, c) => acc + (parseFloat(c.percentage) || 0), 0);
  const poBudget = purchaseOrders.reduce((acc, po) => {
    return acc + po.items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);
  }, 0);

  const summaryRows: { icon: string; label: string; value: string }[] = [];

  if (phases.length > 0) {
    summaryRows.push({
      icon: 'layers',
      label: 'Phases',
      value: `${phases.length} phase${phases.length !== 1 ? 's' : ''}`,
    });
  }
  if (fs.contractValue) {
    summaryRows.push({ icon: 'dollar-sign', label: 'Contract Value', value: `$${fs.contractValue}` });
  }
  if (fs.retentionPercent) {
    summaryRows.push({ icon: 'percent', label: 'Retention', value: `${fs.retentionPercent}%` });
  }
  if (purchaseOrders.length > 0) {
    summaryRows.push({
      icon: 'shopping-bag',
      label: 'Purchase Orders',
      value: `${purchaseOrders.length} PO${purchaseOrders.length !== 1 ? 's' : ''}${poBudget > 0 ? `  $${poBudget.toFixed(2)}` : ''}`,
    });
  }
  if (claimStages.length > 0) {
    summaryRows.push({
      icon: 'bar-chart-2',
      label: 'Claim Stages',
      value: `${claimStages.length} stage${claimStages.length !== 1 ? 's' : ''}  ${totalClaimPct.toFixed(1)}%`,
    });
  }
  if (documents.length > 0) {
    summaryRows.push({ icon: 'file-text', label: 'Documents', value: `${documents.length} file${documents.length !== 1 ? 's' : ''}` });
  }
  if (checklistItems.length > 0) {
    summaryRows.push({ icon: 'check-square', label: 'Checklist', value: `${checklistItems.length} item${checklistItems.length !== 1 ? 's' : ''}` });
  }
  if (requiredInformation.length > 0) {
    summaryRows.push({ icon: 'info', label: 'Required Info', value: `${requiredInformation.length} row${requiredInformation.length !== 1 ? 's' : ''}` });
  }

  if (summaryRows.length === 0) return null;

  return (
    <View style={styles.container} testID="setup-summary">
      <View style={styles.header}>
        <Feather name="check-circle" size={16} color={colors.primary} />
        <Text style={styles.headerText}>Setup Summary</Text>
      </View>
      {summaryRows.map((row, idx) => (
        <View key={idx} style={styles.row}>
          <Feather name={row.icon as any} size={14} color={colors.mutedForeground} />
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}
