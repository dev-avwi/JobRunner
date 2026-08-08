import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { spacing, radius, shadows, typography, iconSizes, sizes, usePageShell, fontWeights } from '../../src/lib/design-tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

type FieldType = 'text' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date' | 'photo' | 'signature';

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  description?: string;
  defaultValue?: string;
  conditionalLogic?: {
    fieldId: string;
    operator: 'equals' | 'not_equals' | 'contains';
    value: string;
  };
}

interface CustomForm {
  id: string;
  name: string;
  description?: string;
  formType: string;
  fields: FormField[];
  requiresSignature: boolean;
  isActive: boolean;
}

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: bottomNavHeight,
  },
  formHeader: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  formName: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  formDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  fieldContainer: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  fieldRequired: {
    color: colors.destructive,
  },
  fieldDescription: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.foreground,
    minHeight: sizes.inputHeight,
  },
  textArea: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.foreground,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.xs,
  },
  radioOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  radioLabel: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
  },
  selectTrigger: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: sizes.inputHeight,
  },
  selectText: {
    ...typography.body,
    color: colors.foreground,
  },
  selectPlaceholder: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  photoButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 100,
  },
  photoButtonText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  signatureBox: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 120,
  },
  signatureText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  signedText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: fontWeights.semibold,
  },
  errorText: {
    ...typography.captionSmall,
    color: colors.destructive,
    marginTop: spacing.xs,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
  },
  submitBtnText: {
    ...typography.button,
    color: colors.primaryForeground,
    fontSize: typography.subtitle.fontSize,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pickerContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '60%',
  },
  pickerTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  pickerOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  pickerOptionText: {
    ...typography.body,
    color: colors.foreground,
  },
  pickerOptionTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  pickerCancel: {
    alignItems: 'center',
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  pickerCancelText: {
    ...typography.body,
    color: colors.mutedForeground,
    fontWeight: fontWeights.medium,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginTop: spacing.md,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
  },
  retryButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
});

export default function FormFillScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const { formId, jobId } = useLocalSearchParams<{ formId: string; jobId?: string }>();

  const [form, setForm] = useState<CustomForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSelectPicker, setShowSelectPicker] = useState(false);
  const [activeSelectField, setActiveSelectField] = useState<string | null>(null);

  useEffect(() => {
    if (!formId) {
      setError('No form specified');
      setIsLoading(false);
      return;
    }
    const fetchForm = async () => {
      try {
        const res = await api.get<CustomForm>(`/api/custom-forms/${formId}`);
        if (res.error) {
          setError(res.error);
        } else if (res.data) {
          setForm(res.data);
          const defaults: Record<string, any> = {};
          (res.data.fields || []).forEach((field: FormField) => {
            if (field.defaultValue) defaults[field.id] = field.defaultValue;
            if (field.type === 'checkbox') defaults[field.id] = false;
          });
          setFormData(defaults);
        }
      } catch (err) {
        setError('Failed to load form');
      } finally {
        setIsLoading(false);
      }
    };
    fetchForm();
  }, [formId]);

  const updateValue = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const isFieldVisible = (field: FormField): boolean => {
    if (!field.conditionalLogic) return true;
    const { fieldId, operator, value } = field.conditionalLogic;
    const currentValue = String(formData[fieldId] || '');
    switch (operator) {
      case 'equals': return currentValue === value;
      case 'not_equals': return currentValue !== value;
      case 'contains': return currentValue.includes(value);
      default: return true;
    }
  };

  const validate = (): boolean => {
    if (!form) return false;
    const newErrors: Record<string, string> = {};
    for (const field of form.fields) {
      if (!isFieldVisible(field)) continue;
      if (field.required) {
        const value = formData[field.id];
        if (value === undefined || value === null || value === '' || (typeof value === 'boolean' && !value)) {
          newErrors[field.id] = 'This field is required';
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !form) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        formId: form.id,
        jobId: jobId || undefined,
        submissionData: formData,
        status: 'submitted' as const,
      };

      const { offlineStorage, useOfflineStore } = await import('@/lib/offline-storage');
      const isOnline = useOfflineStore.getState().isOnline;

      if (!isOnline) {
        await offlineStorage.saveFormSubmissionOffline(payload);
        Alert.alert('Saved offline', 'Form will be submitted when you reconnect.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }

      const res = await api.post(`/api/custom-forms/${form.id}/submit`, payload);
      if (res.error) {
        // Network/server failure — fall back to offline queue so the form isn't lost.
        try {
          await offlineStorage.saveFormSubmissionOffline(payload);
          Alert.alert('Saved offline', 'Submission queued. Will retry automatically.', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        } catch {
          Alert.alert('Error', res.error);
        }
        return;
      }
      Alert.alert('Success', 'Form submitted successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      try {
        const { offlineStorage } = await import('@/lib/offline-storage');
        await offlineStorage.saveFormSubmissionOffline({
          formId: form.id,
          jobId: jobId || undefined,
          submissionData: formData,
          status: 'submitted',
        });
        Alert.alert('Saved offline', 'Submission queued. Will retry automatically.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } catch {
        Alert.alert('Error', 'Failed to submit form.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    if (!isFieldVisible(field)) return null;

    const value = formData[field.id];
    const fieldError = errors[field.id];

    return (
      <View key={field.id} style={styles.fieldContainer}>
        {field.type !== 'checkbox' && (
          <Text style={styles.fieldLabel}>
            {field.label}
            {field.required && <Text style={styles.fieldRequired}> *</Text>}
          </Text>
        )}
        {field.description && field.type !== 'checkbox' && (
          <Text style={styles.fieldDescription}>{field.description}</Text>
        )}

        {field.type === 'text' && (
          <TextInput
            style={styles.textInput}
            value={value || ''}
            onChangeText={(text) => updateValue(field.id, text)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            placeholderTextColor={colors.mutedForeground}
          />
        )}

        {field.type === 'number' && (
          <TextInput
            style={styles.textInput}
            value={value?.toString() || ''}
            onChangeText={(text) => updateValue(field.id, text)}
            placeholder={field.placeholder || 'Enter number'}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
          />
        )}

        {field.type === 'textarea' && (
          <TextInput
            style={styles.textArea}
            value={value || ''}
            onChangeText={(text) => updateValue(field.id, text)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={4}
          />
        )}

        {field.type === 'checkbox' && (
          <PressableRow style={styles.checkboxRow} onPress={() => updateValue(field.id, !value)} >
            <View style={[styles.checkboxBox, value && styles.checkboxBoxChecked]}>
              {value && <Feather name="check" size={16} color={colors.primaryForeground} />}
            </View>
            <Text style={styles.checkboxLabel}>
              {field.label}
              {field.required && <Text style={styles.fieldRequired}> *</Text>}
            </Text>
          </PressableRow>
        )}

        {field.type === 'radio' && (
          <View>
            {(field.options || []).map((option, idx) => (
              <PressableRow key={idx} style={[styles.radioOption, value === option && styles.radioOptionSelected]} onPress={() => updateValue(field.id, option)} >
                <View style={[styles.radioCircle, value === option && styles.radioCircleSelected]}>
                  {value === option && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.radioLabel}>{option}</Text>
              </PressableRow>
            ))}
          </View>
        )}

        {field.type === 'select' && (
          <PressableRow style={styles.selectTrigger} onPress={() => { setActiveSelectField(field.id); setShowSelectPicker(true); }} >
            <Text style={value ? styles.selectText : styles.selectPlaceholder}>
              {value || 'Select an option'}
            </Text>
            <Feather name="chevron-down" size={iconSizes.lg} color={colors.mutedForeground} />
          </PressableRow>
        )}

        {field.type === 'date' && (
          <TextInput
            style={styles.textInput}
            value={value || ''}
            onChangeText={(text) => updateValue(field.id, text)}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={colors.mutedForeground}
          />
        )}

        {field.type === 'photo' && (
          <PressableRow style={styles.photoButton} >
            <Feather name="camera" size={24} color={colors.mutedForeground} />
            <Text style={styles.photoButtonText}>Take or upload photo</Text>
          </PressableRow>
        )}

        {field.type === 'signature' && (
          <View style={styles.signatureBox}>
            <Feather name="edit-3" size={24} color={colors.mutedForeground} />
            <Text style={styles.signatureText}>Tap to sign</Text>
          </View>
        )}

        {fieldError && <Text style={styles.errorText}>{fieldError}</Text>}
      </View>
    );
  };

  const activeField = form?.fields.find(f => f.id === activeSelectField);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Fill Form' }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !form) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen options={{ title: 'Form' }} />
        <Feather name="alert-circle" size={40} color={colors.destructive} />
        <Text style={styles.errorTitle}>{error || 'Form not found'}</Text>
        <PressableRow style={styles.retryButton} onPress={() => router.back()} >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </PressableRow>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: form.name }} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.formHeader}>
          <Text style={styles.formName}>{form.name}</Text>
          {form.description && <Text style={styles.formDescription}>{form.description}</Text>}
        </View>

        {(form.fields || []).map(renderField)}

        {form.requiresSignature && (
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              Signature<Text style={styles.fieldRequired}> *</Text>
            </Text>
            <View style={styles.signatureBox}>
              <Feather name="edit-3" size={24} color={colors.mutedForeground} />
              <Text style={styles.signatureText}>Tap to sign</Text>
            </View>
          </View>
        )}

        <PressableRow style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={isSubmitting} >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="send" size={iconSizes.lg} color={colors.primaryForeground} />
              <Text style={styles.submitBtnText}>Submit Form</Text>
            </>
          )}
        </PressableRow>
      </ScrollView>

      {showSelectPicker && activeField && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowSelectPicker(false)}>
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerTitle}>{activeField.label}</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {(activeField.options || []).map((option, idx) => (
                  <PressableRow key={idx} style={[styles.pickerOption, formData[activeField.id] === option && styles.pickerOptionActive]} onPress={() => { updateValue(activeField.id, option); setShowSelectPicker(false); setActiveSelectField(null); }} >
                    <Text style={[styles.pickerOptionText, formData[activeField.id] === option && styles.pickerOptionTextActive]}>
                      {option}
                    </Text>
                    {formData[activeField.id] === option && <Feather name="check" size={18} color={colors.primary} />}
                  </PressableRow>
                ))}
              </ScrollView>
              <PressableRow style={styles.pickerCancel} onPress={() => { setShowSelectPicker(false); setActiveSelectField(null); }} >
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </PressableRow>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
