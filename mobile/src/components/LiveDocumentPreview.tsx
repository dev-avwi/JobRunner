import { View, Text, ScrollView, Image, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMemo } from 'react';
import { 
  getTemplateStyles, 
  TemplateId, 
  TemplateCustomization, 
  DEFAULT_TEMPLATE,
  DOCUMENT_ACCENT_COLOR
} from '../lib/document-templates';
import { useTheme } from '../lib/theme';
import { spacing } from '../lib/design-tokens';

const jobRunnerLogo = require('../../assets/jobrunner-logo.png');

interface LineItem {
  description: string;
  quantity: number | string;
  unitPrice: number | string;
}

interface BusinessInfo {
  businessName?: string;
  abn?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  brandColor?: string;
  gstEnabled?: boolean;
  licenseNumber?: string;
  paymentInstructions?: string;
  bankDetails?: string;
  lateFeeRate?: string;
  warrantyPeriod?: string;
}

interface ClientInfo {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface SignatureInfo {
  dataUrl: string;
  signedBy?: string;
  signedAt?: string;
}

interface JobSignature {
  id: string | number;
  signerName: string;
  signatureData: string;
  signedAt: string | Date;
  documentType?: string;
}

interface PhotoItem {
  id: number | string;
  signedUrl?: string;
  caption?: string | null;
  category?: string;
}

interface LiveDocumentPreviewProps {
  type: 'quote' | 'invoice';
  documentNumber?: string;
  title?: string;
  description?: string;
  date?: string;
  validUntil?: string;
  dueDate?: string;
  lineItems: LineItem[];
  notes?: string;
  terms?: string;
  business: BusinessInfo;
  client: ClientInfo | null;
  showDepositSection?: boolean;
  depositPercent?: number;
  gstEnabled?: boolean;
  status?: string;
  jobAddress?: string;
  jobScheduledDate?: string;
  templateId?: TemplateId;
  templateCustomization?: TemplateCustomization;
  signature?: SignatureInfo;
  jobSignatures?: JobSignature[];
  acceptedAt?: string | Date | null;
  acceptedBy?: string | null;
  clientSignatureData?: string | null;
  bottomPadding?: number;
  beforePhotos?: PhotoItem[];
  afterPhotos?: PhotoItem[];
  serverSubtotal?: number;
  serverGstAmount?: number;
  serverTotal?: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: string | Date | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function LiveDocumentPreview({
  type,
  documentNumber,
  title,
  description,
  date,
  validUntil,
  dueDate,
  lineItems,
  notes,
  terms,
  business,
  client,
  showDepositSection = false,
  depositPercent = 50,
  gstEnabled = true,
  status,
  jobAddress,
  jobScheduledDate,
  templateId = DEFAULT_TEMPLATE,
  templateCustomization,
  signature,
  jobSignatures = [],
  acceptedAt,
  acceptedBy,
  clientSignatureData,
  bottomPadding = 0,
  beforePhotos = [],
  afterPhotos = [],
  serverSubtotal,
  serverGstAmount,
  serverTotal,
}: LiveDocumentPreviewProps) {
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  
  const colors = useMemo(() => ({
    white: '#FFFFFF',
    background: themeColors.muted,
    text: themeColors.foreground,
    textMuted: themeColors.mutedForeground,
    textLight: themeColors.secondaryText,
    textLighter: themeColors.mutedForeground,
    border: themeColors.border,
    borderLight: themeColors.borderLight,
    success: themeColors.success,
    successBg: themeColors.successLight,
    successText: themeColors.successDark,
    destructive: themeColors.destructive,
    destructiveBg: themeColors.destructiveLight,
    destructiveText: themeColors.destructiveDark,
    warning: themeColors.warning,
    warningBg: themeColors.warningLight,
    warningText: themeColors.warningDark,
    info: themeColors.info,
    infoBg: themeColors.infoLight,
    primary: themeColors.primary,
    primaryLight: themeColors.primaryLight,
  }), [themeColors]);

  const safeParseFloat = (val: string | number): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  const calculateLineTotal = (item: LineItem): number => {
    const qty = safeParseFloat(item.quantity);
    const price = safeParseFloat(item.unitPrice);
    return qty * price;
  };

  const validLineItems = lineItems.filter(item => {
    const qty = safeParseFloat(item.quantity);
    const price = safeParseFloat(item.unitPrice);
    return item.description && qty > 0 && price >= 0;
  });

  const subtotal = validLineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  const gst = gstEnabled ? subtotal * 0.1 : 0;
  const total = subtotal + gst;
  const depositAmount = showDepositSection ? total * ((depositPercent || 0) / 100) : 0;
  
  const brandColor = business.brandColor || themeColors.primary;
  const isPaid = status === 'paid';
  const isOverdue = status === 'overdue';
  const isAccepted = status === 'accepted';
  
  const templateStyles = getTemplateStyles(templateId, brandColor, templateCustomization);
  const { template, primaryColor, headingStyle, tableHeaderStyle, getTableRowStyle, getNoteStyle } = templateStyles;

  const documentTitle = type === 'quote' 
    ? 'QUOTE' 
    : gstEnabled 
      ? (isPaid ? 'TAX INVOICE / RECEIPT' : 'TAX INVOICE')
      : (isPaid ? 'INVOICE / RECEIPT' : 'INVOICE');

  const getStatusBadgeStyle = (s: string) => {
    switch (s) {
      case 'draft': return { background: colors.border, color: colors.text };
      case 'sent': return { background: colors.infoBg, color: colors.info };
      case 'accepted': return { background: colors.successBg, color: colors.successText };
      case 'declined': return { background: colors.destructiveBg, color: colors.destructiveText };
      case 'paid': return { background: colors.successBg, color: colors.successText };
      case 'overdue': return { background: colors.destructiveBg, color: colors.destructiveText };
      case 'pending': return { background: colors.warningBg, color: colors.warningText };
      default: return { background: colors.border, color: colors.text };
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing['4xl'],
    },
    documentCard: {
      backgroundColor: colors.white,
      borderRadius: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#e2e8f0',
    },
    documentContent: {
      padding: spacing['2xl'],
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing['2xl'],
      paddingBottom: spacing.lg,
      borderBottomWidth: template.showHeaderDivider ? template.headerBorderWidth : 0,
      borderBottomColor: template.showHeaderDivider ? primaryColor : 'transparent',
    },
    companyInfo: {
      flex: 3,
      minWidth: 150,
      maxWidth: '65%',
      marginRight: spacing.md,
    },
    logo: {
      width: 60,
      height: 60,
      borderRadius: 8,
      marginBottom: spacing.md,
    },
    logoPlaceholder: {
      width: 60,
      height: 60,
      borderRadius: 8,
      backgroundColor: '#f1f5f9',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    businessName: {
      fontSize: 20,
      fontWeight: headingStyle.fontWeight as any,
      color: headingStyle.color,
      marginBottom: spacing.sm,
    },
    businessDetails: {
      gap: spacing.xxs,
    },
    businessDetail: {
      fontSize: 10,
      color: colors.textMuted,
      lineHeight: 16,
    },
    businessDetailBold: {
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    },
    documentMeta: {
      flex: 1,
      alignItems: 'flex-end',
      minWidth: 100,
    },
    documentType: {
      fontSize: gstEnabled && type === 'invoice' ? 20 : 24,
      fontWeight: headingStyle.fontWeight as any,
      color: isPaid ? colors.success : headingStyle.color,
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: spacing.xs,
    },
    documentNumber: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    statusBadge: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 12,
      marginTop: spacing.sm,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    infoSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing['2xl'],
      gap: spacing['2xl'],
    },
    infoColumn: {
      flex: 1,
    },
    sectionLabel: {
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: colors.textLight,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      marginBottom: 6,
    },
    clientName: {
      fontSize: 13,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      color: colors.text,
    },
    clientDetail: {
      fontSize: 11,
      color: colors.text,
      lineHeight: 18,
    },
    placeholder: {
      fontSize: 12,
      color: colors.textLight,
      fontStyle: 'italic',
    },
    detailRow: {
      flexDirection: 'row',
      marginBottom: spacing.xxs,
    },
    detailLabel: {
      fontSize: 11,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      color: colors.text,
      marginRight: spacing.xs,
    },
    detailValue: {
      fontSize: 11,
      color: colors.text,
    },
    descriptionSection: {
      backgroundColor: '#f8f9fa',
      borderRadius: 6,
      padding: spacing.lg,
      marginBottom: spacing['2xl'],
    },
    descriptionTitle: {
      fontSize: 13,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      color: primaryColor,
      marginBottom: spacing.sm,
    },
    descriptionText: {
      fontSize: 11,
      color: colors.text,
      lineHeight: 18,
    },
    table: {
      marginBottom: spacing['2xl'],
    },
    tableHeader: {
      flexDirection: 'row',
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      backgroundColor: tableHeaderStyle.backgroundColor,
      borderBottomWidth: tableHeaderStyle.borderBottomWidth,
      borderBottomColor: tableHeaderStyle.borderBottomColor,
      borderRadius: template.borderRadius,
    },
    tableHeaderCell: {
      fontSize: 10,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: tableHeaderStyle.color,
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
    },
    tableCell: {
      fontSize: 11,
      color: colors.text,
    },
    descCol: { flex: 1 },
    qtyCol: { width: 40, textAlign: 'right' },
    priceCol: { width: 70, textAlign: 'right' },
    amountCol: { width: 70, textAlign: 'right' },
    emptyRow: {
      paddingVertical: spacing['2xl'],
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 11,
      color: colors.textLight,
      fontStyle: 'italic',
    },
    totalsContainer: {
      alignItems: 'flex-end',
      marginBottom: spacing['2xl'],
    },
    totalsBox: {
      width: '60%',
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    totalLabel: {
      fontSize: 11,
      color: colors.textMuted,
    },
    totalValue: {
      fontSize: 11,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      color: colors.text,
    },
    grandTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      marginTop: spacing.xs,
      borderTopWidth: 2,
      borderTopColor: isPaid ? colors.success : primaryColor,
    },
    grandTotalLabel: {
      fontSize: 14,
      fontWeight: '700', fontFamily: 'Inter_700Bold',
      color: isPaid ? colors.success : primaryColor,
    },
    grandTotalValue: {
      fontSize: 14,
      fontWeight: '700', fontFamily: 'Inter_700Bold',
      color: isPaid ? colors.success : primaryColor,
    },
    gstNote: {
      fontSize: 9,
      color: colors.textLight,
      textAlign: 'right',
      marginTop: spacing.xs,
    },
    depositSection: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    depositRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
    },
    depositLabel: {
      fontSize: 11,
      color: colors.textMuted,
    },
    depositValue: {
      fontSize: 11,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      color: colors.text,
    },
    notesSection: {
      marginBottom: spacing['2xl'],
      padding: spacing.lg,
    },
    notesSectionTitle: {
      fontSize: 12,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      color: '#333',
      marginBottom: spacing.sm,
    },
    notesText: {
      fontSize: 10,
      color: colors.textMuted,
      lineHeight: 16,
    },
    photosSection: {
      marginBottom: spacing.xl,
      padding: spacing.md,
    },
    photosSectionTitle: {
      fontSize: 12,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      color: '#333',
      marginBottom: 10,
      letterSpacing: 0.3,
    },
    photosGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    photoItem: {
      width: '48%',
    },
    photoImage: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 4,
      backgroundColor: '#f0f0f0',
    },
    photoCaption: {
      fontSize: 8,
      color: colors.textMuted,
      marginTop: 3,
      textAlign: 'center',
    },
    termsSection: {
      marginBottom: spacing['2xl'],
    },
    termsTitle: {
      fontSize: 11,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      color: '#333',
      marginBottom: spacing.sm,
    },
    termsText: {
      fontSize: 9,
      color: colors.textMuted,
      lineHeight: 14,
    },
    acceptanceSection: {
      marginTop: spacing['2xl'],
      padding: spacing.xl,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: '#ddd',
      borderRadius: 8,
    },
    acceptanceTitle: {
      fontSize: 13,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      color: '#333',
      marginBottom: spacing.md,
    },
    acceptanceText: {
      fontSize: 10,
      color: colors.textMuted,
      marginBottom: spacing.xl,
      lineHeight: 16,
    },
    signatureRow: {
      flexDirection: 'row',
      gap: spacing.lg,
    },
    signatureBox: {
      flex: 1,
    },
    signatureLabel: {
      fontSize: 10,
      color: colors.textLight,
      marginBottom: spacing.xl,
    },
    signatureLine: {
      borderBottomWidth: 1,
      borderBottomColor: '#333',
    },
    confirmationBox: {
      backgroundColor: colors.successBg,
      borderLeftWidth: 4,
      borderLeftColor: colors.success,
      borderRadius: 6,
      padding: spacing.lg,
      marginBottom: spacing['2xl'],
    },
    confirmationTitle: {
      fontSize: 13,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      color: colors.successText,
      marginBottom: spacing.xs,
    },
    confirmationText: {
      fontSize: 10,
      color: colors.successText,
    },
    acceptedSignatureBox: {
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      padding: spacing.md,
      marginVertical: spacing.sm,
      alignSelf: 'flex-start',
    },
    acceptedSignatureImage: {
      height: 50,
      width: 150,
    },
    footer: {
      marginTop: spacing['2xl'],
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: 'center',
    },
    footerText: {
      fontSize: 9,
      color: colors.textLighter,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    paidWatermarkContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
      pointerEvents: 'none',
    },
    paidWatermark: {
      fontSize: 72,
      fontWeight: '800', fontFamily: 'Inter_800ExtraBold',
      color: colors.success,
      opacity: 0.08,
      transform: [{ rotate: '-30deg' }],
      letterSpacing: 8,
    },
    paidBadge: {
      position: 'absolute',
      top: 24,
      right: 24,
      backgroundColor: colors.successBg,
      borderWidth: 2,
      borderColor: colors.success,
      borderRadius: 6,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      zIndex: 10,
    },
    paidBadgeText: {
      fontSize: 14,
      fontWeight: '700', fontFamily: 'Inter_700Bold',
      color: colors.successText,
      letterSpacing: 2,
    },
    signatureDisplaySection: {
      marginTop: spacing['2xl'],
      marginBottom: spacing['2xl'],
      padding: spacing.xl,
      backgroundColor: colors.primaryLight,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    signatureDisplayTitle: {
      fontSize: 13,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      color: colors.primary,
      marginBottom: spacing.md,
    },
    signatureImage: {
      width: '100%',
      height: 80,
      backgroundColor: colors.white,
      borderRadius: 4,
      marginBottom: spacing.sm,
    },
    signatureMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    signatureMetaText: {
      fontSize: 10,
      color: colors.textMuted,
    },
    signatureMetaValue: {
      fontSize: 10,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      color: colors.text,
    },
    jobSignaturesSection: {
      marginTop: spacing['2xl'],
      marginBottom: spacing['2xl'],
      padding: spacing.lg,
      backgroundColor: colors.borderLight,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    jobSignaturesTitle: {
      fontSize: 12,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.lg,
      textAlign: 'center',
    },
    jobSignaturesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.xl,
    },
    jobSignatureItem: {
      alignItems: 'center',
      minWidth: 130,
    },
    jobSignatureImageBox: {
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    jobSignatureImage: {
      width: 100,
      height: 40,
    },
    jobSignatureName: {
      fontSize: 11,
      fontWeight: '600', fontFamily: 'Inter_600SemiBold',
      color: colors.text,
    },
    jobSignatureRole: {
      fontSize: 10,
      color: colors.textMuted,
    },
    jobSignatureDate: {
      fontSize: 9,
      color: colors.textLight,
    },
  }), [template, primaryColor, headingStyle, isPaid, gstEnabled, type, tableHeaderStyle, colors]);

  const noteStyle = getNoteStyle();

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.documentCard}>
        {/* PAID Watermark - displayed for paid invoices */}
        {type === 'invoice' && isPaid && (
          <View style={styles.paidWatermarkContainer}>
            <Text style={styles.paidWatermark}>PAID</Text>
          </View>
        )}
        
        {/* PAID Badge - prominent indicator for paid invoices */}
        {type === 'invoice' && isPaid && (
          <View style={styles.paidBadge}>
            <Text style={styles.paidBadgeText}>PAID</Text>
          </View>
        )}
        
        <View style={styles.documentContent}>
          {/* Header - Business Info LEFT, Document Type RIGHT */}
          <View style={styles.header}>
            {/* Company Info - Left Side */}
            <View style={styles.companyInfo}>
              {business.logoUrl && (
                <Image 
                  source={{ uri: business.logoUrl }} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.businessName}>
                {business.businessName || 'Your Business Name'}
              </Text>
              <View style={styles.businessDetails}>
                {business.abn && (
                  <Text style={styles.businessDetail}>
                    <Text style={styles.businessDetailBold}>ABN:</Text> {business.abn}
                  </Text>
                )}
                {business.address && (
                  <Text style={styles.businessDetail}>{business.address}</Text>
                )}
                {business.phone && (
                  <Text style={styles.businessDetail}>Phone: {business.phone}</Text>
                )}
                {business.email && (
                  <Text style={styles.businessDetail}>Email: {business.email}</Text>
                )}
                {business.licenseNumber && (
                  <Text style={styles.businessDetail}>Licence No: {business.licenseNumber}</Text>
                )}
              </View>
            </View>

            {/* Document Type - Right Side */}
            <View style={styles.documentMeta}>
              <Text style={styles.documentType}>{documentTitle}</Text>
              <Text style={styles.documentNumber}>{documentNumber || 'AUTO'}</Text>
              {/* Only show status badge if NOT paid (paid status already shown with watermark/badge) */}
              {status && status !== 'paid' && (
                <View style={[styles.statusBadge, { backgroundColor: getStatusBadgeStyle(status).background }]}>
                  <Text style={[styles.statusText, { color: getStatusBadgeStyle(status).color }]}>
                    {status.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Info Section - Bill To & Document Details */}
          <View style={styles.infoSection}>
            {/* Bill To / Quote For */}
            <View style={styles.infoColumn}>
              <Text style={styles.sectionLabel}>
                {type === 'quote' ? 'Quote For' : 'Bill To'}
              </Text>
              {client ? (
                <>
                  <Text style={styles.clientName}>{client.name}</Text>
                  {client.address && <Text style={styles.clientDetail}>{client.address}</Text>}
                  {client.email && <Text style={styles.clientDetail}>{client.email}</Text>}
                  {client.phone && <Text style={styles.clientDetail}>{client.phone}</Text>}
                </>
              ) : (
                <Text style={styles.placeholder}>Select a client...</Text>
              )}
            </View>

            {/* Document Details */}
            <View style={styles.infoColumn}>
              <Text style={styles.sectionLabel}>
                {type === 'quote' ? 'Quote Details' : 'Invoice Details'}
              </Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date:</Text>
                <Text style={styles.detailValue}>{formatDate(date || new Date().toISOString())}</Text>
              </View>
              {type === 'quote' && validUntil && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Valid Until:</Text>
                  <Text style={styles.detailValue}>{formatDate(validUntil)}</Text>
                </View>
              )}
              {type === 'invoice' && dueDate && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Due Date:</Text>
                  <Text style={styles.detailValue}>{formatDate(dueDate)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Job Site Location */}
          {jobAddress && (
            <View style={[styles.infoSection, { marginTop: spacing.sm }]}>
              <View style={styles.infoColumn}>
                <Text style={styles.sectionLabel}>Job Site Location</Text>
                <Text style={styles.clientName}>{jobAddress}</Text>
                {jobScheduledDate && (
                  <Text style={[styles.clientDetail, { color: colors.textMuted }]}>
                    {type === 'quote' ? 'Scheduled:' : 'Completed:'} {formatDate(jobScheduledDate)}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Description Section */}
          {(title || description) && (
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionTitle}>
                {title || `New ${type === 'quote' ? 'Quote' : 'Invoice'}`}
              </Text>
              {description && (
                <Text style={styles.descriptionText}>{description}</Text>
              )}
            </View>
          )}

          {/* Line Items Table */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.descCol]}>Description</Text>
              <Text style={[styles.tableHeaderCell, styles.qtyCol]}>Qty</Text>
              <Text style={[styles.tableHeaderCell, styles.priceCol]}>Unit Price</Text>
              <Text style={[styles.tableHeaderCell, styles.amountCol]}>Amount</Text>
            </View>
            
            {validLineItems.length > 0 ? (
              validLineItems.map((item, index) => {
                const rowStyle = getTableRowStyle(index, index === validLineItems.length - 1);
                return (
                  <View 
                    key={index} 
                    style={[
                      styles.tableRow, 
                      { 
                        borderBottomWidth: rowStyle.borderBottomWidth,
                        borderBottomColor: rowStyle.borderBottomColor,
                        backgroundColor: rowStyle.backgroundColor,
                      }
                    ]}
                  >
                    <Text style={[styles.tableCell, styles.descCol]} numberOfLines={2}>
                      {item.description}
                    </Text>
                    <Text style={[styles.tableCell, styles.qtyCol]}>
                      {safeParseFloat(item.quantity).toFixed(2)}
                    </Text>
                    <Text style={[styles.tableCell, styles.priceCol]}>
                      {formatCurrency(safeParseFloat(item.unitPrice))}
                    </Text>
                    <Text style={[styles.tableCell, styles.amountCol, { fontWeight: '600', fontFamily: 'Inter_600SemiBold' }]}>
                      {formatCurrency(calculateLineTotal(item))}
                    </Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>Add line items to see them here...</Text>
              </View>
            )}
          </View>

          {/* Totals Section */}
          <View style={styles.totalsContainer}>
            <View style={styles.totalsBox}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{formatCurrency(serverSubtotal ?? subtotal)}</Text>
              </View>
              {gstEnabled && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>GST (10%)</Text>
                  <Text style={styles.totalValue}>{formatCurrency(serverGstAmount ?? gst)}</Text>
                </View>
              )}
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>
                  {isPaid ? 'Amount Paid' : `Total${gstEnabled ? ' (incl. GST)' : ''}`}
                </Text>
                <Text style={styles.grandTotalValue}>{formatCurrency(serverTotal ?? total)}</Text>
              </View>
              {gstEnabled && (
                <Text style={styles.gstNote}>GST included in total</Text>
              )}
              
              {/* Deposit Section */}
              {showDepositSection && depositPercent > 0 && (
                <View style={styles.depositSection}>
                  <View style={styles.depositRow}>
                    <Text style={styles.depositLabel}>Deposit Required ({depositPercent}%):</Text>
                    <Text style={styles.depositValue}>{formatCurrency(depositAmount)}</Text>
                  </View>
                  <View style={styles.depositRow}>
                    <Text style={styles.depositLabel}>Balance on completion:</Text>
                    <Text style={styles.depositValue}>{formatCurrency(total - depositAmount)}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Notes Section */}
          {notes && (
            <View style={[styles.notesSection, noteStyle]}>
              <Text style={styles.notesSectionTitle}>Additional Notes</Text>
              <Text style={styles.notesText}>{notes}</Text>
            </View>
          )}

          {/* Before Photos Section */}
          {beforePhotos.length > 0 && (
            <View style={styles.photosSection}>
              <Text style={styles.photosSectionTitle}>Before Photos</Text>
              <View style={styles.photosGrid}>
                {beforePhotos.map((photo) => (
                  photo.signedUrl ? (
                    <View key={photo.id} style={styles.photoItem}>
                      <Image
                        source={{ uri: photo.signedUrl }}
                        style={styles.photoImage}
                        resizeMode="cover"
                      />
                      {photo.caption ? (
                        <Text style={styles.photoCaption}>{photo.caption}</Text>
                      ) : null}
                    </View>
                  ) : null
                ))}
              </View>
            </View>
          )}

          {/* After Photos Section */}
          {afterPhotos.length > 0 && (
            <View style={styles.photosSection}>
              <Text style={styles.photosSectionTitle}>After Photos</Text>
              <View style={styles.photosGrid}>
                {afterPhotos.map((photo) => (
                  photo.signedUrl ? (
                    <View key={photo.id} style={styles.photoItem}>
                      <Image
                        source={{ uri: photo.signedUrl }}
                        style={styles.photoImage}
                        resizeMode="cover"
                      />
                      {photo.caption ? (
                        <Text style={styles.photoCaption}>{photo.caption}</Text>
                      ) : null}
                    </View>
                  ) : null
                ))}
              </View>
            </View>
          )}

          {/* Terms Section */}
          {terms && (
            <View style={styles.termsSection}>
              <Text style={styles.termsTitle}>Terms & Conditions</Text>
              <Text style={styles.termsText}>{terms}</Text>
            </View>
          )}

          {/* Quote Acceptance Section */}
          {type === 'quote' && status !== 'accepted' && status !== 'declined' && (
            <View style={styles.acceptanceSection}>
              <Text style={styles.acceptanceTitle}>Quote Acceptance</Text>
              <Text style={styles.acceptanceText}>
                By signing below, I accept this quote and authorise the work to proceed in accordance with the terms and conditions above.
              </Text>
              <View style={styles.signatureRow}>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>Client Signature</Text>
                  <View style={styles.signatureLine} />
                </View>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>Print Name</Text>
                  <View style={styles.signatureLine} />
                </View>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureLabel}>Date</Text>
                  <View style={styles.signatureLine} />
                </View>
              </View>
            </View>
          )}

          {/* Accepted Quote Confirmation */}
          {type === 'quote' && status === 'accepted' && (
            <View style={styles.confirmationBox}>
              <Text style={styles.confirmationTitle}>Quote Accepted</Text>
              {clientSignatureData && (
                <View style={styles.acceptedSignatureBox}>
                  <Image 
                    source={{ uri: clientSignatureData.startsWith('data:') ? clientSignatureData : `data:image/png;base64,${clientSignatureData}` }}
                    style={styles.acceptedSignatureImage}
                    resizeMode="contain"
                  />
                </View>
              )}
              {(acceptedBy || acceptedAt) ? (
                <Text style={styles.confirmationText}>
                  {acceptedBy && `Signed by: ${acceptedBy}`}
                  {acceptedBy && acceptedAt && ' • '}
                  {acceptedAt && `Date: ${formatDate(acceptedAt)}`}
                </Text>
              ) : (
                <Text style={styles.confirmationText}>This quote has been accepted.</Text>
              )}
            </View>
          )}

          {/* Payment Received Confirmation */}
          {type === 'invoice' && isPaid && (
            <View style={styles.confirmationBox}>
              <Text style={styles.confirmationTitle}>Payment Received - Thank You!</Text>
              <Text style={styles.confirmationText}>Amount: {formatCurrency(total)}</Text>
            </View>
          )}

          {/* Job Completion Signatures Section - Only show on invoices, not quotes */}
          {type === 'invoice' && jobSignatures.length > 0 && (
            <View style={styles.jobSignaturesSection}>
              <Text style={styles.jobSignaturesTitle}>Job Completion Signatures</Text>
              <View style={styles.jobSignaturesContainer}>
                {jobSignatures.filter(sig => sig.signatureData).map((sig) => {
                  const sigDataUrl = sig.signatureData.startsWith('data:') 
                    ? sig.signatureData 
                    : `data:image/png;base64,${sig.signatureData}`;
                  return (
                    <View key={sig.id} style={styles.jobSignatureItem}>
                      <View style={styles.jobSignatureImageBox}>
                        <Image 
                          source={{ uri: sigDataUrl }} 
                          style={styles.jobSignatureImage}
                          resizeMode="contain"
                        />
                      </View>
                      <Text style={styles.jobSignatureName}>{sig.signerName || 'Client'}</Text>
                      <Text style={styles.jobSignatureRole}>Client Signature</Text>
                      <Text style={styles.jobSignatureDate}>{formatDate(sig.signedAt)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Captured Signature Display (Legacy single signature) */}
          {signature && signature.dataUrl && jobSignatures.length === 0 && (
            <View style={styles.signatureDisplaySection}>
              <Text style={styles.signatureDisplayTitle}>
                <Feather name="edit-3" size={14} color={colors.primary} /> Authorised Signature
              </Text>
              <Image 
                source={{ uri: signature.dataUrl }} 
                style={styles.signatureImage}
                resizeMode="contain"
              />
              {(signature.signedBy || signature.signedAt) && (
                <View style={styles.signatureMetaRow}>
                  {signature.signedBy && (
                    <View>
                      <Text style={styles.signatureMetaText}>Signed by:</Text>
                      <Text style={styles.signatureMetaValue}>{signature.signedBy}</Text>
                    </View>
                  )}
                  {signature.signedAt && (
                    <View>
                      <Text style={styles.signatureMetaText}>Date:</Text>
                      <Text style={styles.signatureMetaValue}>{formatDate(signature.signedAt)}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Thank you for your business!</Text>
            {business.abn && (
              <Text style={styles.footerText}>ABN: {business.abn}</Text>
            )}
            <Text style={styles.footerText}>Generated by JobRunner</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
