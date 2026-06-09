import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

const TOTAL_DURATION = 6000;
const MSG_FADE = 300;

const STATUS_MESSAGES = [
  'Setting up your business profile',
  'Preparing your dashboard',
  'Almost ready',
];

interface OnboardingMagicScreenProps {
  firstName?: string;
  businessName?: string;
  onDone: () => void;
}

export function OnboardingMagicScreen({ firstName, businessName, onDone }: OnboardingMagicScreenProps) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const msgFade = useRef(new Animated.Value(1)).current;
  const [msgIndex, setMsgIndex] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    Animated.timing(contentFade, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();

    // Progress bar animates across the full duration.
    Animated.timing(progress, {
      toValue: 1,
      duration: TOTAL_DURATION,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();

    // Each status message shows for an equal slice of the total duration
    // (2s each across 6s) with a 0.3s cross-fade between them.
    const stepMs = TOTAL_DURATION / STATUS_MESSAGES.length;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < STATUS_MESSAGES.length; i++) {
      timers.push(
        setTimeout(() => {
          Animated.timing(msgFade, {
            toValue: 0,
            duration: MSG_FADE,
            useNativeDriver: true,
          }).start(() => {
            setMsgIndex(i);
            Animated.timing(msgFade, {
              toValue: 1,
              duration: MSG_FADE,
              useNativeDriver: true,
            }).start();
          });
        }, stepMs * i)
      );
    }

    // Advance only after the full duration has elapsed — never tied to whether
    // background seeding finished.
    const finish = setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone();
    }, TOTAL_DURATION);
    timers.push(finish);

    return () => timers.forEach(clearTimeout);
  }, []);

  const widthInterpolate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const greeting = firstName ? `Welcome, ${firstName}` : 'Welcome aboard';

  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="30%" rx="70%" ry="55%" fx="50%" fy="30%">
            <Stop offset="0%" stopColor="#2B7DE9" stopOpacity={0.15} />
            <Stop offset="100%" stopColor="#2B7DE9" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
      </Svg>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentFade,
            paddingTop: insets.top + 44,
            paddingBottom: insets.bottom + 52,
          },
        ]}
      >
        <View style={styles.topBlock}>
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/jobrunner-logo-header.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.wordmark}>
            <Text style={styles.wordmarkJob}>Job</Text>
            <Text style={styles.wordmarkRunner}>Runner</Text>
          </Text>
        </View>

        <View style={styles.midBlock}>
          <Text style={styles.greeting}>{greeting}</Text>
          {!!businessName && <Text style={styles.businessName}>{businessName}</Text>}
          <Text style={styles.subtitle}>We're getting everything ready for you</Text>
        </View>

        <View style={styles.bottomBlock}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: widthInterpolate }]} />
          </View>
          <Animated.Text style={[styles.statusText, { opacity: msgFade }]}>
            {STATUS_MESSAGES[msgIndex]}
          </Animated.Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'space-between',
  },
  topBlock: {
    alignItems: 'center',
  },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  logo: {
    width: 46,
    height: 46,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  wordmarkJob: {
    color: '#5AA2F5',
    fontSize: 28,
    fontWeight: '800',
  },
  wordmarkRunner: {
    color: '#F7A23B',
    fontSize: 28,
    fontWeight: '800',
  },
  midBlock: {
    alignItems: 'center',
  },
  greeting: {
    fontSize: 31,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  businessName: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.68)',
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomBlock: {
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#2B7DE9',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
