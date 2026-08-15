import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Switch,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography, fontWeights } from '../../src/lib/design-tokens';
import { validateABN, formatABN } from '../../src/lib/format';
import { SignaturePad } from '../../src/components/SignaturePad';
import { TradeTypeSelector } from '../../src/components/TradeTypeSelector';
import { api } from '../../src/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: bottomNavHeight,
  },
  headerButton: {
    padding: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  brandingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brandingLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  brandingIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandingLinkText: {
    flex: 1,
  },
  brandingLinkTitle: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: fontWeights.semibold,
  },
  brandingLinkSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  inputLabelText: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: fontWeights.medium,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputHint: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.primaryForeground,
    fontWeight: fontWeights.semibold,
    fontSize: typography.subtitle.fontSize,
  },
});

export default function BusinessSettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const { businessSettings, updateBusinessSettings } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    businessName: businessSettings?.businessName || '',
    tradeType: (businessSettings as any)?.tradeType || 'general',
    abn: businessSettings?.abn || '',
    phone: businessSettings?.phone || '',
    email: businessSettings?.email || '',
    address: businessSettings?.address || '',
    jobPrefix: (businessSettings as any)?.jobPrefix || '',
    jobNextNumber: (businessSettings as any)?.jobNextNumber != null ? String((businessSettings as any).jobNextNumber) : '',
    defaultSignature: (businessSettings as any)?.defaultSignature || '',
    signatureName: (businessSettings as any)?.signatureName || '',
    includeSignatureOnQuotes: (businessSettings as any)?.includeSignatureOnQuotes || false,
    includeSignatureOnInvoices: (businessSettings as any)?.includeSignatureOnInvoices || false,
  });
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchAddresses = useCallback(async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }
    try {
      const encoded = encodeURIComponent(query);
      const response = await api.get<any[]>(`/api/address-search?q=${encoded}`);
      if (response.data && response.data.length > 0) {
        setAddressSuggestions(response.data);
        setShowAddressSuggestions(true);
      } else {
        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
      }
    } catch {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
    }
  }, []);

  const handleAddressChange = useCallback((text: string) => {
    setForm(prev => ({ ...prev, address: text }));
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    addressDebounceRef.current = setTimeout(() => searchAddresses(text), 400);
  }, [searchAddresses]);

  const handleAddressSelect = useCallback((suggestion: any) => {
    setForm(prev => ({ ...prev, address: suggestion.description }));
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
  }, []);

  useEffect(() => {
    if (businessSettings) {
      setForm({
        businessName: businessSettings.businessName || '',
        tradeType: (businessSettings as any)?.tradeType || 'general',
        abn: businessSettings.abn || '',
        phone: businessSettings.phone || '',
        email: businessSettings.email || '',
        address: businessSettings.address || '',
        jobPrefix: (businessSettings as any)?.jobPrefix || '',
        jobNextNumber: (businessSettings as any)?.jobNextNumber != null ? String((businessSettings as any).jobNextNumber) : '',
        defaultSignature: (businessSettings as any)?.defaultSignature || '',
        signatureName: (businessSettings as any)?.signatureName || '',
        includeSignatureOnQuotes: (businessSettings as any)?.includeSignatureOnQuotes || false,
        includeSignatureOnInvoices: (businessSettings as any)?.includeSignatureOnInvoices || false,
      });
    }
  }, [businessSettings]);

  const handleSave = async () => {
    if (!form.businessName.trim()) {
      Alert.alert('Error', 'Business name is required');
      return;
    }

    if (form.abn) {
      const abnResult = validateABN(form.abn);
      if (!abnResult.valid) {
        Alert.alert('Invalid ABN', abnResult.error || 'Please enter a valid 11-digit Australian Business Number');
        return;
      }
    }

    setIsLoading(true);
    const saveData: Record<string, any> = { ...form };
    // Convert jobNextNumber to integer or null
    saveData.jobPrefix = form.jobPrefix.trim() || null;
    saveData.jobNextNumber = form.jobNextNumber.trim() !== '' && parseInt(form.jobNextNumber, 10) > 0
      ? parseInt(form.jobNextNumber, 10)
      : null;
    const success = await updateBusinessSettings(saveData);
    setIsLoading(false);

    if (success) {
      Alert.alert('Success', 'Business settings saved successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } else {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Business Settings',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
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
      >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Business Details</Text>
          
          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="briefcase" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Business Name</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.businessName}
              onChangeText={(text) => setForm({ ...form, businessName: text })}
              placeholder="Enter your business name"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>

          <View style={styles.inputGroup}>
            <TradeTypeSelector
              value={form.tradeType}
              onChange={(value) => setForm({ ...form, tradeType: value })}
              label="Trade Type"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="hash" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>ABN</Text>
            </View>
            <TextInput
              style={[styles.input, form.abn && !validateABN(form.abn).valid ? { borderColor: colors.destructive } : null]}
              value={formatABN(form.abn)}
              onChangeText={(text) => {
                const digits = text.replace(/\s/g, '').replace(/[^0-9]/g, '').slice(0, 11);
                setForm({ ...form, abn: digits });
              }}
              placeholder="12 345 678 901"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={14}
            />
            {form.abn && !validateABN(form.abn).valid ? (
              <Text style={{ color: colors.destructive, fontSize: typography.captionSmall.fontSize, marginTop: 4 }}>
                {validateABN(form.abn).error}
              </Text>
            ) : (
              <Text style={styles.inputHint}>
                Australian Business Number (optional)
              </Text>
            )}
          </View>

          <Text style={styles.sectionTitle}>Job Numbering</Text>
          <Text style={styles.sectionDescription}>
            Set a prefix so new jobs get numbers like GEM1004. Leave blank to use plain sequential numbers.
          </Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="tag" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Job Number Prefix</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.jobPrefix}
              onChangeText={(text) => setForm({ ...form, jobPrefix: text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) })}
              placeholder="e.g. GEM"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              maxLength={6}
            />
            <Text style={styles.inputHint}>Up to 6 characters, uppercase letters and numbers only</Text>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="hash" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Starting Number</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.jobNextNumber}
              onChangeText={(text) => setForm({ ...form, jobNextNumber: text.replace(/[^0-9]/g, '') })}
              placeholder="e.g. 1000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
            />
            <Text style={styles.inputHint}>
              {form.jobPrefix && form.jobNextNumber
                ? `Next job will be: ${form.jobPrefix}${parseInt(form.jobNextNumber, 10) + 1}`
                : 'The next job number to assign (the counter starts here)'}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Contact Information</Text>

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
            <View style={styles.inputLabel}>
              <Feather name="mail" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Email</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(text) => setForm({ ...form, email: text })}
              placeholder="contact@business.com.au"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="map-pin" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Business Address</Text>
            </View>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={form.address}
              onChangeText={handleAddressChange}
              placeholder="Start typing to search..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            {showAddressSuggestions && addressSuggestions.length > 0 && (
              <View style={{ backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: 4, overflow: 'hidden' }}>
                {addressSuggestions.slice(0, 5).map((suggestion, index) => (
                  <PressableRow key={index} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: index < Math.min(addressSuggestions.length, 5) - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.border }} onPress={() => handleAddressSelect(suggestion)} >
                    <Feather name="map-pin" size={14} color={colors.mutedForeground} style={{ marginRight: spacing.sm }} />
                    <Text style={{ flex: 1, fontSize: typography.button.fontSize, color: colors.foreground }} numberOfLines={2}>{suggestion.description}</Text>
                  </PressableRow>
                ))}
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Digital Signature</Text>
          <Text style={styles.sectionDescription}>
            Add your signature to quotes and invoices for a professional touch
          </Text>

          {form.defaultSignature && !showSignaturePad ? (
            <View style={[styles.inputGroup, { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border }]}>
              <View style={{ backgroundColor: '#fff', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md }}>
                <Image 
                  source={{ uri: form.defaultSignature }} 
                  style={{ width: '100%', height: 80, resizeMode: 'contain' }}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <PressableRow style={[styles.input, { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm }]} onPress={() => setShowSignaturePad(true)} >
                  <Feather name="edit-2" size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: fontWeights.medium }}>Change</Text>
                </PressableRow>
                <PressableRow style={[styles.input, { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm }]} onPress={() => setForm({ ...form, defaultSignature: '' })} >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                  <Text style={{ color: colors.destructive, fontWeight: fontWeights.medium }}>Clear</Text>
                </PressableRow>
              </View>
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <SignaturePad
                onSave={(signature) => {
                  setForm({ ...form, defaultSignature: signature });
                  setShowSignaturePad(false);
                }}
                onClear={() => setForm({ ...form, defaultSignature: '' })}
                label="Draw your signature"
                showControls={true}
                existingSignature={showSignaturePad ? form.defaultSignature : undefined}
              />
              {showSignaturePad && (
                <PressableRow style={[styles.input, { marginTop: spacing.sm, alignItems: 'center' }]} onPress={() => setShowSignaturePad(false)} >
                  <Text style={{ color: colors.mutedForeground }}>Cancel</Text>
                </PressableRow>
              )}
            </View>
          )}

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="user" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Name Under Signature</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.signatureName}
              onChangeText={(text) => setForm({ ...form, signatureName: text })}
              placeholder="e.g., John Smith, Director"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={styles.inputHint}>
              This name will appear below your signature on documents
            </Text>
          </View>

          <View style={[styles.inputGroup, { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabelText}>Include on Quotes</Text>
                <Text style={[styles.inputHint, { marginTop: 2 }]}>Add your signature to all quotes</Text>
              </View>
              <Switch
                value={form.includeSignatureOnQuotes}
                onValueChange={(value) => setForm({ ...form, includeSignatureOnQuotes: value })}
                trackColor={{ false: colors.border, true: colors.primary + '66' }}
                thumbColor={'#FFFFFF'}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabelText}>Include on Invoices</Text>
                <Text style={[styles.inputHint, { marginTop: 2 }]}>Add your signature to all invoices</Text>
              </View>
              <Switch
                value={form.includeSignatureOnInvoices}
                onValueChange={(value) => setForm({ ...form, includeSignatureOnInvoices: value })}
                trackColor={{ false: colors.border, true: colors.primary + '66' }}
                thumbColor={'#FFFFFF'}
              />
            </View>
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
