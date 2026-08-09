import { Animated, Easing } from 'react-native';
import { useRef, useEffect } from 'react';

export const springConfig = {
  tension: 40,
  friction: 7,
  useNativeDriver: true,
};

export const smoothSpringConfig = {
  tension: 65,
  friction: 11,
  useNativeDriver: true,
};

export const snappySpringConfig = {
  tension: 100,
  friction: 10,
  useNativeDriver: true,
};

export const timingConfig = {
  duration: 200,
  easing: Easing.bezier(0.4, 0, 0.2, 1),
  useNativeDriver: true,
};

export const slowTimingConfig = {
  duration: 300,
  easing: Easing.bezier(0.4, 0, 0.2, 1),
  useNativeDriver: true,
};

export function useFadeIn(delay: number = 0): Animated.Value {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay]);

  return opacity;
}

export function useSlideUp(delay: number = 0): {
  opacity: Animated.Value;
  translateY: Animated.Value;
} {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay]);

  return { opacity, translateY };
}

export function useScaleIn(delay: number = 0): {
  opacity: Animated.Value;
  scale: Animated.Value;
} {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, [delay]);

  return { opacity, scale };
}

export function usePulse(): {
  scale: Animated.Value;
  pulse: () => void;
} {
  const scale = useRef(new Animated.Value(1)).current;

  const pulse = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 100,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return { scale, pulse };
}

export function useShake(): {
  translateX: Animated.Value;
  shake: () => void;
} {
  const translateX = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(translateX, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 4, duration: 50, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  return { translateX, shake };
}

export function staggeredAnimation(
  animations: Animated.CompositeAnimation[],
  staggerDelay: number = 50
): Animated.CompositeAnimation {
  return Animated.stagger(staggerDelay, animations);
}

export function getStaggerDelay(index: number, baseDelay: number = 50): number {
  return Math.min(index * baseDelay, 300);
}

export function createPressAnimation(
  scale: Animated.Value,
  targetScale: number = 0.95
): {
  onPressIn: () => void;
  onPressOut: () => void;
} {
  return {
    onPressIn: () => {
      Animated.spring(scale, {
        toValue: targetScale,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }).start();
    },
    onPressOut: () => {
      Animated.spring(scale, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start();
    },
  };
}
