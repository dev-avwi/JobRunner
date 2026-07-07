import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Switch,
  Modal,
  FlatList,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from './ui/PressableRow';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import api from '../lib/api';
import { useTheme, ThemeColors } from '../lib/theme';
import { AppBottomSheet } from './ui/AppBottomSheet';
import { spacing, radius, shadows, iconSizes, typography } from '../lib/design-tokens';
import { SignaturePad } from './SignaturePad';

interface FormField {
  id: string;
  type: 'text' | 'number' | 'email' | 'phone' | 'textarea' | 'checkbox' | 'radio' | 'select' | 'date' | 'time' | 'photo' | 'signature' | 'section';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  helpText?: string;
}

interface CustomForm {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
  isActive: boolean;
}

interface FormSubmission {
  id: string;
  formId: string;
  jobId?: string;
  submittedBy?: string;
  data: Record<string, any>;
  status: 'draft' | 'submitted' | 'reviewed';
  submittedAt?: string;
  reviewedAt?: string;
  form?: CustomForm;
}

interface JobFormsProps {
  jobId: string;
  readOnly?: boolean;
  jobCardMode?: boolean;
  onExport?: () => void;
  isExporting?: boolean;
  onSubmissionsChange?: (submissions: FormSubmission[]) => void;
  onFormsChange?: (forms: CustomForm[]) => void;
}

export function JobForms({ jobId, readOnly = false, jobCardMode = false, onExport, isExporting = false, onSubmissionsChange, onFormsChange }: JobFormsProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const [forms, setForms] = useState<CustomForm[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [selectedForm, setSelectedForm] = useState<CustomForm | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFormSelector, setShowFormSelector] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [jobId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [formsRes, submissionsRes] = await Promise.all([
        api.get<CustomForm[]>('/api/custom-forms'),
        api.get<FormSubmission[]>(`/api/jobs/${jobId}/form-submissions`),
      ]);
      
      if (formsRes.data) {
        const activeForms = formsRes.data.filter(f => f.isActive);
        setForms(activeForms);
        onFormsChange?.(activeForms);
      }
      if (submissionsRes.data) {
        setSubmissions(submissionsRes.data);
        onSubmissionsChange?.(submissionsRes.data);
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading forms:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectForm = (form: CustomForm) => {
    setSelectedForm(form);
    setFormData({});
    setShowFormSelector(false);
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handlePhotoCapture = async (fieldId: string) => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const base64 = result.assets[0].base64;
        if (base64) {
          handleFieldChange(fieldId, `data:image/jpeg;base64,${base64}`);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  const handleSubmitForm = async () => {
    if (!selectedForm) return;

    const missingRequired = selectedForm.fields.filter(
      f => f.required && !formData[f.id] && f.type !== 'section'
    );

    if (missingRequired.length > 0) {
      Alert.alert(
        'Missing Required Fields',
        `Please fill in: ${missingRequired.map(f => f.label).join(', ')}`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post(`/api/jobs/${jobId}/form-submissions`, {
        formId: selectedForm.id,
        data: formData,
        status: 'submitted',
      });
      
      Alert.alert('Success', 'Form submitted successfully');
      setSelectedForm(null);
      setFormData({});
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.id];

    switch (field.type) {
      case 'section':
        return (
          <View key={field.id} style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{field.label}</Text>
            {field.helpText && (
              <Text style={styles.sectionDescription}>{field.helpText}</Text>
            )}
          </View>
        );

      case 'text':
      case 'email':
      case 'phone':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            <TextInput
              style={styles.input}
              value={value || ''}
              onChangeText={(text) => handleFieldChange(field.id, text)}
              placeholder={field.placeholder}
              placeholderTextColor={colors.mutedForeground}
              keyboardType={
                field.type === 'email' ? 'email-address' :
                field.type === 'phone' ? 'phone-pad' : 'default'
              }
              editable={!readOnly}
            />
            {field.helpText && (
              <Text style={styles.helpText}>{field.helpText}</Text>
            )}
          </View>
        );

      case 'number':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            <TextInput
              style={styles.input}
              value={value?.toString() || ''}
              onChangeText={(text) => handleFieldChange(field.id, text)}
              placeholder={field.placeholder}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              editable={!readOnly}
            />
            {field.helpText && (
              <Text style={styles.helpText}>{field.helpText}</Text>
            )}
          </View>
        );

      case 'textarea':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={value || ''}
              onChangeText={(text) => handleFieldChange(field.id, text)}
              placeholder={field.placeholder}
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!readOnly}
            />
            {field.helpText && (
              <Text style={styles.helpText}>{field.helpText}</Text>
            )}
          </View>
        );

      case 'checkbox':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <PressableRow style={styles.checkboxRow} onPress={() => !readOnly && handleFieldChange(field.id, !value)} disabled={readOnly} >
              <View style={[styles.checkbox, value && styles.checkboxChecked]}>
                {value && <Feather name="check" size={14} color={colors.primaryForeground} />}
              </View>
              <Text style={styles.checkboxLabel}>
                {field.label}
                {field.required && <Text style={styles.required}> *</Text>}
              </Text>
            </PressableRow>
            {field.helpText && (
              <Text style={styles.helpText}>{field.helpText}</Text>
            )}
          </View>
        );

      case 'radio':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            {field.options?.map((option) => (
              <PressableRow key={option} style={styles.radioRow} onPress={() => !readOnly && handleFieldChange(field.id, option)} disabled={readOnly} >
                <View style={[styles.radio, value === option && styles.radioSelected]}>
                  {value === option && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.radioLabel}>{option}</Text>
              </PressableRow>
            ))}
            {field.helpText && (
              <Text style={styles.helpText}>{field.helpText}</Text>
            )}
          </View>
        );

      case 'select':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            <View style={styles.selectOptions}>
              {field.options?.map((option) => (
                <PressableRow key={option} style={[ styles.selectOption, value === option && styles.selectOptionActive ]} onPress={() => !readOnly && handleFieldChange(field.id, option)} disabled={readOnly} >
                  <Text style={[
                    styles.selectOptionText,
                    value === option && styles.selectOptionTextActive
                  ]}>
                    {option}
                  </Text>
                </PressableRow>
              ))}
            </View>
            {field.helpText && (
              <Text style={styles.helpText}>{field.helpText}</Text>
            )}
          </View>
        );

      case 'date':
      case 'time':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            <TextInput
              style={styles.input}
              value={value || ''}
              onChangeText={(text) => handleFieldChange(field.id, text)}
              placeholder={field.type === 'date' ? 'DD/MM/YYYY' : 'HH:MM'}
              placeholderTextColor={colors.mutedForeground}
              editable={!readOnly}
            />
            {field.helpText && (
              <Text style={styles.helpText}>{field.helpText}</Text>
            )}
          </View>
        );

      case 'photo':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            {value ? (
              <View style={styles.photoPreview}>
                <Feather name="check-circle" size={24} color={colors.success} />
                <Text style={styles.photoText}>Photo captured</Text>
                {!readOnly && (
                  <PressableRow onPress={() => handleFieldChange(field.id, null)} style={styles.photoRemove} >
                    <Feather name="x" size={20} color={colors.destructive} />
                  </PressableRow>
                )}
              </View>
            ) : (
              <PressableRow style={styles.photoButton} onPress={() => handlePhotoCapture(field.id)} disabled={readOnly} >
                <Feather name="camera" size={20} color={colors.primary} />
                <Text style={styles.photoButtonText}>Take Photo</Text>
              </PressableRow>
            )}
            {field.helpText && (
              <Text style={styles.helpText}>{field.helpText}</Text>
            )}
          </View>
        );

      case 'signature':
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            {value ? (
              <View style={styles.signaturePreview}>
                <Feather name="check-circle" size={24} color={colors.success} />
                <Text style={styles.signatureText}>Signature captured</Text>
                {!readOnly && (
                  <PressableRow onPress={() => handleFieldChange(field.id, null)} style={styles.signatureRemove} >
                    <Feather name="x" size={20} color={colors.destructive} />
                  </PressableRow>
                )}
              </View>
            ) : (
              <PressableRow style={styles.signatureButton} onPress={() => setShowSignaturePad(field.id)} disabled={readOnly} >
                <Feather name="edit-3" size={20} color={colors.primary} />
                <Text style={styles.signatureButtonText}>Capture Signature</Text>
              </PressableRow>
            )}
            {field.helpText && (
              <Text style={styles.helpText}>{field.helpText}</Text>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  const renderSubmission = (submission: FormSubmission) => {
    const form = forms.find(f => f.id === submission.formId) || submission.form;
    
    return (
      <View key={submission.id} style={styles.submissionCard}>
        <View style={styles.submissionHeader}>
          <View style={styles.submissionIcon}>
            <Feather name="file-text" size={16} color={colors.primary} />
          </View>
          <View style={styles.submissionInfo}>
            <Text style={styles.submissionTitle}>
              {form?.name || 'Form'}
            </Text>
            <Text style={styles.submissionDate}>
              {submission.submittedAt
                ? new Date(submission.submittedAt).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : 'Draft'}
            </Text>
          </View>
          <View style={[
            styles.submissionStatus,
            submission.status === 'reviewed' && styles.submissionStatusReviewed,
            submission.status === 'submitted' && styles.submissionStatusSubmitted,
          ]}>
            <Text style={[
              styles.submissionStatusText,
              submission.status === 'reviewed' && styles.submissionStatusTextReviewed,
              submission.status === 'submitted' && styles.submissionStatusTextSubmitted,
            ]}>
              {submission.status}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const isJobCardForm = (f: CustomForm) => !!(f as any).isJobCard;
  const displayForms = jobCardMode ? forms.filter(isJobCardForm) : forms.filter(f => !isJobCardForm(f));
  const displaySubmissions = submissions.filter(s => {
    const form = forms.find(f => f.id === s.formId);
    const isJC = form ? isJobCardForm(form) : false;
    return jobCardMode ? isJC : !isJC;
  });

  if (jobCardMode && displayForms.length === 0) {
    // Don't flash anything while loading
    if (isLoading) return null;
    // No job card form set up yet — show a prompt instead of hiding the section
    return (
      <View style={[styles.container, { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }]}>
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="clipboard" size={iconSizes.lg} color={colors.primary} />
          </View>
          <Text style={styles.headerLabel}>Job Card</Text>
        </View>
        <Text style={styles.emptyText}>No job card form set up yet</Text>
        <PressableRow style={styles.addFormButton} onPress={() => router.push('/more/form-builder' as any)}>
          <Feather name="plus" size={18} color={colors.primaryForeground} />
          <Text style={styles.addFormButtonText}>Create Job Card</Text>
        </PressableRow>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: `${colors.primary}15` }]}>
          <Feather name={jobCardMode ? 'clipboard' : 'check-square'} size={iconSizes.lg} color={colors.primary} />
        </View>
        <Text style={styles.headerLabel}>{jobCardMode ? 'Job Card' : 'Checklist'}</Text>
        {displaySubmissions.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{displaySubmissions.length}</Text>
          </View>
        )}
      </View>

      {jobCardMode && onExport && displaySubmissions.length > 0 && (
        <PressableRow style={styles.exportButton} onPress={onExport} disabled={isExporting}>
          {isExporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Feather name="download" size={16} color={colors.primary} />
              <Text style={styles.exportButtonText}>Export PDF</Text>
            </>
          )}
        </PressableRow>
      )}

      {displaySubmissions.length > 0 && (
        <View style={styles.submissions}>
          {displaySubmissions.map(renderSubmission)}
        </View>
      )}

      {selectedForm ? (
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{selectedForm.name}</Text>
            <PressableRow onPress={() => { setSelectedForm(null); setFormData({}); }} >
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </PressableRow>
          </View>
          
          {selectedForm.description && (
            <Text style={styles.formDescription}>{selectedForm.description}</Text>
          )}

          <View style={styles.fields}>
            {selectedForm.fields.map(renderField)}
          </View>

          <PressableRow style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} onPress={handleSubmitForm} disabled={isSubmitting} >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="check" size={20} color={colors.primaryForeground} />
                <Text style={styles.submitButtonText}>Submit Form</Text>
              </>
            )}
          </PressableRow>
        </View>
      ) : displayForms.length > 0 ? (
        <PressableRow style={styles.addFormButton} onPress={() => setShowFormSelector(true)} >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
          <Text style={styles.addFormButtonText}>{jobCardMode ? 'Fill Job Card' : 'Add Checklist'}</Text>
        </PressableRow>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{jobCardMode ? 'No job card available' : 'No checklists available'}</Text>
        </View>
      )}

      <AppBottomSheet
        visible={showFormSelector}
        onDismiss={() => setShowFormSelector(false)}
        snapPoints={['85%']}
        scrollable={false}
        contentPadding={0}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{jobCardMode ? 'Select Job Card' : 'Select Checklist'}</Text>
            <PressableRow onPress={() => setShowFormSelector(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
          </View>
          <FlatList
            data={displayForms}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.formsList}
            renderItem={({ item }) => (
              <PressableRow style={styles.formItem} onPress={() => handleSelectForm(item)} >
                <View style={styles.formItemIcon}>
                  <Feather name="file-text" size={20} color={colors.primary} />
                </View>
                <View style={styles.formItemContent}>
                  <Text style={styles.formItemTitle}>{item.name}</Text>
                  {item.description && (
                    <Text style={styles.formItemDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                  <Text style={styles.formItemFields}>
                    {item.fields.filter(f => f.type !== 'section').length} fields
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </PressableRow>
            )}
          />
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        visible={showSignaturePad !== null}
        onDismiss={() => setShowSignaturePad(null)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Capture Signature</Text>
            <PressableRow onPress={() => setShowSignaturePad(null)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
          </View>
          <View style={styles.signaturePadContainer}>
            <SignaturePad
              onSave={(signatureData) => {
                if (showSignaturePad) {
                  handleFieldChange(showSignaturePad, signatureData);
                }
                setShowSignaturePad(null);
              }}
              onClear={() => {}}
              showControls={true}
            />
          </View>
        </View>
      </AppBottomSheet>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  loadingContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    flex: 1,
  },
  countBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  countText: {
    color: colors.primaryForeground,
    fontSize: 12,
    fontWeight: '600',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  exportButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  submissions: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  submissionCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  submissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submissionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  submissionInfo: {
    flex: 1,
  },
  submissionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  submissionDate: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  submissionStatus: {
    backgroundColor: colors.muted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  submissionStatusReviewed: {
    backgroundColor: `${colors.success}20`,
  },
  submissionStatusSubmitted: {
    backgroundColor: `${colors.primary}20`,
  },
  submissionStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
  },
  submissionStatusTextReviewed: {
    color: colors.success,
  },
  submissionStatusTextSubmitted: {
    color: colors.primary,
  },
  formContainer: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  formDescription: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  fields: {
    gap: spacing.md,
  },
  fieldContainer: {
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.destructive,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 16,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  helpText: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    color: colors.foreground,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  radioLabel: {
    fontSize: 14,
    color: colors.foreground,
  },
  selectOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  selectOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectOptionText: {
    fontSize: 14,
    color: colors.foreground,
  },
  selectOptionTextActive: {
    color: colors.primaryForeground,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    gap: spacing.sm,
  },
  photoButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  photoPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: `${colors.success}15`,
    gap: spacing.sm,
  },
  photoText: {
    flex: 1,
    fontSize: 14,
    color: colors.success,
    fontWeight: '500',
  },
  photoRemove: {
    padding: spacing.xs,
  },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    gap: spacing.sm,
  },
  signatureButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  signaturePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: `${colors.success}15`,
    gap: spacing.sm,
  },
  signatureText: {
    flex: 1,
    fontSize: 14,
    color: colors.success,
    fontWeight: '500',
  },
  signatureRemove: {
    padding: spacing.xs,
  },
  sectionHeader: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  addFormButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  addFormButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  emptyContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  formsList: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  formItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  formItemIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  formItemContent: {
    flex: 1,
  },
  formItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  formItemDescription: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  formItemFields: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  signaturePadContainer: {
    flex: 1,
    padding: spacing.lg,
  },
});

export default JobForms;
