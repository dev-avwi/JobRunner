import { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, PanResponder, Animated, LayoutChangeEvent, GestureResponderEvent, PanResponderGestureState, Platform } from 'react-native';

interface SliderProps {
  style?: object;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  value?: number;
  onValueChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
}

export function Slider({
  style,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  value = 0,
  onValueChange,
  onSlidingComplete,
  minimumTrackTintColor = '#007AFF',
  maximumTrackTintColor = '#E0E0E0',
  thumbTintColor = '#007AFF',
}: SliderProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const containerWidthRef = useRef(0);
  const currentValue = useRef(value);
  const thumbPosition = useRef(new Animated.Value(0)).current;
  const startPosition = useRef(0);
  const thumbRadius = 12;

  const getPositionFromValue = (val: number, width: number) => {
    if (width <= thumbRadius * 2) return 0;
    const range = maximumValue - minimumValue;
    if (range === 0) return 0;
    const normalizedValue = (val - minimumValue) / range;
    return normalizedValue * (width - thumbRadius * 2);
  };

  const getValueFromPosition = (position: number, width: number) => {
    if (width <= thumbRadius * 2) return minimumValue;
    const clampedPosition = Math.max(0, Math.min(width - thumbRadius * 2, position));
    const normalizedPosition = clampedPosition / (width - thumbRadius * 2);
    const range = maximumValue - minimumValue;
    let val = minimumValue + normalizedPosition * range;
    if (step > 0) {
      val = Math.round(val / step) * step;
    }
    return Math.max(minimumValue, Math.min(maximumValue, val));
  };

  useEffect(() => {
    if (containerWidthRef.current > 0) {
      currentValue.current = value;
      thumbPosition.setValue(getPositionFromValue(value, containerWidthRef.current));
    }
  }, [value]);

  const onLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setContainerWidth(width);
    containerWidthRef.current = width;
    thumbPosition.setValue(getPositionFromValue(value, width));
    currentValue.current = value;
  };

  const handleGrant = (evt: GestureResponderEvent) => {
    const touchX = evt.nativeEvent.locationX;
    startPosition.current = touchX - thumbRadius;
    const newValue = getValueFromPosition(touchX - thumbRadius, containerWidthRef.current);
    currentValue.current = newValue;
    thumbPosition.setValue(getPositionFromValue(newValue, containerWidthRef.current));
    onValueChange?.(newValue);
  };

  const handleMove = (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
    const width = containerWidthRef.current;
    const newPosition = startPosition.current + gestureState.dx;
    const clampedPosition = Math.max(0, Math.min(width - thumbRadius * 2, newPosition));
    const newValue = getValueFromPosition(clampedPosition, width);
    
    if (newValue !== currentValue.current) {
      currentValue.current = newValue;
      thumbPosition.setValue(getPositionFromValue(newValue, width));
      onValueChange?.(newValue);
    }
  };

  const handleRelease = () => {
    onSlidingComplete?.(currentValue.current);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: handleGrant,
      onPanResponderMove: handleMove,
      onPanResponderRelease: handleRelease,
      onPanResponderTerminate: handleRelease,
    })
  ).current;

  const progressWidth = thumbPosition.interpolate({
    inputRange: [0, Math.max(1, containerWidth - thumbRadius * 2)],
    outputRange: [thumbRadius, Math.max(thumbRadius, containerWidth - thumbRadius)],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, style]} onLayout={onLayout} {...panResponder.panHandlers}>
      <View style={[styles.track, { backgroundColor: maximumTrackTintColor }]} />
      <Animated.View
        style={[
          styles.progress,
          { backgroundColor: minimumTrackTintColor, width: progressWidth },
        ]}
      />
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: thumbTintColor,
            transform: [{ translateX: thumbPosition }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: Platform.OS === 'android' ? 44 : 40,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
  },
  progress: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
});

export default Slider;
