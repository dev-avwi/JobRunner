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

const TOTAL_DURATION = 4500;

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
      duration: 500,
      useNativeDriver: true,
    }).start();

    Animated.timing(progress, {
      toValue: 1,
      duration: TOTAL_DURATION,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();

    const stepMs = TOTAL_DURATION / STATUS_MESSAGES.length;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < STATUS_MESSAGES.length; i++) {
      timers.push(
        setTimeout(() => {
          Animated.timing(msgFade, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setMsgIndex(i);
            Animated.timing(msgFade, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }).start();
          });
        }, stepMs * i)
      );
    }

    const finish = setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone();
    }, TOTAL_DURATION + 250);
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
      <Image
        source={require('../../assets/onboarding-tradie.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(8,12,20,0.55)', 'rgba(8,12,20,0.78)', 'rgba(8,12,20,0.92)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentFade,
            paddingTop: insets.top + 40,
            paddingBottom: insets.bottom + 48,
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
    backgroundColor: '#080c14',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'space-between',
  },
  topBlock: {
    alignItems: 'center',
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
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
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
    fontSize: 30,
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
    color: 'rgba(255,255,255,0.7)',
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
    backgroundColor: 'rgba(255,255,255,0.18)',
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
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
});
