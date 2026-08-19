/**
 * Shared style factory for project setup sub-sections.
 */
import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../lib/theme';
import { spacing, typography, fontWeights } from '../../lib/design-tokens';

export function sharedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    empty: {
      fontSize: typography.sizes.sm,
      color: colors.mutedForeground,
      marginBottom: spacing.md,
      lineHeight: 20,
    },
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm,
    },
    itemBullet: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemBulletText: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.primary,
    },
    itemTitle: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
      flex: 1,
    },
    itemMeta: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      padding: spacing.md,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.primary + '50',
      borderStyle: 'dashed',
    },
    addButtonText: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.medium,
      color: colors.primary,
    },
    // Modal styles
    modalContainer: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    modalCancel: {
      fontSize: typography.sizes.md,
      color: colors.mutedForeground,
      minWidth: 60,
    },
    modalSave: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.semibold,
      color: colors.primary,
      minWidth: 60,
      textAlign: 'right',
    },
    modalContent: {
      padding: spacing.lg,
      gap: spacing.md,
      paddingBottom: 80,
    },
    // Form
    field: {
      gap: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    label: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.medium,
      color: colors.mutedForeground,
      marginBottom: 2,
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      fontSize: typography.sizes.md,
      color: colors.foreground,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      minHeight: 46,
    },
    selectorValue: {
      fontSize: typography.sizes.md,
      color: colors.foreground,
      flex: 1,
    },
    selectorPlaceholder: {
      fontSize: typography.sizes.md,
      color: colors.mutedForeground,
      flex: 1,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.md,
    },
    sectionSubtitle: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: spacing.sm,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    deleteButtonText: {
      fontSize: typography.sizes.sm,
      color: colors.destructive,
    },
  });
}
