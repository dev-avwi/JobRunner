import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle, XCircle, ArrowLeft } from 'lucide-react-native';
import api from '../../src/lib/api';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useAuthStore } from '../../src/lib/store';
import { typography, fontWeights } from '../../src/lib/design-tokens';

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { colors } = useTheme();
  const bottomInset = useBottomInset(24);
  const styles = createStyles(colors);
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    if (token) {
      verifyEmail();
    } else {
      setVerifying(false);
      setError('No verification token provided');
    }
  }, [token]);

  const verifyEmail = async () => {
    try {
      setVerifying(true);
      setError(null);
      
      const response = await api.post<{ sessionToken?: string; isNewUser?: boolean }>('/api/auth/verify-email', { token });
      
      if (response.error) {
        setError(response.error || 'Verification failed');
        setSuccess(false);
      } else {
        setSuccess(true);
        
        if (response.data?.sessionToken) {
          await api.setToken(response.data.sessionToken);
        }
        
        await checkAuth();
        // No auto-redirect — show the success state with a Continue button so
        // users get clear confirmation and control over the next step.
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'An error occurred during verification');
      setSuccess(false);
    } finally {
      setVerifying(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.content, { paddingBottom: bottomInset }]}>
        {verifying ? (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.title}>Verifying your email...</Text>
            <Text style={styles.description}>
              Please wait while we verify your email address.
            </Text>
          </>
        ) : success ? (
          <>
            <View style={styles.iconContainer}>
              <CheckCircle size={64} color={colors.success} strokeWidth={1.5} />
            </View>
            <Text style={styles.title}>Email verified</Text>
            <Text style={styles.description}>
              You're all set. Tap continue to start using JobRunner.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                const { businessSettings } = useAuthStore.getState();
                if (!businessSettings?.onboardingCompleted) {
                  router.replace('/(onboarding)/setup' as const);
                } else {
                  router.replace('/(tabs)' as const);
                }
              }}
              testID="button-continue-verified"
            >
              <Text style={styles.retryText}>Continue</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.iconContainer}>
              <XCircle size={64} color={colors.destructive} strokeWidth={1.5} />
            </View>
            <Text style={styles.title}>Verification Failed</Text>
            <Text style={styles.description}>
              {error || 'The verification link may have expired or is invalid.'}
            </Text>
            
            <TouchableOpacity
              style={styles.retryButton}
              onPress={verifyEmail}
              testID="button-retry-verification"
            >
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </>
        )}

        {!verifying && !success && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToLogin}
            testID="button-back-to-login"
          >
            <ArrowLeft size={18} color={colors.foreground} />
            <Text style={styles.backText}>Back to sign in</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: typography.subtitle.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 16,
  },
  retryText: {
    color: colors.primaryForeground,
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 24,
  },
  backText: {
    fontSize: typography.subtitle.fontSize,
    color: colors.foreground,
    marginLeft: 8,
  },
});
