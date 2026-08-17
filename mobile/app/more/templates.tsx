import { useEffect, useState, useCallback, useMemo } from 'react';
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
  Dimensions,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '@/components/ui/PressableRow';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { API_URL } from '../../src/lib/api';
import { spacing, radius, shadows, typography, fontWeights } from '../../src/lib/design-tokens';
import LiveDocumentPreview from '../../src/components/LiveDocumentPreview';
import { TemplateId, DOCUMENT_TEMPLATES, TemplateCustomization, DOCUMENT_ACCENT_COLOR, getTemplateStyles } from '../../src/lib/document-templates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';

interface StylePreset {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  headerLayout: string;
  footerLayout: string;
  showLogo: boolean;
  showBusinessDetails: boolean;
  showBankDetails: boolean;
  tableBorders: boolean;
  alternateRowColors: boolean;
  compactMode: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DocumentTemplate {
  id: string;
  userId: string;
  type: 'quote' | 'invoice' | 'job';
  familyKey: string;
  name: string;
  tradeType: string;
  rateCardId: string | null;
  isDefault?: boolean;
  styling: {
    brandColor?: string;
    logoDisplay?: boolean;
    templateStyle?: TemplateId;
  };
  sections: {
    showHeader?: boolean;
    showLineItems?: boolean;
    showTotals?: boolean;
    showTerms?: boolean;
    showSignature?: boolean;
  };
  defaults: {
    title?: string;
    description?: string;
    terms?: string;
    depositPct?: number;
    dueTermDays?: number;
    gstEnabled?: boolean;
  };
  defaultLineItems: Array<{
    description: string;
    qty: number;
    unitPrice: number;
    unit: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const tradeTypes = [
  'plumbing', 'electrical', 'carpentry', 'painting', 'hvac', 'roofing', 
  'landscaping', 'tiling', 'flooring', 'renovation', 'handyman', 'general'
];

const templateStyles: { id: TemplateId; name: string; description: string }[] = [
  { id: 'professional', name: 'Professional', description: 'Traditional layout with bordered tables' },
  { id: 'modern', name: 'Modern', description: 'Clean design with bold brand colors' },
  { id: 'minimal', name: 'Minimal', description: 'Ultra-clean with subtle styling' },
];

// Thumbnail dimensions — document rendered at DOC_W px wide, first DOC_H_SHOW px shown, scaled by SCALE
const THUMB_DOC_W = 320;
const THUMB_DOC_H_SHOW = 210;
const THUMB_SCALE = 0.24;
const THUMB_CONTAINER_H = Math.round(THUMB_DOC_H_SHOW * THUMB_SCALE); // ~50px
const THUMB_MARGIN_LEFT = -(THUMB_DOC_W * (1 - THUMB_SCALE)) / 2;       // ~-121.6
const THUMB_MARGIN_TOP = -(THUMB_DOC_H_SHOW * (1 - THUMB_SCALE)) / 2;   // ~-79.8

function TemplateStyleThumbnail({ templateId, customization }: { templateId: TemplateId; customization: TemplateCustomization }) {
  const { colors } = useTheme();
  const { template, primaryColor } = getTemplateStyles(templateId, customization?.accentColor || DOCUMENT_ACCENT_COLOR, customization);
  const isModern = template.headerLayout === 'modern';
  const isMinimal = template.headerLayout === 'minimal';

  return (
    <View style={{ width: '100%', height: THUMB_CONTAINER_H, overflow: 'hidden', borderRadius: 6, marginBottom: 8, backgroundColor: '#fff' }}>
      <View
        pointerEvents="none"
        style={{
          width: THUMB_DOC_W,
          height: THUMB_DOC_H_SHOW,
          overflow: 'hidden',
          transform: [{ scale: THUMB_SCALE }],
          marginLeft: THUMB_MARGIN_LEFT,
          marginTop: THUMB_MARGIN_TOP,
        }}
      >
        {/* HEADER */}
        {isModern ? (
          <View style={{ backgroundColor: primaryColor, paddingHorizontal: 16, paddingVertical: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>QUOTE</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 3 }}>Your Business Pty Ltd</Text>
              </View>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Q-2025-001</Text>
            </View>
          </View>
        ) : isMinimal ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: primaryColor, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>Your Business Pty Ltd</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: primaryColor, letterSpacing: 0.5 }}>QUOTE</Text>
          </View>
        ) : (
          /* classic / professional */
          <View style={{ backgroundColor: primaryColor, paddingHorizontal: 16, paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Your Business Pty Ltd</Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>ABN 12 345 678 901</Text>
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: 1 }}>QUOTE</Text>
            </View>
          </View>
        )}

        {/* CLIENT & META */}
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }}>
          <Text style={{ fontSize: 9, color: '#aaa', letterSpacing: 0.5 }}>TO</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a1a', marginTop: 1 }}>John Smith</Text>
          <Text style={{ fontSize: 10, color: '#888', marginTop: 1 }}>123 Sample Street, Sydney NSW</Text>
        </View>

        {/* TABLE HEADER */}
        <View style={{
          flexDirection: 'row',
          marginHorizontal: 12,
          paddingHorizontal: 8,
          paddingVertical: 6,
          backgroundColor: template.tableStyle === 'minimal' ? 'transparent' : primaryColor,
          borderRadius: isModern ? 6 : 0,
          borderBottomWidth: template.tableStyle === 'minimal' ? 2 : 0,
          borderBottomColor: primaryColor,
        }}>
          <Text style={{ flex: 3, fontSize: 9, fontWeight: '700', color: template.tableStyle === 'minimal' ? '#555' : '#fff' }}>DESCRIPTION</Text>
          <Text style={{ flex: 1, fontSize: 9, fontWeight: '700', color: template.tableStyle === 'minimal' ? '#555' : '#fff', textAlign: 'right' }}>AMOUNT</Text>
        </View>

        {/* LINE ITEMS */}
        {[
          { desc: 'Labour — Site Inspection', total: '$360.00', idx: 0 },
          { desc: 'Materials & Parts', total: '$85.00', idx: 1 },
          { desc: 'Call-out Fee', total: '$75.00', idx: 2 },
        ].map((item) => (
          <View key={item.idx} style={{
            flexDirection: 'row',
            marginHorizontal: 12,
            paddingHorizontal: 8,
            paddingVertical: 7,
            backgroundColor: template.tableStyle === 'striped' && item.idx % 2 === 0 ? `${primaryColor}14` : 'transparent',
            borderBottomWidth: template.tableStyle === 'bordered' ? 1 : 0,
            borderBottomColor: '#e5e7eb',
          }}>
            <Text style={{ flex: 3, fontSize: 11, color: '#333' }}>{item.desc}</Text>
            <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: '#111', textAlign: 'right' }}>{item.total}</Text>
          </View>
        ))}

        {/* TOTAL */}
        <View style={{ flexDirection: 'row', marginHorizontal: 12, paddingHorizontal: 8, paddingVertical: 8, marginTop: 6, backgroundColor: `${primaryColor}18`, borderRadius: 4 }}>
          <Text style={{ flex: 3, fontSize: 12, fontWeight: '700', color: '#1a1a1a' }}>TOTAL (inc. GST)</Text>
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: primaryColor, textAlign: 'right' }}>$572.00</Text>
        </View>
      </View>
    </View>
  );
}

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  headerLeft: {
    flex: 1,
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  createButtonText: {
    color: colors.primaryForeground,
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    marginBottom: 4,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: typography.sizes.sm,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'] + 16,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg + 4,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  emptyButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  templateList: {
    gap: spacing.md,
  },
  templateCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  templateType: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.primary,
    textTransform: 'capitalize',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  templateTrade: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
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
  templateDetails: {
    marginTop: spacing.sm,
  },
  templateTitle: {
    fontSize: typography.button.fontSize,
    color: colors.foreground,
    marginBottom: 4,
  },
  templateItemsCount: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
  },
  templateTerms: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 4,
    fontStyle: 'italic',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  badge: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  createdByYouBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    fontSize: typography.sizes.xs,
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  createdByYouBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.primary,
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  tabText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  previewScrollView: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: spacing.lg + 4,
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
    padding: spacing.md + 2,
    fontSize: typography.subtitle.fontSize,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: spacing.md + 2,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontSize: typography.button.fontSize,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  typeButtonTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
  tradeTypeScroll: {
    marginBottom: spacing.lg,
  },
  tradeTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tradeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tradeChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tradeChipText: {
    fontSize: typography.sizes.sm,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  tradeChipTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
  sectionHeader: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  styleCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  styleCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  styleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  styleName: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  styleDescription: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  colorPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  colorPreview: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  colorInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.button.fontSize,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorPresets: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  colorPreset: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorPresetActive: {
    borderColor: colors.foreground,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  switchLabel: {
    fontSize: typography.button.fontSize,
    color: colors.foreground,
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.muted,
    padding: 2,
  },
  switchTrackActive: {
    backgroundColor: colors.primary,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  switchThumbActive: {
    marginLeft: 20,
  },
  lineItemRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  lineItemInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    fontSize: typography.button.fontSize,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lineItemQty: {
    width: 60,
  },
  lineItemPrice: {
    width: 80,
  },
  addLineItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addLineItemText: {
    fontSize: typography.button.fontSize,
    color: colors.primary,
  },
  removeLineItemButton: {
    padding: spacing.sm,
    justifyContent: 'center',
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
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
  },
  previewTotalBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  previewTotalText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  stylePresetsSection: {
    marginBottom: spacing.xl,
  },
  stylePresetsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stylePresetsSectionTitle: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  viewAllButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
  stylePresetCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stylePresetCardActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  stylePresetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  stylePresetInfo: {
    flex: 1,
  },
  stylePresetName: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: 4,
  },
  stylePresetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  defaultBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  defaultBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  colorSwatches: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  colorSwatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
  stylePresetDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  stylePresetDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stylePresetDetailText: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
  },
  previewSection: {
    marginTop: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    overflow: 'hidden',
    height: 200,
  },
  stylePresetListModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  stylePresetList: {
    gap: spacing.md,
  },
  emptyStylePresets: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyStylePresetsText: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  customizeSection: {
    marginBottom: spacing.md,
  },
  customizeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  customizeSectionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  customizeSectionTitle: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  customizeSectionSubtitle: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
  },
  customizeCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  templateStyleButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  templateStyleButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  templateStyleButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  templateStyleButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  templateStyleButtonTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  templateStylePreview: {
    width: '100%',
    height: 64,
    backgroundColor: colors.background,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  templatePreviewHeader: {
    height: 16,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  templatePreviewHeaderTall: {
    height: 22,
    paddingHorizontal: 6,
    justifyContent: 'center',
    gap: 3,
  },
  templatePreviewHeaderLine: {
    width: 28,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 1,
  },
  templatePreviewHeaderLineSm: {
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  templatePreviewBody: {
    padding: 5,
    gap: 4,
  },
  templatePreviewRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  templatePreviewLineWide: {
    flex: 2,
    height: 2,
    borderRadius: 1,
  },
  templatePreviewLineNarrow: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
  templatePreviewDivider: {
    height: 1,
    borderRadius: 1,
    marginTop: 2,
  },
  templatePreviewAccentBar: {
    height: 5,
    borderRadius: 2,
    marginTop: 2,
  },
  templatePreviewMinimalTop: {
    borderBottomWidth: 1.5,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  customizeOptionRow: {
    marginBottom: spacing.md,
  },
  customizeOptionLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  customizePickerRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  customizePickerOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  customizePickerOptionActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  customizePickerOptionText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
  },
  customizePickerOptionTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
  customizeSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  customizeColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  customizeColorPreview: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  customizeColorPresets: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  customizeColorPreset: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  customizeColorPresetActive: {
    borderColor: colors.foreground,
  },
  customizePreviewContainer: {
    marginTop: spacing.lg,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    overflow: 'hidden',
    height: 220,
  },
  saveCustomizationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    marginTop: spacing.lg,
  },
  saveCustomizationButtonDisabled: {
    backgroundColor: colors.muted,
  },
  saveCustomizationButtonText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  saveCustomizationButtonTextDisabled: {
    color: colors.mutedForeground,
  },
  sectionDivider: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dividerLine: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
  },
  templateListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  templateListHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  templateListHeaderTitle: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  templateListHeaderSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});

function StatCard({ 
  title, 
  value, 
  icon,
  colors
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode;
  colors: ThemeColors;
}) {
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <View style={styles.statLabelRow}>
        {icon}
        <Text style={styles.statLabel}>{title}</Text>
      </View>
    </View>
  );
}

interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  unit: string;
}

interface NewTemplate {
  name: string;
  type: 'quote' | 'invoice' | 'job';
  tradeType: string;
  styling: {
    brandColor: string;
    logoDisplay: boolean;
    templateStyle: TemplateId;
  };
  defaults: {
    title: string;
    description: string;
    terms: string;
    depositPct: number;
    gstEnabled: boolean;
  };
  defaultLineItems: LineItem[];
}

const colorPresets = [
  '#1e3a5f',
  '#2563eb',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#db2777',
  '#0891b2',
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function TemplatesScreen() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const { token, businessSettings, fetchBusinessSettings } = useAuthStore();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [stylePresets, setStylePresets] = useState<StylePreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<StylePreset | null>(null);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [isLoadingPresets, setIsLoadingPresets] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'quote' | 'invoice' | 'job'>('all');
  const [templateSearchQuery, setTemplateSearchQuery] = useState('');
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  
  const [selectedTemplateStyle, setSelectedTemplateStyle] = useState<TemplateId>('professional');
  const [templateCustomization, setTemplateCustomization] = useState<TemplateCustomization>({
    tableStyle: 'bordered',
    noteStyle: 'bordered',
    headerBorderWidth: 2,
    showHeaderDivider: true,
    bodyWeight: '600',
    headingWeight: '700',
    accentColor: DOCUMENT_ACCENT_COLOR,
    fontStyle: 'default',
  });
  const [isUpdatingPreset, setIsUpdatingPreset] = useState(false);
  const [isSavingCustomization, setIsSavingCustomization] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [newTemplate, setNewTemplate] = useState<NewTemplate>({
    name: '',
    type: 'quote',
    tradeType: 'general',
    styling: {
      brandColor: '#1e3a5f',
      logoDisplay: true,
      templateStyle: 'minimal',
    },
    defaults: {
      title: '',
      description: '',
      terms: '',
      depositPct: 0,
      gstEnabled: true,
    },
    defaultLineItems: []
  });
  const [isCreating, setIsCreating] = useState(false);

  const fetchStylePresets = useCallback(async () => {
    setIsLoadingPresets(true);
    try {
      const response = await fetch(`${API_URL}/api/style-presets`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setStylePresets(data || []);
        const defaultPreset = data?.find((p: StylePreset) => p.isDefault) || data?.[0] || null;
        if (!selectedPreset && defaultPreset) {
          setSelectedPreset(defaultPreset);
        }
      }
    } catch (error) {
      console.error('Failed to fetch style presets:', error);
    }
    setIsLoadingPresets(false);
  }, [token, selectedPreset]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.append('type', typeFilter);
      
      const url = `${API_URL}/api/templates${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
    setIsLoading(false);
  }, [token, typeFilter]);

  useEffect(() => {
    // Fetch fresh business settings to sync template style from web app
    fetchBusinessSettings();
    fetchStylePresets();
  }, []);

  useEffect(() => {
    refreshData();
  }, [typeFilter]);

  // Sync selected template style from business settings (SINGLE source of truth for cross-platform sync)
  // Note: We intentionally do NOT sync from selectedPreset.headerLayout to prevent race conditions
  // where stale preset data overwrites the correct template from businessSettings
  useEffect(() => {
    const serverDocumentTemplate = (businessSettings as any)?.documentTemplate;
    if (serverDocumentTemplate && ['professional', 'modern', 'minimal'].includes(serverDocumentTemplate)) {
      setSelectedTemplateStyle(serverDocumentTemplate as TemplateId);
    }
  }, [(businessSettings as any)?.documentTemplate]);

  // Load saved customization from server on mount
  useEffect(() => {
    const serverSettings = (businessSettings as any)?.documentTemplateSettings;
    if (serverSettings) {
      setTemplateCustomization(prev => ({
        ...prev,
        tableStyle: serverSettings.tableStyle || prev.tableStyle,
        noteStyle: serverSettings.noteStyle || prev.noteStyle,
        headerBorderWidth: serverSettings.headerBorderWidth ?? prev.headerBorderWidth,
        showHeaderDivider: serverSettings.showHeaderDivider ?? prev.showHeaderDivider,
        bodyWeight: serverSettings.bodyWeight || prev.bodyWeight,
        headingWeight: serverSettings.headingWeight || prev.headingWeight,
        accentColor: serverSettings.accentColor || prev.accentColor,
        fontStyle: serverSettings.fontStyle || prev.fontStyle,
      }));
    }
  }, [(businessSettings as any)?.documentTemplateSettings]);

  // Sync customization when template style changes (only reset if no server settings)
  useEffect(() => {
    const template = DOCUMENT_TEMPLATES[selectedTemplateStyle];
    if (template) {
      const serverSettings = (businessSettings as any)?.documentTemplateSettings;
      if (!serverSettings) {
        setTemplateCustomization(prev => ({
          ...prev,
          tableStyle: template.tableStyle,
          noteStyle: template.noteStyle,
          headerBorderWidth: template.headerBorderWidth,
          showHeaderDivider: template.showHeaderDivider,
          bodyWeight: template.bodyWeight,
          headingWeight: template.headingWeight,
        }));
      }
    }
  }, [selectedTemplateStyle]);

  const updateStylePresetTemplate = useCallback(async (templateId: TemplateId) => {
    setIsUpdatingPreset(true);
    try {
      // Update style preset if one is selected
      let presetResponse: Response | null = null;
      if (selectedPreset) {
        presetResponse = await fetch(`${API_URL}/api/style-presets/${selectedPreset.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            headerLayout: templateId,
          }),
        });
      }
      
      // Get the template's default customization values
      const template = DOCUMENT_TEMPLATES[templateId];
      const resetCustomization = template ? {
        tableStyle: template.tableStyle,
        noteStyle: template.noteStyle,
        headerBorderWidth: template.headerBorderWidth,
        showHeaderDivider: template.showHeaderDivider,
        bodyWeight: template.bodyWeight,
        headingWeight: template.headingWeight,
        accentColor: templateCustomization.accentColor || DOCUMENT_ACCENT_COLOR,
      } : undefined;
      
      // Always update business settings with BOTH template ID and reset customization
      await fetch(`${API_URL}/api/business-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentTemplate: templateId,
          documentTemplateSettings: resetCustomization,
        }),
      });
      
      // Update local state
      await fetchBusinessSettings();
      
      if (presetResponse?.ok) {
        await fetchStylePresets();
      }
    } catch (error) {
      console.error('Failed to update style preset:', error);
    }
    setIsUpdatingPreset(false);
  }, [selectedPreset, token, fetchStylePresets, fetchBusinessSettings, templateCustomization.accentColor]);

  const handleSelectTemplateStyle = useCallback((templateId: TemplateId) => {
    setSelectedTemplateStyle(templateId);
    updateStylePresetTemplate(templateId);
  }, [updateStylePresetTemplate]);

  const updateCustomization = useCallback((updates: Partial<TemplateCustomization>) => {
    setTemplateCustomization(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  }, []);

  const saveCustomization = useCallback(async () => {
    setIsSavingCustomization(true);
    try {
      await fetch(`${API_URL}/api/business-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentTemplate: selectedTemplateStyle,
          documentTemplateSettings: templateCustomization,
        }),
      });
      await fetchBusinessSettings();
      setHasUnsavedChanges(false);
      Alert.alert('Saved', 'Document style customizations saved successfully.');
    } catch (error) {
      console.error('Failed to save customization:', error);
      Alert.alert('Error', 'Failed to save customizations. Please try again.');
    }
    setIsSavingCustomization(false);
  }, [token, selectedTemplateStyle, templateCustomization, fetchBusinessSettings]);

  const resetForm = () => {
    setNewTemplate({
      name: '',
      type: 'quote',
      tradeType: 'general',
      styling: {
        brandColor: businessSettings?.brandColor || '#1e3a5f',
        logoDisplay: true,
        templateStyle: 'minimal',
      },
      defaults: {
        title: '',
        description: '',
        terms: '',
        depositPct: 0,
        gstEnabled: businessSettings?.gstEnabled ?? true,
      },
      defaultLineItems: []
    });
    setEditingTemplate(null);
    setActiveTab('edit');
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim()) {
      Alert.alert('Error', 'Template name is required');
      return;
    }

    setIsCreating(true);
    try {
      const method = editingTemplate ? 'PATCH' : 'POST';
      const url = editingTemplate 
        ? `${API_URL}/api/templates/${editingTemplate.id}`
        : `${API_URL}/api/templates`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newTemplate.name,
          type: newTemplate.type,
          tradeType: newTemplate.tradeType,
          familyKey: newTemplate.tradeType,
          defaults: newTemplate.defaults,
          defaultLineItems: newTemplate.defaultLineItems.filter(item => item.description.trim()),
          styling: newTemplate.styling,
          sections: {
            showHeader: true,
            showLineItems: true,
            showTotals: true,
            showTerms: true,
            showSignature: false,
          },
        }),
      });

      if (response.ok) {
        await refreshData();
        setShowCreateModal(false);
        resetForm();
        Alert.alert('Success', editingTemplate ? 'Template updated successfully' : 'Template created successfully');
      } else {
        const error = await response.text();
        Alert.alert('Error', error || 'Failed to save template');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    }
    setIsCreating(false);
  };

  const handleEditTemplate = (template: DocumentTemplate) => {
    setEditingTemplate(template);
    setNewTemplate({
      name: template.name,
      type: template.type,
      tradeType: template.tradeType,
      styling: {
        brandColor: template.styling?.brandColor || '#1e3a5f',
        logoDisplay: template.styling?.logoDisplay ?? true,
        templateStyle: (template.styling?.templateStyle as TemplateId) || 'minimal',
      },
      defaults: {
        title: template.defaults?.title || '',
        description: template.defaults?.description || '',
        terms: template.defaults?.terms || '',
        depositPct: template.defaults?.depositPct || 0,
        gstEnabled: template.defaults?.gstEnabled ?? true,
      },
      defaultLineItems: template.defaultLineItems || [],
    });
    setActiveTab('edit');
    setShowCreateModal(true);
  };

  const handleDuplicateTemplate = async (template: DocumentTemplate) => {
    try {
      const response = await fetch(`${API_URL}/api/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          type: template.type,
          tradeType: template.tradeType,
          familyKey: template.familyKey,
          defaults: template.defaults,
          defaultLineItems: template.defaultLineItems,
          styling: template.styling,
          sections: template.sections,
        }),
      });

      if (response.ok) {
        await refreshData();
        Alert.alert('Success', 'Template duplicated successfully');
      } else {
        Alert.alert('Error', 'Failed to duplicate template');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };

  const handleDeleteTemplate = async (template: DocumentTemplate) => {
    const ok = await confirm({
      title: 'Delete Template',
      message: `Are you sure you want to delete "${template.name}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (ok) {
      try {
        const response = await fetch(`${API_URL}/api/templates/${template.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          await refreshData();
          Alert.alert('Success', 'Template deleted');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to delete template');
      }
    }
  };

  const addLineItem = () => {
    setNewTemplate({
      ...newTemplate,
      defaultLineItems: [
        ...newTemplate.defaultLineItems,
        { description: '', qty: 1, unitPrice: 0, unit: 'each' }
      ]
    });
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const items = [...newTemplate.defaultLineItems];
    items[index] = { ...items[index], [field]: value };
    setNewTemplate({ ...newTemplate, defaultLineItems: items });
  };

  const removeLineItem = (index: number) => {
    const items = newTemplate.defaultLineItems.filter((_, i) => i !== index);
    setNewTemplate({ ...newTemplate, defaultLineItems: items });
  };

  const subtotal = useMemo(() => {
    return newTemplate.defaultLineItems.reduce((sum, item) => {
      return sum + (item.qty || 0) * (item.unitPrice || 0);
    }, 0);
  }, [newTemplate.defaultLineItems]);

  const gst = newTemplate.defaults.gstEnabled ? subtotal * 0.1 : 0;
  const total = subtotal + gst;

  const previewLineItems = useMemo(() => {
    const items = newTemplate.defaultLineItems
      .filter(item => item.description.trim())
      .map(item => ({
        description: item.description,
        quantity: item.qty || 1,
        unitPrice: item.unitPrice || 0,
      }));
    
    if (items.length === 0) {
      return [
        { description: 'Sample Service Item', quantity: 2, unitPrice: 150 },
        { description: 'Materials & Supplies', quantity: 1, unitPrice: 85 },
      ];
    }
    return items;
  }, [newTemplate.defaultLineItems]);

  const businessInfo = useMemo(() => ({
    businessName: businessSettings?.businessName || 'Your Business Name',
    abn: businessSettings?.abn,
    address: businessSettings?.address,
    phone: businessSettings?.phone,
    email: businessSettings?.email,
    logoUrl: newTemplate.styling.logoDisplay ? businessSettings?.logoUrl : undefined,
    brandColor: newTemplate.styling.brandColor,
    gstEnabled: newTemplate.defaults.gstEnabled,
  }), [businessSettings, newTemplate.styling, newTemplate.defaults.gstEnabled]);

  const sampleClient = useMemo(() => ({
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '0400 123 456',
    address: '123 Sample Street, Sydney NSW 2000',
  }), []);

  const filteredTemplates = useMemo(() => {
    let result = templates;
    if (templateSearchQuery.trim()) {
      const q = templateSearchQuery.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(q) || 
        t.tradeType?.toLowerCase().includes(q) ||
        t.defaults?.title?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [templates, templateSearchQuery]);
  const isSearching = templateSearchQuery.trim().length > 0;
  const displayedTemplates = isSearching || showAllTemplates ? filteredTemplates : filteredTemplates.slice(0, 5);
  const hasMoreTemplates = filteredTemplates.length > 5;
  const quoteTemplates = templates.filter(t => t.type === 'quote').length;
  const invoiceTemplates = templates.filter(t => t.type === 'invoice').length;
  const jobTemplates = templates.filter(t => t.type === 'job').length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'quote': return 'file-text';
      case 'invoice': return 'file-text';
      case 'job': return 'briefcase';
      default: return 'file';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'quote': return colors.info;
      case 'invoice': return colors.success;
      case 'job': return colors.warning;
      default: return colors.primary;
    }
  };

  const renderEditTab = () => (
    <ScrollView 
      style={styles.modalContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Template Name *</Text>
        <TextInput
          style={styles.input}
          value={newTemplate.name}
          onChangeText={(text) => setNewTemplate({ ...newTemplate, name: text })}
          placeholder="e.g., Plumbing Quote Template"
          placeholderTextColor={colors.mutedForeground}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Template Type</Text>
        <View style={styles.typeButtons}>
          {(['quote', 'invoice', 'job'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeButton,
                newTemplate.type === type && styles.typeButtonActive
              ]}
              onPress={() => setNewTemplate({ ...newTemplate, type })}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.typeButtonText,
                newTemplate.type === type && styles.typeButtonTextActive
              ]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Trade Type</Text>
        <View style={styles.tradeTypeContainer}>
          {tradeTypes.map((trade) => (
            <TouchableOpacity
              key={trade}
              style={[
                styles.tradeChip,
                newTemplate.tradeType === trade && styles.tradeChipActive
              ]}
              onPress={() => setNewTemplate({ ...newTemplate, tradeType: trade })}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.tradeChipText,
                newTemplate.tradeType === trade && styles.tradeChipTextActive
              ]}>
                {trade}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.sectionHeader}>Document Style</Text>
      
      {templateStyles.map((style) => (
        <PressableRow
          key={style.id}
          style={[
            styles.styleCard,
            newTemplate.styling.templateStyle === style.id && styles.styleCardActive
          ]}
          onPress={() => setNewTemplate({
            ...newTemplate,
            styling: { ...newTemplate.styling, templateStyle: style.id }
          })}

        >
          <View style={styles.styleCardHeader}>
            <Text style={styles.styleName}>{style.name}</Text>
            {newTemplate.styling.templateStyle === style.id && (
              <Feather name="check-circle" size={20} color={colors.primary} />
            )}
          </View>
          <Text style={styles.styleDescription}>{style.description}</Text>
        </PressableRow>
      ))}

      <Text style={styles.sectionHeader}>Brand Color</Text>
      
      <View style={styles.inputGroup}>
        <View style={styles.colorPickerRow}>
          <View 
            style={[styles.colorPreview, { backgroundColor: newTemplate.styling.brandColor }]}
          />
          <TextInput
            style={styles.colorInput}
            value={newTemplate.styling.brandColor}
            onChangeText={(text) => setNewTemplate({
              ...newTemplate,
              styling: { ...newTemplate.styling, brandColor: text }
            })}
            placeholder="#1e3a5f"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.colorPresets}>
          {colorPresets.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorPreset,
                { backgroundColor: color },
                newTemplate.styling.brandColor === color && styles.colorPresetActive
              ]}
              onPress={() => setNewTemplate({
                ...newTemplate,
                styling: { ...newTemplate.styling, brandColor: color }
              })}
              activeOpacity={0.7}
            />
          ))}
        </View>
      </View>

      <Text style={styles.sectionHeader}>Display Options</Text>

      <TouchableOpacity
        style={styles.switchRow}
        onPress={() => setNewTemplate({
          ...newTemplate,
          styling: { ...newTemplate.styling, logoDisplay: !newTemplate.styling.logoDisplay }
        })}
        activeOpacity={0.7}
      >
        <Text style={styles.switchLabel}>Show Logo on Documents</Text>
        <View style={[
          styles.switchTrack,
          newTemplate.styling.logoDisplay && styles.switchTrackActive
        ]}>
          <View style={[
            styles.switchThumb,
            newTemplate.styling.logoDisplay && styles.switchThumbActive
          ]} />
        </View>
      </TouchableOpacity>

      {newTemplate.type !== 'job' && (
        <TouchableOpacity
          style={styles.switchRow}
          onPress={() => setNewTemplate({
            ...newTemplate,
            defaults: { ...newTemplate.defaults, gstEnabled: !newTemplate.defaults.gstEnabled }
          })}
          activeOpacity={0.7}
        >
          <Text style={styles.switchLabel}>Include GST (10%)</Text>
          <View style={[
            styles.switchTrack,
            newTemplate.defaults.gstEnabled && styles.switchTrackActive
          ]}>
            <View style={[
              styles.switchThumb,
              newTemplate.defaults.gstEnabled && styles.switchThumbActive
            ]} />
          </View>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionHeader}>Default Content</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Default Title</Text>
        <TextInput
          style={styles.input}
          value={newTemplate.defaults.title}
          onChangeText={(text) => setNewTemplate({ 
            ...newTemplate, 
            defaults: { ...newTemplate.defaults, title: text } 
          })}
          placeholder="e.g., Plumbing Service Quote"
          placeholderTextColor={colors.mutedForeground}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Default Description</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={newTemplate.defaults.description}
          onChangeText={(text) => setNewTemplate({ 
            ...newTemplate, 
            defaults: { ...newTemplate.defaults, description: text } 
          })}
          placeholder="Brief description..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {newTemplate.type !== 'job' && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Default Terms</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={newTemplate.defaults.terms}
              onChangeText={(text) => setNewTemplate({ 
                ...newTemplate, 
                defaults: { ...newTemplate.defaults, terms: text } 
              })}
              placeholder="Payment terms, conditions..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Default Deposit (%)</Text>
            <TextInput
              style={[styles.input, { width: 100 }]}
              value={String(newTemplate.defaults.depositPct || '')}
              onChangeText={(text) => setNewTemplate({ 
                ...newTemplate, 
                defaults: { ...newTemplate.defaults, depositPct: parseInt(text) || 0 } 
              })}
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.sectionHeader}>Default Line Items</Text>

          {newTemplate.defaultLineItems.map((item, index) => (
            <View key={index} style={styles.lineItemRow}>
              <TextInput
                style={styles.lineItemInput}
                value={item.description}
                onChangeText={(text) => updateLineItem(index, 'description', text)}
                placeholder="Description"
                placeholderTextColor={colors.mutedForeground}
              />
              <TextInput
                style={[styles.lineItemInput, styles.lineItemQty]}
                value={String(item.qty || '')}
                onChangeText={(text) => updateLineItem(index, 'qty', parseInt(text) || 1)}
                placeholder="Qty"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.lineItemInput, styles.lineItemPrice]}
                value={String(item.unitPrice || '')}
                onChangeText={(text) => updateLineItem(index, 'unitPrice', parseFloat(text) || 0)}
                placeholder="Price"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={styles.removeLineItemButton}
                onPress={() => removeLineItem(index)}
                activeOpacity={0.7}
              >
                <Feather name="x" size={20} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            style={styles.addLineItemButton}
            onPress={addLineItem}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={18} color={colors.primary} />
            <Text style={styles.addLineItemText}>Add Line Item</Text>
          </TouchableOpacity>
        </>
      )}

      {newTemplate.type === 'job' && (
        <View style={styles.inputGroup}>
          <View style={{ 
            backgroundColor: colors.primaryLight, 
            padding: spacing.md, 
            borderRadius: radius.lg,
            marginTop: spacing.md
          }}>
            <Text style={{ fontSize: typography.button.fontSize, color: colors.primary, fontWeight: fontWeights.medium, marginBottom: 4 }}>
              Job Template
            </Text>
            <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>
              Job templates save the default title and description for quick job creation. 
              They don't include pricing as jobs get quoted separately.
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.saveButton, isCreating && styles.saveButtonDisabled]}
        onPress={handleCreateTemplate}
        disabled={isCreating}
        activeOpacity={0.7}
      >
        <Feather name="check" size={18} color={colors.white} />
        <Text style={styles.saveButtonText}>
          {isCreating ? 'Saving...' : (editingTemplate ? 'Update Template' : 'Create Template')}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderPreviewTab = () => {
    if (newTemplate.type === 'job') {
      return (
        <View style={[styles.previewContainer, { justifyContent: 'center', alignItems: 'center', padding: spacing.xl }]}>
          <Feather name="briefcase" size={48} color={colors.warning} style={{ marginBottom: spacing.lg }} />
          <Text style={{ fontSize: typography.sizes.lg, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.sm, textAlign: 'center' }}>
            Job Template Preview
          </Text>
          <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.lg }}>
            Job templates don't generate documents. They provide quick defaults for creating new jobs.
          </Text>
          <View style={{ 
            backgroundColor: colors.card, 
            borderRadius: radius.lg, 
            padding: spacing.lg,
            width: '100%',
            borderWidth: 1,
            borderColor: colors.border
          }}>
            <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginBottom: 4 }}>Title</Text>
            <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.md }}>
              {newTemplate.defaults.title || 'Untitled Job'}
            </Text>
            <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginBottom: 4 }}>Description</Text>
            <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground }}>
              {newTemplate.defaults.description || 'No description set'}
            </Text>
          </View>
        </View>
      );
    }
    
    return (
      <View style={styles.previewContainer}>
        <LiveDocumentPreview
          type={newTemplate.type}
          documentNumber={newTemplate.type === 'quote' ? 'Q-PREVIEW' : 'INV-PREVIEW'}
          title={newTemplate.defaults.title || `Sample ${newTemplate.type === 'quote' ? 'Quote' : 'Invoice'}`}
          description={newTemplate.defaults.description || 'This is a preview of how your document will look with the selected template style and settings.'}
          date={new Date().toISOString()}
          validUntil={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}
          dueDate={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()}
          lineItems={previewLineItems}
          notes="Thank you for your business!"
          terms={newTemplate.defaults.terms || 'Payment due within 14 days. Late payments may incur additional fees.'}
          business={businessInfo}
          client={sampleClient}
          showDepositSection={newTemplate.defaults.depositPct > 0}
          depositPercent={newTemplate.defaults.depositPct}
          gstEnabled={newTemplate.defaults.gstEnabled}
          templateId={newTemplate.styling.templateStyle}
          templateCustomization={{
            accentColor: newTemplate.styling.brandColor,
          }}
        />
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshData}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Templates</Text>
              <Text style={styles.pageSubtitle}>Manage document templates for quotes, invoices, and jobs</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.createButton}
              onPress={() => {
                resetForm();
                setShowCreateModal(true);
              }}
            >
              <Feather name="plus" size={18} color={colors.primaryForeground} />
              <Text style={styles.createButtonText}>New</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <StatCard
              title="Quotes"
              value={quoteTemplates}
              icon={<Feather name="file-text" size={14} color={colors.info} />}
              colors={colors}
            />
            <StatCard
              title="Invoices"
              value={invoiceTemplates}
              icon={<Feather name="file-text" size={14} color={colors.success} />}
              colors={colors}
            />
            <StatCard
              title="Jobs"
              value={jobTemplates}
              icon={<Feather name="briefcase" size={14} color={colors.warning} />}
              colors={colors}
            />
          </View>

          {/* Style Presets Section — only shown when custom presets exist */}
          {stylePresets.length > 0 && (
          <View style={styles.stylePresetsSection}>
            <View style={styles.stylePresetsSectionHeader}>
              <Text style={styles.stylePresetsSectionTitle}>Style Presets</Text>
              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => setShowPresetsModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.viewAllButtonText}>View All</Text>
                <Feather name="chevron-right" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {isLoadingPresets ? (
              <View style={[styles.stylePresetCard, { alignItems: 'center', paddingVertical: spacing.xl }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.stylePresetDetailText, { marginTop: spacing.sm }]}>
                  Loading style presets...
                </Text>
              </View>
            ) : selectedPreset ? (
              <PressableRow
                style={[
                  styles.stylePresetCard,
                  selectedPreset.isDefault && styles.stylePresetCardActive
                ]}
                onPress={() => setShowPresetsModal(true)}

              >
                <View style={styles.stylePresetHeader}>
                  <View style={styles.stylePresetInfo}>
                    <Text style={styles.stylePresetName}>{selectedPreset.name}</Text>
                    <View style={styles.stylePresetMeta}>
                      {selectedPreset.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                      <View style={styles.colorSwatches}>
                        <View style={[styles.colorSwatch, { backgroundColor: selectedPreset.primaryColor }]} />
                        <View style={[styles.colorSwatch, { backgroundColor: selectedPreset.accentColor }]} />
                      </View>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </View>

                <View style={styles.stylePresetDetails}>
                  <View style={styles.stylePresetDetail}>
                    <Feather name="type" size={12} color={colors.mutedForeground} />
                    <Text style={styles.stylePresetDetailText}>{selectedPreset.fontFamily}</Text>
                  </View>
                  <View style={styles.stylePresetDetail}>
                    <Feather name="layout" size={12} color={colors.mutedForeground} />
                    <Text style={styles.stylePresetDetailText}>{selectedPreset.headerLayout}</Text>
                  </View>
                  {selectedPreset.showLogo && (
                    <View style={styles.stylePresetDetail}>
                      <Feather name="image" size={12} color={colors.mutedForeground} />
                      <Text style={styles.stylePresetDetailText}>Logo</Text>
                    </View>
                  )}
                </View>

                <View style={styles.previewSection}>
                  <LiveDocumentPreview
                    type="quote"
                    documentNumber="Q-PREVIEW"
                    title="Sample Quote"
                    description="Preview of how your documents will look with this style preset."
                    date={new Date().toISOString()}
                    validUntil={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}
                    lineItems={[
                      { description: 'Sample Service', quantity: 2, unitPrice: 150 },
                      { description: 'Materials', quantity: 1, unitPrice: 85 },
                    ]}
                    terms="Payment due within 14 days."
                    business={{
                      businessName: businessSettings?.businessName || 'Your Business',
                      abn: businessSettings?.abn,
                      address: businessSettings?.address,
                      phone: businessSettings?.phone,
                      email: businessSettings?.email,
                      logoUrl: selectedPreset.showLogo ? businessSettings?.logoUrl : undefined,
                      brandColor: templateCustomization.accentColor || DOCUMENT_ACCENT_COLOR,
                      gstEnabled: businessSettings?.gstEnabled ?? true,
                    }}
                    client={{
                      name: 'John Smith',
                      email: 'john@example.com',
                      phone: '0400 123 456',
                      address: '123 Sample St, Sydney NSW 2000',
                    }}
                    gstEnabled={businessSettings?.gstEnabled ?? true}
                    templateId={selectedTemplateStyle}
                    templateCustomization={templateCustomization}
                  />
                </View>
              </PressableRow>
            ) : null}
          </View>
          )}

          {/* Customise Template Section */}
          <View style={styles.customizeSection}>
            <View style={styles.customizeSectionHeader}>
              <View style={styles.customizeSectionIcon}>
                <Feather name="sliders" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.customizeSectionTitle}>Customise Template</Text>
                <Text style={styles.customizeSectionSubtitle}>
                  Fine-tune the {DOCUMENT_TEMPLATES[selectedTemplateStyle].name} template
                </Text>
              </View>
            </View>

            <View style={styles.customizeCard}>
              {/* Template Style Selector */}
              <View style={styles.customizeOptionRow}>
                <Text style={styles.customizeOptionLabel}>Template Style</Text>
                <View style={styles.templateStyleButtons}>
                  {templateStyles.map((style) => {
                    const isActive = selectedTemplateStyle === style.id;
                    const previewAccent = style.id === 'professional' ? '#1e3a5f' : style.id === 'modern' ? '#2563eb' : '#6b7280';
                    return (
                      <TouchableOpacity
                        key={style.id}
                        style={[
                          styles.templateStyleButton,
                          isActive && styles.templateStyleButtonActive
                        ]}
                        onPress={() => handleSelectTemplateStyle(style.id)}
                        activeOpacity={0.7}
                        disabled={isUpdatingPreset}
                      >
                        <TemplateStyleThumbnail templateId={style.id as TemplateId} customization={templateCustomization} />
                        <Text style={[
                          styles.templateStyleButtonText,
                          isActive && styles.templateStyleButtonTextActive
                        ]}>
                          {style.name}
                        </Text>
                        {isActive && (
                          <Feather name="check" size={12} color={colors.primary} style={{ marginTop: 2 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Table Style */}
              <View style={styles.customizeOptionRow}>
                <Text style={styles.customizeOptionLabel}>Table Style</Text>
                <View style={styles.customizePickerRow}>
                  {(['bordered', 'striped', 'minimal'] as const).map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.customizePickerOption,
                        templateCustomization.tableStyle === option && styles.customizePickerOptionActive
                      ]}
                      onPress={() => updateCustomization({ tableStyle: option })}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.customizePickerOptionText,
                        templateCustomization.tableStyle === option && styles.customizePickerOptionTextActive
                      ]}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Notes Style */}
              <View style={styles.customizeOptionRow}>
                <Text style={styles.customizeOptionLabel}>Notes Style</Text>
                <View style={styles.customizePickerRow}>
                  {([
                    { value: 'bordered', label: 'Boxed' },
                    { value: 'highlighted', label: 'Highlighted' },
                    { value: 'simple', label: 'Standard' }
                  ] as const).map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.customizePickerOption,
                        templateCustomization.noteStyle === option.value && styles.customizePickerOptionActive
                      ]}
                      onPress={() => updateCustomization({ noteStyle: option.value })}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.customizePickerOptionText,
                        templateCustomization.noteStyle === option.value && styles.customizePickerOptionTextActive
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Header Border Toggle */}
              <View style={styles.customizeSwitchRow}>
                <Text style={styles.customizeOptionLabel}>Header Border</Text>
                <Switch
                  value={templateCustomization.showHeaderDivider}
                  onValueChange={(value) => updateCustomization({ showHeaderDivider: value })}
                  trackColor={{ false: colors.muted, true: colors.primary }}
                  thumbColor={colors.card}
                />
              </View>

              {/* Heading Weight */}
              <View style={styles.customizeOptionRow}>
                <Text style={styles.customizeOptionLabel}>Heading Weight</Text>
                <View style={styles.customizePickerRow}>
                  {(['600', '700', '800'] as const).map((weight) => (
                    <TouchableOpacity
                      key={weight}
                      style={[
                        styles.customizePickerOption,
                        templateCustomization.headingWeight === weight && styles.customizePickerOptionActive
                      ]}
                      onPress={() => updateCustomization({ headingWeight: weight })}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.customizePickerOptionText,
                        templateCustomization.headingWeight === weight && styles.customizePickerOptionTextActive
                      ]}>
                        {weight}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Body Weight */}
              <View style={styles.customizeOptionRow}>
                <Text style={styles.customizeOptionLabel}>Body Weight</Text>
                <View style={styles.customizePickerRow}>
                  {(['400', '500', '600', '700'] as const).map((weight) => (
                    <TouchableOpacity
                      key={weight}
                      style={[
                        styles.customizePickerOption,
                        templateCustomization.bodyWeight === weight && styles.customizePickerOptionActive
                      ]}
                      onPress={() => updateCustomization({ bodyWeight: weight })}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.customizePickerOptionText,
                        templateCustomization.bodyWeight === weight && styles.customizePickerOptionTextActive
                      ]}>
                        {weight}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Accent Color */}
              <View style={styles.customizeOptionRow}>
                <Text style={styles.customizeOptionLabel}>Accent Color</Text>
                <View style={styles.customizeColorRow}>
                  <View 
                    style={[
                      styles.customizeColorPreview, 
                      { backgroundColor: templateCustomization.accentColor || DOCUMENT_ACCENT_COLOR }
                    ]} 
                  />
                  <View style={styles.customizeColorPresets}>
                    {colorPresets.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.customizeColorPreset,
                          { backgroundColor: color },
                          templateCustomization.accentColor === color && styles.customizeColorPresetActive
                        ]}
                        onPress={() => updateCustomization({ accentColor: color })}
                        activeOpacity={0.7}
                      />
                    ))}
                  </View>
                </View>
              </View>

              {/* Font Style */}
              <View style={styles.customizeOptionRow}>
                <Text style={styles.customizeOptionLabel}>Font Style</Text>
                <View style={styles.customizePickerRow}>
                  {([
                    { value: 'default', label: 'Sans-Serif' },
                    { value: 'serif', label: 'Serif' },
                    { value: 'mono', label: 'Monospace' },
                  ] as const).map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.customizePickerOption,
                        (templateCustomization.fontStyle || 'default') === option.value && styles.customizePickerOptionActive
                      ]}
                      onPress={() => updateCustomization({ fontStyle: option.value })}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.customizePickerOptionText,
                        (templateCustomization.fontStyle || 'default') === option.value && styles.customizePickerOptionTextActive
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Save Customizations Button */}
              <TouchableOpacity
                style={[
                  styles.saveCustomizationButton,
                  !hasUnsavedChanges && styles.saveCustomizationButtonDisabled
                ]}
                onPress={saveCustomization}
                disabled={isSavingCustomization || !hasUnsavedChanges}
                activeOpacity={0.7}
              >
                {isSavingCustomization ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather name="save" size={16} color={hasUnsavedChanges ? colors.primaryForeground : colors.mutedForeground} />
                )}
                <Text style={[
                  styles.saveCustomizationButtonText,
                  !hasUnsavedChanges && styles.saveCustomizationButtonTextDisabled
                ]}>
                  {isSavingCustomization ? 'Saving...' : hasUnsavedChanges ? 'Save Customizations' : 'All Changes Saved'}
                </Text>
              </TouchableOpacity>

              {/* Live Preview */}
              <View style={styles.customizePreviewContainer}>
                <LiveDocumentPreview
                  type="quote"
                  documentNumber="Q-PREVIEW"
                  title="Sample Quote"
                  description="Preview with your customizations"
                  date={new Date().toISOString()}
                  validUntil={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}
                  lineItems={[
                    { description: 'Sample Service', quantity: 2, unitPrice: 150 },
                    { description: 'Materials', quantity: 1, unitPrice: 85 },
                  ]}
                  terms="Payment due within 14 days."
                  business={{
                    businessName: businessSettings?.businessName || 'Your Business',
                    abn: businessSettings?.abn,
                    address: businessSettings?.address,
                    phone: businessSettings?.phone,
                    email: businessSettings?.email,
                    logoUrl: businessSettings?.logoUrl,
                    brandColor: templateCustomization.accentColor || DOCUMENT_ACCENT_COLOR,
                    gstEnabled: businessSettings?.gstEnabled ?? true,
                  }}
                  client={{
                    name: 'John Smith',
                    email: 'john@example.com',
                    phone: '0400 123 456',
                    address: '123 Sample St, Sydney NSW 2000',
                  }}
                  gstEnabled={businessSettings?.gstEnabled ?? true}
                  templateId={selectedTemplateStyle}
                  templateCustomization={templateCustomization}
                />
              </View>
            </View>
          </View>

          {/* Section Divider */}
          <View style={styles.sectionDivider}>
            <View style={styles.dividerLine} />
          </View>

          {/* Template Details Section Header */}
          <View style={styles.templateListHeader}>
            <View style={styles.templateListHeaderIcon}>
              <Feather name="layers" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.templateListHeaderTitle}>Document Templates</Text>
              <Text style={styles.templateListHeaderSubtitle}>
                Pre-built templates for quotes, invoices, and jobs
              </Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.muted,
              borderRadius: radius.md,
              paddingHorizontal: spacing.sm,
              height: 40,
            }}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={{
                  flex: 1,
                  marginLeft: spacing.xs,
                  color: colors.foreground,
                  fontSize: typography.button.fontSize,
                }}
                placeholder="Search templates..."
                placeholderTextColor={colors.mutedForeground}
                value={templateSearchQuery}
                onChangeText={setTemplateSearchQuery}
              />
              {templateSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setTemplateSearchQuery('')}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.filtersRow}>
            {(['all', 'quote', 'invoice', 'job'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterChip,
                  typeFilter === type && styles.filterChipActive
                ]}
                onPress={() => setTypeFilter(type)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterChipText,
                  typeFilter === type && styles.filterChipTextActive
                ]}>
                  {type === 'all' ? 'All' : type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredTemplates.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Feather name="file-text" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>No Templates Yet</Text>
              <Text style={styles.emptySubtitle}>
                Create templates to quickly generate quotes, invoices, and jobs with pre-filled information.
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={18} color={colors.primary} />
                <Text style={styles.emptyButtonText}>Create Template</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.templateList}>
              {displayedTemplates.map((template) => (
                <View key={template.id} style={styles.templateCard}>
                  <View style={styles.templateHeader}>
                    <View style={styles.templateInfo}>
                      <Text style={styles.templateName}>{template.name}</Text>
                      <View style={styles.templateMeta}>
                        <Text style={styles.templateType}>{template.type}</Text>
                        <Text style={styles.templateTrade}>{template.tradeType}</Text>
                      </View>
                    </View>
                    <View style={styles.templateActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleEditTemplate(template)}
                        activeOpacity={0.7}
                      >
                        <Feather name="edit-2" size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDuplicateTemplate(template)}
                        activeOpacity={0.7}
                      >
                        <Feather name="copy" size={18} color={colors.mutedForeground} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleDeleteTemplate(template)}
                        activeOpacity={0.7}
                      >
                        <Feather name="trash-2" size={18} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  {template.defaults?.title && (
                    <View style={styles.templateDetails}>
                      <Text style={styles.templateTitle}>{template.defaults.title}</Text>
                    </View>
                  )}
                  
                  <View style={styles.badgeRow}>
                    {!template.isDefault && (
                      <View style={styles.createdByYouBadge}>
                        <Feather name="user" size={10} color={colors.primary} />
                        <Text style={styles.createdByYouBadgeText}>Created by you</Text>
                      </View>
                    )}
                    {template.defaultLineItems?.length > 0 && (
                      <Text style={styles.badge}>
                        {template.defaultLineItems.length} item{template.defaultLineItems.length !== 1 ? 's' : ''}
                      </Text>
                    )}
                    {template.defaults?.gstEnabled && (
                      <Text style={styles.badge}>GST included</Text>
                    )}
                    {(template.defaults?.depositPct ?? 0) > 0 && (
                      <Text style={styles.badge}>{template.defaults.depositPct}% deposit</Text>
                    )}
                    {template.styling?.templateStyle && (
                      <Text style={styles.badge}>{template.styling.templateStyle} style</Text>
                    )}
                  </View>
                </View>
              ))}
              {hasMoreTemplates && !templateSearchQuery && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: spacing.md,
                    gap: spacing.xs,
                  }}
                  onPress={() => setShowAllTemplates(!showAllTemplates)}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: colors.primary, fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold }}>
                    {showAllTemplates ? 'Show Less' : `View All (${filteredTemplates.length})`}
                  </Text>
                  <Feather 
                    name={showAllTemplates ? 'chevron-up' : 'chevron-down'} 
                    size={16} 
                    color={colors.primary} 
                  />
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>

        <Modal
          visible={showCreateModal}
          animationType="slide"
          onRequestClose={() => {
            setShowCreateModal(false);
            resetForm();
          }}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
          <View style={styles.modalContainer}>
            <View style={[styles.modalHeader]}>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                activeOpacity={0.7}
              >
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </Text>
              <View style={styles.previewTotalBadge}>
                <Text style={styles.previewTotalText}>{formatCurrency(total)}</Text>
              </View>
            </View>

            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'edit' && styles.tabActive]}
                onPress={() => setActiveTab('edit')}
                activeOpacity={0.7}
              >
                <Feather 
                  name="edit-2" 
                  size={16} 
                  color={activeTab === 'edit' ? colors.primary : colors.mutedForeground} 
                />
                <Text style={[styles.tabText, activeTab === 'edit' && styles.tabTextActive]}>
                  Edit
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'preview' && styles.tabActive]}
                onPress={() => setActiveTab('preview')}
                activeOpacity={0.7}
              >
                <Feather 
                  name="eye" 
                  size={16} 
                  color={activeTab === 'preview' ? colors.primary : colors.mutedForeground} 
                />
                <Text style={[styles.tabText, activeTab === 'preview' && styles.tabTextActive]}>
                  Preview
                </Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'edit' ? renderEditTab() : renderPreviewTab()}
          </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Style Presets Sheet */}
        <AppBottomSheet
          visible={showPresetsModal}
          onDismiss={() => setShowPresetsModal(false)}
          title="Style Presets"
          snapPoints={['90%']}
          scrollable
          footer={
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => setShowPresetsModal(false)}
              activeOpacity={0.7}
            >
              <Feather name="check" size={18} color={colors.white} />
              <Text style={styles.saveButtonText}>Done</Text>
            </TouchableOpacity>
          }
        >
          <Text style={[styles.pageSubtitle, { marginBottom: spacing.lg }]}>
            Select a style preset to preview how your documents will look.
          </Text>

          <View style={styles.stylePresetList}>
            {stylePresets.map((preset) => (
              <PressableRow
                key={preset.id}
                style={[
                  styles.stylePresetCard,
                  selectedPreset?.id === preset.id && styles.stylePresetCardActive
                ]}
                onPress={() => setSelectedPreset(preset)}
              >
                <View style={styles.stylePresetHeader}>
                  <View style={styles.stylePresetInfo}>
                    <Text style={styles.stylePresetName}>{preset.name}</Text>
                    <View style={styles.stylePresetMeta}>
                      {preset.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                      <View style={styles.colorSwatches}>
                        <View style={[styles.colorSwatch, { backgroundColor: preset.primaryColor }]} />
                        <View style={[styles.colorSwatch, { backgroundColor: preset.accentColor }]} />
                      </View>
                    </View>
                  </View>
                  {selectedPreset?.id === preset.id && (
                    <Feather name="check-circle" size={20} color={colors.primary} />
                  )}
                </View>

                <View style={styles.stylePresetDetails}>
                  <View style={styles.stylePresetDetail}>
                    <Feather name="type" size={12} color={colors.mutedForeground} />
                    <Text style={styles.stylePresetDetailText}>{preset.fontFamily}</Text>
                  </View>
                  <View style={styles.stylePresetDetail}>
                    <Feather name="layout" size={12} color={colors.mutedForeground} />
                    <Text style={styles.stylePresetDetailText}>{preset.headerLayout}</Text>
                  </View>
                  {preset.showLogo && (
                    <View style={styles.stylePresetDetail}>
                      <Feather name="image" size={12} color={colors.mutedForeground} />
                      <Text style={styles.stylePresetDetailText}>Logo</Text>
                    </View>
                  )}
                  {preset.tableBorders && (
                    <View style={styles.stylePresetDetail}>
                      <Feather name="grid" size={12} color={colors.mutedForeground} />
                      <Text style={styles.stylePresetDetailText}>Table Borders</Text>
                    </View>
                  )}
                </View>

                {selectedPreset?.id === preset.id && (
                  <View style={styles.previewSection}>
                    <LiveDocumentPreview
                      type="quote"
                      documentNumber="Q-PREVIEW"
                      title="Sample Quote"
                      description="Preview of how your documents will look."
                      date={new Date().toISOString()}
                      validUntil={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}
                      lineItems={[
                        { description: 'Sample Service', quantity: 2, unitPrice: 150 },
                        { description: 'Materials', quantity: 1, unitPrice: 85 },
                      ]}
                      terms="Payment due within 14 days."
                      business={{
                        businessName: businessSettings?.businessName || 'Your Business',
                        abn: businessSettings?.abn,
                        address: businessSettings?.address,
                        phone: businessSettings?.phone,
                        email: businessSettings?.email,
                        logoUrl: preset.showLogo ? businessSettings?.logoUrl : undefined,
                        brandColor: templateCustomization.accentColor || DOCUMENT_ACCENT_COLOR,
                        gstEnabled: businessSettings?.gstEnabled ?? true,
                      }}
                      client={{
                        name: 'John Smith',
                        email: 'john@example.com',
                        phone: '0400 123 456',
                        address: '123 Sample St, Sydney NSW 2000',
                      }}
                      gstEnabled={businessSettings?.gstEnabled ?? true}
                      templateId={selectedTemplateStyle}
                      templateCustomization={templateCustomization}
                    />
                  </View>
                )}
              </PressableRow>
            ))}
          </View>
        </AppBottomSheet>
      </View>
    </>
  );
}
