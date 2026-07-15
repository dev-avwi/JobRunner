import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useStripeTerminal } from '../../src/hooks/useServices';
import { isTapToPayAvailable } from '../../src/lib/stripe-terminal';
import { useAuthStore } from '../../src/lib/store';
import api from '../../src/lib/api';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius } from '../../src/lib/design-tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OnboardingStep = 'splash' | 'terms' | 'tutorial' | 'configuring' | 'success' | 'non-admin';

interface TermsStatus {
  accepted: boolean;
  acceptedAt?: string;
  acceptedByName?: string;
  tutorialCompleted: boolean;
  splashShown: boolean;
  termsVersion?: string;
}

const TUTORIAL_SLIDES = [
  {
    id: 'contactless',
    title: 'Accept Contactless Cards',
    subtitle: 'Tap to Pay on iPhone',
    description: 'Accept contactless credit and debit cards directly on your iPhone. Simply hold the card near the top of your device.',
    icon: 'credit-card' as const,
    tips: [
      'Hold card flat against the back of iPhone',
      'Wait for confirmation vibration',
      'Works with all major card networks'
    ]
  },
  {
    id: 'apple-pay',
    title: 'Accept Apple Pay',
    subtitle: 'Digital Wallet Payments',
    description: 'Customers can pay with Apple Pay, Google Pay, and other digital wallets stored on their phones or watches.',
    icon: 'smartphone' as const,
    tips: [
      'Customers double-click side button',
      'Hold device near top of your iPhone',
      'Instant secure payment'
    ]
  },
  {
    id: 'security',
    title: 'Secure & Private',
    subtitle: 'Built-in Protection',
    description: 'All transactions are encrypted end-to-end. Card numbers are never stored on your device or shared with your business.',
    icon: 'shield' as const,
    tips: [
      'End-to-end encryption',
      'No card data stored locally',
      'Compliant with PCI standards'
    ]
  }
];

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: bottomNavHeight,
  },
  header: {
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    paddingTop: 60,
  },
  splashIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  splashSubtitle: {
    fontSize: 18,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 26,
  },
  splashFeatureList: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  splashFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  splashFeatureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  splashFeatureText: {
    flex: 1,
    fontSize: 16,
    color: colors.foreground,
    fontWeight: '500',
  },
  splashCTA: {
    width: '100%',
    marginTop: spacing.lg,
  },
  termsContainer: {
    flex: 1,
    padding: spacing.lg,
  },
  termsHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  termsIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  termsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  termsSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  termsScrollView: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  termsContent: {
    padding: spacing.lg,
  },
  termsText: {
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 22,
  },
  termsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  termsCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  termsCheckbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    marginTop: 2,
  },
  termsCheckboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsCheckboxLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
  tutorialContainer: {
    flex: 1,
  },
  tutorialHeader: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  tutorialProgress: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  tutorialProgressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  tutorialProgressDotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  tutorialSlide: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  tutorialIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  tutorialBadge: {
    marginBottom: spacing.md,
  },
  tutorialTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  tutorialDescription: {
    fontSize: 16,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  tutorialTipsContainer: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tutorialTipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tutorialTip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tutorialTipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  tutorialTipText: {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
  },
  tutorialNavigation: {
    flexDirection: 'row',
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  configuringContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  configuringIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  configuringTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  configuringSubtitle: {
    fontSize: 16,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  configuringSteps: {
    width: '100%',
    marginTop: spacing.lg,
  },
  configuringStep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  configuringStepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  configuringStepIconPending: {
    backgroundColor: colors.muted,
  },
  configuringStepIconActive: {
    backgroundColor: colors.infoLight,
  },
  configuringStepIconComplete: {
    backgroundColor: colors.successLight,
  },
  configuringStepText: {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
  },
  configuringStepTextComplete: {
    color: colors.success,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  successIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  successSubtitle: {
    fontSize: 16,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  successCTA: {
    width: '100%',
    gap: spacing.md,
  },
  nonAdminContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  nonAdminIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  nonAdminTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  nonAdminSubtitle: {
    fontSize: 16,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default function TapToPaySetupScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = createStyles(colors, bottomNavHeight);
  const { user } = useAuthStore();
  const { isInitialized: stripeTerminalReady } = useStripeTerminal();
  const params = useLocalSearchParams<{ mode?: string }>();
  const educationOnly = params.mode === 'education';

  const [step, setStep] = useState<OnboardingStep>('splash');
  const [loading, setLoading] = useState(true);
  const [termsStatus, setTermsStatus] = useState<TermsStatus | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [tutorialSlide, setTutorialSlide] = useState(0);
  const [configProgress, setConfigProgress] = useState(0);
  const [isAdmin, setIsAdmin] = useState(true);

  const checkDeviceCompatibility = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'Not Available',
        'Tap to Pay on iPhone is only available on iOS devices.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return false;
    }

    const available = await isTapToPayAvailable();
    if (!available) {
      Alert.alert(
        'Device Not Supported',
        'Your iPhone does not support Tap to Pay. iPhone XS or later with iOS 16.4+ is required.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return false;
    }
    return true;
  }, []);

  const fetchTermsStatus = useCallback(async (): Promise<TermsStatus | null> => {
    try {
      const response = await api.get<TermsStatus>('/api/tap-to-pay/terms-status');
      const status = response.data ?? null;
      setTermsStatus(status);
      return status;
    } catch (error) {
      console.error('Error fetching terms status:', error);
      return null;
    }
  }, []);

  const determineInitialStep = useCallback(async () => {
    setLoading(true);
    
    const compatible = await checkDeviceCompatibility();
    if (!compatible) {
      setLoading(false);
      return;
    }

    if (educationOnly) {
      setTutorialSlide(0);
      setStep('tutorial');
      setLoading(false);
      return;
    }

    const status = await fetchTermsStatus();
    
    if (status?.accepted && status?.tutorialCompleted) {
      setStep('success');
    } else if (status?.accepted) {
      setStep('tutorial');
    } else if (!status?.splashShown) {
      setStep('splash');
    } else {
      setStep('terms');
    }
    
    setLoading(false);
  }, [checkDeviceCompatibility, fetchTermsStatus, educationOnly]);

  useEffect(() => {
    determineInitialStep();
  }, [determineInitialStep]);

  const handleSplashContinue = async () => {
    try {
      await api.post('/api/tap-to-pay/mark-splash-shown', {});
      setStep('terms');
    } catch (error) {
      console.error('Error marking splash shown:', error);
      setStep('terms');
    }
  };

  const handleAcceptTerms = async () => {
    if (!termsAccepted) {
      Alert.alert('Terms Required', 'Please read and accept the terms & conditions to continue.');
      return;
    }

    setAcceptingTerms(true);
    try {
      const response = await api.post<{ success?: boolean }>('/api/tap-to-pay/accept-terms', {});
      
      if (response.data?.success) {
        // Apple requirement 4.1: merchant education is shown immediately AFTER
        // Tap to Pay is enabled and Terms are accepted — so configure first,
        // then show the education slides.
        runConfiguration();
      }
    } catch (error: any) {
      if (error?.response?.status === 403) {
        setIsAdmin(false);
        setStep('non-admin');
      } else {
        Alert.alert('Error', error?.response?.data?.error || 'Failed to accept terms. Please try again.');
      }
    } finally {
      setAcceptingTerms(false);
    }
  };

  const handleTutorialNext = () => {
    if (tutorialSlide < TUTORIAL_SLIDES.length - 1) {
      setTutorialSlide(prev => prev + 1);
    } else {
      handleTutorialComplete();
    }
  };

  const handleTutorialPrev = () => {
    if (tutorialSlide > 0) {
      setTutorialSlide(prev => prev - 1);
    }
  };

  const runConfiguration = async () => {
    setStep('configuring');
    setConfigProgress(0);

    const progressSteps = [
      { delay: 500, progress: 1 },
      { delay: 1000, progress: 2 },
      { delay: 1500, progress: 3 },
    ];

    for (const s of progressSteps) {
      await new Promise(resolve => setTimeout(resolve, s.delay));
      setConfigProgress(s.progress);
    }

    // Education slides come straight after successful enablement (Apple 4.1)
    setTutorialSlide(0);
    setStep('tutorial');
  };

  const handleTutorialComplete = async () => {
    if (educationOnly) {
      router.back();
      return;
    }

    try {
      await api.post('/api/tap-to-pay/complete-tutorial', {});
    } catch (error) {
      console.error('Error completing tutorial:', error);
    }
    setStep('success');
  };

  const handleStartCollecting = () => {
    router.replace('/more/collect-payment');
  };

  const handleViewTutorial = () => {
    setTutorialSlide(0);
    setStep('tutorial');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Tap to Pay Setup',
            headerShown: true,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.pageSubtitle, { marginTop: spacing.md }]}>
            Checking device compatibility...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: educationOnly ? 'How to Accept Payments' : step === 'splash' ? '' : 'Tap to Pay Setup',
          headerShown: step !== 'splash',
          headerBackTitle: 'Back',
        }}
      />

      {step === 'splash' && (
        <View style={styles.splashContainer}>
          <View style={styles.splashIconContainer}>
            <Feather name="smartphone" size={56} color={colors.primary} />
          </View>
          
          <Text style={styles.splashTitle}>
            Tap to Pay{'\n'}on iPhone
          </Text>
          
          <Text style={styles.splashSubtitle}>
            Accept contactless payments anywhere with just your iPhone. No extra hardware needed.
          </Text>

          <View style={styles.splashFeatureList}>
            <View style={styles.splashFeature}>
              <View style={styles.splashFeatureIcon}>
                <Feather name="check" size={22} color={colors.success} />
              </View>
              <Text style={styles.splashFeatureText}>Accept credit & debit cards</Text>
            </View>
            
            <View style={styles.splashFeature}>
              <View style={styles.splashFeatureIcon}>
                <Feather name="check" size={22} color={colors.success} />
              </View>
              <Text style={styles.splashFeatureText}>Accept Apple Pay & digital wallets</Text>
            </View>
            
            <View style={styles.splashFeature}>
              <View style={styles.splashFeatureIcon}>
                <Feather name="check" size={22} color={colors.success} />
              </View>
              <Text style={styles.splashFeatureText}>Secure, contactless transactions</Text>
            </View>
            
            <View style={styles.splashFeature}>
              <View style={styles.splashFeatureIcon}>
                <Feather name="check" size={22} color={colors.success} />
              </View>
              <Text style={styles.splashFeatureText}>No additional hardware required</Text>
            </View>
          </View>

          <View style={styles.splashCTA}>
            <Button 
              onPress={handleSplashContinue}
              size="lg"
              data-testid="button-splash-continue"
            >
              Get Started
            </Button>
          </View>
        </View>
      )}

      {step === 'terms' && (
        <View style={styles.termsContainer}>
          <View style={styles.termsHeader}>
            <View style={styles.termsIconContainer}>
              <Feather name="file-text" size={36} color={colors.info} />
            </View>
            <Text style={styles.termsTitle}>Terms & Conditions</Text>
            <Text style={styles.termsSubtitle}>
              Please review and accept the terms to enable Tap to Pay
            </Text>
          </View>

          <ScrollView style={styles.termsScrollView}>
            <View style={styles.termsContent}>
              <Text style={styles.termsText}>
                By enabling Tap to Pay on iPhone, you agree to the following terms and conditions:
              </Text>

              <Text style={styles.termsSectionTitle}>1. Service Agreement</Text>
              <Text style={styles.termsText}>
                You agree to use the Tap to Pay on iPhone service in accordance with all applicable laws and regulations, including payment card industry (PCI) standards and Apple's usage guidelines.
              </Text>

              <Text style={styles.termsSectionTitle}>2. Payment Processing</Text>
              <Text style={styles.termsText}>
                Payments processed through Tap to Pay are subject to Stripe's terms of service and payment processing fees. You are responsible for any chargebacks or disputes arising from transactions you process.
              </Text>

              <Text style={styles.termsSectionTitle}>3. Security Requirements</Text>
              <Text style={styles.termsText}>
                You agree to maintain the security of your device and not share your passcode or allow unauthorized access to your iPhone. You must report any suspected unauthorized use immediately.
              </Text>

              <Text style={styles.termsSectionTitle}>4. Data Privacy</Text>
              <Text style={styles.termsText}>
                Card data is processed securely and is never stored on your device. Transaction data may be stored for record-keeping purposes in accordance with our privacy policy.
              </Text>

              <Text style={styles.termsSectionTitle}>5. Liability</Text>
              <Text style={styles.termsText}>
                You acknowledge that you are responsible for ensuring the proper use of the Tap to Pay feature and accept liability for any misuse or unauthorized transactions.
              </Text>

              <Text style={styles.termsSectionTitle}>6. Updates and Changes</Text>
              <Text style={styles.termsText}>
                We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the updated terms.
              </Text>
            </View>
          </ScrollView>

          <PressableRow style={styles.termsCheckboxRow} onPress={() => setTermsAccepted(!termsAccepted)} data-testid="button-terms-checkbox" >
            <View style={[
              styles.termsCheckbox,
              termsAccepted && styles.termsCheckboxChecked
            ]}>
              {termsAccepted && <Feather name="check" size={16} color={colors.primaryForeground} />}
            </View>
            <Text style={styles.termsCheckboxLabel}>
              I have read and agree to the Terms & Conditions for using Tap to Pay on iPhone
            </Text>
          </PressableRow>

          <Button
            onPress={handleAcceptTerms}
            disabled={!termsAccepted || acceptingTerms}
            size="lg"
            data-testid="button-accept-terms"
          >
            {acceptingTerms ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              'Accept & Continue'
            )}
          </Button>
        </View>
      )}

      {step === 'tutorial' && (
        <View style={styles.tutorialContainer}>
          <View style={styles.tutorialHeader}>
            <View style={styles.tutorialProgress}>
              {TUTORIAL_SLIDES.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.tutorialProgressDot,
                    index === tutorialSlide && styles.tutorialProgressDotActive
                  ]}
                />
              ))}
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.tutorialSlide}>
            <View style={styles.tutorialIconContainer}>
              <Feather 
                name={TUTORIAL_SLIDES[tutorialSlide].icon} 
                size={48} 
                color={colors.primary} 
              />
            </View>

            <Badge 
              variant="secondary" 
              style={styles.tutorialBadge}
            >
              {TUTORIAL_SLIDES[tutorialSlide].subtitle}
            </Badge>

            <Text style={styles.tutorialTitle}>
              {TUTORIAL_SLIDES[tutorialSlide].title}
            </Text>

            <Text style={styles.tutorialDescription}>
              {TUTORIAL_SLIDES[tutorialSlide].description}
            </Text>

            <View style={styles.tutorialTipsContainer}>
              <Text style={styles.tutorialTipsTitle}>Quick Tips</Text>
              {TUTORIAL_SLIDES[tutorialSlide].tips.map((tip, index) => (
                <View key={index} style={styles.tutorialTip}>
                  <View style={styles.tutorialTipIcon}>
                    <Feather name="check" size={12} color={colors.success} />
                  </View>
                  <Text style={styles.tutorialTipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.tutorialNavigation}>
            {tutorialSlide > 0 ? (
              <Button 
                variant="outline" 
                onPress={handleTutorialPrev}
                style={{ flex: 1 }}
                data-testid="button-tutorial-prev"
              >
                Previous
              </Button>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Button 
              onPress={handleTutorialNext}
              style={{ flex: 1 }}
              data-testid="button-tutorial-next"
            >
              {tutorialSlide === TUTORIAL_SLIDES.length - 1 ? (educationOnly ? 'Done' : 'Finish Setup') : 'Next'}
            </Button>
          </View>
        </View>
      )}

      {step === 'configuring' && (
        <View style={styles.configuringContainer}>
          <View style={styles.configuringIconContainer}>
            <ActivityIndicator size="large" color={colors.info} />
          </View>

          <Text style={styles.configuringTitle}>Configuring Tap to Pay</Text>
          <Text style={styles.configuringSubtitle}>
            Please wait while we set up your device...
          </Text>

          <View style={styles.configuringSteps}>
            {[
              { label: 'Verifying account', complete: configProgress >= 1 },
              { label: 'Initializing terminal', complete: configProgress >= 2 },
              { label: 'Ready for payments', complete: configProgress >= 3 },
            ].map((item, index) => (
              <View key={index} style={styles.configuringStep}>
                <View style={[
                  styles.configuringStepIcon,
                  item.complete 
                    ? styles.configuringStepIconComplete 
                    : configProgress === index 
                      ? styles.configuringStepIconActive 
                      : styles.configuringStepIconPending
                ]}>
                  {item.complete ? (
                    <Feather name="check" size={18} color={colors.success} />
                  ) : configProgress === index ? (
                    <ActivityIndicator size="small" color={colors.info} />
                  ) : (
                    <Feather name="circle" size={18} color={colors.mutedForeground} />
                  )}
                </View>
                <Text style={[
                  styles.configuringStepText,
                  item.complete && styles.configuringStepTextComplete
                ]}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {step === 'success' && (
        <View style={styles.successContainer}>
          <View style={styles.successIconContainer}>
            <Feather name="check-circle" size={64} color={colors.success} />
          </View>

          <Text style={styles.successTitle}>You're All Set!</Text>
          <Text style={styles.successSubtitle}>
            Tap to Pay on iPhone is now ready. Start accepting contactless payments from your customers.
          </Text>

          <View style={styles.successCTA}>
            <Button 
              onPress={handleStartCollecting}
              size="lg"
              data-testid="button-start-collecting"
            >
              Start Collecting Payments
            </Button>
            
            <Button 
              variant="outline"
              onPress={handleViewTutorial}
              size="lg"
              data-testid="button-view-tutorial"
            >
              View Tutorial Again
            </Button>
          </View>
        </View>
      )}

      {step === 'non-admin' && (
        <View style={styles.nonAdminContainer}>
          <View style={styles.nonAdminIconContainer}>
            <Feather name="lock" size={48} color={colors.warning} />
          </View>

          <Text style={styles.nonAdminTitle}>Admin Required</Text>
          <Text style={styles.nonAdminSubtitle}>
            Contact your admin to enable Tap to Pay on iPhone. Only business administrators can accept the terms and conditions.
          </Text>

          <Button 
            variant="outline"
            onPress={() => router.back()}
            size="lg"
            data-testid="button-non-admin-back"
          >
            Go Back
          </Button>
        </View>
      )}
    </View>
  );
}
