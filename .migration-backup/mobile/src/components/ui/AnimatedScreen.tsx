import { ReactNode, useRef, useEffect } from 'react';
import { Animated, ViewStyle, StyleSheet, Easing } from 'react-native';

interface AnimatedScreenProps {
  children: ReactNode;
  style?: ViewStyle;
  delay?: number;
}

export function AnimatedScreen({
  children,
  style,
  delay = 0,
}: AnimatedScreenProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay]);

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          opacity, 
          transform: [{ translateY }] 
        }, 
        style
      ]}
    >
      {children}
    </Animated.View>
  );
}

interface AnimatedListItemProps {
  children: ReactNode;
  index: number;
  style?: ViewStyle;
}

export function AnimatedListItem({
  children,
  index,
  style,
}: AnimatedListItemProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    const delay = Math.min(index * 40, 200);
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [index]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

interface AnimatedPressableProps {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  disabled?: boolean;
}

export function useAnimatedPress() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.98,
        duration: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.9,
        duration: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  };

  return {
    scale,
    opacity,
    onPressIn,
    onPressOut,
    animatedStyle: {
      transform: [{ scale }],
      opacity,
    },
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default AnimatedScreen;
