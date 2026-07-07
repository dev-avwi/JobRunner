import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Switch,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '@/components/ui/PressableRow';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors, colorWithOpacity } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { spacing, radius, shadows, typography, iconSizes, sizes, componentStyles, usePageShell } from '../../src/lib/design-tokens';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { useUserRole } from '../../src/hooks/use-user-role';
import { useAuthStore } from '../../src/lib/store';

type FormType = 'general' | 'safety' | 'compliance' | 'inspection';
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
  formType: FormType;
  fields: FormField[];
  requiresSignature: boolean;
  isActive: boolean;
  isJobCard?: boolean;
  blockJobCompletion?: boolean;
  isDefault?: boolean;
  createdAt?: string;
  userId?: string;
}

const FORM_TYPE_CONFIG: Record<FormType, { label: string; icon: keyof typeof Feather.glyphMap; color: string; bgColor: string }> = {
  general: { label: 'General', icon: 'file-text', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
  safety: { label: 'Safety', icon: 'shield', color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' },
  compliance: { label: 'Compliance', icon: 'clipboard', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
  inspection: { label: 'Inspection', icon: 'search', color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.1)' },
};

const FIELD_TYPE_CONFIG: Record<FieldType, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  text: { label: 'Text', icon: 'type' },
  number: { label: 'Number', icon: 'hash' },
  textarea: { label: 'Text Area', icon: 'align-left' },
  select: { label: 'Dropdown', icon: 'list' },
  checkbox: { label: 'Checkbox', icon: 'check-square' },
  radio: { label: 'Radio', icon: 'circle' },
  date: { label: 'Date', icon: 'calendar' },
  photo: { label: 'Photo', icon: 'camera' },
  signature: { label: 'Signature', icon: 'edit-3' },
};

const FIELD_TYPES: FieldType[] = ['text', 'number', 'textarea', 'select', 'checkbox', 'radio', 'date', 'photo', 'signature'];

const SAFETY_TEMPLATES = [
  {
    name: 'Site Safety Checklist',
    description: 'Pre-work safety assessment for job sites',
    formType: 'safety' as FormType,
    requiresSignature: true,
    fields: [
      { id: 'hazards', type: 'textarea' as FieldType, label: 'Identified Hazards', required: true, placeholder: 'List any hazards observed' },
      { id: 'ppe', type: 'checkbox' as FieldType, label: 'PPE Available and Worn', required: true },
      { id: 'fire_extinguisher', type: 'checkbox' as FieldType, label: 'Fire Extinguisher Accessible', required: true },
      { id: 'first_aid', type: 'checkbox' as FieldType, label: 'First Aid Kit Available', required: true },
      { id: 'risk_level', type: 'select' as FieldType, label: 'Overall Risk Level', required: true, options: ['Low', 'Medium', 'High', 'Critical'] },
      { id: 'notes', type: 'textarea' as FieldType, label: 'Additional Notes', placeholder: 'Any other safety concerns' },
    ],
  },
  {
    name: 'Vehicle Inspection',
    description: 'Daily vehicle safety check before use',
    formType: 'inspection' as FormType,
    requiresSignature: true,
    fields: [
      { id: 'vehicle_rego', type: 'text' as FieldType, label: 'Vehicle Registration', required: true },
      { id: 'odometer', type: 'number' as FieldType, label: 'Odometer Reading', required: true },
      { id: 'tyres', type: 'select' as FieldType, label: 'Tyre Condition', required: true, options: ['Good', 'Fair', 'Poor', 'Needs Replacement'] },
      { id: 'lights', type: 'checkbox' as FieldType, label: 'All Lights Working', required: true },
      { id: 'brakes', type: 'checkbox' as FieldType, label: 'Brakes Working Properly', required: true },
      { id: 'fluid_levels', type: 'checkbox' as FieldType, label: 'Fluid Levels Checked', required: true },
      { id: 'damage_photo', type: 'photo' as FieldType, label: 'Photo of Any Damage' },
      { id: 'notes', type: 'textarea' as FieldType, label: 'Notes', placeholder: 'Any issues to report' },
    ],
  },
  {
    name: 'Job Completion Report',
    description: 'Document completed work and sign-off',
    formType: 'general' as FormType,
    requiresSignature: true,
    fields: [
      { id: 'work_summary', type: 'textarea' as FieldType, label: 'Work Completed', required: true, placeholder: 'Describe the work performed' },
      { id: 'materials_used', type: 'textarea' as FieldType, label: 'Materials Used', placeholder: 'List materials and quantities' },
      { id: 'hours_worked', type: 'number' as FieldType, label: 'Hours Worked', required: true },
      { id: 'completion_status', type: 'select' as FieldType, label: 'Completion Status', required: true, options: ['Fully Complete', 'Partially Complete', 'Requires Follow-up'] },
      { id: 'before_photo', type: 'photo' as FieldType, label: 'Before Photo' },
      { id: 'after_photo', type: 'photo' as FieldType, label: 'After Photo' },
      { id: 'client_notes', type: 'textarea' as FieldType, label: 'Notes for Client', placeholder: 'Any notes or recommendations' },
    ],
  },
  {
    name: 'Electrical Compliance',
    description: 'Electrical safety compliance checklist',
    formType: 'compliance' as FormType,
    requiresSignature: true,
    fields: [
      { id: 'circuit_tested', type: 'checkbox' as FieldType, label: 'Circuit Isolation Tested', required: true },
      { id: 'rcd_tested', type: 'checkbox' as FieldType, label: 'RCD Tested and Working', required: true },
      { id: 'earth_tested', type: 'checkbox' as FieldType, label: 'Earth Continuity Verified', required: true },
      { id: 'insulation_resistance', type: 'text' as FieldType, label: 'Insulation Resistance Reading', required: true },
      { id: 'compliance_standard', type: 'select' as FieldType, label: 'Compliance Standard', required: true, options: ['AS/NZS 3000', 'AS/NZS 3008', 'AS/NZS 3012', 'Other'] },
      { id: 'certificate_number', type: 'text' as FieldType, label: 'Certificate Number' },
      { id: 'photo_evidence', type: 'photo' as FieldType, label: 'Photo Evidence' },
    ],
  },
];

const generateId = () => `field_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  activeTab: {
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  tabText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  activeTabText: {
    color: colors.primaryForeground,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
    paddingVertical: spacing.sm,
    letterSpacing: 0,
    textAlign: 'left',
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  formCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  formTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formName: {
    ...typography.cardTitle,
    color: colors.foreground,
    flex: 1,
  },
  formDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  formMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  formMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  formMetaText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  typeBadgeText: {
    ...typography.badge,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  emptyButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: sizes.fabSize,
    height: sizes.fabSize,
    borderRadius: sizes.fabSize / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    flex: 1,
    textAlign: 'center',
  },
  modalSaveText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
  modalSegment: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  modalSegmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  modalSegmentItemActive: {
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  modalSegmentText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalSegmentTextActive: {
    color: colors.primaryForeground,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  fieldLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  switchLabel: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
  },
  switchDescription: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  sectionTitle: {
    ...typography.subtitle,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  fieldItem: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fieldDragHandle: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  fieldInfo: {
    flex: 1,
  },
  fieldItemLabel: {
    ...typography.body,
    fontWeight: '500',
    color: colors.foreground,
  },
  fieldItemType: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  fieldItemBadge: {
    ...typography.badge,
    color: colors.destructive,
    marginLeft: spacing.xs,
  },
  deleteFieldBtn: {
    padding: spacing.sm,
  },
  addFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  addFieldBtnText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '500',
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
    maxHeight: '70%',
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
    flex: 1,
  },
  pickerOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  pickerOptionDescription: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  pickerCancel: {
    alignItems: 'center',
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  pickerCancelText: {
    ...typography.body,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  templateCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  templateName: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  templateDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  templateUseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    marginTop: spacing.md,
  },
  templateUseBtnText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  fieldEditSection: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  optionInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...typography.caption,
    color: colors.foreground,
  },
  conditionalSection: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  conditionalTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  previewContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  previewFieldLabel: {
    ...typography.body,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  previewFieldPlaceholder: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: sizes.inputHeight,
    justifyContent: 'center',
  },
  previewPlaceholderText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  previewCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewCheckboxBox: {
    width: 20,
    height: 20,
    borderRadius: radius.xs,
    borderWidth: 2,
    borderColor: colors.border,
  },
  previewSignatureBox: {
    height: 80,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['3xl'],
  },
  errorText: {
    ...typography.body,
    color: colors.destructive,
    textAlign: 'center',
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
});

type ActiveTab = 'forms' | 'templates';

export default function FormBuilderScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const responsiveShell = usePageShell();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isOwner, isManager } = useUserRole();
  const myUserId = useAuthStore((s) => s.user?.id);
  const isOwnerOrManager = isOwner || isManager;
  const canManageForm = useCallback(
    (form?: CustomForm | null) => isOwnerOrManager || (!!form?.userId && form.userId === myUserId),
    [isOwnerOrManager, myUserId],
  );

  const params = useLocalSearchParams<{ createJobCard?: string }>();
  const [activeTab, setActiveTab] = useState<ActiveTab>('forms');
  const [forms, setForms] = useState<CustomForm[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingForm, setEditingForm] = useState<CustomForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<FormType>('general');
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [isJobCard, setIsJobCard] = useState(false);
  const [blockJobCompletion, setBlockJobCompletion] = useState(false);
  const [fields, setFields] = useState<FormField[]>([]);

  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showFieldTypePicker, setShowFieldTypePicker] = useState(false);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showConditionalPicker, setShowConditionalPicker] = useState(false);
  const [conditionalFieldIndex, setConditionalFieldIndex] = useState<number | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  const fetchForms = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<CustomForm[]>('/api/custom-forms');
      if (res.error) {
        setError(res.error);
      } else {
        setForms(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      setError('Failed to load forms');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  // Deep link from the job screen: land on Templates so they can start from one,
  // with "Show as Job Card" pre-enabled whichever way they create the form
  const [jobCardIntent, setJobCardIntent] = useState(false);
  const jobCardIntentHandled = useRef(false);
  useEffect(() => {
    if (params.createJobCard === '1' && !jobCardIntentHandled.current) {
      jobCardIntentHandled.current = true;
      setJobCardIntent(true);
      setActiveTab('templates');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.createJobCard]);

  const filteredForms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter((f) =>
      f.name.toLowerCase().includes(q) ||
      (f.description || '').toLowerCase().includes(q) ||
      (f.formType || '').toLowerCase().includes(q)
    );
  }, [forms, searchQuery]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchForms();
  }, [fetchForms]);

  const resetFormState = () => {
    setFormName('');
    setFormDescription('');
    setFormType('general');
    setRequiresSignature(false);
    setIsJobCard(false);
    setBlockJobCompletion(false);
    setFields([]);
    setEditingForm(null);
    setEditingFieldIndex(null);
    setShowPreview(false);
    setReadOnly(false);
  };

  const openCreate = () => {
    resetFormState();
    if (jobCardIntent) setIsJobCard(true);
    setShowFormModal(true);
  };

  const openEdit = (form: CustomForm) => {
    setFormName(form.name);
    setFormDescription(form.description || '');
    setFormType((form.formType as FormType) || 'general');
    setRequiresSignature(form.requiresSignature || false);
    setIsJobCard(form.isJobCard || false);
    setBlockJobCompletion(form.blockJobCompletion || false);
    setFields(form.fields || []);
    setEditingForm(form);
    setReadOnly(false);
    setShowFormModal(true);
  };

  const openView = (form: CustomForm) => {
    setFormName(form.name);
    setFormDescription(form.description || '');
    setFormType((form.formType as FormType) || 'general');
    setRequiresSignature(form.requiresSignature || false);
    setIsJobCard(form.isJobCard || false);
    setBlockJobCompletion(form.blockJobCompletion || false);
    setFields(form.fields || []);
    setEditingForm(form);
    setReadOnly(true);
    setShowPreview(true);
    setShowFormModal(true);
  };

  const openFromTemplate = (template: typeof SAFETY_TEMPLATES[0]) => {
    setFormName(template.name);
    setFormDescription(template.description);
    setFormType(template.formType);
    setRequiresSignature(template.requiresSignature);
    setIsJobCard(jobCardIntent);
    setBlockJobCompletion(false);
    setFields(template.fields.map(f => ({ ...f, id: generateId() })));
    setEditingForm(null);
    setShowFormModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Required', 'Form name is required.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        formType,
        requiresSignature,
        isJobCard,
        blockJobCompletion: isJobCard ? blockJobCompletion : false,
        fields,
        isActive: true,
      };

      if (editingForm) {
        const res = await api.patch(`/api/custom-forms/${editingForm.id}`, payload);
        if (res.error) {
          Alert.alert('Error', res.error);
          return;
        }
        Alert.alert('Success', 'Form updated.');
      } else {
        const res = await api.post('/api/custom-forms', payload);
        if (res.error) {
          Alert.alert('Error', res.error);
          return;
        }
        Alert.alert('Success', isJobCard && params.createJobCard === '1'
          ? 'Job card created. It now shows on your jobs.'
          : 'Form created.');
      }
      setShowFormModal(false);
      resetFormState();
      fetchForms();
      if (!editingForm && params.createJobCard === '1') {
        // Came from a job screen — take them back to see the job card
        if (router.canGoBack()) router.back();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to save form.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (form: CustomForm) => {
    const ok = await confirm({
      title: 'Delete Form',
      message: `Are you sure you want to delete "${form.name}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (ok) {
      try {
        const res = await api.delete(`/api/custom-forms/${form.id}`);
        if (res.error) {
          Alert.alert('Error', res.error);
          return;
        }
        fetchForms();
      } catch (err) {
        Alert.alert('Error', 'Failed to delete form.');
      }
    }
  };

  const addField = (type: FieldType) => {
    const newField: FormField = {
      id: generateId(),
      type,
      label: FIELD_TYPE_CONFIG[type].label + ' Field',
      required: false,
      ...(type === 'select' || type === 'radio' ? { options: ['Option 1', 'Option 2'] } : {}),
    };
    setFields([...fields, newField]);
    setEditingFieldIndex(fields.length);
    setShowFieldTypePicker(false);
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...updates };
    setFields(updated);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
    if (editingFieldIndex === index) setEditingFieldIndex(null);
  };

  const moveField = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= fields.length) return;
    const updated = [...fields];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setFields(updated);
    if (editingFieldIndex === fromIndex) setEditingFieldIndex(toIndex);
  };

  const addOption = (fieldIndex: number) => {
    const field = fields[fieldIndex];
    const options = [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`];
    updateField(fieldIndex, { options });
  };

  const updateOption = (fieldIndex: number, optionIndex: number, value: string) => {
    const field = fields[fieldIndex];
    const options = [...(field.options || [])];
    options[optionIndex] = value;
    updateField(fieldIndex, { options });
  };

  const removeOption = (fieldIndex: number, optionIndex: number) => {
    const field = fields[fieldIndex];
    const options = (field.options || []).filter((_, i) => i !== optionIndex);
    updateField(fieldIndex, { options });
  };

  const renderFormCard = ({ item }: { item: CustomForm }) => {
    const typeConfig = FORM_TYPE_CONFIG[item.formType as FormType] || FORM_TYPE_CONFIG.general;
    const fieldCount = (item.fields || []).length;

    return (
      <PressableRow
        style={styles.formCard}
        onPress={() => (canManageForm(item) ? openEdit(item) : openView(item))}

      >
        <View style={styles.formCardHeader}>
          <View style={[styles.formTypeIcon, { backgroundColor: typeConfig.bgColor }]}>
            <Feather name={typeConfig.icon} size={iconSizes['2xl']} color={typeConfig.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.formName} numberOfLines={1}>{item.name}</Text>
            {item.description ? (
              <Text style={styles.formDescription} numberOfLines={1}>{item.description}</Text>
            ) : null}
          </View>
          {canManageForm(item) ? (
            <TouchableOpacity onPress={() => handleDelete(item)} activeOpacity={0.7} style={{ padding: spacing.xs }}>
              <Feather name="trash-2" size={iconSizes.lg} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.formMeta}>
          <View style={[styles.typeBadge, { backgroundColor: typeConfig.bgColor }]}>
            <Text style={[styles.typeBadgeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
          </View>
          {item.isJobCard && (
            <View style={[styles.typeBadge, { backgroundColor: colorWithOpacity(colors.primary, 0.12) }]}>
              <Text style={[styles.typeBadgeText, { color: colors.primary }]}>Job Card</Text>
            </View>
          )}
          <View style={styles.formMetaItem}>
            <Feather name="layers" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={styles.formMetaText}>{fieldCount} field{fieldCount !== 1 ? 's' : ''}</Text>
          </View>
          {item.requiresSignature && (
            <View style={styles.formMetaItem}>
              <Feather name="edit-3" size={iconSizes.sm} color={colors.mutedForeground} />
              <Text style={styles.formMetaText}>Signature</Text>
            </View>
          )}
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: item.isActive ? '#22c55e' : '#9ca3af' }]} />
            <Text style={styles.statusText}>{item.isActive ? 'Active' : 'Inactive'}</Text>
          </View>
        </View>
      </PressableRow>
    );
  };

  const renderFieldEditor = (field: FormField, index: number) => {
    const isExpanded = editingFieldIndex === index;
    const typeConfig = FIELD_TYPE_CONFIG[field.type];
    const hasOptions = field.type === 'select' || field.type === 'radio';

    return (
      <View key={field.id}>
        <View style={styles.fieldItem}>
          <View style={{ gap: spacing.xs }}>
            <TouchableOpacity
              style={styles.fieldDragHandle}
              onPress={() => moveField(index, index - 1)}
              disabled={index === 0}
              activeOpacity={0.5}
            >
              <Feather name="chevron-up" size={14} color={index === 0 ? colors.border : colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fieldDragHandle}
              onPress={() => moveField(index, index + 1)}
              disabled={index === fields.length - 1}
              activeOpacity={0.5}
            >
              <Feather name="chevron-down" size={14} color={index === fields.length - 1 ? colors.border : colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <PressableRow
            style={styles.fieldInfo}
            onPress={() => setEditingFieldIndex(isExpanded ? null : index)}

          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Feather name={typeConfig.icon} size={iconSizes.sm} color={colors.mutedForeground} />
              <Text style={styles.fieldItemLabel} numberOfLines={1}>{field.label}</Text>
              {field.required && <Text style={styles.fieldItemBadge}>*</Text>}
            </View>
            <Text style={styles.fieldItemType}>{typeConfig.label}</Text>
          </PressableRow>
          <TouchableOpacity
            style={styles.deleteFieldBtn}
            onPress={() => removeField(index)}
            activeOpacity={0.7}
          >
            <Feather name="x" size={iconSizes.lg} color={colors.destructive} />
          </TouchableOpacity>
        </View>

        {isExpanded && (
          <View style={styles.fieldEditSection}>
            <Text style={styles.fieldLabel}>Label</Text>
            <TextInput
              style={styles.textInput}
              value={field.label}
              onChangeText={(text) => updateField(index, { label: text })}
              placeholder="Field label"
              placeholderTextColor={colors.mutedForeground}
            />

            <Text style={styles.fieldLabel}>Placeholder</Text>
            <TextInput
              style={styles.textInput}
              value={field.placeholder || ''}
              onChangeText={(text) => updateField(index, { placeholder: text })}
              placeholder="Placeholder text"
              placeholderTextColor={colors.mutedForeground}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Required</Text>
              <Switch
                value={field.required || false}
                onValueChange={(val) => updateField(index, { required: val })}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            {hasOptions && (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.fieldLabel}>Options</Text>
                {(field.options || []).map((opt, optIdx) => (
                  <View key={optIdx} style={styles.optionRow}>
                    <TextInput
                      style={styles.optionInput}
                      value={opt}
                      onChangeText={(text) => updateOption(index, optIdx, text)}
                      placeholder={`Option ${optIdx + 1}`}
                      placeholderTextColor={colors.mutedForeground}
                    />
                    <TouchableOpacity onPress={() => removeOption(index, optIdx)} activeOpacity={0.7}>
                      <Feather name="minus-circle" size={iconSizes.lg} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  style={[styles.addFieldBtn, { borderColor: colors.primary }]}
                  onPress={() => addOption(index)}
                  activeOpacity={0.7}
                >
                  <Feather name="plus" size={iconSizes.sm} color={colors.primary} />
                  <Text style={[styles.addFieldBtnText, { fontSize: 13 }]}>Add Option</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.conditionalSection}>
              <Text style={styles.conditionalTitle}>Conditional Logic</Text>
              {field.conditionalLogic ? (
                <View>
                  <Text style={styles.formMetaText}>
                    Show when "{fields.find(f => f.id === field.conditionalLogic?.fieldId)?.label || '?'}" {field.conditionalLogic.operator.replace('_', ' ')} "{field.conditionalLogic.value}"
                  </Text>
                  <TouchableOpacity
                    onPress={() => updateField(index, { conditionalLogic: undefined })}
                    activeOpacity={0.7}
                    style={{ marginTop: spacing.sm }}
                  >
                    <Text style={{ ...typography.caption, color: colors.destructive }}>Remove Condition</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setConditionalFieldIndex(index);
                    setShowConditionalPicker(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ ...typography.caption, color: colors.primary }}>Add Condition</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderPreviewField = (field: FormField) => {
    if (field.conditionalLogic) {
      return null;
    }

    return (
      <View key={field.id} style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
          <Text style={styles.previewFieldLabel}>{field.label}</Text>
          {field.required && <Text style={{ color: colors.destructive }}>*</Text>}
        </View>
        {field.type === 'checkbox' ? (
          <View style={styles.previewCheckbox}>
            <View style={styles.previewCheckboxBox} />
            <Text style={{ ...typography.body, color: colors.foreground }}>{field.label}</Text>
          </View>
        ) : field.type === 'signature' ? (
          <View style={styles.previewSignatureBox}>
            <Feather name="edit-3" size={24} color={colors.mutedForeground} />
            <Text style={styles.previewPlaceholderText}>Sign here</Text>
          </View>
        ) : field.type === 'photo' ? (
          <View style={[styles.previewSignatureBox, { height: 100 }]}>
            <Feather name="camera" size={24} color={colors.mutedForeground} />
            <Text style={styles.previewPlaceholderText}>Take or upload photo</Text>
          </View>
        ) : field.type === 'select' || field.type === 'radio' ? (
          <View>
            {(field.options || []).map((opt, idx) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
                {field.type === 'radio' ? (
                  <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.border }} />
                ) : null}
                <Text style={{ ...typography.body, color: colors.foreground }}>{opt}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.previewFieldPlaceholder}>
            <Text style={styles.previewPlaceholderText}>
              {field.placeholder || `Enter ${field.label.toLowerCase()}`}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderFormModal = () => (
    <Modal visible={showFormModal} animationType="slide" onRequestClose={() => setShowFormModal(false)}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalHeader, { paddingTop: insets.top + spacing.md }]}>
          <TouchableOpacity onPress={() => { setShowFormModal(false); resetFormState(); }} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{readOnly ? 'View Form' : editingForm ? 'Edit Form' : 'New Form'}</Text>
          {readOnly ? (
            <View style={{ width: 24 }} />
          ) : (
            <TouchableOpacity onPress={handleSave} disabled={isSaving} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.modalSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {!readOnly && (
          <View style={styles.modalSegment}>
            <TouchableOpacity
              style={[styles.modalSegmentItem, !showPreview && styles.modalSegmentItemActive]}
              onPress={() => setShowPreview(false)}
              activeOpacity={0.8}
            >
              <Feather name="edit-2" size={iconSizes.md} color={!showPreview ? colors.primaryForeground : colors.foreground} />
              <Text style={[styles.modalSegmentText, !showPreview && styles.modalSegmentTextActive]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSegmentItem, showPreview && styles.modalSegmentItemActive]}
              onPress={() => setShowPreview(true)}
              activeOpacity={0.8}
            >
              <Feather name="eye" size={iconSizes.md} color={showPreview ? colors.primaryForeground : colors.foreground} />
              <Text style={[styles.modalSegmentText, showPreview && styles.modalSegmentTextActive]}>Preview</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 + insets.bottom }} keyboardShouldPersistTaps="handled">
          {showPreview ? (
            <View>
              <View style={styles.previewContainer}>
                <Text style={{ ...typography.cardTitle, color: colors.foreground, marginBottom: spacing.xs }}>{formName || 'Untitled Form'}</Text>
                {formDescription ? (
                  <Text style={{ ...typography.caption, color: colors.mutedForeground, marginBottom: spacing.lg }}>{formDescription}</Text>
                ) : null}
                {fields.map(renderPreviewField)}
                {requiresSignature && (
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={styles.previewFieldLabel}>Signature *</Text>
                    <View style={styles.previewSignatureBox}>
                      <Feather name="edit-3" size={24} color={colors.mutedForeground} />
                      <Text style={styles.previewPlaceholderText}>Sign here</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View>
              <Text style={[styles.sectionTitle, { marginBottom: spacing.sm }]}>Form Details</Text>

              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.textInput}
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g., Site Safety Checklist"
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={styles.textArea}
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Brief description of this form"
                placeholderTextColor={colors.mutedForeground}
                multiline
              />

              <Text style={styles.fieldLabel}>Type</Text>
              <TouchableOpacity
                style={styles.textInput}
                onPress={() => setShowTypePicker(true)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Feather
                    name={FORM_TYPE_CONFIG[formType].icon}
                    size={iconSizes.md}
                    color={FORM_TYPE_CONFIG[formType].color}
                  />
                  <Text style={{ ...typography.body, color: colors.foreground }}>{FORM_TYPE_CONFIG[formType].label}</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Requires Signature</Text>
                  <Text style={styles.switchDescription}>Require a signature when submitting</Text>
                </View>
                <Switch
                  value={requiresSignature}
                  onValueChange={setRequiresSignature}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: spacing.md }}>
                  <Text style={styles.switchLabel}>Show as Job Card</Text>
                  <Text style={styles.switchDescription}>Appears as a tab on the job so workers can fill it on site</Text>
                </View>
                <Switch
                  value={isJobCard}
                  onValueChange={setIsJobCard}
                  trackColor={{ false: colors.border, true: colors.primary }}
                />
              </View>

              {isJobCard && (
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: spacing.md }}>
                    <Text style={styles.switchLabel}>Require Before Completing Job</Text>
                    <Text style={styles.switchDescription}>Job can't be marked done until this card is filled in</Text>
                  </View>
                  <Switch
                    value={blockJobCompletion}
                    onValueChange={setBlockJobCompletion}
                    trackColor={{ false: colors.border, true: colors.primary }}
                  />
                </View>
              )}

              <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>
                Fields ({fields.length})
              </Text>

              {fields.map((field, index) => renderFieldEditor(field, index))}

              <TouchableOpacity
                style={styles.addFieldBtn}
                onPress={() => setShowFieldTypePicker(true)}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={iconSizes.lg} color={colors.primary} />
                <Text style={styles.addFieldBtnText}>Add Field</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showTypePicker} transparent animationType="fade" onRequestClose={() => setShowTypePicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowTypePicker(false)}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Form Type</Text>
            {(Object.entries(FORM_TYPE_CONFIG) as [FormType, typeof FORM_TYPE_CONFIG[FormType]][]).map(([type, config]) => (
              <TouchableOpacity
                key={type}
                style={[styles.pickerOption, formType === type && styles.pickerOptionActive]}
                onPress={() => { setFormType(type); setShowTypePicker(false); }}
                activeOpacity={0.7}
              >
                <Feather name={config.icon} size={iconSizes.lg} color={formType === type ? colors.primary : config.color} />
                <Text style={[styles.pickerOptionText, formType === type && styles.pickerOptionTextActive]}>
                  {config.label}
                </Text>
                {formType === type && <Feather name="check" size={18} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowTypePicker(false)} activeOpacity={0.7}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showFieldTypePicker} transparent animationType="fade" onRequestClose={() => setShowFieldTypePicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowFieldTypePicker(false)}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Add Field</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {FIELD_TYPES.map((type) => {
                const config = FIELD_TYPE_CONFIG[type];
                return (
                  <TouchableOpacity
                    key={type}
                    style={styles.pickerOption}
                    onPress={() => addField(type)}
                    activeOpacity={0.7}
                  >
                    <Feather name={config.icon} size={iconSizes.lg} color={colors.primary} />
                    <Text style={styles.pickerOptionText}>{config.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowFieldTypePicker(false)} activeOpacity={0.7}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {renderConditionalLogicModal()}
    </Modal>
  );

  const renderConditionalLogicModal = () => {
    if (conditionalFieldIndex === null) return null;
    const otherFields = fields.filter((_, i) => i !== conditionalFieldIndex);

    return (
      <Modal visible={showConditionalPicker} transparent animationType="fade" onRequestClose={() => setShowConditionalPicker(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowConditionalPicker(false)}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Show This Field When...</Text>
            {otherFields.length === 0 ? (
              <Text style={{ ...typography.body, color: colors.mutedForeground, textAlign: 'center', padding: spacing.lg }}>
                Add more fields first to create conditions.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 400 }}>
                {otherFields.map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    style={styles.pickerOption}
                    onPress={() => {
                      updateField(conditionalFieldIndex, {
                        conditionalLogic: {
                          fieldId: f.id,
                          operator: 'equals',
                          value: f.options?.[0] || 'Yes',
                        },
                      });
                      setShowConditionalPicker(false);
                      setConditionalFieldIndex(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.pickerOptionText}>
                      "{f.label}" equals "{f.options?.[0] || 'Yes'}"
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.pickerCancel} onPress={() => { setShowConditionalPicker(false); setConditionalFieldIndex(null); }} activeOpacity={0.7}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Feather name="clipboard" size={32} color={colors.mutedForeground} />
      </View>
      <Text style={styles.emptyTitle}>No Custom Forms</Text>
      <Text style={styles.emptySubtitle}>
        Create custom forms for safety checklists, inspections, compliance, and more.
      </Text>
      <TouchableOpacity style={styles.emptyButton} onPress={openCreate} activeOpacity={0.7}>
        <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground} />
        <Text style={styles.emptyButtonText}>Create Form</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTemplateCard = (template: typeof SAFETY_TEMPLATES[0], index: number) => {
    const typeConfig = FORM_TYPE_CONFIG[template.formType];

    return (
      <View key={index} style={styles.templateCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <View style={[styles.formTypeIcon, { backgroundColor: typeConfig.bgColor, width: 32, height: 32 }]}>
            <Feather name={typeConfig.icon} size={16} color={typeConfig.color} />
          </View>
          <View style={[styles.typeBadge, { backgroundColor: typeConfig.bgColor }]}>
            <Text style={[styles.typeBadgeText, { color: typeConfig.color }]}>{typeConfig.label}</Text>
          </View>
        </View>
        <Text style={styles.templateName}>{template.name}</Text>
        <Text style={styles.templateDescription}>{template.description}</Text>
        <View style={styles.templateMeta}>
          <Feather name="layers" size={iconSizes.sm} color={colors.mutedForeground} />
          <Text style={styles.formMetaText}>{template.fields.length} fields</Text>
          {template.requiresSignature && (
            <>
              <Feather name="edit-3" size={iconSizes.sm} color={colors.mutedForeground} />
              <Text style={styles.formMetaText}>Signature required</Text>
            </>
          )}
        </View>
        <TouchableOpacity
          style={styles.templateUseBtn}
          onPress={() => openFromTemplate(template)}
          activeOpacity={0.7}
        >
          <Feather name="copy" size={iconSizes.sm} color={colors.primaryForeground} />
          <Text style={styles.templateUseBtnText}>Use Template</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Stack.Screen options={{ title: 'Form Builder' }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Form Builder' }} />
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh} activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Form Builder' }} />

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'forms' && styles.activeTab]}
          onPress={() => setActiveTab('forms')}
          activeOpacity={0.8}
        >
          <Feather name="file-text" size={iconSizes.md} color={activeTab === 'forms' ? colors.primaryForeground : colors.foreground} />
          <Text style={[styles.tabText, activeTab === 'forms' && styles.activeTabText]}>My Forms</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'templates' && styles.activeTab]}
          onPress={() => setActiveTab('templates')}
          activeOpacity={0.8}
        >
          <Feather name="grid" size={iconSizes.md} color={activeTab === 'templates' ? colors.primaryForeground : colors.foreground} />
          <Text style={[styles.tabText, activeTab === 'templates' && styles.activeTabText]}>Templates</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'forms' && forms.length > 0 && (
        <View style={styles.searchBar}>
          <Feather name="search" size={iconSizes.md} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search forms..."
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={iconSizes.md} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {activeTab === 'forms' ? (
        forms.length === 0 ? (
          <ScrollView
            contentContainerStyle={{ padding: responsiveShell.paddingHorizontal }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          >
            {renderEmptyState()}
          </ScrollView>
        ) : (
          <FlatList
            data={filteredForms}
            renderItem={renderFormCard}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                <Text style={{ ...typography.body, color: colors.mutedForeground }}>
                  No forms match "{searchQuery.trim()}"
                </Text>
              </View>
            }
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: responsiveShell.paddingHorizontal, paddingBottom: sizes.fabSize + spacing.xl }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          />
        )
      ) : (
        <ScrollView contentContainerStyle={{ padding: responsiveShell.paddingHorizontal, paddingBottom: spacing.lg + insets.bottom }}>
          <Text style={{ ...typography.caption, color: colors.mutedForeground, marginBottom: spacing.md }}>
            {jobCardIntent
              ? 'Pick a template for your job card, or switch to My Forms and tap + to start from scratch.'
              : 'Start with a pre-built template and customize it to your needs.'}
          </Text>
          {SAFETY_TEMPLATES.map((template, index) => renderTemplateCard(template, index))}
        </ScrollView>
      )}

      {activeTab === 'forms' && (
        <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="plus" size={iconSizes['2xl']} color={colors.primaryForeground} />
        </TouchableOpacity>
      )}

      {renderFormModal()}
    </View>
  );
}
