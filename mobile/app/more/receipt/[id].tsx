import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Share,
  Linking,
  Modal,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../../src/components/ui/PressableRow';
import { useBottomInset } from '../../../src/components/ui/BottomInsetSpacer';
import { useConfirmDialog } from '../../../src/components/ui/ConfirmDialog';
import { useActionSheet } from '../../../src/components/ui/ActionSheet';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as SMS from 'expo-sms';
import { useAuthStore } from '../../../src/lib/store';
import { useTheme, ThemeColors } from '../../../src/lib/theme';
import { API_URL, api } from '../../../src/lib/api';
import { spacing, radius, shadows, typography, iconSizes } from '../../../src/lib/design-tokens';
import { format } from 'date-fns';
import { getEmailPreference, setEmailPreference, EmailAppPreference } from '../../../src/lib/email-preference';
import { EmailComposeModal } from '../../../src/components/EmailComposeModal';

interface ReceiptData {
  id: string;
  userId: string;
  invoiceId: string | null;
  receiptNumber: string;
  amount: number;
  gstAmount: number | null;
  paymentMethod: string;
  paymentReference: string | null;
  paidAt: string | null;
  clientId: string | null;
  notes: string | null;
  createdAt: string;
}

interface ClientData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface InvoiceData {
  id: string;
  number: string | null;
  invoiceNumber?: string | null;
  title: string | null;
  jobId: string | null;
}

interface JobData {
  id: string;
  title: string;
  address: string | null;
}


function safeFormatDate(value: string | Date | null | undefined, fmt: string, fallback: string = ''): string {
  if (!value) return fallback;
  const d = new Date(value);
  if (isNaN(d.getTime())) return fallback;
  try {
    return format(d, fmt);
  } catch {
    return fallback;
  }
}

export default function ReceiptDetailScreen() {
  const confirm = useConfirmDialog();
  const showActionSheet = useActionSheet();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, businessSettings } = useAuthStore();
  const { colors } = useTheme();
  const bottomInset = useBottomInset(40);
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [client, setClient] = useState<ClientData | null>(null);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [job, setJob] = useState<JobData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [includePaymentDetails, setIncludePaymentDetails] = useState(true);
  const [includeBusinessInfo, setIncludeBusinessInfo] = useState(true);
  const [includeClientInfo, setIncludeClientInfo] = useState(true);
  
  const brandColor = businessSettings?.brandColor || user?.brandColor || '#22c55e';

  const handleDeleteReceipt = () => {
    if (!receipt) return;
    
    confirm({
      title: 'Delete Receipt',
      message: 'Are you sure you want to delete this receipt? This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      setIsDeleting(true);
      try {
        await api.delete(`/api/receipts/${receipt.id}`);
        Alert.alert('Success', 'Receipt deleted successfully');
        router.back();
      } catch (error) {
        console.error('Error deleting receipt:', error);
        Alert.alert('Error', 'Failed to delete receipt');
      } finally {
        setIsDeleting(false);
      }
    });
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const receiptRes = await api.get<ReceiptData>(`/api/receipts/${id}`);
      if (receiptRes.data) {
        setReceipt(receiptRes.data);
        
        if (receiptRes.data.clientId) {
          const clientRes = await api.get<ClientData>(`/api/clients/${receiptRes.data.clientId}`);
          if (clientRes.data) setClient(clientRes.data);
        }
        
        if (receiptRes.data.invoiceId) {
          const invoiceRes = await api.get<InvoiceData>(`/api/invoices/${receiptRes.data.invoiceId}`);
          if (invoiceRes.data) {
            setInvoice(invoiceRes.data);
            
            if (invoiceRes.data.jobId) {
              const jobRes = await api.get<JobData>(`/api/jobs/${invoiceRes.data.jobId}`);
              if (jobRes.data) setJob(jobRes.data);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading receipt:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const { formatCurrency: fmt } = require('../../../src/lib/format');
    return fmt(amount);
  };

  const formatPaymentMethod = (method: string) => {
    const methods: Record<string, string> = {
      'card': 'Card Payment',
      'tap_to_pay': 'Tap to Pay',
      'bank_transfer': 'Bank Transfer',
      'cash': 'Cash',
      'cheque': 'Cheque',
      'eftpos': 'EFTPOS',
      'stripe': 'Online Payment',
      'manual': 'Manual Payment',
      'payment_link': 'Payment Link',
      'qr_code': 'QR Code',
      'other': 'Other',
    };
    return methods[method?.toLowerCase()] || method;
  };

  const downloadPdfToCache = useCallback(async (): Promise<string | null> => {
    if (!receipt) return null;
    
    const PDF_TIMEOUT_MS = 60000; // 60 seconds for receipts
    
    const authToken = await api.getToken();
    if (!authToken) {
      throw new Error('Not authenticated. Please log in again.');
    }
    
    const fileUri = `${FileSystem.cacheDirectory}Receipt-${receipt.receiptNumber || id}_${Date.now()}.pdf`;
    const pdfUrl = `${API_URL}/api/receipts/${id}/pdf`;
    
    if (__DEV__) console.log('[PDF] Downloading from:', pdfUrl);
    
    // Use createDownloadResumable for cancellation support
    const downloadResumable = FileSystem.createDownloadResumable(
      pdfUrl,
      fileUri,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );
    
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let didTimeout = false;
    
    try {
      const downloadPromise = downloadResumable.downloadAsync();
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(async () => {
          didTimeout = true;
          try {
            await downloadResumable.pauseAsync();
          } catch (e) {
            // Ignore pause errors
          }
          reject(new Error('PDF generation timed out. Please try again.'));
        }, PDF_TIMEOUT_MS);
      });
      
      const downloadResult = await Promise.race([downloadPromise, timeoutPromise]);
      
      if (timeoutId) clearTimeout(timeoutId);
      
      if (!downloadResult) {
        throw new Error('Download failed. Please try again.');
      }
      
      if (__DEV__) console.log('[PDF] Download result status:', downloadResult.status);

      if (downloadResult.status === 401) {
        throw new Error('Session expired. Please log in again.');
      }
      
      if (downloadResult.status === 404) {
        throw new Error('Receipt not found. It may have been deleted.');
      }
      
      if (downloadResult.status !== 200) {
        throw new Error(`Server error (${downloadResult.status}). Please try again.`);
      }
      
      // Verify the file was downloaded
      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      if (!fileInfo.exists || (fileInfo.size !== undefined && fileInfo.size < 100)) {
        throw new Error('PDF file is empty or corrupted. Please try again.');
      }

      return downloadResult.uri;
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      if (__DEV__) console.log('[PDF] Download error:', error);
      throw error;
    }
  }, [receipt, id]);

  const handleSharePdf = async () => {
    if (!receipt || isDownloadingPdf) return;
    
    setIsDownloadingPdf(true);
    try {
      const uri = await downloadPdfToCache();
      if (!uri) {
        throw new Error('Failed to generate PDF');
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Receipt ${receipt.receiptNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Sharing Not Available', 'Sharing is not available on this device.');
      }
    } catch (error: any) {
      if (__DEV__) console.log('Share PDF error:', error);
      const message = error?.message || 'Failed to share PDF. Please try again.';
      Alert.alert('PDF Download', message);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleNavigateToInvoice = () => {
    if (invoice) {
      router.push(`/more/invoice/${invoice.id}`);
    }
  };

  const handleNavigateToJob = () => {
    if (job) {
      router.push(`/job/${job.id}`);
    }
  };

  const handleSendReceipt = async () => {
    if (!receipt) return;
    
    if (!client?.email) {
      Alert.alert(
        'No Email Address',
        'This client does not have an email address on file. Please add an email address to the client record first.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    showActionSheet({
      title: 'Send Receipt',
      message: `To: ${client?.email || 'client'}`,
      actions: [
        { label: 'JobRunner: Send Now', icon: 'send', onPress: () => { handleSendViaJobRunner(); } },
        { label: 'JobRunner: Edit Message', icon: 'edit-3', onPress: () => setShowEmailCompose(true) },
        { label: 'Manual: Share', icon: 'share-2', onPress: () => showManualShareOptions() },
      ],
    });
  };
  
  const showManualShareOptions = () => {
    if (!receipt) return;
    
    showActionSheet({
      title: 'Share Format',
      message: 'How would you like to share this receipt?',
      actions: [
        { label: 'PDF Attachment', icon: 'file-text', onPress: () => handleShareAsPdf() },
        { label: 'Composed Email', icon: 'mail', onPress: () => handleShareAsComposedEmail() },
      ],
    });
  };
  
  const handleShareAsComposedEmail = async () => {
    if (!receipt || isDownloadingPdf) return;
    
    setIsDownloadingPdf(true);
    try {
      const receiptNumber = receipt.receiptNumber || receipt.id?.slice(0, 8);
      const businessName = businessSettings?.businessName || user?.name || 'Your tradie';
      const amount = formatCurrency(receipt.amount);
      const paidDate = safeFormatDate(receipt.paidAt, 'PP', format(new Date(), 'PP'));
      
      const subject = `Payment Receipt ${receiptNumber} from ${businessName}`;
      const body = `Hi ${client?.name || 'there'},

Thank you for your payment! Here are your receipt details:

Receipt Number: ${receiptNumber}
Amount Paid: ${amount}
Date: ${paidDate}

Thank you for your business!

${businessName}`;
      
      const emailUrl = `mailto:${client?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      const canOpen = await Linking.canOpenURL(emailUrl);
      if (canOpen) {
        await Linking.openURL(emailUrl);
      } else {
        Alert.alert('Email Not Available', 'Unable to open email app. Please send manually.');
      }
    } catch (error: any) {
      if (__DEV__) console.log('Error composing receipt email:', error);
      Alert.alert('Error', 'Failed to compose email. Please try again.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };
  
  const handleShareAsImage = async () => {
    if (!receipt || isDownloadingPdf) return;
    const receiptNumber = receipt.receiptNumber || receipt.id?.slice(0, 8);
    
    setIsDownloadingPdf(true);
    try {
      const authToken = await api.getToken();
      const response = await fetch(`${API_URL}/api/receipts/${receipt.id}/image`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate image');
      }
      
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const imageUri = FileSystem.cacheDirectory + `receipt-${receiptNumber}.png`;
      await FileSystem.writeAsStringAsync(imageUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(imageUri, {
          mimeType: 'image/png',
          dialogTitle: `Share Receipt ${receiptNumber}`,
          UTI: 'public.png',
        });
      } else {
        Alert.alert('Sharing Not Available', 'Sharing is not available on this device.');
      }
    } catch (error: any) {
      if (__DEV__) console.log('Error sharing as image:', error);
      Alert.alert('Error', 'Failed to generate image. Try sharing as PDF instead.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };
  
  const handleShareAsPdf = async () => {
    if (!receipt || isDownloadingPdf) return;
    
    setIsDownloadingPdf(true);
    try {
      const uri = await downloadPdfToCache();
      if (!uri) {
        throw new Error('Failed to generate PDF');
      }
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        const receiptNumber = receipt.receiptNumber || receipt.id?.slice(0, 8);
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Receipt ${receiptNumber} to ${client?.name || 'client'}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Sharing Not Available', 'Please use "JobRunner" to send with PDF attached.');
      }
    } catch (error: any) {
      if (__DEV__) console.log('Share receipt PDF error:', error);
      const message = error?.message || 'Failed to share PDF. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsDownloadingPdf(false);
    }
  };
  
  const handleSendViaJobRunner = async () => {
    if (!receipt || isSendingEmail) return;
    
    const recipientEmail = client?.email;
    
    if (!recipientEmail) {
      Alert.alert(
        'No Email Address',
        'This client does not have an email address on file.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setIsSendingEmail(true);
    try {
      await api.post(`/api/receipts/${receipt.id}/send-email`, {
        email: recipientEmail,
      });
      Alert.alert(
        'Receipt Sent!', 
        `Email sent to ${recipientEmail} with PDF attached.\n\nView it in Communications Hub to see the full email and delivery status.`
      );
    } catch (error: any) {
      console.error('Error sending receipt email:', error);
      const message = error?.response?.data?.error || error?.message || 'Failed to send receipt email';
      Alert.alert('Error', message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendWithCustomMessage = async (customSubject: string, customMessage: string) => {
    if (!receipt || !client?.email) {
      throw new Error('Missing receipt or client email information.');
    }
    
    try {
      await api.post(`/api/receipts/${receipt.id}/send-email`, {
        email: client.email,
        customSubject,
        customMessage,
      });
      
      // Refresh receipt data to show updated email sent status
      loadData();
      setShowEmailCompose(false);
      Alert.alert(
        'Receipt Sent!', 
        `Email sent to ${client.email} with PDF attached.\n\nView it in Communications Hub to see the full email and delivery status.`
      );
    } catch (error: any) {
      console.error('Error sending receipt email:', error);
      const message = error?.response?.data?.error || error?.message || 'Failed to send receipt email';
      // Throw error so EmailComposeModal shows it and stays open for retry
      throw new Error(message);
    }
  };

  const handleShareViaSMS = async () => {
    if (!receipt || !client?.phone) {
      if (!client?.phone) {
        Alert.alert('No Phone Number', 'This client does not have a phone number on file.');
      }
      return;
    }

    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('SMS Not Available', 'SMS is not available on this device.');
      return;
    }

    const businessName = businessSettings?.businessName || 'Your Business';
    const message = `Hi ${client.name || 'there'},\n\nThank you for your payment of ${formatCurrency(receipt.amount)}.\n\nReceipt: ${receipt.receiptNumber}\nDate: ${safeFormatDate(receipt.paidAt, 'd MMMM yyyy', safeFormatDate(receipt.createdAt, 'd MMMM yyyy', format(new Date(), 'd MMMM yyyy')))}\nMethod: ${formatPaymentMethod(receipt.paymentMethod)}\n\nThank you for your business!\n\n${businessName}`;

    try {
      await SMS.sendSMSAsync([client.phone], message);
    } catch (error) {
      console.error('Error sending SMS:', error);
    }
  };

  const SkeletonBox = ({ width, height, style }: { width: number | string; height: number; style?: any }) => (
    <View style={[{
      width: typeof width === 'string' ? width : width,
      height,
      backgroundColor: colors.muted,
      borderRadius: 8,
    }, style]} />
  );

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Receipt' }} />
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
          <View style={styles.summaryCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <SkeletonBox width={100} height={20} />
              <SkeletonBox width={60} height={24} style={{ borderRadius: 12 }} />
            </View>
            <SkeletonBox width={160} height={40} style={{ marginBottom: 8 }} />
            <SkeletonBox width={100} height={14} style={{ marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', gap: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
              <View style={{ flex: 1 }}>
                <SkeletonBox width={50} height={10} />
                <SkeletonBox width="100%" height={14} style={{ marginTop: 4 }} />
              </View>
              <View style={{ flex: 1 }}>
                <SkeletonBox width={50} height={10} />
                <SkeletonBox width="100%" height={14} style={{ marginTop: 4 }} />
              </View>
            </View>
          </View>
          <View style={styles.actionsRow}>
            {[1, 2, 3].map((i) => (
              <SkeletonBox key={i} width={100} height={48} style={{ flex: 1, borderRadius: 10 }} />
            ))}
          </View>
          <SkeletonBox width={120} height={14} style={{ marginBottom: 8 }} />
          <View style={styles.card}>
            <SkeletonBox width="100%" height={100} />
          </View>
        </ScrollView>
      </>
    );
  }

  if (!receipt) {
    return (
      <>
        <Stack.Screen options={{ title: 'Receipt' }} />
        <View style={styles.errorContainer}>
          <Feather name="file" size={48} color={colors.mutedForeground} />
          <Text style={styles.errorTitle}>Receipt Not Found</Text>
          <Text style={styles.errorText}>This receipt could not be found or may have been deleted.</Text>
          <PressableRow style={styles.backButton} onPress={() => router.back()} >
            <Text style={styles.backButtonText}>Go Back</Text>
          </PressableRow>
        </View>
      </>
    );
  }

  const subtotal = receipt.gstAmount ? receipt.amount - receipt.gstAmount : receipt.amount;
  const gst = receipt.gstAmount || 0;

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: receipt.receiptNumber || 'Receipt',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <PressableRow onPress={() => setShowPreview(true)} style={styles.headerButton} >
                <Feather name="eye" size={22} color={colors.primary} />
              </PressableRow>
              <PressableRow onPress={handleDeleteReceipt} style={styles.headerButton} disabled={isDeleting} data-testid="button-delete-receipt" >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={colors.destructive} />
                ) : (
                  <Feather name="trash-2" size={22} color={colors.destructive} />
                )}
              </PressableRow>
            </View>
          )
        }} 
      />
      <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomInset }]}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.receiptNumberLarge}>{receipt.receiptNumber}</Text>
            <View style={styles.paidBadgeLarge}>
              <Feather name="check-circle" size={14} color={colors.white} />
              <Text style={styles.paidBadgeLargeText}>PAID</Text>
            </View>
          </View>
          <Text style={styles.amountLarge}>{formatCurrency(receipt.amount)}</Text>
          <Text style={styles.amountLabel}>
            {gst > 0 ? 'Total (inc. GST)' : 'Amount Paid'}
          </Text>
          
          <View style={styles.summaryDetailsRow}>
            <View style={styles.summaryDetailItem}>
              <Feather name="user" size={14} color={colors.mutedForeground} />
              <View>
                <Text style={styles.summaryDetailLabel}>Client</Text>
                <Text style={styles.summaryDetailValue} numberOfLines={1}>{client?.name || 'Customer'}</Text>
              </View>
            </View>
            <View style={styles.summaryDetailItem}>
              <Feather name="credit-card" size={14} color={colors.mutedForeground} />
              <View>
                <Text style={styles.summaryDetailLabel}>Method</Text>
                <Text style={styles.summaryDetailValue} numberOfLines={1}>{formatPaymentMethod(receipt.paymentMethod)}</Text>
              </View>
            </View>
          </View>
          
          {receipt.paidAt && (
            <View style={styles.summaryDateRow}>
              <Feather name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={styles.summaryDateText}>
                Paid on {safeFormatDate(receipt.paidAt, 'd MMMM yyyy', 'Unknown date')}{safeFormatDate(receipt.paidAt, 'h:mm a') ? ` at ${safeFormatDate(receipt.paidAt, 'h:mm a')}` : ''}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.actionsRow}>
          <PressableRow style={[styles.actionButton, styles.actionButtonPrimary]} onPress={handleSharePdf} disabled={isDownloadingPdf} data-testid="button-download-pdf" >
            {isDownloadingPdf ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="download" size={18} color={colors.primaryForeground} />
                <Text style={styles.actionButtonPrimaryText}>PDF</Text>
              </>
            )}
          </PressableRow>
          
          <PressableRow style={[styles.actionButton, !client?.email && styles.actionButtonDisabled]} onPress={handleSendReceipt} disabled={isSendingEmail || !client?.email} data-testid="button-send-email" >
            {isSendingEmail ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Feather name="mail" size={18} color={client?.email ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.actionButtonText, !client?.email && styles.actionButtonTextDisabled]}>Email</Text>
              </>
            )}
          </PressableRow>
          
          <PressableRow style={[styles.actionButton, !client?.phone && styles.actionButtonDisabled]} onPress={handleShareViaSMS} disabled={!client?.phone} data-testid="button-send-sms" >
            <Feather name="message-circle" size={18} color={client?.phone ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.actionButtonText, !client?.phone && styles.actionButtonTextDisabled]}>SMS</Text>
          </PressableRow>
          
          <PressableRow style={styles.actionButton} onPress={handleDeleteReceipt} disabled={isDeleting} data-testid="button-delete-receipt-content" >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.destructive} />
            ) : (
              <>
                <Feather name="trash-2" size={18} color={colors.destructive} />
                <Text style={[styles.actionButtonText, { color: colors.destructive }]}>Delete</Text>
              </>
            )}
          </PressableRow>
        </View>

        {(invoice || job) && (
          <View style={styles.linkedSection}>
            <Text style={styles.linkedTitle}>Linked Documents</Text>
            {invoice && (
              <PressableRow style={styles.linkedCard} onPress={handleNavigateToInvoice} data-testid="link-invoice" >
                <View style={styles.linkedCardIcon}>
                  <Feather name="file-text" size={20} color={colors.primary} />
                </View>
                <View style={styles.linkedCardContent}>
                  <Text style={styles.linkedCardLabel}>Invoice</Text>
                  <Text style={styles.linkedCardValue}>
                    {invoice.number || invoice.invoiceNumber || `#${invoice.id.substring(0, 8).toUpperCase()}`}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </PressableRow>
            )}
            {job && (
              <PressableRow style={styles.linkedCard} onPress={handleNavigateToJob} data-testid="link-job" >
                <View style={styles.linkedCardIcon}>
                  <Feather name="briefcase" size={20} color={colors.info} />
                </View>
                <View style={styles.linkedCardContent}>
                  <Text style={styles.linkedCardLabel}>Job</Text>
                  <Text style={styles.linkedCardValue} numberOfLines={1}>{job.title}</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </PressableRow>
            )}
          </View>
        )}

        <Text style={styles.detailsTitle}>Payment Details</Text>
        <View style={styles.card}>
          <View style={[styles.headerSection, { borderBottomColor: brandColor }]}>
            <View style={styles.businessInfo}>
              {businessSettings?.logoUrl && (
                <Image 
                  source={{ uri: businessSettings.logoUrl }} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.businessName}>
                {businessSettings?.businessName || 'Your Business Name'}
              </Text>
              {businessSettings?.abn && (
                <Text style={styles.businessDetail}>ABN: {businessSettings.abn}</Text>
              )}
            </View>
            
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptTitle}>RECEIPT</Text>
              <Text style={styles.receiptNumber}>{receipt.receiptNumber}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.row}>
              <View style={styles.infoColumn}>
                <Text style={styles.sectionLabel}>RECEIVED FROM</Text>
                <Text style={styles.clientName}>{client?.name || 'Customer'}</Text>
                {client?.address && <Text style={styles.infoText}>{client.address}</Text>}
                {client?.email && <Text style={styles.infoText}>{client.email}</Text>}
                {client?.phone && <Text style={styles.infoText}>{client.phone}</Text>}
              </View>
              
              <View style={styles.infoColumn}>
                <Text style={styles.sectionLabel}>PAYMENT DETAILS</Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoLabel}>Date: </Text>
                  {safeFormatDate(receipt.paidAt, 'd MMMM yyyy', safeFormatDate(receipt.createdAt, 'd MMMM yyyy', 'Unknown date'))}
                </Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoLabel}>Method: </Text>
                  {formatPaymentMethod(receipt.paymentMethod)}
                </Text>
                {receipt.paymentReference && (
                  <Text style={styles.infoText}>
                    <Text style={styles.infoLabel}>Reference: </Text>
                    {receipt.paymentReference}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <View style={[styles.paymentSummary, { borderColor: '#22c55e' }]}>
            <View style={styles.paymentSummaryHeader}>
              <Text style={styles.summaryTitle}>Payment Received</Text>
              <View style={styles.paidBadgeSmall}>
                <Text style={styles.paidBadgeSmallText}>Paid</Text>
              </View>
            </View>
            
            {gst > 0 && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal (excl. GST)</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryDivider]}>
                  <Text style={styles.summaryLabel}>GST (10%)</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(gst)}</Text>
                </View>
              </>
            )}
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Amount Paid {gst > 0 ? '(incl. GST)' : ''}
              </Text>
              <Text style={styles.totalValue}>{formatCurrency(receipt.amount)}</Text>
            </View>
          </View>

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Payment Method</Text>
              <Text style={styles.detailValue}>{formatPaymentMethod(receipt.paymentMethod)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Transaction ID</Text>
              <Text style={styles.detailValueSmall} numberOfLines={1}>{receipt.id}</Text>
            </View>
            {receipt.paidAt && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Date & Time</Text>
                <Text style={styles.detailValue}>
                  {safeFormatDate(receipt.paidAt, 'd MMMM yyyy, h:mm a', 'Unknown')}
                </Text>
              </View>
            )}
            {receipt.paymentReference && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Reference</Text>
                <Text style={styles.detailValue}>{receipt.paymentReference}</Text>
              </View>
            )}
          </View>

          <View style={[styles.thankYouSection, { backgroundColor: `${brandColor}10` }]}>
            <Text style={[styles.thankYouText, { color: brandColor }]}>
              Thank you for your payment!
            </Text>
            <Text style={styles.thankYouSubtext}>
              This receipt confirms your payment has been received and processed.
            </Text>
          </View>
        </View>

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>

      {/* Receipt Preview Modal */}
      <Modal
        visible={showPreview}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={styles.previewModalHeader}>
            <PressableRow onPress={() => setShowPreview(false)} style={styles.previewCloseButton}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
            <Text style={styles.previewModalTitle}>Receipt Preview</Text>
            <View style={styles.previewActionButtons}>
              <PressableRow onPress={() => { setShowPreview(false); setTimeout(() => handleSendReceipt(), 300); }} style={styles.previewActionButton} >
                <Feather name="mail" size={20} color={colors.primary} />
              </PressableRow>
              <PressableRow onPress={() => { setShowPreview(false); setTimeout(() => handleSharePdf(), 300); }} style={styles.previewActionButton} disabled={isDownloadingPdf} >
                <Feather name="share-2" size={20} color={isDownloadingPdf ? colors.mutedForeground : colors.primary} />
              </PressableRow>
            </View>
          </View>
          <View style={styles.previewOptionsRow}>
            <PressableRow style={[styles.previewOptionChip, includeBusinessInfo && styles.previewOptionChipActive]} onPress={() => setIncludeBusinessInfo(!includeBusinessInfo)} >
              <Feather name={includeBusinessInfo ? "check-square" : "square"} size={14} color={includeBusinessInfo ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.previewOptionChipText, includeBusinessInfo && { color: colors.primary }]}>Business</Text>
            </PressableRow>
            <PressableRow style={[styles.previewOptionChip, includeClientInfo && styles.previewOptionChipActive]} onPress={() => setIncludeClientInfo(!includeClientInfo)} >
              <Feather name={includeClientInfo ? "check-square" : "square"} size={14} color={includeClientInfo ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.previewOptionChipText, includeClientInfo && { color: colors.primary }]}>Client</Text>
            </PressableRow>
            <PressableRow style={[styles.previewOptionChip, includePaymentDetails && styles.previewOptionChipActive]} onPress={() => setIncludePaymentDetails(!includePaymentDetails)} >
              <Feather name={includePaymentDetails ? "check-square" : "square"} size={14} color={includePaymentDetails ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.previewOptionChipText, includePaymentDetails && { color: colors.primary }]}>Details</Text>
            </PressableRow>
          </View>
          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.previewDocumentCard}>
              <View style={styles.previewDocumentContent}>
                {/* Header */}
                <View style={[styles.previewHeader, { borderBottomColor: brandColor }]}>
                  {includeBusinessInfo && (
                    <View style={{ flex: 1 }}>
                      {businessSettings?.logoUrl && (
                        <Image 
                          source={{ uri: businessSettings.logoUrl }} 
                          style={styles.logo}
                          resizeMode="contain"
                        />
                      )}
                      <Text style={styles.businessName}>
                        {businessSettings?.businessName || 'Your Business Name'}
                      </Text>
                      {businessSettings?.abn && (
                        <Text style={styles.businessDetail}>ABN: {businessSettings.abn}</Text>
                      )}
                      {businessSettings?.address && (
                        <Text style={styles.businessDetail}>{businessSettings.address}</Text>
                      )}
                      {businessSettings?.phone && (
                        <Text style={styles.businessDetail}>Phone: {businessSettings.phone}</Text>
                      )}
                    </View>
                  )}
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: brandColor, letterSpacing: 2 }}>RECEIPT</Text>
                    <Text style={{ fontSize: 14, color: '#1a1a1a', fontWeight: '600', marginTop: 4 }}>{receipt.receiptNumber}</Text>
                    <View style={{ backgroundColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginTop: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.white }}>PAID</Text>
                    </View>
                  </View>
                </View>

                {/* Client & Payment Info */}
                <View style={{ flexDirection: 'row', marginTop: 16, gap: 16 }}>
                  {includeClientInfo && client && (
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>RECEIVED FROM</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a1a' }}>{client.name}</Text>
                      {client.address && <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{client.address}</Text>}
                      {client.email && <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{client.email}</Text>}
                      {client.phone && <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{client.phone}</Text>}
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>PAYMENT DATE</Text>
                    <Text style={{ fontSize: 13, color: '#1a1a1a' }}>
                      {safeFormatDate(receipt.paidAt, 'd MMMM yyyy', safeFormatDate(receipt.createdAt, 'd MMMM yyyy', 'Unknown date'))}
                    </Text>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 }}>METHOD</Text>
                    <Text style={{ fontSize: 13, color: '#1a1a1a' }}>{formatPaymentMethod(receipt.paymentMethod)}</Text>
                  </View>
                </View>

                {/* Amount Section */}
                <View style={{ marginTop: 20, borderWidth: 1, borderColor: '#22c55e', borderRadius: 8, padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a1a' }}>Payment Received</Text>
                    <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#16a34a' }}>Paid</Text>
                    </View>
                  </View>
                  {gst > 0 && (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Subtotal (excl. GST)</Text>
                        <Text style={{ fontSize: 12, color: '#1a1a1a' }}>{formatCurrency(subtotal)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb' }}>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>GST (10%)</Text>
                        <Text style={{ fontSize: 12, color: '#1a1a1a' }}>{formatCurrency(gst)}</Text>
                      </View>
                    </>
                  )}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#22c55e', marginTop: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>
                      Amount Paid {gst > 0 ? '(incl. GST)' : ''}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1a1a1a' }}>{formatCurrency(receipt.amount)}</Text>
                  </View>
                </View>

                {/* Payment Details */}
                {includePaymentDetails && (
                  <View style={{ marginTop: 16, gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' }}>
                      <Text style={{ fontSize: 12, color: '#6b7280' }}>Payment Method</Text>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: '#1a1a1a' }}>{formatPaymentMethod(receipt.paymentMethod)}</Text>
                    </View>
                    {receipt.paymentReference && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' }}>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Reference</Text>
                        <Text style={{ fontSize: 12, fontWeight: '500', color: '#1a1a1a' }}>{receipt.paymentReference}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' }}>
                      <Text style={{ fontSize: 12, color: '#6b7280' }}>Transaction ID</Text>
                      <Text style={{ fontSize: 12, fontWeight: '500', color: '#1a1a1a' }} numberOfLines={1}>{receipt.id.slice(0, 12)}...</Text>
                    </View>
                    {receipt.paidAt && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Date & Time</Text>
                        <Text style={{ fontSize: 12, fontWeight: '500', color: '#1a1a1a' }}>
                          {safeFormatDate(receipt.paidAt, 'd MMM yyyy, h:mm a', 'Unknown')}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Thank You */}
                <View style={{ marginTop: 20, padding: 16, backgroundColor: `${brandColor}10`, borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: brandColor }}>Thank you for your payment!</Text>
                  <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 4, textAlign: 'center' }}>
                    This receipt confirms your payment has been received and processed.
                  </Text>
                </View>

                {/* Footer */}
                <View style={{ marginTop: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb', alignItems: 'center' }}>
                  {businessSettings?.abn && (
                    <Text style={{ fontSize: 10, color: '#6b7280' }}>ABN: {businessSettings.abn}</Text>
                  )}
                  <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>Generated by JobRunner</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Email Compose Modal for customizing receipt email */}
      {receipt && client && (
        <EmailComposeModal
          visible={showEmailCompose}
          onClose={() => setShowEmailCompose(false)}
          type="receipt"
          documentId={receipt.id}
          clientName={client.name || 'Customer'}
          clientEmail={client.email || ''}
          documentNumber={receipt.receiptNumber || receipt.id.slice(0, 8)}
          documentTitle={invoice?.title || job?.title || 'Payment'}
          total={formatCurrency(receipt.amount)}
          businessName={businessSettings?.businessName || 'Your Business'}
          onSend={handleSendWithCustomMessage}
        />
      )}
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  receiptNumberLarge: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  paidBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  paidBadgeLargeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  amountLarge: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.foreground,
    textAlign: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 4,
  },
  summaryDetailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryDetailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  summaryDetailLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: 2,
  },
  summaryDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryDateText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  actionButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  actionButtonTextDisabled: {
    color: colors.mutedForeground,
  },
  linkedSection: {
    marginBottom: 20,
  },
  linkedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 10,
  },
  linkedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  linkedCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  linkedCardContent: {
    flex: 1,
  },
  linkedCardLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  linkedCardValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: 2,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 10,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
    backgroundColor: colors.background,
  },
  errorTitle: {
    ...typography.sectionTitle,
    color: colors.foreground,
    marginTop: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  backButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  backButtonText: {
    ...typography.bodySemibold,
    color: colors.primaryForeground,
  },
  headerButton: {
    padding: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadows.md,
  },
  headerSection: {
    padding: spacing.lg,
    borderBottomWidth: 3,
  },
  businessInfo: {
    marginBottom: spacing.lg,
  },
  logo: {
    width: 120,
    height: 50,
    marginBottom: spacing.sm,
  },
  businessName: {
    ...typography.sectionTitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  businessDetail: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  receiptHeader: {
    alignItems: 'flex-end',
  },
  receiptTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
    letterSpacing: 2,
  },
  receiptNumber: {
    ...typography.body,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  receiptDate: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  paidBadgeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  section: {
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  infoColumn: {
    flex: 1,
  },
  sectionLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  clientName: {
    ...typography.bodySemibold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  infoText: {
    ...typography.caption,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  infoLabel: {
    fontWeight: '600',
  },
  paymentSummary: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: '#f0fdf4',
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  paymentSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  summaryTitle: {
    ...typography.subtitle,
    color: '#15803d',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paidBadgeSmall: {
    backgroundColor: '#22c55e',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  paidBadgeSmallText: {
    ...typography.captionSmall,
    color: colors.white,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  summaryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#bbf7d0',
  },
  summaryLabel: {
    ...typography.body,
    color: '#15803d',
  },
  summaryValue: {
    ...typography.bodySemibold,
    color: '#15803d',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 2,
    borderTopColor: '#22c55e',
  },
  totalLabel: {
    ...typography.cardTitle,
    color: '#15803d',
    fontWeight: '700',
  },
  totalValue: {
    ...typography.cardTitle,
    color: '#15803d',
    fontWeight: '700',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  detailItem: {
    width: '48%',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  detailValue: {
    ...typography.bodySemibold,
    color: colors.foreground,
  },
  detailValueSmall: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
  },
  referenceCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
  },
  referenceLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  referenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  referenceLink: {
    ...typography.bodySemibold,
    textDecorationLine: 'underline',
  },
  referenceSubtext: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  thankYouSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  thankYouText: {
    ...typography.cardTitle,
    fontWeight: '600',
  },
  thankYouSubtext: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  footerText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  footerBrand: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  shareButtonText: {
    ...typography.bodySemibold,
    color: colors.primaryForeground,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  emailButtonText: {
    ...typography.bodySemibold,
    color: colors.primary,
  },
  viewInvoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewInvoiceButtonText: {
    ...typography.bodySemibold,
    color: colors.primary,
    flex: 1,
    textAlign: 'center',
  },
  previewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  previewCloseButton: {
    padding: 4,
  },
  previewModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  previewActionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  previewActionButton: {
    padding: 4,
  },
  previewOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  previewOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  previewOptionChipActive: {
    borderColor: `${colors.primary}40`,
    backgroundColor: `${colors.primary}08`,
  },
  previewOptionChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  previewDocumentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  previewDocumentContent: {
    padding: 24,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 2,
    marginBottom: 0,
  },
});
