import { Pressable, Animated, ViewStyle, Platform } from 'react-native';
import { ReactNode, useRef } from 'react';
import { useTheme } from '../../lib/theme';
import { radius, shadows } from '../../lib/design-tokens';

interface PressableCardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
}

export function PressableCard({ children, onPress, style, disabled }: PressableCardProps) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isAndroid = Platform.OS === 'android';

  const handlePressIn = () => {
    if (isAndroid) return;
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    if (isAndroid) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View style={isAndroid ? undefined : { transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        android_ripple={
          isAndroid
            ? {
                color: colors.ripple ?? colors.elevate1,
                borderless: false,
                foreground: true,
              }
            : undefined
        }
        style={({ pressed }) => [
          {
            backgroundColor: !isAndroid && pressed ? colors.cardHover : colors.card,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            overflow: 'hidden',
            ...shadows.xs,
          },
          style,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default PressableCard;
