import { TouchableOpacity, Text, ActivityIndicator, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import { useTheme } from '../../lib/theme';
import { spacing, radius } from '../../lib/design-tokens';

interface SheetButtonProps {
  label?: string;
  children?: ReactNode;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline';
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

// Reliable bottom-sheet / modal action button. Uses a plain TouchableOpacity with
// explicit theme colours (colors.primary background + colors.primaryForeground text)
// so primary actions never render white-on-white the way the Pressable-based
// Button "brand" variant did on device.
export function SheetButton({
  label,
  children,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon,
  trailingIcon,
  fullWidth = false,
  style,
}: SheetButtonProps) {
  const { colors } = useTheme();
  const isOutline = variant === 'outline';
  const isDisabled = disabled || loading;
  const textColor = isOutline ? colors.foreground : colors.primaryForeground;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          backgroundColor: isOutline ? 'transparent' : colors.primary,
          borderWidth: isOutline ? 1 : 0,
          borderColor: isOutline ? colors.buttonOutline : 'transparent',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          borderRadius: radius.lg,
          minHeight: 48,
          opacity: isDisabled ? 0.6 : 1,
        },
        fullWidth ? { width: '100%' } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : children ? (
        children
      ) : (
        <>
          {icon}
          {label ? (
            <Text style={{ color: textColor, fontSize: 16, fontWeight: '600' }}>{label}</Text>
          ) : null}
          {trailingIcon}
        </>
      )}
    </TouchableOpacity>
  );
}

export default SheetButton;
