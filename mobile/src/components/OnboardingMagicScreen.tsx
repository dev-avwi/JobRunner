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
import { useTheme, ThemeColors } from '../lib/theme';

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
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);

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
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentFade,
            transform: [{ translateY: contentRise }],
            paddingTop: insets.top + 56,
            paddingBottom: insets.bottom,
          },
        ]}
      >
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

          <View style={styles.stepsCard}>
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
                  <Check size={15} color="#FFFFFF" strokeWidth={3.5} />
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

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'space-between',
    },
    topBlock: {
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    logoOuterRing: {
      width: 84,
      height: 84,
      borderRadius: 20,
      borderWidth: 2.5,
      borderColor: '#2B7DE9',
      padding: 3,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
      backgroundColor: '#FFFFFF',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.4 : 0.1,
      shadowRadius: 16,
      elevation: 6,
    },
    logoInnerRing: {
      flex: 1,
      width: '100%',
      borderRadius: 14,
      borderWidth: 2,
      borderColor: '#F28C28',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
    },
    logo: {
      width: 44,
      height: 44,
    },
    wordmark: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    wordmarkJob: {
      color: '#2B7DE9',
      fontSize: 26,
      fontWeight: '800',
    },
    wordmarkRunner: {
      color: '#F28C28',
      fontSize: 26,
      fontWeight: '800',
    },
    midBlock: {
      paddingHorizontal: 32,
    },
    welcomeLine: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.mutedForeground,
      letterSpacing: 2.5,
      marginBottom: 6,
    },
    nameLine: {
      fontSize: 46,
      fontWeight: '800',
      color: colors.foreground,
      letterSpacing: -1.2,
    },
    businessName: {
      fontSize: 18,
      fontWeight: '600',
      color: '#2B7DE9',
      marginTop: 8,
    },
    stepsCard: {
      marginTop: 32,
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 18,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 14,
      elevation: 3,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      gap: 14,
    },
    stepRowBorder: {
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    stepIcon: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#22C55E',
    },
    stepText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.foreground,
    },
    bottomBlock: {
      alignItems: 'stretch',
    },
    statusText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.mutedForeground,
      textAlign: 'center',
      letterSpacing: 0.2,
      marginBottom: 16,
    },
    progressTrack: {
      width: '100%',
      height: 4,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#2B7DE9',
    },
  });
