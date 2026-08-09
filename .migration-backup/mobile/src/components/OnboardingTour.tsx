import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Dimensions,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../lib/theme';
import { spacing, radius, typography } from '../lib/design-tokens';
import haptics from '../lib/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to JobRunner!',
    description: 'The all-in-one app for Australian tradespeople. Let\'s show you around.',
    icon: 'home',
    color: '#3b82f6',
  },
  {
    id: 'jobs',
    title: 'Manage Your Jobs',
    description: 'Create, schedule, and track jobs from quote to completion. Tap the + button to create your first job.',
    icon: 'briefcase',
    color: '#10b981',
  },
  {
    id: 'documents',
    title: 'Quotes & Invoices',
    description: 'Create professional quotes and invoices with GST. Convert quotes to invoices with one tap.',
    icon: 'file-text',
    color: '#f59e0b',
  },
  {
    id: 'payments',
    title: 'Get Paid Faster',
    description: 'Accept card payments, send payment links, and track all your payments in one place.',
    icon: 'credit-card',
    color: '#8b5cf6',
  },
  {
    id: 'team',
    title: 'Team Management',
    description: 'Invite team members, assign jobs, and track everyone\'s location in real-time.',
    icon: 'users',
    color: '#ec4899',
  },
  {
    id: 'ready',
    title: 'You\'re All Set!',
    description: 'Start by adding your first client or creating a job. We\'re here to help you grow your business.',
    icon: 'check-circle',
    color: '#22c55e',
  },
];

const ONBOARDING_KEY = 'onboarding_completed';

interface OnboardingTourProps {
  forceShow?: boolean;
  onComplete?: () => void;
}

export function OnboardingTour({ forceShow = false, onComplete }: OnboardingTourProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(0));
  
  useEffect(() => {
    checkOnboardingStatus();
  }, [forceShow]);
  
  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, currentStep]);
  
  const checkOnboardingStatus = async () => {
    if (forceShow) {
      setVisible(true);
      return;
    }
    
    try {
      const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!completed) {
        setVisible(true);
      }
    } catch (error) {
      if (__DEV__) console.log('Error checking onboarding status:', error);
    }
  };
  
  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (error) {
      if (__DEV__) console.log('Error saving onboarding status:', error);
    }
    setVisible(false);
    onComplete?.();
  };
  
  const nextStep = () => {
    haptics.selection();
    fadeAnim.setValue(0);
    
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  };
  
  const prevStep = () => {
    haptics.selection();
    fadeAnim.setValue(0);
    
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const skip = () => {
    haptics.light();
    completeOnboarding();
  };
  
  if (!visible) return null;
  
  const step = TOUR_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOUR_STEPS.length - 1;
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={skip}
    >
      <LinearGradient colors={['#1E3A5F', '#0F172A']} style={styles.overlay}>
        <Animated.View 
          style={[
            styles.container, 
            { 
              backgroundColor: colors.card,
              opacity: fadeAnim,
              transform: [{
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              }],
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.skipButton} 
            onPress={skip}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
          </TouchableOpacity>
          
          <View style={[styles.iconContainer, { backgroundColor: step.color + '20' }]}>
            <Feather name={step.icon} size={48} color={step.color} />
          </View>
          
          <Text style={[styles.title, { color: colors.foreground }]}>{step.title}</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            {step.description}
          </Text>
          
          <View style={styles.dotsContainer}>
            {TOUR_STEPS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === currentStep ? colors.primary : colors.muted,
                    width: index === currentStep ? 24 : 8,
                  },
                ]}
              />
            ))}
          </View>
          
          <View style={[styles.buttonRow, { marginBottom: insets.bottom }]}>
            {!isFirstStep && (
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton, { borderColor: colors.border }]}
                onPress={prevStep}
              >
                <Feather name="chevron-left" size={20} color={colors.foreground} />
                <Text style={[styles.buttonText, { color: colors.foreground }]}>Back</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[
                styles.button, 
                styles.primaryButton, 
                { backgroundColor: colors.primary },
                isFirstStep && { flex: 1 },
              ]}
              onPress={nextStep}
            >
              <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                {isLastStep ? 'Get Started' : 'Next'}
              </Text>
              {!isLastStep && (
                <Feather name="chevron-right" size={20} color={colors.primaryForeground} />
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </LinearGradient>
    </Modal>
  );
}

export async function resetOnboarding() {
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch (error) {
    if (__DEV__) console.log('Error resetting onboarding:', error);
  }
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
    return !!completed;
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  skipButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    padding: spacing.sm,
  },
  skipText: {
    fontSize: typography.sizes.sm,
    fontWeight: '500', fontFamily: 'Inter_500Medium',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: '700', fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.sizes.md,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  primaryButton: {},
  secondaryButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: typography.sizes.md,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
  },
});
