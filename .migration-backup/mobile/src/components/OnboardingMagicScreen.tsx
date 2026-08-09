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
import { useTheme } from '../lib/theme';

const TOTAL_DURATION = 6000;
const MSG_FADE = 300;
const STEP_STAGGER = 500;

// Brand ring colours — kept in sync with the premium login screen's logo badge.
const RING_BLUE = '#2B7DE9';
const RING_ORANGE = '#F28C28';

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
  const { colors } = useTheme();

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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentFade,
            transform: [{ translateY: contentRise }],
            paddingTop: insets.top + 56,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        {/* Top — premium double-ring logo badge + wordmark, centred. */}
        <View style={styles.topBlock}>
          <View style={styles.logoOuterRing}>
            <View style={styles.logoInnerRing}>
              <Image
                source={require('../../assets/jobrunner-logo-header.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>
          <Text style={styles.wordmark}>
            <Text style={styles.wordmarkJob}>Job</Text>
            <Text style={styles.wordmarkRunner}>Runner</Text>
          </Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            For Australian Tradies
          </Text>
        </View>

        {/* Greeting — centred to match the premium completion step. */}
        <View style={styles.greeting}>
          <Text style={[styles.welcomeLine, { color: colors.mutedForeground }]}>WELCOME</Text>
          <Text
            style={[styles.nameLine, { color: colors.foreground }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {firstName || 'aboard'}
          </Text>
          {!!businessName && (
            <Text style={[styles.businessName, { color: colors.primary }]} numberOfLines={1}>
              {businessName}
            </Text>
          )}
        </View>

        {/* Checklist — bordered card with staggered rows, matching the
            onboarding completion screen's card language. */}
        <View style={[styles.stepsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {SETUP_STEPS.map((label, i) => (
            <Animated.View
              key={label}
              style={[
                styles.stepRow,
                i > 0 && [styles.stepRowBorder, { borderTopColor: colors.cardBorder }],
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
              <View style={[styles.stepIcon, { backgroundColor: colors.success }]}>
                <Check size={14} color="#FFFFFF" strokeWidth={3.5} />
              </View>
              <Text style={[styles.stepText, { color: colors.foreground }]}>{label}</Text>
            </Animated.View>
          ))}
        </View>

        <View style={styles.spacer} />

        {/* Bottom — cycling status + full-width progress bar. */}
        <Animated.Text style={[styles.statusText, { color: colors.mutedForeground, opacity: msgFade }]}>
          {STATUS_MESSAGES[msgIndex]}
        </Animated.Text>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <Animated.View
            style={[styles.progressFill, { width: widthInterpolate, backgroundColor: colors.primary }]}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
  },
  topBlock: {
    alignItems: 'center',
  },
  logoOuterRing: {
    width: 84,
    height: 84,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: RING_BLUE,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  logoInnerRing: {
    flex: 1,
    width: '100%',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: RING_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 44,
    height: 44,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  wordmarkJob: {
    color: RING_BLUE,
    fontSize: 28,
    fontWeight: '800',
  },
  wordmarkRunner: {
    color: RING_ORANGE,
    fontSize: 28,
    fontWeight: '800',
  },
  tagline: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  greeting: {
    marginTop: 36,
    alignItems: 'center',
  },
  welcomeLine: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 8,
  },
  nameLine: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.2,
    textAlign: 'center',
  },
  businessName: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  stepsCard: {
    marginTop: 32,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    gap: 14,
  },
  stepRowBorder: {
    borderTopWidth: 1,
  },
  stepIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  spacer: {
    flex: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 14,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
