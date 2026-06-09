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
import { Check } from 'lucide-react-native';

const TOTAL_DURATION = 6000;
const MSG_FADE = 300;

const STATUS_MESSAGES = [
  'Setting up your business profile',
  'Preparing your dashboard',
  'Almost ready',
];

const SETUP_STEPS = [
  'Your business profile is ready',
  'Your trade templates are configured',
  'Your team workspace is live',
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
  const stepAnims = useRef(SETUP_STEPS.map(() => new Animated.Value(0))).current;
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

    // Setup-step rows fade + slide in one by one with a 0.4s stagger.
    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    stepAnims.forEach((anim, i) => {
      stepTimers.push(
        setTimeout(() => {
          Animated.timing(anim, {
            toValue: 1,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }, 600 + i * 400)
      );
    });

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

    return () => [...timers, ...stepTimers].forEach(clearTimeout);
  }, []);

  const widthInterpolate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="38%" rx="75%" ry="60%" fx="50%" fy="38%">
            <Stop offset="0%" stopColor="#2B7DE9" stopOpacity={0.08} />
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
            paddingTop: insets.top + 56,
            paddingBottom: insets.bottom,
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
          <Text style={styles.welcomeLine}>Welcome,</Text>
          <Text style={styles.nameLine}>{firstName || 'aboard'}</Text>
          {!!businessName && <Text style={styles.businessName}>{businessName}</Text>}

          <View style={styles.divider} />

          <View style={styles.stepsBlock}>
            {SETUP_STEPS.map((label, i) => (
              <Animated.View
                key={label}
                style={[
                  styles.stepRow,
                  {
                    opacity: stepAnims[i],
                    transform: [
                      {
                        translateY: stepAnims[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [10, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.stepIcon}>
                  <Check size={14} color="#2B7DE9" strokeWidth={3} />
                </View>
                <Text style={styles.stepText}>{label}</Text>
              </Animated.View>
            ))}
          </View>
        </View>

        <View style={styles.bottomBlock}>
          <Animated.Text style={[styles.statusText, { opacity: msgFade }]}>
            {STATUS_MESSAGES[msgIndex]}
          </Animated.Text>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: widthInterpolate }]} />
          </View>
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
    justifyContent: 'space-between',
  },
  topBlock: {
    alignItems: 'center',
    paddingHorizontal: 32,
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
    paddingHorizontal: 32,
  },
  welcomeLine: {
    fontSize: 30,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.5,
  },
  nameLine: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginTop: 2,
  },
  businessName: {
    fontSize: 20,
    fontWeight: '500',
    color: '#2B7DE9',
    marginTop: 10,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: 28,
    marginBottom: 24,
  },
  stepsBlock: {
    gap: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    gap: 14,
  },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43,125,233,0.16)',
  },
  stepText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.70)',
  },
  bottomBlock: {
    alignItems: 'stretch',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 16,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2B7DE9',
  },
});
