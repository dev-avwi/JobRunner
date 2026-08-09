import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Image,
} from 'react-native';
import { PressableRow } from './ui/PressableRow';
import { Feather } from '@expo/vector-icons';
import { colors } from '../lib/colors';
import { useAuthStore } from '../lib/store';
import { getTemplateStyles, TemplateId, TemplateCustomization } from '../lib/document-templates';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface DocumentPreviewProps {
  visible: boolean;
  onClose: () => void;
  type: 'quote' | 'invoice';
  document: {
    id: string;
    number: string;
    status: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    subtotal: number;
    gstAmount: number;
    total: number;
    notes?: string;
    createdAt: string;
    validUntil?: string;
    dueDate?: string;
    lineItems: LineItem[];
    depositRequired?: number;
    depositPaid?: boolean;
  };
  templateId?: TemplateId;
  templateCustomization?: TemplateCustomization;
}

export function DocumentPreview({ 
  visible, 
  onClose, 
  type, 
  document,
  templateId,
  templateCustomization 
}: DocumentPreviewProps) {
  const { businessSettings } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setIsLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const formatCurrency = (amount: number) => {
    const { formatCurrency: fmt } = require('../lib/format');
    return fmt(amount / 100);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${type === 'quote' ? 'Quote' : 'Invoice'} ${document.number}\n\nTotal: ${formatCurrency(document.total)}\n\nFrom ${businessSettings?.businessName || 'JobRunner'}`,
        title: `${type === 'quote' ? 'Quote' : 'Invoice'} ${document.number}`,
      });
    } catch (error) {
      if (__DEV__) console.log('Share error:', error);
    }
  };

  const effectiveTemplateId = templateId || businessSettings?.documentTemplate || 'minimal';
  const effectiveCustomization = templateCustomization || businessSettings?.documentTemplateSettings;
  const brandColor = businessSettings?.brandColor || '#3b82f6';
  
  const templateStyles = getTemplateStyles(
    effectiveTemplateId as TemplateId,
    brandColor,
    effectiveCustomization
  );

  // Dynamic text styles based on template
  const bodyTextStyle = { fontWeight: String(templateStyles.template.bodyWeight) as '400' | '500' | '600' | '700' };
  const headingTextStyle = { fontWeight: String(templateStyles.template.headingWeight) as '600' | '700' | '800', color: templateStyles.primaryColor };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <PressableRow onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color={colors.foreground} />
          </PressableRow>
          <Text style={styles.headerTitle}>
            {type === 'quote' ? 'Quote' : 'Invoice'} Preview
          </Text>
          <PressableRow onPress={handleShare} style={styles.shareButton}>
            <Feather name="share-2" size={20} color={colors.primary} />
          </PressableRow>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={templateStyles.primaryColor} />
            <Text style={styles.loadingText}>Loading preview...</Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Document Preview */}
            <View style={styles.documentContainer}>
              <View style={styles.document}>
                {/* Document Header */}
                <View style={[
                  styles.documentHeader, 
                  { backgroundColor: templateStyles.primaryColor },
                  templateStyles.headerStyle
                ]}>
                  <View style={styles.businessInfo}>
                    {businessSettings?.logoUrl && (
                      <Image 
                        source={{ uri: businessSettings.logoUrl }} 
                        style={styles.logo}
                        resizeMode="contain"
                      />
                    )}
                    <View style={styles.businessDetails}>
                      <Text style={styles.businessName}>{businessSettings?.businessName || 'Your Business'}</Text>
                      {businessSettings?.abn && (
                        <Text style={styles.businessAbn}>ABN: {businessSettings.abn}</Text>
                      )}
                      {businessSettings?.email && (
                        <Text style={styles.businessContact}>{businessSettings.email}</Text>
                      )}
                      {businessSettings?.phone && (
                        <Text style={styles.businessContact}>{businessSettings.phone}</Text>
                      )}
                      {businessSettings?.address && (
                        <Text style={styles.businessContact}>{businessSettings.address}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.documentTypeContainer}>
                    <Text style={styles.documentType}>{type === 'quote' ? 'QUOTE' : 'TAX INVOICE'}</Text>
                    <Text style={styles.documentNumber}>{document.number}</Text>
                  </View>
                </View>

                {/* Document Body */}
                <View style={styles.documentBody}>
                  {/* Client & Dates Row */}
                  <View style={styles.infoRow}>
                    <View style={styles.infoColumn}>
                      <Text style={[styles.infoLabel, headingTextStyle]}>Bill To:</Text>
                      <Text style={[styles.clientName, bodyTextStyle]}>{document.clientName}</Text>
                      {document.clientEmail && (
                        <Text style={[styles.clientDetail, bodyTextStyle]}>{document.clientEmail}</Text>
                      )}
                      {document.clientPhone && (
                        <Text style={[styles.clientDetail, bodyTextStyle]}>{document.clientPhone}</Text>
                      )}
                      {document.clientAddress && (
                        <Text style={[styles.clientDetail, bodyTextStyle]}>{document.clientAddress}</Text>
                      )}
                    </View>
                    <View style={styles.infoColumn}>
                      <View style={styles.dateRow}>
                        <Text style={[styles.dateLabel, headingTextStyle]}>Date:</Text>
                        <Text style={[styles.dateValue, bodyTextStyle]}>{formatDate(document.createdAt)}</Text>
                      </View>
                      {document.validUntil && (
                        <View style={styles.dateRow}>
                          <Text style={[styles.dateLabel, headingTextStyle]}>Valid Until:</Text>
                          <Text style={[styles.dateValue, bodyTextStyle]}>{formatDate(document.validUntil)}</Text>
                        </View>
                      )}
                      {document.dueDate && (
                        <View style={styles.dateRow}>
                          <Text style={[styles.dateLabel, headingTextStyle]}>Due Date:</Text>
                          <Text style={[styles.dateValue, bodyTextStyle]}>{formatDate(document.dueDate)}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Line Items Table */}
                  <View style={[styles.itemsTable, { borderRadius: templateStyles.borderRadius }]}>
                    <View style={[
                      styles.tableHeader, 
                      { 
                        backgroundColor: templateStyles.tableHeaderStyle.backgroundColor,
                        borderTopLeftRadius: templateStyles.borderRadius,
                        borderTopRightRadius: templateStyles.borderRadius,
                      }
                    ]}>
                      <Text style={[styles.tableHeaderText, { flex: 2, color: templateStyles.tableHeaderStyle.color }]}>Description</Text>
                      <Text style={[styles.tableHeaderText, styles.textCenter, { color: templateStyles.tableHeaderStyle.color }]}>Qty</Text>
                      <Text style={[styles.tableHeaderText, styles.textRight, { color: templateStyles.tableHeaderStyle.color }]}>Price</Text>
                      <Text style={[styles.tableHeaderText, styles.textRight, { color: templateStyles.tableHeaderStyle.color }]}>Total</Text>
                    </View>
                    
                    {document.lineItems.map((item, index) => {
                      const isLast = index === document.lineItems.length - 1;
                      const rowStyle = templateStyles.getTableRowStyle(index, isLast);
                      return (
                        <View 
                          key={item.id} 
                          style={[
                            styles.tableRow,
                            rowStyle
                          ]}
                        >
                          <Text style={[styles.tableCell, { flex: 2 }, bodyTextStyle]} numberOfLines={2}>
                            {item.description}
                          </Text>
                          <Text style={[styles.tableCell, styles.textCenter, bodyTextStyle]}>{item.quantity}</Text>
                          <Text style={[styles.tableCell, styles.textRight, bodyTextStyle]}>
                            {formatCurrency(item.unitPrice)}
                          </Text>
                          <Text style={[styles.tableCell, styles.textRight, bodyTextStyle]}>
                            {formatCurrency(item.total)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Totals */}
                  <View style={[styles.totalsContainer, templateStyles.sectionStyle]}>
                    <View style={styles.totalsRow}>
                      <Text style={[styles.totalsLabel, bodyTextStyle]}>Subtotal</Text>
                      <Text style={[styles.totalsValue, bodyTextStyle]}>{formatCurrency(document.subtotal)}</Text>
                    </View>
                    <View style={styles.totalsRow}>
                      <Text style={[styles.totalsLabel, bodyTextStyle]}>GST (10%)</Text>
                      <Text style={[styles.totalsValue, bodyTextStyle]}>{formatCurrency(document.gstAmount)}</Text>
                    </View>
                    <View style={[styles.totalsRow, styles.totalsFinal, { borderTopColor: templateStyles.primaryColor }]}>
                      <Text style={[styles.totalsFinalLabel, headingTextStyle]}>Total (AUD)</Text>
                      <Text style={[styles.totalsFinalValue, { color: templateStyles.primaryColor }]}>
                        {formatCurrency(document.total)}
                      </Text>
                    </View>
                    {document.depositRequired && !document.depositPaid && (
                      <View style={styles.depositRow}>
                        <Text style={[styles.depositLabel, bodyTextStyle]}>Deposit Required</Text>
                        <Text style={[styles.depositValue, bodyTextStyle]}>
                          {formatCurrency(document.depositRequired)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Notes */}
                  {document.notes && (
                    <View style={[styles.notesSection, templateStyles.getNoteStyle()]}>
                      <Text style={[styles.notesTitle, headingTextStyle]}>Notes</Text>
                      <Text style={[styles.notesText, bodyTextStyle]}>{document.notes}</Text>
                    </View>
                  )}

                  {/* Footer */}
                  <View style={[styles.documentFooter, { borderTopColor: templateStyles.primaryColor }]}>
                    <Text style={[styles.footerText, headingTextStyle]}>
                      Thank you for your business!
                    </Text>
                    {businessSettings?.phone && (
                      <Text style={[styles.footerContact, bodyTextStyle]}>
                        Phone: {businessSettings.phone}
                      </Text>
                    )}
                    {businessSettings?.email && (
                      <Text style={[styles.footerContact, bodyTextStyle]}>
                        Email: {businessSettings.email}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <PressableRow style={styles.actionButton} onPress={handleShare}>
                <Feather name="share-2" size={20} color={colors.primary} />
                <Text style={styles.actionButtonText}>Share</Text>
              </PressableRow>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.muted,
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
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
  },
  shareButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  scrollView: {
    flex: 1,
  },
  documentContainer: {
    padding: 16,
  },
  document: {
    backgroundColor: colors.white,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  businessDetails: {
    flex: 1,
  },
  businessName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  businessAbn: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  businessContact: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  documentTypeContainer: {
    alignItems: 'flex-end',
  },
  documentType: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 1,
  },
  documentNumber: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  documentBody: {
    padding: 20,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 20,
  },
  infoColumn: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  clientDetail: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  dateValue: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.foreground,
  },
  itemsTable: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: colors.foreground,
  },
  textCenter: {
    textAlign: 'center',
  },
  textRight: {
    textAlign: 'right',
  },
  totalsContainer: {
    alignSelf: 'flex-end',
    width: '60%',
    marginBottom: 20,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  totalsLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  totalsValue: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  totalsFinal: {
    borderTopWidth: 2,
    marginTop: 4,
    paddingTop: 10,
  },
  totalsFinalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
  },
  totalsFinalValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  depositRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.warningLight,
    borderRadius: 6,
    marginTop: 8,
  },
  depositLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.warning,
  },
  depositValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.warning,
  },
  notesSection: {
    padding: 14,
    marginBottom: 20,
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  notesText: {
    fontSize: 13,
    color: colors.foreground,
    lineHeight: 20,
  },
  documentFooter: {
    borderTopWidth: 1,
    paddingTop: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: 8,
  },
  footerContact: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.primary,
  },
});
