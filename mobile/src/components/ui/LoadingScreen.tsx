import { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Image,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../lib/theme';
import { useAuthStore } from '../../lib/store';
import { spacing } from '../../lib/design-tokens';

const JOBRUNNER_LOGO = require('../../../assets/jobrunner-logo.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LoadingScreenProps {
  message?: string;
  showProgress?: boolean;
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    shadowColor: isDark ? '#000' : '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.3 : 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  jobrunnerLogo: {
    width: 120,
    height: 120,
  },
  businessLogo: {
    width: 110,
    height: 110,
    borderRadius: 24,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  progressContainer: {
    marginTop: spacing['2xl'],
    width: 180,
    height: 4,
    backgroundColor: colors.muted,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  shimmerContainer: {
    marginTop: spacing['2xl'],
    width: 180,
    height: 4,
    backgroundColor: colors.muted,
    borderRadius: 2,
    overflow: 'hidden',
  },
  shimmer: {
    width: 90,
    height: '100%',
    borderRadius: 2,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing['2xl'],
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  ringOuter: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    opacity: 0.3,
  },
  ringInner: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    opacity: 0.2,
  },
});

function ShimmerProgress({ colors, isDark }: { colors: ThemeColors; isDark: boolean }) {
  const shimmerPosition = useRef(new Animated.Value(-90)).current;
  const shimmerOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const positionAnimation = Animated.loop(
      Animated.timing(shimmerPosition, {
        toValue: 180,
        duration: 1200,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      })
    );
    
    const opacityAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerOpacity, {
          toValue: 0.3,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    
    positionAnimation.start();
    opacityAnimation.start();
    
    return () => {
      positionAnimation.stop();
      opacityAnimation.stop();
    };
  }, []);

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const shimmerColor = colors.primary;

  return (
    <View style={styles.shimmerContainer}>
      <Animated.View
        style={[
          styles.shimmer,
          { 
            backgroundColor: shimmerColor,
            transform: [{ translateX: shimmerPosition }],
            opacity: shimmerOpacity,
          },
        ]}
      />
    </View>
  );
}

function LoadingDots({ colors, isDark }: { colors: ThemeColors; isDark: boolean }) {
  const dot1Scale = useRef(new Animated.Value(0.8)).current;
  const dot2Scale = useRef(new Animated.Value(0.8)).current;
  const dot3Scale = useRef(new Animated.Value(0.8)).current;
  const dot1Opacity = useRef(new Animated.Value(0.4)).current;
  const dot2Opacity = useRef(new Animated.Value(0.4)).current;
  const dot3Opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animateDot = (scale: Animated.Value, opacity: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1,
              duration: 350,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 350,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 0.8,
              duration: 350,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.4,
              duration: 350,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
    };

    const anim1 = animateDot(dot1Scale, dot1Opacity, 0);
    const anim2 = animateDot(dot2Scale, dot2Opacity, 200);
    const anim3 = animateDot(dot3Scale, dot3Opacity, 400);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, []);

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const dotColor = colors.primary;

  return (
    <View style={styles.dotsContainer}>
      <Animated.View 
        style={[
          styles.dot, 
          { 
            backgroundColor: dotColor,
            opacity: dot1Opacity,
            transform: [{ scale: dot1Scale }],
          }
        ]} 
      />
      <Animated.View 
        style={[
          styles.dot, 
          { 
            backgroundColor: dotColor,
            opacity: dot2Opacity,
            transform: [{ scale: dot2Scale }],
          }
        ]} 
      />
      <Animated.View 
        style={[
          styles.dot, 
          { 
            backgroundColor: dotColor,
            opacity: dot3Opacity,
            transform: [{ scale: dot3Scale }],
          }
        ]} 
      />
    </View>
  );
}

function PulsingRing({ colors, isDark }: { colors: ThemeColors; isDark: boolean }) {
  const ring1Scale = useRef(new Animated.Value(1)).current;
  const ring1Opacity = useRef(new Animated.Value(0.3)).current;
  const ring2Scale = useRef(new Animated.Value(1)).current;
  const ring2Opacity = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const createRingAnimation = (scale: Animated.Value, opacity: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1.15,
              duration: 1800,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 1800,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.3,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
    };

    const anim1 = createRingAnimation(ring1Scale, ring1Opacity, 0);
    const anim2 = createRingAnimation(ring2Scale, ring2Opacity, 900);

    anim1.start();
    anim2.start();

    return () => {
      anim1.stop();
      anim2.stop();
    };
  }, []);

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const ringColor = colors.primary;

  return (
    <>
      <Animated.View
        style={[
          styles.ringOuter,
          {
            borderColor: ringColor,
            transform: [{ scale: ring1Scale }],
            opacity: ring1Opacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.ringInner,
          {
            borderColor: ringColor,
            transform: [{ scale: ring2Scale }],
            opacity: ring2Opacity,
          },
        ]}
      />
    </>
  );
}

function PulsingLogo({ 
  colors,
  isDark,
  businessLogoUrl,
}: { 
  colors: ThemeColors;
  isDark: boolean;
  businessLogoUrl?: string;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.03,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <PulsingRing colors={colors} isDark={isDark} />
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {businessLogoUrl ? (
          <Image 
            source={{ uri: businessLogoUrl }} 
            style={styles.businessLogo}
            resizeMode="cover"
          />
        ) : (
          <Image 
            source={JOBRUNNER_LOGO} 
            style={styles.jobrunnerLogo}
            resizeMode="contain"
          />
        )}
      </Animated.View>
    </View>
  );
}

export function LoadingScreen({ message = 'Loading JobRunner...', showProgress = false }: LoadingScreenProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { businessSettings } = useAuthStore();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (showProgress) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(progressAnim, {
            toValue: 0.85,
            duration: 1800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
          Animated.timing(progressAnim, {
            toValue: 0.95,
            duration: 1500,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
          Animated.delay(300),
          Animated.timing(progressAnim, {
            toValue: 0,
            duration: 200,
            easing: Easing.linear,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [showProgress]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const businessLogoUrl = businessSettings?.logoUrl;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
      <View style={styles.contentWrapper}>
        {/* Static logo without pulsing effect */}
        <View style={styles.logoContainer}>
          {businessLogoUrl ? (
            <Image 
              source={{ uri: businessLogoUrl }} 
              style={styles.businessLogo}
              resizeMode="cover"
            />
          ) : (
            <Image 
              source={JOBRUNNER_LOGO} 
              style={styles.jobrunnerLogo}
              resizeMode="contain"
            />
          )}
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.appName}>JobRunner</Text>
          {message && <Text style={styles.message}>{message}</Text>}
        </View>

        {/* Always use loading dots animation */}
        <LoadingDots colors={colors} isDark={isDark} />
      </View>
    </View>
  );
}

export function LoadingOverlay({ 
  visible = true, 
  message = 'Loading...',
  transparent = true 
}: { 
  visible?: boolean;
  message?: string;
  transparent?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: visible ? 1 : 0.95,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        ...StyleSheet.absoluteFillObject,
        backgroundColor: transparent ? `${colors.background}F2` : colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeAnim,
      }}
    >
      <Animated.View
        style={{
          alignItems: 'center',
          transform: [{ scale: scaleAnim }],
        }}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.md,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.cardBorder,
          }}
        >
          <Image 
            source={JOBRUNNER_LOGO} 
            style={{ width: 56, height: 56 }}
            resizeMode="contain"
          />
        </View>
        <Text
          style={{
            fontSize: 14,
            color: colors.foreground,
            fontWeight: '500',
          }}
        >
          {message}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}
