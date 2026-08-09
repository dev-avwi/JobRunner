import { ReactNode, useRef, useCallback } from 'react';
import { Pressable, Animated, Easing, ViewStyle, PressableProps } from 'react-native';
import { triggerHaptic, HapticType } from '../../lib/haptics';

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  children: ReactNode;
  style?: ViewStyle;
  scaleValue?: number;
  opacityValue?: number;
  duration?: number;
  haptic?: HapticType;
}

export function AnimatedPressable({
  children,
  style,
  scaleValue = 0.97,
  opacityValue = 0.85,
  duration = 100,
  haptic = 'light',
  onPress,
  disabled,
  ...rest
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: scaleValue,
        duration,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: opacityValue,
        duration,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity, scaleValue, opacityValue, duration]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 400,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity]);

  const handlePress = useCallback((e: any) => {
    if (haptic !== 'none') {
      triggerHaptic(haptic);
    }
    onPress?.(e);
  }, [haptic, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export function AnimatedCardPressable({
  children,
  style,
  onPress,
  disabled,
  ...rest
}: AnimatedPressableProps) {
  return (
    <AnimatedPressable
      style={style}
      scaleValue={0.985}
      opacityValue={0.9}
      duration={120}
      onPress={onPress}
      disabled={disabled}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

export function AnimatedListItemPressable({
  children,
  style,
  onPress,
  disabled,
  ...rest
}: AnimatedPressableProps) {
  return (
    <AnimatedPressable
      style={style}
      scaleValue={0.99}
      opacityValue={0.85}
      duration={80}
      onPress={onPress}
      disabled={disabled}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}

export { triggerHaptic };
export type { HapticType };
export default AnimatedPressable;
