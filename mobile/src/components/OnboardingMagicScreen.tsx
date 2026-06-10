import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';

const TOTAL_DURATION = 6000;
const MSG_FADE = 300;

const BLUE = '#2B7DE9';
const ORANGE = '#F28C28';
const NAME = '#0F172A';
const TAGLINE = '#94A3B8';
const STEP_TEXT = '#334155';
const DIVIDER = '#E8EDF3';
const GREEN = '#22C55E';
const STATUS = '#64748B';
const TRACK = '#E2E8F0';

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
  const contentRise = useRef(new Animated.Value(16)).current;
  const msgFade = useRef(new Animated.Value(1)).current;
  const stepAnims = useRef(SETUP_STEPS.map(() => new Animated.Value(0))).current;
  const [msgIndex, setMsgIndex] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(contentRise, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

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
      <LinearGradient
        colors={['#FFFFFF', '#F4F7FB', '#EAF1FA']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft brand glow behind the logo so the top isn't a flat white void. */}
      <LinearGradient
        colors={['rgba(43,125,233,0.10)', 'rgba(43,125,233,0)']}
        style={[styles.glow, { top: insets.top - 40 }]}
      />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentFade,
            transform: [{ translateY: contentRise }],
            paddingTop: insets.top + 44,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <View style={styles.topBlock}>
          <Image
            source={require('../../assets/jobrunner-logo-header.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.wordmark}>
            <Text style={styles.wordmarkJob}>Job</Text>
            <Text style={styles.wordmarkRunner}>Runner</Text>
          </Text>
          <Text style={styles.tagline}>For Australian Tradies</Text>
        </View>

        <View style={styles.midBlock}>
          <Text style={styles.welcomeLine}>WELCOME</Text>
          <Text style={styles.nameLine} numberOfLines={1} adjustsFontSizeToFit>
            {firstName || 'aboard'}
          </Text>
          {!!businessName && (
            <Text style={styles.businessName} numberOfLines={1}>
              {businessName}
            </Text>
          )}

          <View style={styles.steps}>
            {SETUP_STEPS.map((label, i) => (
              <Animated.View
                key={label}
                style={[
                  styles.stepRow,
                  i > 0 && styles.stepRowBorder,
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
                  <Check size={14} color="#FFFFFF" strokeWidth={3.5} />
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
    backgroundColor: '#FFFFFF',
  },
  glow: {
    position: 'absolute',
    alignSelf: 'center',
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  content: {
    flex: 1,
  },
  topBlock: {
    alignItems: 'center',
  },
  logo: {
    width: 76,
    height: 76,
    marginBottom: 16,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  wordmarkJob: {
    color: BLUE,
    fontSize: 28,
    fontWeight: '800',
  },
  wordmarkRunner: {
    color: ORANGE,
    fontSize: 28,
    fontWeight: '800',
  },
  tagline: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    color: TAGLINE,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  midBlock: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  welcomeLine: {
    fontSize: 12,
    fontWeight: '700',
    color: BLUE,
    letterSpacing: 3.5,
    marginBottom: 8,
  },
  nameLine: {
    fontSize: 50,
    fontWeight: '800',
    color: NAME,
    letterSpacing: -1.4,
  },
  businessName: {
    fontSize: 18,
    fontWeight: '600',
    color: BLUE,
    marginTop: 8,
  },
  steps: {
    marginTop: 32,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    gap: 14,
  },
  stepRowBorder: {
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
  },
  stepIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: STEP_TEXT,
  },
  bottomBlock: {
    paddingHorizontal: 30,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: STATUS,
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 14,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: TRACK,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: BLUE,
  },
});
