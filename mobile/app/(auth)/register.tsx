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
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import api, { API_URL } from '../../src/lib/api';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { useAuthStore } from '../../src/lib/store';
import { GoogleLogo } from '../../src/components/ui/GoogleLogo';
import { useTheme, ThemeColors } from '../../src/lib/theme';

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
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const { colors } = useTheme();
  const bottomInset = useBottomInset(40);
  const styles = createStyles(colors);

  // Password strength: 0 empty, 1 weak (<8), 2 ok (8+), 3 strong (12+ with mix)
  const passwordStrength = (() => {
    if (!password) return 0;
    if (password.length < 8) return 1;
    const hasMix = /[A-Z]/.test(password) && /[0-9!@#$%^&*]/.test(password);
    if (password.length >= 12 && hasMix) return 3;
    return 2;
  })();
  const strengthLabel = ['', 'Too short', 'Good', 'Strong'][passwordStrength];
  const strengthColor =
    passwordStrength === 1 ? colors.destructive :
    passwordStrength === 2 ? '#E8862E' :
    passwordStrength === 3 ? '#16a34a' : colors.mutedForeground;

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
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    setError(null);

    const response = await api.register({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
      tradeType: 'general',
    });

    setIsLoading(false);

    if (response.error) {
      setError(response.error);
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
          const api = (await import('../../src/lib/api')).default;
          await api.setToken(token);
          await checkAuth();
          await resolvePostAuthRedirect();
        } else if (auth === 'success' || auth === 'google_success') {
          await checkAuth();
          const { isAuthenticated } = useAuthStore.getState();
          if (isAuthenticated) {
            await resolvePostAuthRedirect();
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
        await resolvePostAuthRedirect();
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
        <View style={styles.hero}>
          <View style={styles.brandRow}>
            <Image 
              source={require('../../assets/jobrunner-logo.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <Text style={styles.brandName}>
              <Text style={styles.brandJob}>Job</Text>
              <Text style={styles.brandRunner}>Runner</Text>
            </Text>
          </View>
          <Text style={styles.heroTitle}>Create your account</Text>
          <Text style={styles.heroSubtitle}>Get started in under 2 minutes</Text>
        </View>

        <View style={[styles.card, { paddingBottom: bottomInset + 24 }]}>
          <View style={styles.form}>
            <View style={styles.nameRow}>
              <View style={[styles.nameField, { marginRight: 8 }]}>
                <Text style={styles.inputLabel}>First name</Text>
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
                <Text style={styles.inputLabel}>Last name</Text>
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
                placeholder="you@example.com"
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
              {password.length > 0 ? (
                <View style={styles.strengthRow}>
                  <View style={styles.strengthBars}>
                    <View style={[
                      styles.strengthBar,
                      { backgroundColor: passwordStrength >= 1 ? strengthColor : colors.cardBorder },
                    ]} />
                    <View style={[
                      styles.strengthBar,
                      { backgroundColor: passwordStrength >= 2 ? strengthColor : colors.cardBorder },
                    ]} />
                    <View style={[
                      styles.strengthBar,
                      { backgroundColor: passwordStrength >= 3 ? strengthColor : colors.cardBorder },
                    ]} />
                  </View>
                  <Text style={[styles.strengthLabel, { color: strengthColor }]}>
                    {strengthLabel}
                  </Text>
                </View>
              ) : (
                <Text style={styles.passwordHint}>At least 8 characters</Text>
              )}
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={styles.primaryButtonText}>Create account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or sign up with</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
                testID="button-google-signup"
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
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={12}
                      style={styles.appleButton}
                      onPress={handleAppleSignUp}
                    />
                  )}
                </View>
              )}
            </View>
          </View>

          <Text style={styles.termsNotice}>
            By creating an account, you agree to our{' '}
            <Text style={styles.termsLink} onPress={() => router.push('/more/terms-of-service' as any)}>
              Terms of Service
            </Text>{' '}and{' '}
            <Text style={styles.termsLink} onPress={() => router.push('/more/privacy-policy' as any)}>
              Privacy Policy
            </Text>
          </Text>

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
  hero: {
    backgroundColor: '#0f172a',
    paddingTop: 72,
    paddingHorizontal: 24,
    paddingBottom: 44,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  brandLogo: {
    width: 32,
    height: 32,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  brandJob: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  brandRunner: {
    color: '#E8862E',
    fontSize: 22,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 15,
    lineHeight: 21,
  },
  card: {
    backgroundColor: colors.background,
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  form: {},
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
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    letterSpacing: 0.2,
    marginBottom: 8,
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
  passwordHint: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 8,
    marginLeft: 2,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginLeft: 2,
    gap: 8,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorContainer: {
    padding: 14,
    marginBottom: 16,
    backgroundColor: colors.destructiveLight,
    borderRadius: 12,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 14,
    fontWeight: '500',
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
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  signInText: {
    color: colors.mutedForeground,
    fontSize: 15,
  },
  signInLink: {
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
