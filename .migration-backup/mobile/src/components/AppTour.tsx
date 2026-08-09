import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, typography } from '../lib/design-tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  route?: string;
  highlight?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to JobRunner!',
    description: 'This quick tour will show you around the app. You\'ll learn where everything is and how to get started.',
    icon: 'star',
  },
  {
    id: 'dashboard',
    title: 'Your Dashboard',
    description: 'This is your home base. See today\'s jobs, track earnings, and access quick actions all in one place.',
    icon: 'home',
    route: '/(tabs)',
  },
  {
    id: 'jobs',
    title: 'Managing Jobs',
    description: 'Jobs flow through stages: Pending → Scheduled → In Progress → Done → Invoiced. Track every job from start to finish.',
    icon: 'briefcase',
    route: '/(tabs)/jobs',
  },
  {
    id: 'more-menu',
    title: 'More Features',
    description: 'Tap the profile icon to access Clients, Quotes, Invoices, Settings, and more. Everything you need is just a tap away.',
    icon: 'grid',
    highlight: 'profile',
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Start by adding your first client, then create a job and send a quote. You\'ve got this!',
    icon: 'check-circle',
    route: '/(tabs)',
  },
];

const STORAGE_KEY = 'jobrunner-mobile-tour-completed';

interface AppTourProps {
  visible: boolean;
  onClose: () => void;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    width: SCREEN_WIDTH - spacing.lg * 2,
    maxWidth: 400,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  header: {
    backgroundColor: colors.primaryLight,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  stepLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  title: {
    ...typography.title,
    color: colors.foreground,
    fontSize: 18,
  },
  closeButton: {
    padding: spacing.sm,
    marginRight: -spacing.sm,
  },
  content: {
    padding: spacing.lg,
  },
  description: {
    ...typography.body,
    color: colors.mutedForeground,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  progressDot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.muted,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  progressDotCompleted: {
    backgroundColor: colors.primary + '60',
    width: 8,
  },
  progressDotPending: {
    width: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.muted,
  },
  buttonText: {
    ...typography.body,
    fontWeight: '600',
  },
  buttonTextPrimary: {
    color: colors.primaryForeground,
  },
  buttonTextSecondary: {
    color: colors.foreground,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  skipButtonText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
});

export default function AppTour({ visible, onClose }: AppTourProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [currentStep, setCurrentStep] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(1));

  const step = TOUR_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
    }
  }, [visible]);

  const animateTransition = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    
    setTimeout(callback, 150);
  };

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      animateTransition(() => {
        const nextStep = TOUR_STEPS[currentStep + 1];
        if (nextStep.route) {
          router.push(nextStep.route as any);
        }
        setCurrentStep(prev => prev + 1);
      });
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      animateTransition(() => {
        const prevStep = TOUR_STEPS[currentStep - 1];
        if (prevStep.route) {
          router.push(prevStep.route as any);
        }
        setCurrentStep(prev => prev - 1);
      });
    }
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch (e) {
      if (__DEV__) console.warn('Failed to save tour completion:', e);
    }
    router.push('/(tabs)');
    onClose();
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY + '-skipped', 'true');
    } catch (e) {
      if (__DEV__) console.warn('Failed to save tour skip:', e);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconContainer}>
                <Feather name={step.icon} size={22} color={colors.primaryForeground} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.stepLabel}>
                  Step {currentStep + 1} of {TOUR_STEPS.length}
                </Text>
                <Text style={styles.title} numberOfLines={1}>
                  {step.title}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={handleSkip}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.description}>{step.description}</Text>

            <View style={styles.progressContainer}>
              {TOUR_STEPS.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    index === currentStep && styles.progressDotActive,
                    index < currentStep && styles.progressDotCompleted,
                    index > currentStep && styles.progressDotPending,
                  ]}
                />
              ))}
            </View>

            <View style={styles.buttonRow}>
              {!isFirstStep && (
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={handlePrevious}
                >
                  <Feather name="chevron-left" size={18} color={colors.foreground} />
                  <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Back</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleNext}
              >
                <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
                  {isLastStep ? "Let's Go!" : 'Next'}
                </Text>
                {!isLastStep && (
                  <Feather name="chevron-right" size={18} color={colors.primaryForeground} />
                )}
              </TouchableOpacity>
            </View>

            {isFirstStep && (
              <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipButtonText}>Skip tour</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export async function checkTourCompleted(): Promise<boolean> {
  try {
    const completed = await AsyncStorage.getItem(STORAGE_KEY);
    return !!completed;
  } catch {
    return false;
  }
}

export async function resetTour(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(STORAGE_KEY + '-skipped');
  } catch (e) {
    if (__DEV__) console.warn('Failed to reset tour:', e);
  }
}
