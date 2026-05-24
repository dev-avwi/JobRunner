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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { GoogleLogo } from '../../src/components/ui/GoogleLogo';
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
      // Explicitly mark onboarding complete (transactional) so demo users
      // never get bounced into the wizard on cold start, deep-link, or token
      // refresh. Endpoint is idempotent. If it fails we surface the error
      // and abort navigation rather than landing in a broken state.
      const completeRes = await api.post('/api/onboarding/complete', {});
      if (completeRes.error) {
        Alert.alert('Demo unavailable', completeRes.error || 'Could not finalise the demo session. Please try again.');
        return;
      }
      const { fetchBusinessSettings: fetchBs } = useAuthStore.getState();
      const refreshed = await fetchBs();
      const bsState = useAuthStore.getState().businessSettings;
      if (!bsState?.onboardingCompleted) {
        Alert.alert('Demo unavailable', 'Could not finalise the demo session. Please try again.');
        return;
      }
      void refreshed;
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
        <View style={[styles.content, { paddingBottom: bottomInset }]}>
          <View style={styles.header}>
            <View style={styles.logoGradientContainer}>
              <View style={styles.logoInner}>
                <Image 
                  source={require('../../assets/jobrunner-logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </View>
            <View style={styles.appNameContainer}>
              <Text style={styles.appNameBlue}>Job</Text>
              <Text style={styles.appNameOrange}>Runner</Text>
            </View>
            <Text style={styles.tagline}>Welcome back!</Text>
            <Text style={styles.taglineSubtext}>Sign in to manage your trade business</Text>
          </View>

          <Card>
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>Enter your email and password to continue</CardDescription>
            </CardHeader>
            <CardContent>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
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
                <Text style={styles.inputLabel}>Password</Text>
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
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.primaryButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.forgotPassword}
                onPress={() => router.push('/(auth)/forgot-password')}
                testID="link-forgot-password"
              >
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
                testID="button-google-signin"
                activeOpacity={0.7}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={colors.foreground} />
                ) : (
                  <>
                    <View style={styles.googleIconContainer}>
                      <GoogleLogo size={20} />
                    </View>
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.demoButton}
                onPress={handleDemoLogin}
                disabled={demoLoading}
                testID="button-demo-login"
                activeOpacity={0.7}
              >
                {demoLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="sparkles-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
                    <Text style={styles.demoButtonText}>Use demo account</Text>
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
                      cornerRadius={8}
                      style={styles.appleButton}
                      onPress={handleAppleSignIn}
                    />
                  )}
                </View>
              )}
            </CardContent>
          </Card>

          <Text style={styles.termsNotice}>
            By signing in, you agree to our{' '}
            <Text style={styles.termsLink} onPress={() => router.push('/more/terms-of-service' as any)}>
              Terms of Service
            </Text>{' '}and{' '}
            <Text style={styles.termsLink} onPress={() => router.push('/more/privacy-policy' as any)}>
              Privacy Policy
            </Text>
          </Text>

          <View style={styles.spacer} />

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
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoGradientContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    padding: 3,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    backgroundColor: '#E8862E',
  },
  logoInner: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 100,
    height: 100,
  },
  appNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  appNameBlue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  appNameOrange: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#E8862E',
  },
  tagline: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  taglineSubtext: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 8,
  },
  input: {
    height: 52,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    color: colors.foreground,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.foreground,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  errorContainer: {
    padding: 12,
    marginBottom: 16,
    backgroundColor: colors.destructiveLight,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.destructive,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: colors.destructive,
    fontSize: 14,
    fontWeight: '500',
  },
  resendButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primary + '15',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    alignSelf: 'flex-start',
  },
  resendButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  successContainer: {
    padding: 12,
    backgroundColor: colors.successLight,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successText: {
    flex: 1,
    color: colors.success,
    fontSize: 14,
    fontWeight: '500',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 15,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  dividerText: {
    marginHorizontal: 16,
    color: colors.mutedForeground,
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 24,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  googleIconText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  googleButtonText: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '500',
  },
  demoButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '12',
    borderWidth: 1,
    borderColor: colors.primary + '40',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 24,
  },
  demoButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  appleButtonContainer: {
    marginTop: 12,
    width: '100%',
  },
  appleButton: {
    width: '100%',
    height: 48,
  },
  appleLoadingContainer: {
    width: '100%',
    height: 48,
    backgroundColor: '#000000',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    height: 16,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
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
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: '600',
  },
  termsNotice: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});
