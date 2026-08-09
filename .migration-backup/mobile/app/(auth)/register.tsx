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
  Image,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import api, { API_URL } from '../../src/lib/api';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { useAuthStore } from '../../src/lib/store';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { GoogleLogo } from '../../src/components/ui/GoogleLogo';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, typography, fontWeights } from '../../src/lib/design-tokens';

// Conditionally import Apple Authentication - only available in dev/production builds, not Expo Go
let AppleAuthentication: any = null;
try {
  AppleAuthentication = require('expo-apple-authentication');
} catch (e) {
  // Module not available in Expo Go - that's fine, we'll hide the button
}

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const { colors } = useTheme();
  const bottomInset = useBottomInset(40);
  const styles = createStyles(colors);

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

  // Check if Apple Authentication is available
  // On iOS, always show the button - we'll handle errors when pressed
  useEffect(() => {
    const checkAppleAuth = async () => {
      if (Platform.OS === 'ios' && AppleAuthentication) {
        try {
          const isAvailable = await AppleAuthentication.isAvailableAsync();
          if (__DEV__) console.log('🍎 Apple Sign In availability check (register):', isAvailable);
          // Always show button on iOS, even if isAvailableAsync returns false
          // Some iPad models may report false incorrectly
          setAppleAuthAvailable(true);
        } catch (e) {
          if (__DEV__) console.log('🍎 Apple Sign In availability check error (register):', e);
          // Still show button on iOS - let the error happen on press
          setAppleAuthAvailable(true);
        }
      }
    };
    checkAppleAuth();
  }, []);

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      setErrorCode(null);
      return;
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError('Password needs 8 characters, one uppercase, and one special character');
      setErrorCode(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    const response = await api.register({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
      platform: 'mobile',
    });

    setIsLoading(false);

    if (response.error) {
      setError(response.error);
      const code = (response.data as any)?.code;
      setErrorCode(typeof code === 'string' ? code : null);
      return;
    }

    // Registration successful - redirect to email verification pending screen
    // Server requires email verification before login is allowed
    router.replace({
      pathname: '/(auth)/verify-email-pending',
      params: { email: email.trim() }
    });
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      
      // Add mobile flag so server redirects to app deep link
      const googleAuthUrl = `${API_URL}/api/auth/google?mobile=true`;
      
      const result = await WebBrowser.openAuthSessionAsync(
        googleAuthUrl,
        'jobrunner://',
        { showInRecents: true }
      );
      
      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const auth = url.searchParams.get('auth');
        const error = url.searchParams.get('error');
        const token = url.searchParams.get('token');
        
        const isNewUser = url.searchParams.get('isNewUser') === 'true';
        
        if ((auth === 'success' || auth === 'google_success') && token) {
          await api.setToken(token);
          await checkAuth();
          if (isNewUser) {
            router.replace('/(onboarding)/setup');
          } else {
            await resolvePostAuthRedirect();
          }
        } else if (auth === 'success' || auth === 'google_success') {
          await checkAuth();
          const { isAuthenticated } = useAuthStore.getState();
          if (isAuthenticated) {
            if (isNewUser) {
              router.replace('/(onboarding)/setup');
            } else {
              await resolvePostAuthRedirect();
            }
          } else {
            Alert.alert('Error', 'Failed to complete sign-up. Please try again.');
          }
        } else if (error) {
          Alert.alert('Error', 'Google sign-up failed. Please try again.');
        }
      }
    } catch (error) {
      if (__DEV__) console.error('Google Sign-Up error:', error);
      Alert.alert('Error', 'Failed to sign up with Google. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignUp = async () => {
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
        if (__DEV__) console.log('🍎 Apple Sign In isAvailableAsync (register, on press):', isAvailable);
        if (!isAvailable) {
          Alert.alert(
            'Sign in with Apple Unavailable',
            'Sign in with Apple is not available on this device. Please ensure you are signed in to iCloud in Settings, and that your Apple ID has two-factor authentication enabled.'
          );
          return;
        }
      } catch (availErr) {
        if (__DEV__) console.log('🍎 Apple Sign In availability check failed on press (register):', availErr);
        // Continue anyway - let signInAsync fail if needed
      }
      
      if (__DEV__) console.log('🍎 Starting Apple Sign Up...');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      if (__DEV__) console.log('🍎 Apple credential received (register), has token:', !!credential.identityToken);
      
      if (credential.identityToken) {
        const response = await api.post<{ success: boolean; sessionToken: string; isNewUser: boolean }>('/api/auth/apple', {
          identityToken: credential.identityToken,
          fullName: credential.fullName,
          email: credential.email,
        });
        
        if (response.error) {
          if (__DEV__) console.log('🍎 Server error (register):', response.error);
          Alert.alert('Error', response.error);
          return;
        }
        
        if (response.data?.sessionToken) {
          await api.setToken(response.data.sessionToken);
        }
        
        await checkAuth();
        if (response.data?.isNewUser) {
          router.replace('/(onboarding)/setup');
        } else {
          await resolvePostAuthRedirect();
        }
      } else {
        if (__DEV__) console.log('🍎 No identity token received from Apple (register)');
        Alert.alert('Error', 'No identity token received from Apple. Please try again.');
      }
    } catch (err: any) {
      // User canceled the sign-in
      if (err.code === 'ERR_REQUEST_CANCELED' || err.code === 'ERR_CANCELED') {
        if (__DEV__) console.log('🍎 Apple Sign Up canceled by user');
        return;
      }
      
      if (__DEV__) {
        console.error('Apple Sign-Up error:', err);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
      }
      
      // Provide more helpful error messages
      let errorMessage = 'Failed to sign up with Apple. Please try again.';
      if (err.code === 'ERR_REQUEST_NOT_HANDLED') {
        errorMessage = 'Sign in with Apple request was not handled. Please check your device settings and try again.';
      } else if (err.code === 'ERR_INVALID_OPERATION') {
        errorMessage = 'Invalid operation. Please ensure you are signed in to iCloud and try again.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      Alert.alert('Sign Up Error', errorMessage);
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
            <View style={styles.logoOuterRing}>
              <View style={styles.logoInnerRing}>
                <Image
                  source={require('../../assets/jobrunner-logo-header.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </View>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Track jobs, send quotes, get paid.</Text>
          </View>

          <Card>
            <CardContent style={styles.cardContent}>
              {/* Google Sign-Up Button First */}
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
                testID="button-google-signup"
                activeOpacity={0.7}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={colors.foreground} />
                ) : (
                  <>
                    <View style={styles.googleIconContainer}>
                      <GoogleLogo size={20} />
                    </View>
                    <Text style={styles.googleButtonText}>Sign up with Google</Text>
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
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={8}
                      style={styles.appleButton}
                      onPress={handleAppleSignUp}
                    />
                  )}
                </View>
              )}

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign up with email</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.nameRow}>
                <View style={[styles.nameField, { marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>First Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="John"
                    placeholderTextColor={colors.mutedForeground}
                    value={firstName}
                    onChangeText={(text) => {
                      setFirstName(text);
                      setError(null);
                    }}
                    autoCapitalize="words"
                    textContentType="givenName"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    enablesReturnKeyAutomatically={false}
                    testID="input-firstname"
                  />
                </View>
                <View style={[styles.nameField, { marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Smith"
                    placeholderTextColor={colors.mutedForeground}
                    value={lastName}
                    onChangeText={(text) => {
                      setLastName(text);
                      setError(null);
                    }}
                    autoCapitalize="words"
                    textContentType="familyName"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    enablesReturnKeyAutomatically={false}
                    testID="input-lastname"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="john@smithelectrical.com.au"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
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
                    placeholder="Create a password"
                    placeholderTextColor={colors.mutedForeground}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      setError(null);
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
                    onSubmitEditing={handleRegister}
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
                <View style={styles.pwReqs}>
                  {[
                    { label: '8 characters', met: password.length >= 8 },
                    { label: 'Uppercase', met: /[A-Z]/.test(password) },
                    { label: 'Special char', met: /[^A-Za-z0-9]/.test(password) },
                  ].map((r) => (
                    <View
                      key={r.label}
                      style={[styles.pwChip, r.met ? styles.pwChipMet : styles.pwChipUnmet]}
                    >
                      <Ionicons
                        name={r.met ? 'checkmark' : 'ellipse-outline'}
                        size={12}
                        color={r.met ? colors.successDark : colors.mutedForeground}
                      />
                      <Text style={[styles.pwChipText, r.met && styles.pwChipTextMet]}>{r.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.messageContainer}>
                {error ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    {errorCode && errorCode.startsWith('email_in_use_') && errorCode !== 'email_in_use_invitation' ? (
                      <TouchableOpacity
                        onPress={() => router.replace({ pathname: '/(auth)/login', params: { email: email.trim() } } as any)}
                        style={styles.errorActionButton}
                        testID="button-error-signin"
                      >
                        <Text style={styles.errorActionText}>Sign in instead</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => setAgreedToTerms((v) => !v)}
                activeOpacity={0.7}
                testID="checkbox-terms"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreedToTerms }}
              >
                <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                  {agreedToTerms ? (
                    <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
                  ) : null}
                </View>
                <Text style={styles.termsRowText}>
                  I agree to the{' '}
                  <Text style={styles.termsLink} onPress={() => router.push('/more/terms-of-service' as any)}>
                    Terms of Service
                  </Text>{' '}and{' '}
                  <Text style={styles.termsLink} onPress={() => router.push('/more/privacy-policy' as any)}>
                    Privacy Policy
                  </Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, (!agreedToTerms || isLoading) && styles.primaryButtonDisabled]}
                onPress={handleRegister}
                disabled={isLoading || !agreedToTerms}
                activeOpacity={0.8}
                testID="button-create-account"
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.primaryButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>
            </CardContent>
          </Card>

          <View style={styles.spacer} />

          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity testID="link-signin">
                <Text style={styles.signInLink}>Sign In</Text>
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
  content: {
    flex: 1,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['4xl'],
    paddingBottom: spacing['4xl'],
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
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
    marginBottom: spacing.md,
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
    borderColor: '#F28C28',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 44,
    height: 44,
  },
  title: {
    fontSize: typography.sizes['3xl'],
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  cardContent: {
    paddingTop: 20,
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
    marginBottom: 4,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleIconText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.bold,
    color: '#4285F4',
  },
  googleButtonText: {
    color: colors.foreground,
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.medium,
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  dividerText: {
    marginHorizontal: 12,
    color: colors.mutedForeground,
    fontSize: typography.sizes.sm,
  },
  nameRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  nameField: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
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
    fontSize: typography.subtitle.fontSize,
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
    fontSize: typography.subtitle.fontSize,
    color: colors.foreground,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pwReqs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  pwChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  pwChipUnmet: {
    backgroundColor: colors.muted,
    borderColor: colors.border,
  },
  pwChipMet: {
    backgroundColor: colors.successLight,
    borderColor: colors.success + '60',
  },
  pwChipText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  pwChipTextMet: {
    color: colors.successDark,
    fontWeight: fontWeights.semibold,
  },
  messageContainer: {
    minHeight: 52,
    marginBottom: 16,
  },
  errorContainer: {
    padding: 12,
    backgroundColor: colors.destructiveLight,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.destructive,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: colors.destructive,
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
  },
  errorActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.destructive,
  },
  errorActionText: {
    color: colors.primaryForeground,
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
  },
  spacer: {
    flex: 1,
    minHeight: 16,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signInText: {
    color: colors.mutedForeground,
    fontSize: typography.sizes.md,
  },
  signInLink: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
    fontSize: typography.sizes.md,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsRowText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    lineHeight: 19,
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
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
  },
  termsNotice: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
});
