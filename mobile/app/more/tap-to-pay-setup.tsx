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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useStripeTerminal } from '../../src/hooks/useServices';
import { isTapToPayAvailable } from '../../src/lib/stripe-terminal';
import { useAuthStore } from '../../src/lib/store';
import api from '../../src/lib/api';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { SheetButton } from '../../src/components/ui/SheetButton';
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
  splashScroll: {
    flex: 1,
  },
  splashScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  splashHero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  splashIconOuter: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: colors.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  splashIconInner: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 0,
  },
  splashKicker: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  splashTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.foreground,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  splashSubtitle: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  splashFeatureCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  splashFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  splashFeatureDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 36 + spacing.md,
  },
  splashFeatureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  splashFeatureText: {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
    fontWeight: '600',
  },
  splashFooter: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  splashFooterNote: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  termsContainer: {
    flex: 1,
    padding: spacing.lg,
    paddingBottom: spacing.lg,
  },
  termsHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginLeft: spacing.xs,
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
    paddingBottom: spacing.md,
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
    paddingBottom: spacing.xl,
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
    paddingBottom: spacing.xl,
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
    paddingBottom: spacing.xl,
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
        <Stack.Screen options={{ headerShown: false }} />
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
          title: educationOnly ? 'How to Accept Payments' : 'Tap to Pay Setup',
          headerShown: Platform.OS === 'ios' && (step === 'terms' || step === 'tutorial'),
        }}
      />

      {step === 'splash' && (
        <>
          <ScrollView
            style={styles.splashScroll}
            contentContainerStyle={styles.splashScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.splashHero}>
              <View style={styles.splashIconOuter}>
                <View style={styles.splashIconInner}>
                  <MaterialCommunityIcons name="contactless-payment" size={44} color={colors.primaryForeground} />
                </View>
              </View>

              <Text style={styles.splashKicker}>Get paid on the spot</Text>
              <Text style={styles.splashTitle}>
                Tap to Pay{'\n'}on iPhone
              </Text>
              <Text style={styles.splashSubtitle}>
                Accept contactless payments anywhere with just your iPhone. No extra hardware needed.
              </Text>
            </View>

            <View style={styles.splashFeatureCard}>
              <View style={styles.splashFeature}>
                <View style={styles.splashFeatureIcon}>
                  <Feather name="credit-card" size={18} color={colors.primary} />
                </View>
                <Text style={styles.splashFeatureText}>Accept credit & debit cards</Text>
              </View>
              <View style={styles.splashFeatureDivider} />

              <View style={styles.splashFeature}>
                <View style={styles.splashFeatureIcon}>
                  <Feather name="smartphone" size={18} color={colors.primary} />
                </View>
                <Text style={styles.splashFeatureText}>Accept Apple Pay & digital wallets</Text>
              </View>
              <View style={styles.splashFeatureDivider} />

              <View style={styles.splashFeature}>
                <View style={styles.splashFeatureIcon}>
                  <Feather name="shield" size={18} color={colors.primary} />
                </View>
                <Text style={styles.splashFeatureText}>Secure, encrypted transactions</Text>
              </View>
              <View style={styles.splashFeatureDivider} />

              <View style={styles.splashFeature}>
                <View style={styles.splashFeatureIcon}>
                  <Feather name="zap" size={18} color={colors.primary} />
                </View>
                <Text style={styles.splashFeatureText}>No extra hardware required</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.splashFooter}>
            <SheetButton
              onPress={handleSplashContinue}
              fullWidth
              label="Get Started"
              trailingIcon={<Feather name="arrow-right" size={18} color={colors.primaryForeground} />}
              data-testid="button-splash-continue"
            />
            <Text style={styles.splashFooterNote}>Takes about a minute to set up</Text>
          </View>
        </>
      )}

      {step === 'terms' && (
        <View style={[styles.termsContainer, Platform.OS === 'ios' && { paddingTop: spacing.sm }]}>
          {Platform.OS === 'android' && (
            <PressableRow style={styles.backButton} onPress={() => setStep('splash')} data-testid="button-terms-back">
              <Feather name="chevron-left" size={22} color={colors.foreground} />
              <Text style={styles.backText}>Back</Text>
            </PressableRow>
          )}
          <View style={[styles.termsHeader, Platform.OS === 'ios' && { marginTop: 0, marginBottom: spacing.md }]}>
            <View style={[styles.termsIconContainer, Platform.OS === 'ios' && { width: 56, height: 56, borderRadius: 28, marginBottom: spacing.md }]}>
              <Feather name="file-text" size={Platform.OS === 'ios' ? 28 : 36} color={colors.info} />
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

          <SheetButton
            onPress={handleAcceptTerms}
            disabled={!termsAccepted}
            loading={acceptingTerms}
            fullWidth
            label="Accept & Continue"
            data-testid="button-accept-terms"
          />
        </View>
      )}

      {step === 'tutorial' && (
        <View style={styles.tutorialContainer}>
          {Platform.OS === 'android' && (
            <PressableRow
              style={[styles.backButton, { marginLeft: spacing.md }]}
              onPress={() => (educationOnly ? router.back() : setStep('splash'))}
              data-testid="button-tutorial-back"
            >
              <Feather name="chevron-left" size={22} color={colors.foreground} />
              <Text style={styles.backText}>Back</Text>
            </PressableRow>
          )}
          <View style={[styles.tutorialHeader, Platform.OS === 'ios' && { paddingTop: spacing.sm }]}>
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
            {tutorialSlide > 0 && (
              <SheetButton
                variant="outline"
                onPress={handleTutorialPrev}
                style={{ flex: 1 }}
                label="Previous"
                data-testid="button-tutorial-prev"
              />
            )}
            <SheetButton
              onPress={handleTutorialNext}
              style={{ flex: 1 }}
              label={tutorialSlide === TUTORIAL_SLIDES.length - 1 ? (educationOnly ? 'Done' : 'Finish Setup') : 'Next'}
              data-testid="button-tutorial-next"
            />
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
            <SheetButton
              onPress={handleStartCollecting}
              fullWidth
              label="Start Collecting Payments"
              data-testid="button-start-collecting"
            />

            <SheetButton
              variant="outline"
              onPress={handleViewTutorial}
              fullWidth
              label="View Tutorial Again"
              data-testid="button-view-tutorial"
            />
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

          <SheetButton
            variant="outline"
            onPress={() => router.back()}
            fullWidth
            label="Go Back"
            data-testid="button-non-admin-back"
          />
        </View>
      )}
    </View>
  );
}
