import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { useAuthStore } from '../../src/lib/store';
import { GoogleLogo } from '../../src/components/ui/GoogleLogo';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import api, { API_URL } from '../../src/lib/api';

// Conditionally import Apple Authentication - only available in dev/production builds, not Expo Go
let AppleAuthentication: any = null;
try {
  AppleAuthentication = require('expo-apple-authentication');
} catch (e) {
  // Module not available in Expo Go - that's fine, we'll hide the button
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const { login, checkAuth, isLoading, error, clearError, isAuthenticated, user } = useAuthStore();
  const { colors } = useTheme();
  const bottomInset = useBottomInset(40);
  const styles = createStyles(colors);
  const params = useLocalSearchParams();

  // Check if Apple Authentication is available
  // On iOS, always show the button - we'll handle errors when pressed
  useEffect(() => {
    const checkAppleAuth = async () => {
      if (Platform.OS === 'ios' && AppleAuthentication) {
        try {
          const isAvailable = await AppleAuthentication.isAvailableAsync();
          if (__DEV__) console.log('🍎 Apple Sign In availability check:', isAvailable);
          // Always show button on iOS, even if isAvailableAsync returns false
          // Some iPad models may report false incorrectly
          setAppleAuthAvailable(true);
        } catch (e) {
          if (__DEV__) console.log('🍎 Apple Sign In availability check error:', e);
          // Still show button on iOS - let the error happen on press
          setAppleAuthAvailable(true);
        }
      }
    };
    checkAppleAuth();
  }, []);

  const resolvePostAuthRedirect = async () => {
    const { user: currentUser, businessSettings: bs, fetchBusinessSettings: fetchBs } = useAuthStore.getState();
    if (currentUser?.isPlatformAdmin === true) {
      router.replace('/more/admin' as const);
      return;
    }
    if (!bs) {
      try { await fetchBs(); } catch {}
    }
    const { businessSettings: latestBs } = useAuthStore.getState();
    if (!latestBs?.onboardingCompleted) {
      router.replace('/(onboarding)/setup');
    } else {
      router.replace('/(tabs)');
    }
  };

  // Handle Google OAuth callback via deep link
  useEffect(() => {
    if (params.auth === 'google_success' || params.auth === 'success') {
      checkAuth().then(async () => {
        const { isAuthenticated: loggedIn } = useAuthStore.getState();
        if (loggedIn) {
          await resolvePostAuthRedirect();
        }
      });
    }
  }, [params.auth, params.isNewUser]);

  // Check if error is about email verification
  const isVerificationError = error?.toLowerCase().includes('verify your email') || 
                              error?.toLowerCase().includes('email verification');

  const handleResendVerification = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address first');
      return;
    }

    setResendingVerification(true);
    try {
      const response = await api.post<{ success: boolean; message?: string }>('/api/auth/resend-verification', { email: email.trim() });
      
      if (response.error) {
        Alert.alert('Error', response.error);
      } else {
        setVerificationSent(true);
        Alert.alert('Email Sent', 'A verification email has been sent. Please check your inbox and spam folder.');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to resend verification email. Please try again.');
    } finally {
      setResendingVerification(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    // Reset verification sent state on new login attempt
    setVerificationSent(false);
    const success = await login(email.trim(), password);
    
    if (success) {
      await resolvePostAuthRedirect();
    }
  };

  const handleDemoLogin = async () => {
    if (demoLoading) return;
    setDemoLoading(true);
    clearError();
    try {
      const response = await api.post<{ success: boolean; user: any; sessionToken: string; error?: string }>(
        '/api/auth/demo-login',
        {},
      );
      if (response.error || !response.data?.sessionToken) {
        Alert.alert('Demo unavailable', response.error || 'Could not start the demo right now. Please try again in a moment.');
        return;
      }
      await api.setToken(response.data.sessionToken);
      await checkAuth();
      // Server-side demo-login already guarantees businessSettings.onboardingCompleted=true
      // for the visitor user. Best-effort secondary call + refresh, but never block on it.
      try { await api.post('/api/onboarding/complete', {}); } catch {}
      try {
        const { fetchBusinessSettings: fetchBs } = useAuthStore.getState();
        await fetchBs();
      } catch {}
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Demo unavailable', err?.message || 'Could not start the demo right now.');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      
      // Open Google OAuth in system browser with mobile flag
      // The backend will detect this and redirect back to the app deep link
      const googleAuthUrl = `${API_URL}/api/auth/google?mobile=true`;
      
      const result = await WebBrowser.openAuthSessionAsync(
        googleAuthUrl,
        'jobrunner://',
        { showInRecents: true }
      );
      
      if (result.type === 'success' && result.url) {
        // Parse the callback URL for auth status
        const url = new URL(result.url);
        const auth = url.searchParams.get('auth');
        const errorParam = url.searchParams.get('error');
        const token = url.searchParams.get('token');
        const isNewUser = url.searchParams.get('isNewUser') === 'true';
        
        if ((auth === 'success' || auth === 'google_success') && token) {
          const api = (await import('../../src/lib/api')).default;
          await api.setToken(token);
          await checkAuth();
          await resolvePostAuthRedirect();
        } else if (auth === 'success' || auth === 'google_success') {
          await checkAuth();
          const { isAuthenticated: loggedIn } = useAuthStore.getState();
          if (loggedIn) {
            await resolvePostAuthRedirect();
          } else {
            Alert.alert('Error', 'Failed to complete sign-in. Please try again.');
          }
        } else if (errorParam) {
          Alert.alert('Error', 'Google sign-in failed. Please try again.');
        }
      }
    } catch (err) {
      if (__DEV__) console.error('Google Sign-In error:', err);
      Alert.alert('Error', 'Failed to sign in with Google. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setAppleLoading(true);
      
      // Check if Apple Authentication is available before attempting
      if (!AppleAuthentication) {
        Alert.alert('Not Available', 'Sign in with Apple is not available on this device.');
        return;
      }
      
      // Double-check availability
      try {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (__DEV__) console.log('🍎 Apple Sign In isAvailableAsync (on press):', isAvailable);
        if (!isAvailable) {
          Alert.alert(
            'Sign in with Apple Unavailable',
            'Sign in with Apple is not available on this device. Please ensure you are signed in to iCloud in Settings, and that your Apple ID has two-factor authentication enabled.'
          );
          return;
        }
      } catch (availErr) {
        if (__DEV__) console.log('🍎 Apple Sign In availability check failed on press:', availErr);
        // Continue anyway - let signInAsync fail if needed
      }
      
      if (__DEV__) console.log('🍎 Starting Apple Sign In...');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      if (__DEV__) console.log('🍎 Apple credential received, has token:', !!credential.identityToken);
      
      if (credential.identityToken) {
        const response = await api.post<{ success: boolean; sessionToken: string; isNewUser: boolean }>('/api/auth/apple', {
          identityToken: credential.identityToken,
          fullName: credential.fullName,
          email: credential.email,
        });
        
        if (response.error) {
          if (__DEV__) console.log('🍎 Server error:', response.error);
          Alert.alert('Error', response.error);
          return;
        }
        
        if (response.data?.sessionToken) {
          await api.setToken(response.data.sessionToken);
        }
        
        await checkAuth();
        await resolvePostAuthRedirect();
      } else {
        if (__DEV__) console.log('🍎 No identity token received from Apple');
        Alert.alert('Error', 'No identity token received from Apple. Please try again.');
      }
    } catch (err: any) {
      // User canceled the sign-in
      if (err.code === 'ERR_REQUEST_CANCELED' || err.code === 'ERR_CANCELED') {
        if (__DEV__) console.log('🍎 Apple Sign In canceled by user');
        return;
      }
      
      if (__DEV__) {
        console.error('Apple Sign-In error:', err);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
      }
      
      // Provide more helpful error messages
      let errorMessage = 'Failed to sign in with Apple. Please try again.';
      if (err.code === 'ERR_REQUEST_NOT_HANDLED') {
        errorMessage = 'Sign in with Apple request was not handled. Please check your device settings and try again.';
      } else if (err.code === 'ERR_INVALID_OPERATION') {
        errorMessage = 'Invalid operation. Please ensure you are signed in to iCloud and try again.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      Alert.alert('Sign In Error', errorMessage);
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient
          colors={['#2563eb', '#7c3bbf', '#E8862E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.brandBadge}>
            <Image 
              source={require('../../assets/jobrunner-logo.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandName}>JobRunner</Text>
          <Text style={styles.heroTitle}>Welcome back</Text>
          <Text style={styles.heroSubtitle}>Sign in to keep the jobs moving</Text>
        </LinearGradient>

        <View style={[styles.card, { paddingBottom: bottomInset + 24 }]}>
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  clearError();
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                blurOnSubmit={false}
                enablesReturnKeyAutomatically={false}
                testID="input-email"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Password</Text>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/forgot-password')}
                  testID="link-forgot-password"
                  hitSlop={8}
                >
                  <Text style={styles.linkSmall}>Forgot?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    clearError();
                  }}
                  secureTextEntry={!showPassword}
                  textContentType="oneTimeCode"
                  autoComplete="off"
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  enablesReturnKeyAutomatically={false}
                  onSubmitEditing={handleLogin}
                  testID="input-password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  accessibilityState={{ selected: showPassword }}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                {isVerificationError && (
                  <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleResendVerification}
                    disabled={resendingVerification || verificationSent}
                  >
                    {resendingVerification ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={styles.resendButtonText}>
                        {verificationSent ? 'Email Sent!' : 'Resend Verification'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={styles.primaryButtonText}>Sign in</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or sign in with</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
                testID="button-google-signin"
                activeOpacity={0.75}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={colors.foreground} />
                ) : (
                  <>
                    <GoogleLogo size={18} />
                    <Text style={styles.socialButtonText}>Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {appleAuthAvailable && AppleAuthentication && (
                <View style={styles.appleButtonContainer}>
                  {appleLoading ? (
                    <View style={styles.appleLoadingContainer}>
                      <ActivityIndicator size="small" color={colors.white} />
                    </View>
                  ) : (
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={12}
                      style={styles.appleButton}
                      onPress={handleAppleSignIn}
                    />
                  )}
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.demoLink}
              onPress={handleDemoLogin}
              disabled={demoLoading}
              testID="button-demo-login"
              activeOpacity={0.7}
            >
              {demoLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.demoLinkText}>
                  Just browsing? <Text style={styles.demoLinkAction}>Try the demo</Text>
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.termsNotice}>
            By signing in, you agree to our{' '}
            <Text style={styles.termsLink} onPress={() => router.push('/more/terms-of-service' as any)}>
              Terms of Service
            </Text>{' '}and{' '}
            <Text style={styles.termsLink} onPress={() => router.push('/more/privacy-policy' as any)}>
              Privacy Policy
            </Text>
          </Text>

          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity testID="link-signup">
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    paddingTop: 72,
    paddingHorizontal: 28,
    paddingBottom: 56,
    alignItems: 'center',
  },
  brandBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  brandLogo: {
    width: 40,
    height: 40,
  },
  brandName: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 28,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.background,
    marginTop: -28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  form: {},
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  linkSmall: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  input: {
    height: 54,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    color: colors.foreground,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    height: 54,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.foreground,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  errorContainer: {
    padding: 14,
    marginBottom: 16,
    backgroundColor: colors.destructiveLight,
    borderRadius: 12,
    flexDirection: 'column',
    gap: 10,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 14,
    fontWeight: '500',
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  resendButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  dividerText: {
    marginHorizontal: 12,
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    height: 50,
    gap: 8,
  },
  socialButtonText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  appleButtonContainer: {
    flex: 1,
    height: 50,
  },
  appleButton: {
    width: '100%',
    height: 50,
  },
  appleLoadingContainer: {
    width: '100%',
    height: 50,
    backgroundColor: '#000000',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoLink: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 10,
  },
  demoLinkText: {
    color: colors.mutedForeground,
    fontSize: 14,
  },
  demoLinkAction: {
    color: colors.primary,
    fontWeight: '600',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  signUpText: {
    color: colors.mutedForeground,
    fontSize: 15,
  },
  signUpLink: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  termsNotice: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 12,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});
