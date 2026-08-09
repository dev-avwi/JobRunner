import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { spacing, radius, shadows, typography, fontWeights } from '../../src/lib/design-tokens';
import { 
  useBusinessTemplates, 
  BusinessTemplate, 
  BusinessTemplateFamily,
  BusinessTemplatePurpose,
  PurposeOption,
  FAMILY_CONFIG, 
  CATEGORIES,
  PURPOSE_LABELS,
  getPurposesForFamily,
} from '../../src/hooks/useBusinessTemplates';
import { useIntegrationHealth } from '../../src/hooks/useIntegrationHealth';
import { openEmailClient, getAvailableEmailClients, renderTemplatePreview } from '../../src/lib/emailClients';
import { useAuthStore } from '../../src/lib/store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: bottomNavHeight,
  },
  header: {
    marginBottom: spacing.lg,
  },
  pageTitle: {
    fontSize: typography.sizes['3xl'],
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  pageSubtitle: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  integrationCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  integrationCardWarning: {
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  integrationCardSuccess: {
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
  },
  integrationContent: {
    flex: 1,
  },
  integrationTitle: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    marginBottom: spacing.xs,
  },
  integrationTitleWarning: {
    color: colors.warningDark,
  },
  integrationTitleSuccess: {
    color: '#065f46',
  },
  integrationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  integrationItemText: {
    fontSize: typography.sizes.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  integrationItemTextWarning: {
    color: colors.warningDark,
  },
  integrationHelpText: {
    fontSize: typography.sizes.xs,
    marginTop: spacing.sm,
    color: colors.warningDark,
  },
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.warningDark + '1A',
  },
  setupButtonText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.warningDark,
  },
  fallbackBadge: {
    fontSize: typography.sizes.xs,
    color: colors.warningDark,
    backgroundColor: colors.warningDark + '1A',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  tabText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  familyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  familyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  familyIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  familyInfo: {
    flex: 1,
  },
  familyName: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  familyDescription: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  familyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  countBadgeText: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  activeBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.medium,
    color: '#065f46',
  },
  familyContent: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
  },
  templateItem: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  templateBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  triggerBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  triggerBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.primary,
  },
  templateDescription: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  activateButton: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  activateButtonText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.primary,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
  },
  createButtonText: {
    fontSize: typography.button.fontSize,
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.xl,
  },
  errorIcon: {
    marginBottom: spacing.lg,
  },
  errorTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  retryButtonText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  loadingText: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.subtitle.fontSize,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMultiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  purposeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  purposeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  purposeChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  purposeChipText: {
    fontSize: typography.sizes.sm,
    color: colors.foreground,
  },
  purposeChipTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
  previewContainer: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  previewLabel: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  previewText: {
    fontSize: typography.button.fontSize,
    color: colors.foreground,
    lineHeight: 20,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
  },
  saveButtonText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  emailClientModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  emailClientSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    maxHeight: '60%',
  },
  emailClientSheetTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emailClientSheetSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emailClientOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  emailClientIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailClientName: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    flex: 1,
  },
  emailClientArrow: {
    opacity: 0.5,
  },
  cancelButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  cancelButtonText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  testEmailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  testEmailButtonText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.primary,
  },
  emailClientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  emailClientButtonText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  emailClientButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  triggerBadgeEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  triggerBadgeIcon: {
    marginRight: 2,
  },
});

type Category = 'communications' | 'financial' | 'jobs_safety';

const FAMILY_ICONS: Record<BusinessTemplateFamily, string> = {
  email: 'mail',
  sms: 'message-square',
  terms_conditions: 'file-text',
  warranty: 'shield',
  payment_notice: 'credit-card',
  safety_form: 'clipboard',
  checklist: 'check-square',
};

export default function BusinessTemplatesScreen() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const router = useRouter();
  
  const {
    templates,
    familiesMeta,
    purposesLoaded,
    isLoading,
    loadingTimedOut,
    error,
    refetch,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    activateTemplate,
    getTemplatesForFamily,
    getFamilyMeta,
    getPurposesForFamilyFromCache,
  } = useBusinessTemplates();
  
  const { health: integrationHealth } = useIntegrationHealth();
  const user = useAuthStore((state) => state.user);
  const previewEmailAddress = user?.email || 'your-email@example.com';
  
  const [activeCategory, setActiveCategory] = useState<Category>('communications');
  const [expandedFamily, setExpandedFamily] = useState<BusinessTemplateFamily | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BusinessTemplate | null>(null);
  const [editingFamily, setEditingFamily] = useState<BusinessTemplateFamily>('email');
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    subject: '',
    purpose: 'general' as BusinessTemplatePurpose,
  });
  
  const [showEmailClientPicker, setShowEmailClientPicker] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<BusinessTemplate | null>(null);
  
  const availableEmailClients = useMemo(() => getAvailableEmailClients(), []);
  
  const handlePreviewInEmailApp = useCallback((template: BusinessTemplate) => {
    setPreviewTemplate(template);
    setShowEmailClientPicker(true);
  }, []);
  
  const handleOpenEmailClient = useCallback(async (clientId: string) => {
    if (!previewTemplate) return;
    
    const subject = previewTemplate.subject 
      ? renderTemplatePreview(previewTemplate.subject)
      : `Preview: ${previewTemplate.name}`;
    const body = renderTemplatePreview(previewTemplate.content);
    
    const success = await openEmailClient(clientId as any, {
      to: previewEmailAddress,
      subject,
      body,
    });
    
    if (success) {
      setShowEmailClientPicker(false);
      setPreviewTemplate(null);
    } else {
      Alert.alert('Error', 'Could not open email client');
    }
  }, [previewTemplate, previewEmailAddress]);
  
  const handleQuickEmailClient = useCallback(async (clientId: string, template: BusinessTemplate) => {
    const subject = template.subject 
      ? renderTemplatePreview(template.subject)
      : `Preview: ${template.name}`;
    const body = renderTemplatePreview(template.content);
    
    const success = await openEmailClient(clientId as any, {
      to: previewEmailAddress,
      subject,
      body,
    });
    
    if (!success) {
      Alert.alert('Error', 'Could not open email client');
    }
  }, [previewEmailAddress]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      content: '',
      subject: '',
      purpose: 'general',
    });
    setEditingTemplate(null);
  };

  const openCreateModal = (family: BusinessTemplateFamily) => {
    if (!purposesLoaded) {
      Alert.alert('Loading', 'Please wait while template options are loading...');
      return;
    }
    resetForm();
    setEditingFamily(family);
    const purposes = getPurposesForFamilyFromCache(family);
    if (purposes.length === 0) {
      Alert.alert('Error', 'Unable to load template purposes. Please try again.');
      return;
    }
    setFormData(prev => ({ ...prev, purpose: purposes[0]?.id || 'general' }));
    setShowEditModal(true);
  };

  const openEditModal = (template: BusinessTemplate) => {
    if (!purposesLoaded) {
      Alert.alert('Loading', 'Please wait while template options are loading...');
      return;
    }
    setEditingTemplate(template);
    setEditingFamily(template.family);
    setFormData({
      name: template.name,
      description: template.description || '',
      content: template.content,
      subject: template.subject || '',
      purpose: (template.purpose as BusinessTemplatePurpose) || 'general',
    });
    setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      Alert.alert('Error', 'Name and content are required');
      return;
    }

    setIsSaving(true);
    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, {
          name: formData.name,
          description: formData.description || undefined,
          content: formData.content,
          subject: formData.subject || undefined,
          purpose: formData.purpose,
        });
        Alert.alert('Success', 'Template updated');
      } else {
        await createTemplate({
          family: editingFamily,
          name: formData.name,
          description: formData.description || undefined,
          content: formData.content,
          subject: formData.subject || undefined,
          purpose: formData.purpose,
        });
        Alert.alert('Success', 'Template created');
      }
      setShowEditModal(false);
      resetForm();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save template');
    }
    setIsSaving(false);
  };

  const handleDelete = async (template: BusinessTemplate) => {
    const ok = await confirm({ title: 'Delete Template', message: `Are you sure you want to delete "${template.name}"?`, confirmText: 'Delete', cancelText: 'Cancel', destructive: true });
    if (ok) {
      try {
        await deleteTemplate(template.id);
        Alert.alert('Success', 'Template deleted');
      } catch (error) {
        Alert.alert('Error', 'Failed to delete template');
      }
    }
  };

  const handleActivate = async (template: BusinessTemplate) => {
    try {
      await activateTemplate(template.id);
      Alert.alert('Success', 'Template activated');
    } catch (error) {
      Alert.alert('Error', 'Failed to activate template');
    }
  };

  const renderIntegrationStatus = () => {
    if (!integrationHealth) return null;

    if (integrationHealth.allReady) {
      return (
        <View style={[styles.integrationCard, styles.integrationCardSuccess]}>
          <Feather name="zap" size={20} color="#065f46" />
          <View style={styles.integrationContent}>
            <Text style={[styles.integrationTitle, styles.integrationTitleSuccess]}>
              All integrations ready
            </Text>
            <Text style={[styles.integrationHelpText, { color: '#065f46' }]}>
              Emails and SMS will send automatically
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.integrationCard, styles.integrationCardWarning]}>
        <Feather name="alert-triangle" size={20} color={colors.warningDark} />
        <View style={styles.integrationContent}>
          <Text style={[styles.integrationTitle, styles.integrationTitleWarning]}>
            Some integrations need setup
          </Text>
          
          {!integrationHealth.services?.sendgrid?.verified && (
            <View>
              <View style={styles.integrationItem}>
                <Text style={[styles.integrationItemText, styles.integrationItemTextWarning]}>
                  <Feather name="mail" size={14} color={colors.warningDark} /> Email: Not configured
                </Text>
                <PressableRow style={styles.setupButton} onPress={() => router.push('/more/integrations')} >
                  <Feather name="settings" size={12} color={colors.warningDark} />
                  <Text style={styles.setupButtonText}>Setup</Text>
                </PressableRow>
              </View>
              <View style={styles.emailClientButtons}>
                {availableEmailClients.slice(0, 3).map((client) => (
                  <PressableRow key={client.id} style={styles.emailClientButton} onPress={() => { const emailTemplates = getTemplatesForFamily('email'); const activeTemplate = emailTemplates.find(t => t.isActive) || emailTemplates[0]; if (activeTemplate) { handleQuickEmailClient(client.id, activeTemplate); } else { Alert.alert('No Template', 'Create an email template first'); } }} >
                    <Feather name="external-link" size={12} color={colors.foreground} />
                    <Text style={styles.emailClientButtonText}>Open in {client.name}</Text>
                  </PressableRow>
                ))}
              </View>
            </View>
          )}
          
          {!integrationHealth.services?.twilio?.verified && (
            <View style={styles.integrationItem}>
              <Text style={[styles.integrationItemText, styles.integrationItemTextWarning]}>
                <Feather name="message-square" size={14} color={colors.warningDark} /> SMS: Not configured
              </Text>
              <PressableRow style={styles.setupButton} onPress={() => router.push('/more/integrations')} >
                <Feather name="settings" size={12} color={colors.warningDark} />
                <Text style={styles.setupButtonText}>Setup</Text>
              </PressableRow>
            </View>
          )}
          
          <Text style={styles.integrationHelpText}>
            Templates work - emails open in your mail app instead of sending automatically.
          </Text>
        </View>
      </View>
    );
  };

  const renderFamilyCard = (family: BusinessTemplateFamily) => {
    const config = FAMILY_CONFIG[family];
    const meta = getFamilyMeta(family);
    const familyTemplates = getTemplatesForFamily(family);
    const isExpanded = expandedFamily === family;
    const iconName = FAMILY_ICONS[family] as keyof typeof Feather.glyphMap;

    return (
      <View key={family} style={styles.familyCard}>
        <PressableRow style={styles.familyHeader} onPress={() => setExpandedFamily(isExpanded ? null : family)} >
          <View style={styles.familyIconContainer}>
            <Feather name={iconName} size={22} color={colors.primary} />
          </View>
          <View style={styles.familyInfo}>
            <Text style={styles.familyName}>{config.name}</Text>
            <Text style={styles.familyDescription}>{config.description}</Text>
          </View>
          <View style={styles.familyMeta}>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {meta?.count || 0}
              </Text>
            </View>
            {meta?.activeTemplateName && (
              <View style={styles.activeBadge}>
                <Feather name="check-circle" size={12} color="#065f46" />
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            )}
            <Feather 
              name={isExpanded ? 'chevron-down' : 'chevron-right'} 
              size={20} 
              color={colors.mutedForeground} 
            />
          </View>
        </PressableRow>

        {isExpanded && (
          <View style={styles.familyContent}>
            {familyTemplates.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No templates yet</Text>
              </View>
            ) : (
              familyTemplates.map((template) => (
                <View key={template.id} style={styles.templateItem}>
                  <View style={styles.templateHeader}>
                    <View style={styles.templateInfo}>
                      <Text style={styles.templateName}>{template.name}</Text>
                      <View style={styles.templateBadges}>
                        {template.purpose && template.purpose !== 'general' && (
                          <View style={styles.triggerBadgeEnhanced}>
                            <Feather name="zap" size={10} color={colors.primary} style={styles.triggerBadgeIcon} />
                            <Text style={styles.triggerBadgeText}>
                              {PURPOSE_LABELS[template.purpose as BusinessTemplatePurpose] || template.purpose}
                            </Text>
                          </View>
                        )}
                        {template.isActive && (
                          <View style={styles.activeBadge}>
                            <Feather name="check" size={10} color="#065f46" />
                            <Text style={styles.activeBadgeText}>Active</Text>
                          </View>
                        )}
                        {template.isDefault && (
                          <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>Default</Text>
                          </View>
                        )}
                        {family === 'email' && (
                          <PressableRow style={styles.testEmailButton} onPress={() => handlePreviewInEmailApp(template)} >
                            <Feather name="external-link" size={10} color={colors.primary} />
                            <Text style={styles.testEmailButtonText}>Preview in App</Text>
                          </PressableRow>
                        )}
                      </View>
                      {template.description && (
                        <Text style={styles.templateDescription} numberOfLines={2}>
                          {template.description}
                        </Text>
                      )}
                    </View>
                    <View style={styles.templateActions}>
                      {!template.isActive && (
                        <PressableRow style={styles.activateButton} onPress={() => handleActivate(template)} >
                          <Text style={styles.activateButtonText}>Activate</Text>
                        </PressableRow>
                      )}
                      <PressableRow style={styles.actionButton} onPress={() => openEditModal(template)} >
                        <Feather name="edit-2" size={18} color={colors.mutedForeground} />
                      </PressableRow>
                      {!template.isDefault && (
                        <PressableRow style={styles.actionButton} onPress={() => handleDelete(template)} >
                          <Feather name="trash-2" size={18} color={colors.destructive} />
                        </PressableRow>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
            
            <PressableRow style={styles.createButton} onPress={() => openCreateModal(family)} >
              <Feather name="plus" size={18} color={colors.primary} />
              <Text style={styles.createButtonText}>Create New Template</Text>
            </PressableRow>
          </View>
        )}
      </View>
    );
  };

  const renderEditModal = () => {
    const purposes = getPurposesForFamilyFromCache(editingFamily);
    const showSubject = editingFamily === 'email';
    const previewContent = renderTemplatePreview(formData.content);

    return (
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <PressableRow onPress={() => setShowEditModal(false)}>
              <Text style={{ color: colors.primary, fontSize: typography.subtitle.fontSize }}>Cancel</Text>
            </PressableRow>
            <Text style={styles.modalTitle}>
              {editingTemplate ? 'Edit Template' : 'New Template'}
            </Text>
            <PressableRow onPress={handleSave} disabled={isSaving} >
              <Text style={{ color: colors.primary, fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold }}>
                {isSaving ? 'Saving...' : 'Save'}
              </Text>
            </PressableRow>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="Template name"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder="What is this template for?"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {purposes.length > 1 && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Trigger / Purpose</Text>
                <View style={styles.purposeSelector}>
                  {purposes.map((purposeOption) => (
                    <PressableRow key={purposeOption.id} style={[ styles.purposeChip, formData.purpose === purposeOption.id && styles.purposeChipActive, ]} onPress={() => setFormData(prev => ({ ...prev, purpose: purposeOption.id }))} >
                      <Text style={[
                        styles.purposeChipText,
                        formData.purpose === purposeOption.id && styles.purposeChipTextActive,
                      ]}>
                        {purposeOption.label}
                      </Text>
                    </PressableRow>
                  ))}
                </View>
              </View>
            )}

            {showSubject && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Subject</Text>
                <TextInput
                  style={styles.input}
                  value={formData.subject}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, subject: text }))}
                  placeholder="Email subject line"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Content</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={formData.content}
                onChangeText={(text) => setFormData(prev => ({ ...prev, content: text }))}
                placeholder="Template content..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={6}
              />
            </View>

            {formData.content.trim() && (
              <View style={styles.previewContainer}>
                <Text style={styles.previewLabel}>PREVIEW</Text>
                <Text style={styles.previewText}>{previewContent}</Text>
              </View>
            )}

            <PressableRow style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSave} disabled={isSaving} >
              {isSaving ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="check" size={20} color={colors.primaryForeground} />
                  <Text style={styles.saveButtonText}>
                    {editingTemplate ? 'Update Template' : 'Create Template'}
                  </Text>
                </>
              )}
            </PressableRow>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  // Show error state if loading timed out or there's an error after loading completed
  const showErrorState = loadingTimedOut || (!isLoading && error && templates.length === 0);
  
  if (isLoading && !loadingTimedOut) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Business Templates' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading templates...</Text>
        </View>
      </View>
    );
  }
  
  if (showErrorState) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Business Templates' }} />
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={colors.mutedForeground} style={styles.errorIcon} />
          <Text style={styles.errorTitle}>Unable to Load Templates</Text>
          <Text style={styles.errorMessage}>
            {error || 'Something went wrong while loading your templates. Please check your connection and try again.'}
          </Text>
          <PressableRow style={styles.retryButton} onPress={refetch} data-testid="button-retry-load" >
            <Feather name="refresh-cw" size={18} color={colors.primaryForeground} />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </PressableRow>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Business Templates' }} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Templates</Text>
          <Text style={styles.pageSubtitle}>
            Manage your email, SMS, and document templates
          </Text>
        </View>

        {renderIntegrationStatus()}

        <View style={styles.tabsContainer}>
          {(['communications', 'financial', 'jobs_safety'] as Category[]).map((cat) => (
            <PressableRow key={cat} style={[styles.tab, activeCategory === cat && styles.tabActive]} onPress={() => { setActiveCategory(cat); setExpandedFamily(null); }} >
              <Text style={[styles.tabText, activeCategory === cat && styles.tabTextActive]}>
                {CATEGORIES[cat].name}
              </Text>
            </PressableRow>
          ))}
        </View>

        {CATEGORIES[activeCategory].families.map((family) => renderFamilyCard(family))}
      </ScrollView>

      {renderEditModal()}
      
      <Modal
        visible={showEmailClientPicker}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowEmailClientPicker(false);
          setPreviewTemplate(null);
        }}
      >
        <TouchableOpacity 
          style={styles.emailClientModal}
          activeOpacity={1}
          onPress={() => {
            setShowEmailClientPicker(false);
            setPreviewTemplate(null);
          }}
        >
          <View style={styles.emailClientSheet}>
            <Text style={styles.emailClientSheetTitle}>Open in Email App</Text>
            <Text style={styles.emailClientSheetSubtitle}>
              {previewTemplate 
                ? `Preview "${previewTemplate.name}" with sample data`
                : 'Choose an email app to preview the template'}
            </Text>
            
            {availableEmailClients.map((client) => {
              const clientColors: Record<string, string> = {
                gmail: '#EA4335',
                outlook: '#0078D4',
                apple_mail: '#007AFF',
                default: colors.primary,
              };
              const bgColor = clientColors[client.id] || colors.primary;
              
              return (
                <PressableRow key={client.id} style={styles.emailClientOption} onPress={() => handleOpenEmailClient(client.id)} >
                  <View style={[styles.emailClientIconContainer, { backgroundColor: `${bgColor}15` }]}>
                    <Feather name="mail" size={22} color={bgColor} />
                  </View>
                  <Text style={styles.emailClientName}>{client.name}</Text>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} style={styles.emailClientArrow} />
                </PressableRow>
              );
            })}
            
            <PressableRow style={styles.cancelButton} onPress={() => { setShowEmailClientPicker(false); setPreviewTemplate(null); }} >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </PressableRow>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
