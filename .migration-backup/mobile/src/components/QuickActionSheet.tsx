import { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableRow } from './ui/PressableRow';
import AppBottomSheet from './ui/AppBottomSheet';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, typography } from '../lib/design-tokens';

export interface QuickAction {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  primary?: boolean;
}

interface QuickActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions: QuickAction[];
}

export function QuickActionSheet({
  visible,
  onClose,
  title,
  subtitle,
  actions,
}: QuickActionSheetProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const handleAction = useCallback((action: QuickAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Fire the action FIRST, then close. On iOS the modal-close animation
    // occasionally swallowed deferred navigation/Alert calls.
    try {
      action.onPress();
    } finally {
      onClose();
    }
  }, [onClose]);

  return (
    <AppBottomSheet visible={visible} onDismiss={onClose} scrollable={false}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
        <PressableRow
          onPress={onClose}
          style={styles.closeButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="x" size={20} color={colors.mutedForeground} />
        </PressableRow>
      </View>

      <View style={styles.actions}>
        {actions.map((action, index) => (
          <PressableRow
            key={index}
            style={[
              styles.actionRow,
              action.primary && styles.actionRowPrimary,
              action.destructive && styles.actionRowDestructive,
              index < actions.length - 1 && styles.actionRowBorder,
            ]}
            onPress={() => handleAction(action)}
          >
            <View style={[
              styles.actionIcon,
              action.primary && { backgroundColor: `${colors.primary}18` },
              action.destructive && { backgroundColor: `${colors.destructive}12` },
            ]}>
              <Feather
                name={action.icon}
                size={18}
                color={
                  action.destructive
                    ? colors.destructive
                    : action.primary
                      ? colors.primary
                      : colors.foreground
                }
              />
            </View>
            <Text style={[
              styles.actionLabel,
              action.primary && { color: colors.primary, fontWeight: '600' },
              action.destructive && { color: colors.destructive },
            ]}>
              {action.label}
            </Text>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </PressableRow>
        ))}
      </View>

      <PressableRow style={styles.cancelButton} onPress={onClose}>
        <Text style={styles.cancelText}>Cancel</Text>
      </PressableRow>
    </AppBottomSheet>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerText: {
      flex: 1,
    },
    title: {
      ...typography.cardTitle,
      color: colors.foreground,
    },
    subtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    closeButton: {
      padding: spacing.xs,
      backgroundColor: colors.muted,
      borderRadius: radius.full,
      marginLeft: spacing.sm,
    },
    actions: {
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: spacing.md,
    },
    actionRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    actionRowPrimary: {
      backgroundColor: `${colors.primary}06`,
    },
    actionRowDestructive: {
      backgroundColor: `${colors.destructive}04`,
    },
    actionIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.muted,
    },
    actionLabel: {
      flex: 1,
      ...typography.body,
      color: colors.foreground,
    },
    cancelButton: {
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.muted,
      alignItems: 'center',
    },
    cancelText: {
      ...typography.bodySemibold,
      color: colors.foreground,
    },
  });
