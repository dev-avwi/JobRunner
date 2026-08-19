/**
 * ProjectSetupSection
 * Renders the optional advanced guided setup area for jobType=project.
 * Contains expandable sub-sections: Phases, Financial Settings, Purchase Orders,
 * Claim Stages, Documents, Checklist, and Required Information.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../lib/theme';
import { spacing, typography, fontWeights, radius } from '../../lib/design-tokens';
import api from '../../lib/api';

import type {
  ProjectSetupData,
  ProjectPhase,
  PurchaseOrder,
  ClaimStage,
  ChecklistItem,
  RequiredInfoRow,
  DocumentFile,
  FinancialSettings,
} from './types';
import { hasAdvancedData } from './types';
import { PhasesSection } from './PhasesSection';
import { FinancialSettingsSection } from './FinancialSettingsSection';
import { PurchaseOrdersSection } from './PurchaseOrdersSection';
import { ClaimStagesSection } from './ClaimStagesSection';
import { DocumentsSection } from './DocumentsSection';
import { ChecklistSection } from './ChecklistSection';
import { RequiredInfoSection } from './RequiredInfoSection';
import { SetupSummary } from './SetupSummary';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ProjectSetupSectionProps {
  data: ProjectSetupData;
  onChange: (data: ProjectSetupData) => void;
  teamMembers: any[];
  isOffline: boolean;
}

type SectionKey = 'phases' | 'financial' | 'pos' | 'claims' | 'documents' | 'checklist' | 'requiredInfo';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginTop: spacing.xl,
    },
    headerCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
      flex: 1,
    },
    headerSubtitle: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    badge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: colors.muted,
    },
    badgeText: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
      fontWeight: fontWeights.medium,
    },
    offlineWarning: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.warning + '20',
      borderWidth: 1,
      borderColor: colors.warning + '40',
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    offlineWarningText: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.warning,
      lineHeight: 20,
    },
    sectionList: {
      gap: spacing.sm,
    },
    sectionRow: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      gap: spacing.md,
    },
    sectionHeaderIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionHeaderText: {
      flex: 1,
    },
    sectionHeaderTitle: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    sectionHeaderSubtitle: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    sectionContent: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: spacing.lg,
    },
    countBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    countBadgeText: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.semibold,
      color: '#fff',
    },
  });
}

interface ExpandableSectionProps {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  count?: number;
  sectionKey: SectionKey;
  expandedSection: SectionKey | null;
  onToggle: (key: SectionKey) => void;
  children: React.ReactNode;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

function ExpandableSection({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  count,
  sectionKey,
  expandedSection,
  onToggle,
  children,
  colors,
  styles,
}: ExpandableSectionProps) {
  const isOpen = expandedSection === sectionKey;
  const rotateAnim = useRef(new Animated.Value(isOpen ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: isOpen ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isOpen]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const handlePress = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle(sectionKey);
  }, [sectionKey, onToggle]);

  return (
    <View style={styles.sectionRow}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={handlePress}
        activeOpacity={0.7}
        testID={`section-toggle-${sectionKey}`}
      >
        <View style={[styles.sectionHeaderIcon, { backgroundColor: iconBg }]}>
          <Feather name={icon as any} size={16} color={iconColor} />
        </View>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionHeaderTitle}>{title}</Text>
          {!isOpen && <Text style={styles.sectionHeaderSubtitle}>{subtitle}</Text>}
        </View>
        {count !== undefined && count > 0 && (
          <View style={[styles.countBadge, { backgroundColor: iconColor }]}>
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
        )}
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
        </Animated.View>
      </TouchableOpacity>
      {isOpen && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
}

export function ProjectSetupSection({
  data,
  onChange,
  teamMembers,
  isOffline,
}: ProjectSetupSectionProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);
  const [expandedSection, setExpandedSection] = useState<SectionKey | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const mainRotate = useRef(new Animated.Value(0)).current;

  // Load suppliers once when section is first expanded
  useEffect(() => {
    if (expanded && suppliers.length === 0 && !loadingSuppliers) {
      setLoadingSuppliers(true);
      api.get<any[]>('/api/suppliers').then((resp) => {
        if (resp.data && Array.isArray(resp.data)) {
          setSuppliers(resp.data);
        }
      }).catch(() => {}).finally(() => setLoadingSuppliers(false));
    }
  }, [expanded]);

  const toggleMain = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(mainRotate, {
      toValue: expanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setExpanded((v) => !v);
  }, [expanded, mainRotate]);

  const toggleSection = useCallback((key: SectionKey) => {
    setExpandedSection((cur) => cur === key ? null : key);
  }, []);

  const mainRotation = mainRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const summaryParts: string[] = [];
  if (data.phases.length > 0) summaryParts.push(`${data.phases.length} phase${data.phases.length !== 1 ? 's' : ''}`);
  if (data.purchaseOrders.length > 0) summaryParts.push(`${data.purchaseOrders.length} PO${data.purchaseOrders.length !== 1 ? 's' : ''}`);
  if (data.claimStages.length > 0) summaryParts.push(`${data.claimStages.length} claim${data.claimStages.length !== 1 ? 's' : ''}`);
  if (data.documents.length > 0) summaryParts.push(`${data.documents.length} doc${data.documents.length !== 1 ? 's' : ''}`);

  const showOfflineWarning = isOffline && hasAdvancedData(data);

  return (
    <View style={styles.container} testID="project-setup-section">
      {/* Main toggle card */}
      <TouchableOpacity
        style={styles.headerCard}
        onPress={toggleMain}
        activeOpacity={0.8}
        testID="project-setup-toggle"
      >
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Feather name="settings" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Optional Project Setup</Text>
            <Text style={styles.headerSubtitle}>
              {expanded
                ? 'Tap a section below to configure it'
                : summaryParts.length > 0
                  ? summaryParts.join(', ')
                  : 'Leave closed to create now, or add phases, POs and more'}
            </Text>
          </View>
          {summaryParts.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{summaryParts.length} configured</Text>
            </View>
          )}
          <Animated.View style={{ transform: [{ rotate: mainRotation }] }}>
            <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View>
          {showOfflineWarning && (
            <View style={styles.offlineWarning}>
              <Feather name="wifi-off" size={16} color={colors.warning} style={{ marginTop: 1 }} />
              <Text style={styles.offlineWarningText}>
                You are offline. Advanced project setup data and documents require an internet connection to save. Connect to the internet before creating this project, or remove the advanced setup data to save a minimal project offline.
              </Text>
            </View>
          )}

          <View style={styles.sectionList}>
            <ExpandableSection
              icon="layers"
              iconColor="#7C3AED"
              iconBg="#7C3AED18"
              title="Phases"
              subtitle={data.phases.length > 0 ? `${data.phases.length} phase${data.phases.length !== 1 ? 's' : ''} configured` : 'Break the project into stages'}
              count={data.phases.length}
              sectionKey="phases"
              expandedSection={expandedSection}
              onToggle={toggleSection}
              colors={colors}
              styles={styles}
            >
              <PhasesSection
                phases={data.phases}
                teamMembers={teamMembers}
                onChange={(phases) => onChange({ ...data, phases })}
              />
            </ExpandableSection>

            <ExpandableSection
              icon="dollar-sign"
              iconColor="#059669"
              iconBg="#05966918"
              title="Financial Settings"
              subtitle="Contract value, retention, payment terms"
              sectionKey="financial"
              expandedSection={expandedSection}
              onToggle={toggleSection}
              colors={colors}
              styles={styles}
            >
              <FinancialSettingsSection
                settings={data.financialSettings}
                onChange={(financialSettings) => onChange({ ...data, financialSettings })}
              />
            </ExpandableSection>

            <ExpandableSection
              icon="shopping-bag"
              iconColor="#EA580C"
              iconBg="#EA580C18"
              title="Purchase Orders"
              subtitle={data.purchaseOrders.length > 0 ? `${data.purchaseOrders.length} PO${data.purchaseOrders.length !== 1 ? 's' : ''} configured` : 'Supplier orders for this project'}
              count={data.purchaseOrders.length}
              sectionKey="pos"
              expandedSection={expandedSection}
              onToggle={toggleSection}
              colors={colors}
              styles={styles}
            >
              <PurchaseOrdersSection
                purchaseOrders={data.purchaseOrders}
                phases={data.phases}
                suppliers={suppliers}
                loadingSuppliers={loadingSuppliers}
                onChange={(purchaseOrders) => onChange({ ...data, purchaseOrders })}
              />
            </ExpandableSection>

            <ExpandableSection
              icon="bar-chart-2"
              iconColor="#2563EB"
              iconBg="#2563EB18"
              title="Claim Stages"
              subtitle={data.claimStages.length > 0 ? `${data.claimStages.length} stage${data.claimStages.length !== 1 ? 's' : ''} configured` : 'Progress claim milestones'}
              count={data.claimStages.length}
              sectionKey="claims"
              expandedSection={expandedSection}
              onToggle={toggleSection}
              colors={colors}
              styles={styles}
            >
              <ClaimStagesSection
                claimStages={data.claimStages}
                phases={data.phases}
                onChange={(claimStages) => onChange({ ...data, claimStages })}
              />
            </ExpandableSection>

            <ExpandableSection
              icon="file-text"
              iconColor="#0891B2"
              iconBg="#0891B218"
              title="Documents"
              subtitle={data.documents.length > 0 ? `${data.documents.length} file${data.documents.length !== 1 ? 's' : ''} selected` : 'Attach contracts, drawings, permits'}
              count={data.documents.length}
              sectionKey="documents"
              expandedSection={expandedSection}
              onToggle={toggleSection}
              colors={colors}
              styles={styles}
            >
              <DocumentsSection
                documents={data.documents}
                onChange={(documents) => onChange({ ...data, documents })}
              />
            </ExpandableSection>

            <ExpandableSection
              icon="check-square"
              iconColor="#D97706"
              iconBg="#D9770618"
              title="Checklist Items"
              subtitle={data.checklistItems.length > 0 ? `${data.checklistItems.length} item${data.checklistItems.length !== 1 ? 's' : ''}` : 'Pre-start or handover checklist'}
              count={data.checklistItems.length}
              sectionKey="checklist"
              expandedSection={expandedSection}
              onToggle={toggleSection}
              colors={colors}
              styles={styles}
            >
              <ChecklistSection
                items={data.checklistItems}
                onChange={(checklistItems) => onChange({ ...data, checklistItems })}
              />
            </ExpandableSection>

            <ExpandableSection
              icon="info"
              iconColor="#6B7280"
              iconBg="#6B728018"
              title="Required Information"
              subtitle={data.requiredInformation.length > 0 ? `${data.requiredInformation.length} row${data.requiredInformation.length !== 1 ? 's' : ''}` : 'Custom label/value pairs'}
              count={data.requiredInformation.length}
              sectionKey="requiredInfo"
              expandedSection={expandedSection}
              onToggle={toggleSection}
              colors={colors}
              styles={styles}
            >
              <RequiredInfoSection
                rows={data.requiredInformation}
                onChange={(requiredInformation) => onChange({ ...data, requiredInformation })}
              />
            </ExpandableSection>
          </View>

          {hasAdvancedData(data) && (
            <View style={{ marginTop: spacing.lg }}>
              <SetupSummary data={data} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
