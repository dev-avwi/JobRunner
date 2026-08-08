import { useState } from 'react';
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
import { Link, router } from 'expo-router';
import api from '../../src/lib/api';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../src/components/ui/Card';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { typography, fontWeights } from '../../src/lib/design-tokens';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { colors } = useTheme();
  const bottomInset = useBottomInset(40);
  const styles = createStyles(colors);

  const handleRequestReset = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.forgotPassword(email.trim());
      
      if (response.success) {
        setEmailSent(true);
      } else {
        Alert.alert('Error', response.error || 'Failed to send reset email');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send reset email. Please try again.');
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
            <Text style={styles.tagline}>Reset your password</Text>
          </View>

          <Card>
            <CardHeader>
              <CardTitle>{emailSent ? 'Check Your Email' : 'Forgot Password'}</CardTitle>
              <CardDescription>
                {emailSent 
                  ? `We've sent password reset instructions to ${email}`
                  : 'Enter your email address and we\'ll send you a link to reset your password.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {emailSent ? (
                <View style={styles.successContainer}>
                  <View style={styles.successIcon}>
                    <Ionicons name="mail-outline" size={48} color={colors.primary} />
                  </View>
                  <Text style={styles.successText}>
                    If an account exists with this email, you'll receive password reset instructions shortly.
                  </Text>
                  <Text style={styles.tipText}>
                    Don't see the email? Check your spam folder.
                  </Text>
                  
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => {
                      setEmailSent(false);
                      setEmail('');
                    }}
                    testID="button-try-again"
                  >
                    <Text style={styles.primaryButtonText}>Try Another Email</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your email"
                      placeholderTextColor={colors.mutedForeground}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                      testID="input-email"
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleRequestReset}
                    disabled={isLoading}
                    activeOpacity={0.8}
                    testID="button-send-reset"
                  >
                    {isLoading ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.primaryButtonText}>Send Reset Link</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </CardContent>
          </Card>

          <View style={styles.backContainer}>
            <TouchableOpacity 
              onPress={() => router.back()}
              style={styles.backButton}
              testID="button-back"
            >
              <Ionicons name="arrow-back" size={20} color={colors.primary} />
              <Text style={styles.backText}>Back to Sign In</Text>
            </TouchableOpacity>
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
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: typography.subtitle.fontSize,
    color: colors.foreground,
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
    backgroundColor: `${colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successText: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  tipText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
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
