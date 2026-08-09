import { Pressable, Text, ActivityIndicator, View, StyleSheet, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import { useTheme, getVisibleButtonColors } from '../../lib/theme';

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'brand';
type ButtonSize = 'default' | 'sm' | 'lg' | 'xl' | 'icon';

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  children,
  variant = 'default',
  size = 'default',
  onPress,
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
}: ButtonProps) {
  const { colors, isDark } = useTheme();

  const getVariantStyles = (pressed: boolean) => {
    const elevateColor = pressed 
      ? (isDark ? colors.elevate2 : colors.elevate2)
      : 'transparent';
    
    switch (variant) {
      case 'default': {
        // Use the guaranteed-visible helper so primary buttons never render
        // white-on-white when a theme's primary colour lacks contrast.
        const safe = getVisibleButtonColors(
          colors.primary,
          colors.primaryDark,
          colors.primaryForeground,
          colors.card,
          isDark,
        );
        return {
          backgroundColor: pressed ? safe.bgPressed : safe.bg,
          borderColor: safe.border,
          textColor: safe.text,
          overlayColor: elevateColor,
        };
      }
      case 'destructive':
        return {
          backgroundColor: colors.destructive,
          borderColor: colors.destructiveDark,
          textColor: colors.destructiveForeground,
          overlayColor: elevateColor,
        };
      case 'outline':
        return {
          backgroundColor: pressed ? colors.elevate1 : 'transparent',
          borderColor: colors.buttonOutline,
          textColor: colors.foreground,
          overlayColor: 'transparent',
        };
      case 'secondary':
        return {
          backgroundColor: colors.secondary,
          borderColor: isDark 
            ? `rgba(37, 42, 50, 0.15)` 
            : `rgba(227, 227, 227, 0.15)`,
          textColor: colors.secondaryForeground,
          overlayColor: elevateColor,
        };
      case 'ghost':
        return {
          backgroundColor: pressed ? colors.elevate1 : 'transparent',
          borderColor: 'transparent',
          textColor: colors.foreground,
          overlayColor: 'transparent',
        };
      case 'brand':
        // HARDCODED blue for guaranteed visibility - bypassing helper
        return {
          backgroundColor: pressed ? '#1D4ED8' : '#2563EB',
          borderColor: '#1D4ED8',
          textColor: '#FFFFFF',
          overlayColor: elevateColor,
        };
      default:
        return {
          backgroundColor: colors.primary,
          borderColor: colors.primaryDark,
          textColor: colors.primaryForeground,
          overlayColor: elevateColor,
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { 
          minHeight: 32, 
          paddingHorizontal: 12, 
          paddingVertical: 0, 
          fontSize: 12, 
          borderRadius: 6 
        };
      case 'lg':
        return { 
          minHeight: 40, 
          paddingHorizontal: 32, 
          paddingVertical: 0, 
          fontSize: 14, 
          borderRadius: 6 
        };
      case 'xl':
        return { 
          minHeight: 56, 
          paddingHorizontal: 24, 
          paddingVertical: 14, 
          fontSize: 17, 
          borderRadius: 12 
        };
      case 'icon':
        return { 
          height: 36, 
          width: 36, 
          paddingHorizontal: 0, 
          paddingVertical: 0, 
          fontSize: 14, 
          borderRadius: 6 
        };
      default:
        return { 
          minHeight: 36, 
          paddingHorizontal: 16, 
          paddingVertical: 8, 
          fontSize: 14, 
          borderRadius: 6 
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => {
        const variantStyles = getVariantStyles(pressed);
        const baseStyles: ViewStyle = {
          backgroundColor: variantStyles.backgroundColor,
          borderColor: variantStyles.borderColor,
          borderWidth: 1,
          minHeight: sizeStyles.minHeight,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          paddingVertical: sizeStyles.paddingVertical,
          borderRadius: sizeStyles.borderRadius,
          opacity: disabled ? 0.5 : 1,
        };
        
        if ('shadowColor' in variantStyles) {
          const vs = variantStyles as any;
          baseStyles.shadowColor = vs.shadowColor;
          baseStyles.shadowOffset = vs.shadowOffset;
          baseStyles.shadowOpacity = vs.shadowOpacity;
          baseStyles.shadowRadius = vs.shadowRadius;
          baseStyles.elevation = vs.elevation;
        }
        
        return [
          styles.button,
          baseStyles,
          size === 'icon' && { width: sizeStyles.width, height: sizeStyles.height },
          fullWidth && styles.fullWidth,
          style,
        ];
      }}
    >
      {({ pressed }) => {
        const variantStyles = getVariantStyles(pressed);
        return (
          <>
            {pressed && variantStyles.overlayColor !== 'transparent' && (
              <View 
                style={[
                  StyleSheet.absoluteFill, 
                  { 
                    backgroundColor: variantStyles.overlayColor,
                    borderRadius: sizeStyles.borderRadius,
                  }
                ]} 
              />
            )}
            {loading ? (
              <ActivityIndicator color={variantStyles.textColor} size="small" />
            ) : (
              <View style={styles.content}>
                {icon && <View style={styles.icon}>{icon}</View>}
                {typeof children === 'string' ? (
                  <Text
                    style={[
                      styles.text,
                      { color: variantStyles.textColor, fontSize: sizeStyles.fontSize },
                    ]}
                  >
                    {children}
                  </Text>
                ) : (
                  children
                )}
              </View>
            )}
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default Button;
