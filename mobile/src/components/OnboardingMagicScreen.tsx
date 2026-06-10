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
import { Check } from 'lucide-react-native';

const TOTAL_DURATION = 6000;
const MSG_FADE = 300;
const STEP_STAGGER = 500;

const BG = '#F8FAFC';
const BLUE = '#2B7DE9';
const ORANGE = '#F28C28';
const NAME = '#0F172A';
const MUTED = '#94A3B8';
const DIVIDER = '#E2E8F0';
const GREEN = '#22C55E';

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

    // Checklist rows fade + slide in one by one with a 0.5s stagger.
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
        }, 600 + i * STEP_STAGGER)
      );
    });

    // Each status message shows for an equal slice of the total duration
    // with a 0.3s cross-fade between them.
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
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentFade,
            transform: [{ translateY: contentRise }],
            paddingTop: insets.top + 44,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        {/* Top — raw logo mark + wordmark, centred. */}
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

        <View style={styles.divider} />

        {/* Greeting — left aligned. */}
        <View style={styles.greeting}>
          <Text style={styles.welcomeLine}>WELCOME</Text>
          <Text style={styles.nameLine} numberOfLines={1} adjustsFontSizeToFit>
            {firstName || 'aboard'}
          </Text>
          {!!businessName && (
            <Text style={styles.businessName} numberOfLines={1}>
              {businessName}
            </Text>
          )}
        </View>

        {/* Checklist — borderless rows with thin dividers, staggered in. */}
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

        <View style={styles.spacer} />

        {/* Bottom — cycling status + full-width progress bar. */}
        <Animated.Text style={[styles.statusText, { opacity: msgFade }]}>
          {STATUS_MESSAGES[msgIndex]}
        </Animated.Text>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: widthInterpolate }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    flex: 1,
  },
  topBlock: {
    alignItems: 'center',
  },
  logo: {
    width: 80,
    height: 80,
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
    color: MUTED,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  divider: {
    marginTop: 32,
    height: 1,
    width: '100%',
    backgroundColor: DIVIDER,
  },
  greeting: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  welcomeLine: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 3,
    marginBottom: 8,
  },
  nameLine: {
    fontSize: 48,
    fontWeight: '800',
    color: NAME,
    letterSpacing: -1.4,
  },
  businessName: {
    fontSize: 17,
    fontWeight: '500',
    color: BLUE,
    marginTop: 8,
  },
  steps: {
    marginTop: 28,
    paddingHorizontal: 24,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
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
    fontWeight: '500',
    color: NAME,
  },
  spacer: {
    flex: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: MUTED,
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 14,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: DIVIDER,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: BLUE,
  },
});
