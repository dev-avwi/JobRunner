import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { PartyPopper, CheckCircle2, DollarSign } from 'lucide-react-native';
import { useTheme } from '../lib/theme';
import { typography, radius } from '../lib/design-tokens';
import { onCelebrate, type CelebrationType } from '../lib/celebrate';

const { width: SCREEN_W } = Dimensions.get('window');

interface Piece {
  key: number;
  x: number;
  y: number;
  color: string;
  rotate: number;
}

const DURATION = 1400;

export default function Celebration() {
  const { colors } = useTheme();
  const [active, setActive] = useState<CelebrationType | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);

  const popScale = useRef(new Animated.Value(0)).current;
  const popOpacity = useRef(new Animated.Value(0)).current;
  const fall = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const config: Record<CelebrationType, { Icon: typeof PartyPopper; label: string; color: string }> = {
    invoice_paid: { Icon: DollarSign, label: 'Paid!', color: colors.success },
    quote_accepted: { Icon: CheckCircle2, label: 'Quote accepted!', color: colors.primary },
    job_completed: { Icon: PartyPopper, label: 'Job done!', color: colors.success },
  };

  useEffect(() => {
    const confettiColors = [colors.success, colors.primary, '#F59E0B', '#A855F7'];
    const unsubscribe = onCelebrate((type) => {
      const next: Piece[] = Array.from({ length: 14 }, (_, i) => ({
        key: Date.now() + i,
        x: (Math.random() - 0.5) * SCREEN_W * 0.8,
        y: 220 + Math.random() * 160,
        color: confettiColors[i % confettiColors.length],
        rotate: Math.random() * 720 - 360,
      }));
      setPieces(next);
      setActive(type);

      popScale.setValue(0);
      popOpacity.setValue(0);
      fall.setValue(0);

      Animated.parallel([
        Animated.spring(popScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(popOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(fall, { toValue: 1, duration: DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();

      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        Animated.timing(popOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
          setActive(null);
        });
      }, DURATION);
    });

    return () => {
      unsubscribe();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [colors]);

  if (!active) return null;

  const { Icon, label, color } = config[active];

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {pieces.map((p) => {
        const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [0, p.y] });
        const translateX = fall.interpolate({ inputRange: [0, 1], outputRange: [0, p.x] });
        const rotate = fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotate}deg`] });
        const opacity = fall.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View
            key={p.key}
            style={[
              styles.piece,
              { backgroundColor: p.color, opacity, transform: [{ translateX }, { translateY }, { rotate }] },
            ]}
          />
        );
      })}

      <Animated.View style={{ opacity: popOpacity, transform: [{ scale: popScale }], alignItems: 'center' }}>
        <View style={[styles.badge, { backgroundColor: color + '22' }]}>
          <Icon size={44} color={color} />
        </View>
        <View style={[styles.labelWrap, { backgroundColor: colors.card }]}>
          <Text style={[typography.bodySemibold, { color }]}>{label}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // zIndex (iOS) + elevation (Android) for stacking only; transparent
    // overlay, no shadow intended.
    zIndex: 99998,
    elevation: 99998,
  },
  piece: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
});
