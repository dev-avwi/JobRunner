import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { ReactNode, useMemo } from 'react';
import { useTheme, ThemeColors } from '../../lib/theme';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

function getVariantStyles(variant: BadgeVariant, colors: ThemeColors) {
  switch (variant) {
    case 'default':
      return {
        backgroundColor: colors.primaryLight,
        borderColor: 'transparent',
        textColor: colors.primary,
      };
    case 'secondary':
      return {
        backgroundColor: colors.cardHover,
        borderColor: 'transparent',
        textColor: colors.foreground,
      };
    case 'destructive':
      return {
        backgroundColor: colors.destructiveLight,
        borderColor: 'transparent',
        textColor: colors.destructive,
      };
    case 'outline':
      return {
        backgroundColor: 'transparent',
        borderColor: colors.border,
        textColor: colors.foreground,
      };
    case 'success':
      return {
        backgroundColor: colors.successLight,
        borderColor: 'transparent',
        textColor: colors.success,
      };
    case 'warning':
      return {
        backgroundColor: colors.warningLight,
        borderColor: 'transparent',
        textColor: colors.warning,
      };
    case 'info':
      return {
        backgroundColor: colors.infoLight,
        borderColor: 'transparent',
        textColor: colors.primary,
      };
    default:
      return {
        backgroundColor: colors.primaryLight,
        borderColor: 'transparent',
        textColor: colors.primary,
      };
  }
}

export function Badge({ children, variant = 'default', style, textStyle }: BadgeProps) {
  const { colors } = useTheme();
  
  const variantStyles = useMemo(() => getVariantStyles(variant, colors), [variant, colors]);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: variantStyles.backgroundColor,
          borderColor: variantStyles.borderColor,
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={[styles.text, { color: variantStyles.textColor }, textStyle]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

export default Badge;
