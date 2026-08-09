import { ReactNode, useRef, useEffect } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { getStaggerDelay } from '../../lib/animations';

interface AnimatedListItemProps {
  children: ReactNode;
  index: number;
  style?: ViewStyle;
  animationType?: 'fade' | 'slideUp' | 'scaleIn';
  baseDelay?: number;
}

export function AnimatedListItem({
  children,
  index,
  style,
  animationType = 'slideUp',
  baseDelay = 40,
}: AnimatedListItemProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(animationType === 'slideUp' ? 15 : 0)).current;
  const scale = useRef(new Animated.Value(animationType === 'scaleIn' ? 0.95 : 1)).current;

  useEffect(() => {
    const delay = getStaggerDelay(index, baseDelay);
    
    const animations: Animated.CompositeAnimation[] = [
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        delay,
        useNativeDriver: true,
      }),
    ];

    if (animationType === 'slideUp') {
      animations.push(
        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 10,
          delay,
          useNativeDriver: true,
        })
      );
    }

    if (animationType === 'scaleIn') {
      animations.push(
        Animated.spring(scale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          delay,
          useNativeDriver: true,
        })
      );
    }

    Animated.parallel(animations).start();
  }, [index, baseDelay, animationType]);

  const animatedStyle = {
    opacity,
    transform: [
      { translateY },
      { scale },
    ],
  };

  return (
    <Animated.View style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

export default AnimatedListItem;
