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
import { router, useLocalSearchParams } from 'expo-router';
import api from '../../src/lib/api';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../src/components/ui/Card';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { typography, fontWeights } from '../../src/lib/design-tokens';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const { colors } = useTheme();
  const bottomInset = useBottomInset(40);
  const styles = createStyles(colors);

  useEffect(() => {
    if (params.token) {
      setToken(params.token as string);
    }
  }, [params.token]);

  const getPasswordRequirements = (pwd: string) => {
    return [
      { label: 'At least 8 characters', met: pwd.length >= 8 },
      { label: 'Contains uppercase letter', met: /[A-Z]/.test(pwd) },
      { label: 'Contains special character', met: /[^A-Za-z0-9]/.test(pwd) },
    ];
  };

  const passwordRequirements = getPasswordRequirements(password);
  const allRequirementsMet = passwordRequirements.every(r => r.met);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!allRequirementsMet) {
      Alert.alert('Error', 'Please meet all password requirements');
      return;
    }

    if (!token) {
      Alert.alert('Error', 'Reset token is missing. Please use the link from your email.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.resetPassword(token, password);
      
      if (response.success) {
        setResetSuccess(true);
      } else {
        Alert.alert('Error', response.error || 'Failed to reset password');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
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
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/jobrunner-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>JobRunner</Text>
            <Text style={styles.tagline}>
              {resetSuccess ? 'Password Reset!' : 'Create New Password'}
            </Text>
          </View>

          <Card>
            <CardHeader>
              <CardTitle>
                {resetSuccess ? 'Success!' : 'Reset Password'}
              </CardTitle>
              <CardDescription>
                {resetSuccess 
                  ? 'Your password has been successfully reset. You can now sign in with your new password.'
                  : 'Enter your new password below.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resetSuccess ? (
                <View style={styles.successContainer}>
                  <View style={styles.successIcon}>
                    <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                  </View>
                  
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => router.replace('/(auth)/login')}
                    testID="button-go-to-login"
                  >
                    <Text style={styles.primaryButtonText}>Go to Sign In</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>New Password</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="Enter new password"
                        placeholderTextColor={colors.mutedForeground}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoComplete="new-password"
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

                  {password.length > 0 && (
                    <View style={styles.requirementsContainer}>
                      {passwordRequirements.map((req, index) => (
                        <View key={index} style={styles.requirementRow}>
                          <Ionicons 
                            name={req.met ? "checkmark-circle" : "close-circle"} 
                            size={16} 
                            color={req.met ? "#22c55e" : colors.mutedForeground} 
                          />
                          <Text style={[
                            styles.requirementText,
                            req.met && styles.requirementMet
                          ]}>
                            {req.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Confirm Password</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="Confirm new password"
                        placeholderTextColor={colors.mutedForeground}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                        autoComplete="new-password"
                        testID="input-confirm-password"
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={styles.eyeButton}
                      >
                        <Ionicons 
                          name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                          size={20} 
                          color={colors.mutedForeground} 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {confirmPassword.length > 0 && (
                    <View style={styles.matchIndicator}>
                      <Ionicons 
                        name={passwordsMatch ? "checkmark-circle" : "close-circle"} 
                        size={16} 
                        color={passwordsMatch ? "#22c55e" : "#ef4444"} 
                      />
                      <Text style={[
                        styles.matchText,
                        passwordsMatch ? styles.matchSuccess : styles.matchError
                      ]}>
                        {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      (!allRequirementsMet || !passwordsMatch) && styles.primaryButtonDisabled
                    ]}
                    onPress={handleResetPassword}
                    disabled={isLoading || !allRequirementsMet || !passwordsMatch}
                    activeOpacity={0.8}
                    testID="button-reset-password"
                  >
                    {isLoading ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.primaryButtonText}>Reset Password</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </CardContent>
          </Card>

          {!resetSuccess && (
            <View style={styles.backContainer}>
              <TouchableOpacity 
                onPress={() => router.replace('/(auth)/login')}
                style={styles.backButton}
                testID="button-back"
              >
                <Ionicons name="arrow-back" size={20} color={colors.primary} />
                <Text style={styles.backText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
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
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 60,
    height: 60,
  },
  appName: {
    fontSize: typography.sizes['3xl'],
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    marginBottom: 8,
  },
  tagline: {
    fontSize: typography.subtitle.fontSize,
    color: colors.mutedForeground,
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: typography.subtitle.fontSize,
    color: colors.foreground,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  requirementsContainer: {
    marginBottom: 16,
    gap: 6,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
  },
  requirementMet: {
    color: '#22c55e',
  },
  matchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  matchText: {
    fontSize: typography.sizes.sm,
  },
  matchSuccess: {
    color: '#22c55e',
  },
  matchError: {
    color: '#ef4444',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.primaryForeground || colors.white,
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22c55e20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  backContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backText: {
    fontSize: typography.button.fontSize,
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
});
