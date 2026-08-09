import { ReactNode } from 'react';
import { Platform, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../lib/theme';

let LiquidGlassView: any = null;
let isLiquidGlassSupported = false;

if (Platform.OS === 'ios') {
  try {
    const lg = require('@callstack/liquid-glass');
    LiquidGlassView = lg.LiquidGlassView;
    isLiquidGlassSupported = lg.isLiquidGlassSupported;
  } catch (e) {}
}

function hexToRgba(hex: string, opacity: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

const SPRING_DOWN = { damping: 20, stiffness: 400, mass: 0.45 };
const SPRING_UP = { damping: 15, stiffness: 280, mass: 0.4 };

interface GlassButtonProps {
  onPress: () => void;
  children: ReactNode;
  size?: number;
  tint?: string;
  disabled?: boolean;
  testID?: string;
}

export function GlassButton({
  onPress,
  children,
  size = 44,
  tint,
  disabled = false,
  testID,
}: GlassButtonProps) {
  const { isDark, colors } = useTheme();
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pressed = useSharedValue(0);

  const baseColor = tint || colors.primary;
  const bgNormal = hexToRgba(baseColor, isDark ? 0.16 : 0.09);
  const bgPressed = hexToRgba(baseColor, isDark ? 0.28 : 0.16);
  const borderRadius = size / 2;

  const fireHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };
  const firePress = () => {
    if (!disabled) onPress();
  };

  const gesture = Gesture.Pan()
    .onBegin((e) => {
      runOnJS(fireHaptic)();
      scale.value = withSpring(0.91, SPRING_DOWN);
      pressed.value = withTiming(1, { duration: 60 });
      const ox = (e.x - size / 2) / (size / 2);
      const oy = (e.y - size / 2) / (size / 2);
      translateX.value = withSpring(ox * 1.2, SPRING_DOWN);
      translateY.value = withSpring(oy * 1.2, SPRING_DOWN);
    })
    .onUpdate((e) => {
      const ox = Math.max(-1, Math.min(1, (e.x - size / 2) / (size / 2)));
      const oy = Math.max(-1, Math.min(1, (e.y - size / 2) / (size / 2)));
      translateX.value = ox * 1.2;
      translateY.value = oy * 1.2;
    })
    .onEnd(() => {
      runOnJS(firePress)();
    })
    .onFinalize(() => {
      scale.value = withSpring(1, SPRING_UP);
      pressed.value = withTiming(0, { duration: 200 });
      translateX.value = withSpring(0, SPRING_UP);
      translateY.value = withSpring(0, SPRING_UP);
    })
    .minDistance(0)
    .maxPointers(1);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const fallbackBgStyle = useAnimatedStyle(() => ({
    backgroundColor: pressed.value > 0.5 ? bgPressed : bgNormal,
  }));

  const glassInnerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          outerStyle,
          !isLiquidGlassSupported &&
            Platform.select({
              ios: {
                shadowColor: baseColor,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isDark ? 0.15 : 0.06,
                shadowRadius: 4,
              },
              android: { elevation: 1 },
            }),
        ]}
        testID={testID}
      >
        {isLiquidGlassSupported && LiquidGlassView ? (
          <LiquidGlassView
            style={glassInnerStyle}
            interactive
            effect="regular"
          >
            {children}
          </LiquidGlassView>
        ) : (
          <Animated.View style={[fallbackBgStyle, glassInnerStyle]}>
            {children}
          </Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

interface GlassModuleProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function GlassModule({ children, style }: GlassModuleProps) {
  return (
    <View
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}
    >
      {children}
    </View>
  );
}
