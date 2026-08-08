import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { TradeTypeSelector } from '../../src/components/TradeTypeSelector';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { typography, fontWeights, HEADER_HEIGHT } from '../../src/lib/design-tokens';

const createStyles = (colors: any, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: bottomNavHeight,
  },
  headerButton: {
    padding: 8,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emailDisplay: {
    fontSize: typography.sizes.md,
    color: colors.mutedForeground,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
    marginLeft: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  inputLabelText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 14,
    fontSize: typography.subtitle.fontSize,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputDisabled: {
    backgroundColor: colors.cardHover,
    color: colors.mutedForeground,
  },
  inputNote: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 4,
    marginLeft: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    marginTop: 24,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
});

export default function ProfileEditScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  
  const { user, checkAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    tradeType: user?.tradeType || '',
  });
  const [payment, setPayment] = useState({
    bankBsb: '',
    bankAccountNumber: '',
    bankAccountName: '',
    abn: '',
    payId: '',
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get<any>('/api/worker/payment-details');
        if (active && res.data && !res.error) {
          setPayment({
            bankBsb: res.data.bankBsb || '',
            bankAccountNumber: res.data.bankAccountNumber || '',
            bankAccountName: res.data.bankAccountName || '',
            abn: res.data.abn || '',
            payId: res.data.payId || '',
          });
        }
      } catch {
        // non-blocking — payment details are optional
      }
    })();
    return () => { active = false; };
  }, []);

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      Alert.alert('Error', 'First name and last name are required');
      return;
    }

    setIsLoading(true);
    try {
      const payload: any = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        tradeType: form.tradeType.trim() || undefined,
      };
      if (form.email.trim() && form.email.trim() !== user?.email) {
        payload.email = form.email.trim();
      }
      const response = await api.patch('/api/auth/profile', payload);

      if (!response.error) {
        // Save payment details (non-blocking for profile success).
        try {
          await api.put('/api/worker/payment-details', {
            bankBsb: payment.bankBsb.trim() || null,
            bankAccountNumber: payment.bankAccountNumber.trim() || null,
            bankAccountName: payment.bankAccountName.trim() || null,
            abn: payment.abn.trim() || null,
            payId: payment.payId.trim() || null,
          });
        } catch {
          // ignore — payment details failure shouldn't block profile save
        }
        await checkAuth();
        Alert.alert('Success', 'Profile updated successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to update profile. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Edit Profile',
          headerRight: () => (
            <PressableRow onPress={handleSave} disabled={isLoading} style={styles.headerButton} >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="save" size={22} color={colors.primary} />
              )}
            </PressableRow>
          ),
        }} 
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        // Screen renders below the global custom <Header />; offset by the
        // header + status bar so iOS keyboard padding is not short.
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + HEADER_HEIGHT : 0}
      >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.avatarSection}>
            <View style={{ marginBottom: 12 }}>
              <TeamAvatar
                firstName={form.firstName || user?.firstName || undefined}
                lastName={form.lastName || user?.lastName || undefined}
                email={form.email || user?.email || undefined}
                userId={user?.id ? String(user.id) : undefined}
                profileImageUrl={(user as any)?.profileImageUrl}
                size={80}
              />
            </View>
            <Text style={styles.emailDisplay}>{form.email}</Text>
          </View>

          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="user" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>First Name *</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.firstName}
              onChangeText={(text) => setForm({ ...form, firstName: text })}
              placeholder="First name"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="user" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Last Name *</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.lastName}
              onChangeText={(text) => setForm({ ...form, lastName: text })}
              placeholder="Last name"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="mail" size={18} color={colors.mutedForeground} />
              <Text style={styles.inputLabelText}>Email</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(text) => setForm({ ...form, email: text.trim() })}
              placeholder="your@email.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {form.email?.includes('privaterelay.appleid.com') && (
              <Text style={[styles.inputNote, { color: colors.warning || '#f59e0b' }]}>
                Apple is hiding your real email. Update it above to receive job notifications directly.
              </Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="phone" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Phone</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(text) => setForm({ ...form, phone: text })}
              placeholder="04XX XXX XXX"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <TradeTypeSelector
              value={form.tradeType}
              onChange={(value) => setForm({ ...form, tradeType: value })}
              label="Trade Type"
            />
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Payment Details</Text>
          <Text style={[styles.inputNote, { marginLeft: 4, marginBottom: 16 }]}>
            Used when you get paid for jobs. Only shared with businesses you work for.
          </Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="user" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Account Name</Text>
            </View>
            <TextInput
              style={styles.input}
              value={payment.bankAccountName}
              onChangeText={(text) => setPayment({ ...payment, bankAccountName: text })}
              placeholder="Name on the account"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="hash" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>BSB</Text>
            </View>
            <TextInput
              style={styles.input}
              value={payment.bankBsb}
              onChangeText={(text) => setPayment({ ...payment, bankBsb: text })}
              placeholder="000-000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="credit-card" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Account Number</Text>
            </View>
            <TextInput
              style={styles.input}
              value={payment.bankAccountNumber}
              onChangeText={(text) => setPayment({ ...payment, bankAccountNumber: text })}
              placeholder="Account number"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="smartphone" size={18} color={colors.mutedForeground} />
              <Text style={styles.inputLabelText}>PayID (optional)</Text>
            </View>
            <TextInput
              style={styles.input}
              value={payment.payId}
              onChangeText={(text) => setPayment({ ...payment, payId: text })}
              placeholder="Email or mobile linked to PayID"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="briefcase" size={18} color={colors.mutedForeground} />
              <Text style={styles.inputLabelText}>ABN (optional)</Text>
            </View>
            <TextInput
              style={styles.input}
              value={payment.abn}
              onChangeText={(text) => setPayment({ ...payment, abn: text })}
              placeholder="11 digit ABN"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
            />
          </View>

          <PressableRow style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} onPress={handleSave} disabled={isLoading} >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="save" size={20} color={colors.primaryForeground} />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </PressableRow>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
