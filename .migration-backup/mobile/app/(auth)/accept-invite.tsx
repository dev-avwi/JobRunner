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
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import api from '../../src/lib/api';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { typography, fontWeights } from '../../src/lib/design-tokens';

interface InviteDetails {
  valid: boolean;
  error?: string;
  invite?: {
    businessName: string;
    roleName: string;
    roleDescription?: string;
    email: string;
    inviterName: string;
    firstName?: string;
    lastName?: string;
    ownerId: string;
    teamMemberId: string;
  };
}

export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colors } = useTheme();
  const bottomInset = useBottomInset(24);
  const styles = createStyles(colors);

  const [inviteData, setInviteData] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile fields are pre-filled from the invite; users can edit before tap.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  // Password fallback (only shown if user opts in OR server says login required).
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [loginRequired, setLoginRequired] = useState(false);

  const checkAuth = useAuthStore((state) => state.checkAuth);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (token) validateInvite();
  }, [token]);

  useEffect(() => {
    if (inviteData?.invite) {
      setFirstName(inviteData.invite.firstName || '');
      setLastName(inviteData.invite.lastName || '');
    }
  }, [inviteData]);

  const validateInvite = async () => {
    try {
      setLoading(true);
      const response = await api.get<InviteDetails>(`/api/team/invite/validate/${token}`);
      if (response.data) setInviteData(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to validate invite');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!firstName.trim()) {
      Alert.alert('Missing info', 'Please enter your first name');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await api.post<{ success?: boolean; sessionToken?: string; error?: string; code?: string }>(
        `/api/team/invite/accept-passwordless/${token}`,
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
        }
      );

      if (response.data?.success) {
        if (response.data.sessionToken) {
          await api.setToken(response.data.sessionToken);
        }
        await checkAuth();
        router.replace('/(tabs)' as const);
        return;
      }

      // Existing account — fall back to login.
      if (response.data?.code === 'login_required' || (response.error || '').toLowerCase().includes('sign in')) {
        setLoginRequired(true);
        setUsePassword(true);
        setError('You already have an account. Enter your password to join.');
      } else {
        setError(response.error || response.data?.error || 'Could not accept invitation');
      }
    } catch (err: any) {
      setError(err.message || 'Could not accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginAndJoin = async () => {
    if (!password.trim()) {
      Alert.alert('Missing info', 'Please enter your password');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const loginRes = await api.login(inviteData?.invite?.email || '', password);
      if (loginRes.error || !loginRes.data?.success) {
        setError(loginRes.error || 'Sign in failed');
        return;
      }
      // Now retry passwordless accept — session will link.
      const accept = await api.post<{ success?: boolean; sessionToken?: string; error?: string }>(
        `/api/team/invite/accept-passwordless/${token}`,
        { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() || undefined }
      );
      if (accept.data?.success) {
        if (accept.data.sessionToken) await api.setToken(accept.data.sessionToken);
        await checkAuth();
        router.replace('/(tabs)' as const);
      } else {
        setError(accept.error || 'Could not join team');
      }
    } catch (err: any) {
      setError(err.message || 'Could not join team');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Validating invitation...</Text>
        </View>
      </>
    );
  }

  if (!inviteData?.valid || !inviteData?.invite) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.errorCard}>
            <Feather name="alert-circle" size={48} color={colors.destructive} />
            <Text style={styles.errorTitle}>Invitation expired</Text>
            <Text style={styles.errorText}>
              {inviteData?.error || "This invite link is no longer valid. Ask the business owner to resend it."}
            </Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.backButtonText}>Go to sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  const invite = inviteData.invite;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inviteHeader}>
            <View style={styles.iconContainer}>
              <Feather name="users" size={32} color={colors.primary} />
            </View>
            <Text style={styles.title}>You've been invited</Text>
            <Text style={styles.subtitle}>
              <Text style={styles.inviterName}>{invite.inviterName}</Text> wants you to join
            </Text>
          </View>

          <View style={styles.businessCard}>
            <View style={styles.businessIcon}>
              <Feather name="briefcase" size={24} color={colors.primary} />
            </View>
            <View style={styles.businessInfo}>
              <Text style={styles.businessName}>{invite.businessName}</Text>
              <View style={styles.roleBadge}>
                <Feather name="shield" size={12} color={colors.success} />
                <Text style={styles.roleText}>{invite.roleName}</Text>
              </View>
              <Text style={styles.emailLine}>{invite.email}</Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color={colors.destructive} />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.label}>First name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="John"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.label}>Last name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Smith"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <Text style={styles.label}>Phone (optional)</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="0412 345 678"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
            />

            {usePassword && (
              <>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={usePassword ? handleLoginAndJoin : handleJoin}
              disabled={submitting}
              testID="button-join-team"
            >
              {submitting ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>
                    {usePassword ? 'Sign in & join' : 'Join team'}
                  </Text>
                  <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
                </>
              )}
            </TouchableOpacity>

            {!loginRequired && (
              <TouchableOpacity
                style={styles.altLink}
                onPress={() => setUsePassword((v) => !v)}
              >
                <Text style={styles.altLinkText}>
                  {usePassword ? 'Cancel password sign in' : 'I already have an account'}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={styles.privacyNote}>
              No password needed for new accounts — your invite link proves it's you.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: typography.subtitle.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  errorCard: {
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: typography.sizes.md,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: colors.primaryForeground,
    fontWeight: fontWeights.semibold,
    fontSize: typography.sizes.md,
  },
  inviteHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: typography.sizes['3xl'],
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.subtitle.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  inviterName: {
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  businessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  businessIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: 6,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  roleText: {
    fontSize: typography.sizes.sm,
    color: colors.success,
    fontWeight: fontWeights.medium,
  },
  emailLine: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.destructive + '15',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    fontSize: typography.button.fontSize,
    color: colors.destructive,
  },
  form: {
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },
  label: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: typography.subtitle.fontSize,
    color: colors.foreground,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.primaryForeground,
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
  },
  altLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  altLinkText: {
    fontSize: typography.button.fontSize,
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
  privacyNote: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 4,
  },
});
