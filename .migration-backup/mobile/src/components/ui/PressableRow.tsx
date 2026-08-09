import { ReactNode, useRef, useCallback, forwardRef, useMemo } from 'react';
import {
  Pressable,
  PressableProps,
  Animated,
  Easing,
  Platform,
  StyleProp,
  StyleSheet,
  ViewStyle,
  View,
  GestureResponderEvent,
} from 'react-native';
import { useTheme } from '../../lib/theme';
import { triggerHaptic, HapticType } from '../../lib/haptics';

export interface PressableRowProps extends Omit<PressableProps, 'style' | 'children'> {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  haptic?: HapticType;
  rippleColor?: string;
  borderless?: boolean;
}

const PressableRow = forwardRef<View, PressableRowProps>(function PressableRow(
  {
    children,
    style,
    haptic = 'light',
    rippleColor,
    borderless = false,
    onPress,
    disabled,
    ...rest
  },
  ref,
) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const isAndroid = Platform.OS === 'android';

  const handlePressIn = useCallback(() => {
    if (isAndroid) return;
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.99,
        duration: 80,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.85,
        duration: 80,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity, isAndroid]);

  const handlePressOut = useCallback(() => {
    if (isAndroid) return;
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
  }, [scale, opacity, isAndroid]);

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (haptic !== 'none') {
        triggerHaptic(haptic);
      }
      onPress?.(e);
    },
    [haptic, onPress],
  );

  const androidRipple = isAndroid
    ? {
        color: rippleColor ?? colors.ripple ?? colors.elevate1,
        borderless,
        foreground: true,
      }
    : undefined;

  const { outerLayoutStyle, innerStyle } = useMemo(() => {
    const flat = (StyleSheet.flatten(style) as ViewStyle) || {};
    const out: ViewStyle = {};
    const inner: ViewStyle = { ...flat };
    const keys: (keyof ViewStyle)[] = [
      'flex', 'flexGrow', 'flexShrink', 'flexBasis',
      'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
      'alignSelf', 'position', 'top', 'right', 'bottom', 'left', 'zIndex',
      'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
      'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
    ];
    for (const k of keys) {
      if (flat[k] !== undefined) {
        (out as Record<string, unknown>)[k] = flat[k];
        // Layout keys live on the outer Pressable only; leaving them on the
        // inner view too double-applies margins/offsets (cards render
        // narrower than siblings).
        delete (inner as Record<string, unknown>)[k];
      }
    }
    // Sizing must transfer to the inner view so the visible card fills the
    // outer layout box.
    if (flat.width !== undefined || flat.alignSelf === 'stretch' || flat.flex !== undefined || flat.flexGrow !== undefined) {
      inner.width = '100%';
    }
    if (flat.height !== undefined) {
      inner.height = '100%';
    }
    return { outerLayoutStyle: out, innerStyle: inner };
  }, [style]);

  if (isAndroid) {
    return (
      <Pressable
        ref={ref}
        onPress={handlePress}
        disabled={disabled}
        android_ripple={androidRipple}
        style={style}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <Pressable
      ref={ref}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={outerLayoutStyle}
      {...rest}
    >
      <Animated.View style={[innerStyle, { transform: [{ scale }], opacity }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
});

export { PressableRow };
export default PressableRow;
