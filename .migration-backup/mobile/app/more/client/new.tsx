import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../../src/components/ui/PressableRow';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClientsStore } from '../../../src/lib/store';
import { useTheme, ThemeColors } from '../../../src/lib/theme';
import { getBottomNavHeight } from '../../../src/components/BottomNav';
import { typography, fontWeights } from '../../../src/lib/design-tokens';

const CLIENT_TYPES = ['Residential', 'Commercial', 'Strata', 'Government'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  saveHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
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
    borderRadius: 12,
    padding: 14,
    fontSize: typography.subtitle.fontSize,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
    letterSpacing: 0,
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerOptionActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  pickerOptionText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  pickerOptionTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
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
  inputHint: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 4,
    marginLeft: 4,
  },
});

export default function NewClientScreen() {
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const { createClient, updateClient, getClient } = useClientsStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  
  const isEditMode = !!clientId;
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingClient, setIsLoadingClient] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    clientType: '',
    referralSource: '',
    tagsText: '',
  });

  useEffect(() => {
    if (clientId) {
      loadClientData();
    }
  }, [clientId]);

  const loadClientData = async () => {
    if (!clientId) return;
    setIsLoadingClient(true);
    const client = await getClient(clientId);
    if (client) {
      setForm({
        name: client.name || '',
        phone: client.phone || '',
        email: client.email || '',
        address: client.address || '',
        notes: client.notes || '',
        clientType: client.clientType || '',
        referralSource: client.referralSource || '',
        tagsText: (client.tags || []).join(', '),
      });
    }
    setIsLoadingClient(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Client name is required');
      return;
    }

    setIsLoading(true);
    
    const tags = form.tagsText
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const payload = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      address: form.address,
      notes: form.notes,
      clientType: form.clientType || undefined,
      referralSource: form.referralSource || undefined,
      tags,
    };

    if (isEditMode && clientId) {
      const success = await updateClient(clientId, payload);
      setIsLoading(false);
      
      if (success) {
        Alert.alert('Success', 'Client updated successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', 'Failed to update client. Please try again.');
      }
    } else {
      const client = await createClient(payload);
      setIsLoading(false);

      if (client) {
        Alert.alert('Success', 'Client created successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Error', 'Failed to create client. Please try again.');
      }
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <PressableRow style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </PressableRow>
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Client' : 'New Client'}</Text>
          <PressableRow style={styles.saveHeaderButton} onPress={handleSave} disabled={isLoading || isLoadingClient} >
            {isLoading || isLoadingClient ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="check" size={20} color={colors.primary} />
            )}
          </PressableRow>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: bottomNavHeight + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Client Information</Text>
          
          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="user" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Name *</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(text) => setForm({ ...form, name: text })}
              placeholder="Enter client name"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
            />
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
            <View style={styles.inputLabel}>
              <Feather name="mail" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Email</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(text) => setForm({ ...form, email: text })}
              placeholder="client@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="map-pin" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Address</Text>
            </View>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={form.address}
              onChangeText={(text) => setForm({ ...form, address: text })}
              placeholder="Enter client address"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
            />
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Classification</Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="layers" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Client Type</Text>
            </View>
            <View style={styles.pickerRow}>
              {CLIENT_TYPES.map((type) => (
                <PressableRow key={type} style={[ styles.pickerOption, form.clientType === type && styles.pickerOptionActive, ]} onPress={() => setForm({ ...form, clientType: form.clientType === type ? '' : type })} >
                  <Text style={[
                    styles.pickerOptionText,
                    form.clientType === type && styles.pickerOptionTextActive,
                  ]}>
                    {type}
                  </Text>
                </PressableRow>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="share-2" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Referral Source</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.referralSource}
              onChangeText={(text) => setForm({ ...form, referralSource: text })}
              placeholder="e.g. Google, Word of Mouth, Facebook"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="tag" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Tags</Text>
            </View>
            <TextInput
              style={styles.input}
              value={form.tagsText}
              onChangeText={(text) => setForm({ ...form, tagsText: text })}
              placeholder="VIP, Priority, Repeat Customer"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
            />
            <Text style={styles.inputHint}>Separate tags with commas</Text>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Additional</Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputLabel}>
              <Feather name="file-text" size={18} color={colors.primary} />
              <Text style={styles.inputLabelText}>Notes</Text>
            </View>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={form.notes}
              onChangeText={(text) => setForm({ ...form, notes: text })}
              placeholder="Additional notes about this client"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
            />
          </View>

          <PressableRow style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} onPress={handleSave} disabled={isLoading} >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Feather name="save" size={20} color={colors.white} />
                <Text style={styles.saveButtonText}>{isEditMode ? 'Update Client' : 'Create Client'}</Text>
              </>
            )}
          </PressableRow>
        </ScrollView>
      </View>
    </>
  );
}
