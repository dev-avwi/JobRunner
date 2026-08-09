import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { router, useLocalSearchParams } from 'expo-router';
import { Mail, RefreshCw, ArrowLeft, CheckCircle, Edit3, ExternalLink, LifeBuoy, AlertCircle } from 'lucide-react-native';
import api from '../../src/lib/api';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { typography, fontWeights } from '../../src/lib/design-tokens';

const RESEND_COOLDOWN_SEC = 30;

export default function VerifyEmailPendingScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const { colors } = useTheme();
  const bottomInset = useBottomInset(24);
  const styles = createStyles(colors);

  // Subtle pulse on the mail icon — friendly, not distracting.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResendEmail = async () => {
    if (!email || resending || cooldown > 0) return;
    setResending(true);
    setResendSuccess(false);
    setResendError(null);
    try {
      const response = await api.post('/api/auth/resend-verification', { email });
      if (response.error) {
        setResendError(response.error);
        // Light cooldown on rate-limit so user can't hammer the button.
        const code = (response.data as any)?.code;
        if (code === 'rate_limited' || /too many|try again/i.test(response.error)) {
          setCooldown(RESEND_COOLDOWN_SEC);
        }
      } else {
        setResendSuccess(true);
        setCooldown(RESEND_COOLDOWN_SEC);
        setTimeout(() => setResendSuccess(false), 4000);
      }
    } catch (error) {
      setResendError('Could not send the email right now. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleOpenMailApp = async () => {
    // iOS opens the native Mail app; Android falls back to the system chooser.
    const url = Platform.OS === 'ios' ? 'message://' : 'mailto:';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else await Linking.openURL('mailto:');
    } catch (e) {
      console.error('Open mail app failed:', e);
    }
  };

  const handleEditEmail = () => {
    router.replace('/(auth)/register');
  };

  const handleBackToLogin = () => {
    router.replace('/(auth)/login');
  };

  const handleContactSupport = async () => {
    const subject = encodeURIComponent('Verification email not arriving');
    const body = encodeURIComponent(
      `Hi JobRunner team,\n\nI signed up with ${email || ''} but the verification email hasn't arrived.\n\n`,
    );
    const url = `mailto:support@jobrunner.com.au?subject=${subject}&body=${body}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          'No mail app found',
          'Please email support@jobrunner.com.au directly and we\'ll help you get verified.',
        );
      }
    } catch (e) {
      Alert.alert(
        'No mail app found',
        'Please email support@jobrunner.com.au directly and we\'ll help you get verified.',
      );
    }
  };

  const iconScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View style={styles.container}>
      <View style={[styles.content, { paddingBottom: bottomInset }]}>
        <Animated.View style={[styles.iconContainer, { transform: [{ scale: iconScale }] }]}>
          <Mail size={56} color={colors.primary} strokeWidth={1.5} />
        </Animated.View>

        <Text style={styles.title}>Check your email</Text>

        <Text style={styles.description}>We sent a verification link to</Text>
        <Text style={styles.email}>{email || 'your email address'}</Text>

        <TouchableOpacity style={styles.editRow} onPress={handleEditEmail} testID="button-edit-email">
          <Edit3 size={14} color={colors.mutedForeground} />
          <Text style={styles.editText}>Wrong email? Edit it</Text>
        </TouchableOpacity>

        <Text style={styles.instructions}>
          Tap the link in the email, then come back here. The link expires in 24 hours.
        </Text>

        <Text style={styles.spamHint}>
          Can't find it? Check your spam or promotions folder.
        </Text>

        {resendSuccess && (
          <View style={styles.successMessage}>
            <CheckCircle size={18} color={colors.success} />
            <Text style={styles.successText}>Verification email sent</Text>
          </View>
        )}

        {resendError && (
          <View style={styles.errorMessage}>
            <AlertCircle size={18} color={colors.destructive} />
            <Text style={styles.errorMessageText}>{resendError}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleOpenMailApp}
          testID="button-open-mail"
        >
          <ExternalLink size={18} color={colors.primaryForeground} />
          <Text style={styles.primaryButtonText}>Open mail app</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resendButton, (cooldown > 0 || resending) && styles.resendButtonDisabled]}
          onPress={handleResendEmail}
          disabled={resending || cooldown > 0}
          testID="button-resend-verification"
        >
          {resending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <RefreshCw size={18} color={cooldown > 0 ? colors.mutedForeground : colors.primary} />
              <Text style={[styles.resendText, cooldown > 0 && { color: colors.mutedForeground }]}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.supportLink}
          onPress={handleContactSupport}
          testID="button-contact-support"
        >
          <LifeBuoy size={14} color={colors.mutedForeground} />
          <Text style={styles.supportText}>Still no email? Contact support</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToLogin}
          testID="button-back-to-login"
        >
          <ArrowLeft size={18} color={colors.foreground} />
          <Text style={styles.backText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  title: {
    fontSize: typography.sizes['3xl'],
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  description: {
    fontSize: typography.sizes.md,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 4,
  },
  email: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: 8,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    marginBottom: 16,
  },
  editText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    textDecorationLine: 'underline',
  },
  instructions: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.success + '15',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.success + '40',
  },
  successText: {
    fontSize: typography.button.fontSize,
    color: colors.success,
    fontWeight: fontWeights.medium,
  },
  errorMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.destructive + '15',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.destructive + '40',
    width: '100%',
  },
  errorMessageText: {
    flex: 1,
    fontSize: typography.button.fontSize,
    color: colors.destructive,
    fontWeight: fontWeights.medium,
  },
  spamHint: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: typography.sizes.md,
    color: colors.primaryForeground,
    fontWeight: fontWeights.semibold,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary + '60',
    width: '100%',
    marginBottom: 8,
  },
  resendButtonDisabled: {
    borderColor: colors.border,
  },
  resendText: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  supportText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    textDecorationLine: 'underline',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  backText: {
    fontSize: typography.sizes.md,
    color: colors.foreground,
  },
});
