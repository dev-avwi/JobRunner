import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Image,
  Modal,
  Share,
  Linking,
  TextInput,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '@/components/ui/PressableRow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../../src/components/BottomNav';
// Note: expo-clipboard requires a native build - using Share API as fallback for Expo Go
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useInvoicesStore, useClientsStore, useAuthStore, useQuotesStore } from '../../../src/lib/store';
import { useTheme, ThemeColors } from '../../../src/lib/theme';
import { AppBottomSheet } from '../../../src/components/ui/AppBottomSheet';
import { spacing, radius, typography, fontWeights } from '../../../src/lib/design-tokens';
import LiveDocumentPreview from '../../../src/components/LiveDocumentPreview';
import { EmailComposeModal } from '../../../src/components/EmailComposeModal';
import { MobileSendModal } from '../../../src/components/MobileSendModal';
import { API_URL, api } from '../../../src/lib/api';
import { maybeRequestReview } from '../../../src/lib/store-review';
import { getEmailPreference, setEmailPreference, EmailAppPreference } from '../../../src/lib/email-preference';
import { format } from 'date-fns';
import { showToast } from '../../../src/lib/toast';
import { Button } from '../../../src/components/ui/Button';
import { useConfirmDialog } from '../../../src/components/ui/ConfirmDialog';

interface Signature {
  id: string;
  signatureData: string;
  signerName?: string;
  signedAt?: string;
  documentType?: string;
  signerRole?: string;
}

const TEMPLATE_OPTIONS = [
  { id: 'professional', name: 'Professional', description: 'Traditional layout with bordered tables' },
  { id: 'modern', name: 'Modern', description: 'Clean design with bold brand colors' },
  { id: 'minimal', name: 'Minimal', description: 'Ultra-clean with subtle styling' },
];

export default function InvoiceDetailScreen() {
  const { id, autoEmail } = useLocalSearchParams<{ id: string; autoEmail?: string }>();
  const { getInvoice, updateInvoiceStatus, fetchInvoices } = useInvoicesStore();
  const { getQuote } = useQuotesStore();
  const { clients, fetchClients } = useClientsStore();
  const { user, businessSettings } = useAuthStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const confirm = useConfirmDialog();
  
  const STATUS_CONFIG = useMemo(() => ({
    draft: { label: 'Draft', color: colors.warning, bg: colors.warningLight },
    sent: { label: 'Sent', color: colors.info, bg: colors.infoLight },
    paid: { label: 'Paid', color: colors.success, bg: colors.successLight },
    overdue: { label: 'Overdue', color: colors.destructive, bg: colors.destructiveLight },
    cancelled: { label: 'Cancelled', color: colors.mutedForeground, bg: colors.cardHover },
  }), [colors]);
  const [invoice, setInvoice] = useState<any>(null);
  const [linkedQuote, setLinkedQuote] = useState<any>(null);
  const [linkedJob, setLinkedJob] = useState<any>(null);
  const [linkedReceipt, setLinkedReceipt] = useState<any>(null);
  const [allSignatures, setAllSignatures] = useState<Signature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [isTogglingPayment, setIsTogglingPayment] = useState(false);
  const [isGeneratingPaymentLink, setIsGeneratingPaymentLink] = useState(false);
  const [isRecordingOnSitePayment, setIsRecordingOnSitePayment] = useState(false);
  const [isSendingReceipt, setIsSendingReceipt] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(businessSettings?.documentTemplate || 'professional');
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [includeBeforePhotos, setIncludeBeforePhotos] = useState(false);
  const [includeAfterPhotos, setIncludeAfterPhotos] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [includeTerms, setIncludeTerms] = useState(true);
  const [jobPhotos, setJobPhotos] = useState<any[]>([]);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'bank_transfer' | 'cheque' | 'card' | 'other'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [isSendingPaymentLinkEmail, setIsSendingPaymentLinkEmail] = useState(false);
  const [createReceiptOnPayment, setCreateReceiptOnPayment] = useState(false);
  const [showReceiptEmailCompose, setShowReceiptEmailCompose] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendModalDefaultTab, setSendModalDefaultTab] = useState<'email' | 'sms'>('email');
  const [showReceiptSendModal, setShowReceiptSendModal] = useState(false);
  const [receiptSendModalDefaultTab, setReceiptSendModalDefaultTab] = useState<'email' | 'sms'>('email');
  const [showMilestonesModal, setShowMilestonesModal] = useState(false);
  const [milestonePreset, setMilestonePreset] = useState<string>('custom');
  const [retentionPercentStr, setRetentionPercentStr] = useState('');
  const [isSavingMilestones, setIsSavingMilestones] = useState(false);
  const [customMilestones, setCustomMilestones] = useState<{ label: string; percent: number; status: string }[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<any[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<any>(null);
  const [myobConnected, setMyobConnected] = useState(false);
  const [isVoidingMyob, setIsVoidingMyob] = useState(false);
  const [showMyobCreditNoteModal, setShowMyobCreditNoteModal] = useState(false);
  const [myobVoidExplanation, setMyobVoidExplanation] = useState('');
  
  const brandColor = businessSettings?.brandColor || user?.brandColor || '#2563eb';

  const MILESTONE_PRESETS = [
    { id: 'custom', label: 'Custom' },
    { id: 'deposit-balance', label: '50% Deposit / 50% Completion' },
    { id: 'three-stage', label: '30% / 40% / 30%' },
    { id: 'four-stage', label: '25% x 4 Stages' },
    { id: 'construction', label: '10% / 30% / 30% / 30%' },
  ] as const;

  const PRESET_MAP: Record<string, { label: string; percent: number }[]> = {
    'deposit-balance': [
      { label: 'Deposit', percent: 50 },
      { label: 'Completion', percent: 50 },
    ],
    'three-stage': [
      { label: 'Deposit', percent: 30 },
      { label: 'Progress', percent: 40 },
      { label: 'Completion', percent: 30 },
    ],
    'four-stage': [
      { label: 'Deposit', percent: 25 },
      { label: 'Lockup', percent: 25 },
      { label: 'Fixout', percent: 25 },
      { label: 'Completion', percent: 25 },
    ],
    'construction': [
      { label: 'Deposit', percent: 10 },
      { label: 'Slab Complete', percent: 30 },
      { label: 'Frame Complete', percent: 30 },
      { label: 'Completion', percent: 30 },
    ],
  };
  
  const PAYMENT_METHODS = [
    { id: 'cash', label: 'Cash', icon: 'dollar-sign' },
    { id: 'bank_transfer', label: 'Bank Transfer', icon: 'briefcase' },
    { id: 'card', label: 'Card', icon: 'credit-card' },
    { id: 'cheque', label: 'Cheque', icon: 'file-text' },
    { id: 'other', label: 'Other', icon: 'more-horizontal' },
  ] as const;
  
  // Computed payment status
  const isPaid = invoice?.status === 'paid';

  const handleDeleteInvoice = async () => {
    if (!invoice) return;
    
    const ok = await confirm({ title: 'Delete Invoice', message: 'Are you sure you want to delete this invoice? This cannot be undone.', confirmText: 'Delete', cancelText: 'Cancel', destructive: true });
    if (ok) {
      setIsDeleting(true);
      try {
        await api.delete(`/api/invoices/${invoice.id}`);
        showToast({ type: 'success', message: 'Success', description: 'Invoice deleted successfully' });
        router.back();
      } catch (error) {
        console.error('Error deleting invoice:', error);
        showToast({ type: 'error', message: 'Error', description: 'Failed to delete invoice' });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Task #96: Fetch MYOB connection status to know whether to surface the Void action.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ connected: boolean }>('/api/integrations/myob/status');
        if (!cancelled) setMyobConnected(!!res.data?.connected);
      } catch {
        if (!cancelled) setMyobConnected(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleRaiseMyobCreditNote = useCallback(async (): Promise<boolean> => {
    if (!invoice) return false;
    setIsVoidingMyob(true);
    try {
      const res = await api.post<any>(`/api/integrations/myob/credit-note/${invoice.id}`);
      if (res.error) {
        showToast({ type: 'error', message: 'Credit note failed', description: res.error });
        return false;
      }
      showToast({ type: 'success', message: 'Credit note raised', description: res.data?.message || 'Credit note posted to MYOB.' });
      await loadData();
      return true;
    } finally {
      setIsVoidingMyob(false);
    }
  }, [invoice]);

  const handleVoidInMyob = useCallback(async () => {
    if (!invoice) return;
    setIsVoidingMyob(true);
    try {
      const authToken = await api.getToken();
      const res = await fetch(`${API_URL}/api/integrations/myob/void-invoice/${invoice.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
      });
      const body: any = await res.json().catch(() => ({}));
      if (res.status === 422 && body?.voidMethod === 'unsupported') {
        setIsVoidingMyob(false);
        setMyobVoidExplanation(body.message || 'MYOB AccountRight does not support voiding posted invoices via API.');
        setShowMyobCreditNoteModal(true);
        return;
      }
      if (res.status >= 200 && res.status < 300 && body?.success) {
        showToast({ type: 'success', message: 'Voided in MYOB', description: body.message || 'Invoice voided in MYOB.' });
        await loadData();
      } else {
        showToast({ type: 'error', message: 'MYOB void failed', description: body?.message || `Request failed (${res.status})` });
      }
    } catch (err: any) {
      showToast({ type: 'error', message: 'MYOB void failed', description: err?.message || 'Network error' });
    } finally {
      setIsVoidingMyob(false);
    }
  }, [invoice]);

  // Auto-open email compose when navigated with autoEmail param
  useEffect(() => {
    if (autoEmail === 'true' && invoice && !isLoading) {
      setTimeout(() => setShowEmailCompose(true), 300);
    }
  }, [autoEmail, invoice, isLoading]);

  // Fetch job photos when preview opens and invoice has a jobId
  useEffect(() => {
    if (!showPreview || !invoice?.jobId) {
      setJobPhotos([]);
      return;
    }
    const fetchPhotos = async () => {
      try {
        const response = await api.get<any[]>(`/api/jobs/${invoice.jobId}/photos`);
        if (Array.isArray(response.data)) setJobPhotos(response.data);
      } catch (e) {
        setJobPhotos([]);
      }
    };
    fetchPhotos();
  }, [showPreview, invoice?.jobId]);

  const loadData = async () => {
    setIsLoading(true);
    const authToken = await api.getToken();
    const invoiceData = await getInvoice(id!);
    setInvoice(invoiceData);
    await fetchClients();
    
    const signatures: Signature[] = [];
    
    // Fetch linked quote if exists
    if (invoiceData?.quoteId) {
      const quoteData = await getQuote(invoiceData.quoteId);
      setLinkedQuote(quoteData);
      
      // Fetch quote acceptance signature
      try {
        const response = await fetch(`${API_URL}/api/digital-signatures?documentType=quote_acceptance&documentId=${invoiceData.quoteId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
          const quoteSignatures = await response.json();
          quoteSignatures.forEach((sig: any) => {
            signatures.push({ ...sig, documentType: 'quote_acceptance' });
          });
        }
      } catch (err) {
        if (__DEV__) console.log('Could not fetch quote signature:', err);
      }
    }
    
    // Fetch job signatures if invoice has jobId
    if (invoiceData?.jobId) {
      try {
        const response = await fetch(`${API_URL}/api/jobs/${invoiceData.jobId}/signatures`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
          const jobSignatures = await response.json();
          jobSignatures.forEach((sig: any) => {
            signatures.push({ 
              ...sig, 
              documentType: sig.documentType || 'job_completion' 
            });
          });
        }
      } catch (err) {
        if (__DEV__) console.log('Could not fetch job signatures:', err);
      }
    }
    
    // Fetch invoice-specific signatures
    try {
      const response = await fetch(`${API_URL}/api/digital-signatures?documentType=invoice&documentId=${id}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const invoiceSignatures = await response.json();
        invoiceSignatures.forEach((sig: any) => {
          signatures.push({ ...sig, documentType: 'invoice' });
        });
      }
    } catch (err) {
      if (__DEV__) console.log('Could not fetch invoice signatures:', err);
    }
    
    setAllSignatures(signatures);
    
    // Fetch linked job if exists (optional, clear state on failure)
    if (invoiceData?.jobId) {
      try {
        const jobResponse = await fetch(`${API_URL}/api/jobs/${invoiceData.jobId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (jobResponse.ok) {
          const jobData = await jobResponse.json();
          setLinkedJob(jobData);
        } else {
          setLinkedJob(null);
        }
      } catch (err) {
        if (__DEV__) console.log('Could not fetch linked job:', err);
        setLinkedJob(null);
      }
    } else {
      setLinkedJob(null);
    }
    
    // Fetch linked receipt if exists (optional, clear state on failure)
    try {
      const receiptResponse = await fetch(`${API_URL}/api/receipts?invoiceId=${id}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (receiptResponse.ok) {
        const receipts = await receiptResponse.json();
        if (receipts.length > 0) {
          setLinkedReceipt(receipts[0]);
        } else {
          setLinkedReceipt(null);
        }
      } else {
        setLinkedReceipt(null);
      }
    } catch (err) {
      if (__DEV__) console.log('Could not fetch linked receipt:', err);
      setLinkedReceipt(null);
    }
    
    // Fetch payment records for payment history timeline
    try {
      const paymentsResponse = await fetch(`${API_URL}/api/invoices/${id}/payments`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        setPaymentRecords(paymentsData.records || []);
        setPaymentSummary(paymentsData.summary || null);
      } else {
        setPaymentRecords([]);
        setPaymentSummary(null);
      }
    } catch (err) {
      if (__DEV__) console.log('Could not fetch payment records:', err);
      setPaymentRecords([]);
      setPaymentSummary(null);
    }
    
    setIsLoading(false);
  };

  const getClient = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  const formatCurrency = (amount: number) => {
    const { formatCurrency: fmt } = require('../../../src/lib/format');
    return fmt(amount);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleSend = () => {
    const client = getClient(invoice?.clientId || '');
    Alert.alert(
      'Send Invoice',
      `To: ${client?.email || 'client'}`,
      [
        {
          text: 'JobRunner: Send Now',
          onPress: () => handleSendViaJobRunner(),
        },
        {
          text: 'JobRunner: Edit Message',
          onPress: () => setShowEmailCompose(true),
        },
        {
          text: 'Send SMS',
          onPress: () => {
            setSendModalDefaultTab('sms');
            setShowSendModal(true);
          },
        },
        {
          text: 'Email & SMS',
          onPress: () => {
            setSendModalDefaultTab('email');
            setShowSendModal(true);
          },
        },
        {
          text: 'Manual: Share',
          onPress: () => showManualShareOptions(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };
  
  const showManualShareOptions = () => {
    if (!invoice) return;
    
    Alert.alert(
      'Share Format',
      'How would you like to share this invoice?',
      [
        {
          text: 'PDF Attachment',
          onPress: () => handleShareAsPdf(),
        },
        {
          text: 'Composed Email with Link',
          onPress: () => handleShareAsComposedEmail(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };
  
  const handleShareAsComposedEmail = async () => {
    if (!invoice) return;
    const client = getClient(invoice.clientId);
    const invoiceNumber = invoice.invoiceNumber || invoice.number || invoice.id?.slice(0, 8);
    
    setIsDownloadingPdf(true);
    try {
      // Enable online payment and get payment token
      const authToken = await api.getToken();
      const tokenResponse = await fetch(`${API_URL}/api/invoices/${invoice.id}/online-payment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ allowOnlinePayment: true }),
      });
      
      if (!tokenResponse.ok) {
        throw new Error('Failed to generate payment link');
      }
      
      const updatedInvoice = await tokenResponse.json();
      const paymentToken = updatedInvoice.paymentToken;
      
      if (!paymentToken) {
        throw new Error('No payment token generated');
      }
      
      // Build the public URL
      const baseUrl = API_URL.replace('/api', '').replace(':5000', '');
      const publicUrl = `${baseUrl}/pay/${paymentToken}`;
      
      // Compose email with payment link
      const businessName = businessSettings?.businessName || user?.name || 'Your tradie';
      const total = formatCurrency(invoice.total);
      const dueDate = invoice.dueDate ? formatDate(new Date(invoice.dueDate).toISOString()) : 'Upon receipt';
      const subject = `Invoice ${invoiceNumber} from ${businessName}`;
      const body = `Hi ${client?.name || 'there'},

Please find your invoice details below.

Invoice Number: ${invoiceNumber}
Amount Due: ${total}
Due Date: ${dueDate}

View and pay your invoice online:
${publicUrl}

Thank you for your business!

${businessName}`;
      
      const emailUrl = `mailto:${client?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      const canOpen = await Linking.canOpenURL(emailUrl);
      if (canOpen) {
        await Linking.openURL(emailUrl);
        
        // Ask if they want to mark as sent
        Alert.alert(
          'Did you send the invoice?',
          'Would you like to mark this invoice as sent?',
          [
            { text: 'Not Yet', style: 'cancel' },
            { 
              text: 'Mark as Sent', 
              onPress: async () => {
                await updateInvoiceStatus(id!, 'sent');
                await loadData();
              }
            },
          ]
        );
      } else {
        // Fallback: copy link to clipboard
        const Clipboard = await import('expo-clipboard');
        await Clipboard.setStringAsync(publicUrl);
        showToast({ type: 'info', message: 'Email Not Available', description: `Payment link copied to clipboard:\n${publicUrl}` });
      }
    } catch (error: any) {
      if (__DEV__) console.log('Error composing email:', error);
      showToast({ type: 'error', message: 'Failed to compose email. Please try again.' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };
  
  const handleShareAsImage = async () => {
    if (!invoice) return;
    const client = getClient(invoice.clientId);
    const invoiceNumber = invoice.invoiceNumber || invoice.id?.slice(0, 8);
    
    setIsDownloadingPdf(true);
    try {
      const authToken = await api.getToken();
      const response = await fetch(`${API_URL}/api/invoices/${invoice.id}/image`, {
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
      
      const imageUri = FileSystem.cacheDirectory + `invoice-${invoiceNumber}.png`;
      await FileSystem.writeAsStringAsync(imageUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(imageUri, {
          mimeType: 'image/png',
          dialogTitle: `Share Invoice ${invoiceNumber}`,
          UTI: 'public.png',
        });
        
        Alert.alert(
          'Did you send the invoice?',
          'Would you like to mark this invoice as sent?',
          [
            { text: 'Not Yet', style: 'cancel' },
            { 
              text: 'Mark as Sent', 
              onPress: async () => {
                await updateInvoiceStatus(id!, 'sent');
                await loadData();
              }
            },
          ]
        );
      } else {
        showToast({ type: 'info', message: 'Sharing Not Available', description: 'Sharing is not available on this device.' });
      }
    } catch (error: any) {
      if (__DEV__) console.log('Error sharing as image:', error);
      showToast({ type: 'error', message: 'Failed to generate image. Try sharing as PDF instead.' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };
  
  const handleShareAsPdf = async () => {
    if (!invoice) return;
    const client = getClient(invoice.clientId);
    
    // Show loading while we prepare the PDF
    setIsDownloadingPdf(true);
    
    try {
      // Download the PDF first so we can share it
      const pdfUri = await downloadPdfToCache();
      
      if (!pdfUri) {
        throw new Error('Failed to generate PDF');
      }
      
      // Check if sharing is available
      const canShare = await Sharing.isAvailableAsync();
      
      if (canShare) {
        // Use share sheet which allows user to select email app AND attaches the PDF
        const invoiceNumber = invoice.invoiceNumber || invoice.id?.slice(0, 8);
        
        // Note: Share sheet will pass the PDF - user types their own message in their email app
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Invoice ${invoiceNumber} to ${client?.name || 'client'}`,
          UTI: 'com.adobe.pdf',
        });
        
        // After sharing, ask if they want to mark as sent
        Alert.alert(
          'Did you send the invoice?',
          'Would you like to mark this invoice as sent?',
          [
            { text: 'Not Yet', style: 'cancel' },
            { 
              text: 'Mark as Sent', 
              onPress: async () => {
                await updateInvoiceStatus(id!, 'sent');
                await loadData();
              }
            },
          ]
        );
      } else {
        showToast({ type: 'info', message: 'Sharing Not Available', description: 'Please use "JobRunner" option to send with PDF attached.' });
      }
    } catch (error: any) {
      if (__DEV__) console.log('Error preparing PDF:', error);
      showToast({ type: 'error', message: error.message || 'Failed to prepare PDF. Please try "JobRunner" option instead.' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };
  
  const handleSendViaJobRunner = async () => {
    if (!invoice || isSendingInvoice) return;
    
    const client = getClient(invoice.clientId);
    const recipientEmail = client?.email;
    
    if (!recipientEmail) {
      showToast({ type: 'info', message: 'No Email Address', description: 'This client does not have an email address on file.' });
      return;
    }
    
    setIsSendingInvoice(true);
    try {
      const authToken = await api.getToken();
      const response = await fetch(`${API_URL}/api/invoices/${id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ email: recipientEmail }),
      });

      if (response.ok) {
        await loadData();
        showToast({ type: 'info', message: 'Invoice Sent!', description: `Email sent to ${recipientEmail} with PDF attached.\n\nView it in Communications Hub to see the full email, PDF preview and delivery status.` });
      } else {
        const error = await response.json();
        showToast({ type: 'error', message: error.error || 'Failed to send invoice' });
      }
    } catch (error) {
      if (__DEV__) console.log('Error sending invoice:', error);
      showToast({ type: 'error', message: 'Failed to send invoice. Please try again.' });
    } finally {
      setIsSendingInvoice(false);
    }
  };

  const handleEmailSend = async (subject: string, message: string) => {
    const authToken = await api.getToken();
    
    try {
      // Use the email-with-pdf endpoint (same as web app) which attaches PDF automatically
      const response = await fetch(`${API_URL}/api/invoices/${id}/email-with-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          customSubject: subject,
          customMessage: message,
        }),
      });

      let result;
      try {
        result = await response.json();
      } catch {
        result = { message: 'Server error - please try again' };
      }

      if (!response.ok) {
        // Show tradie-friendly error message from backend
        showToast({ type: 'info', message: result.title || "Couldn't send email", description: result.fix || result.message || "Please try again or use your email app instead." });
        return;
      }

      // Handle automatic mode (SendGrid) - email already sent
      if (result.sent) {
        await loadData();
        setShowEmailCompose(false);
        showToast({ type: 'info', message: 'Invoice Sent!', description: `Email sent to ${result.recipientEmail} with PDF attached.\n\nView it in Communications Hub to see the full email and delivery status.` });
        return;
      }

      // Handle manual mode (Gmail draft) - open the draft URL
      if (result.draftUrl) {
        await loadData();
        setShowEmailCompose(false);
        
        // Open Gmail draft in browser
        const canOpen = await Linking.canOpenURL(result.draftUrl);
        if (canOpen) {
          await Linking.openURL(result.draftUrl);
          showToast({ type: 'info', message: 'Gmail Draft Created!', description: 'PDF attached automatically. Review and click Send in Gmail.' });
        } else {
          showToast({ type: 'info', message: 'Draft Created', description: 'Your email draft has been created. Open Gmail to review and send.' });
        }
        return;
      }

      // Fallback - status updated successfully even if email mechanism unclear
      await loadData();
      setShowEmailCompose(false);
      showToast({ type: 'info', message: 'Invoice Updated', description: 'Invoice has been processed.' });

    } catch (networkError) {
      if (__DEV__) console.log('Network error sending invoice:', networkError);
      throw new Error('Unable to send invoice. Please check your connection and try again.');
    }
  };

  const toggleOnlinePayment = async () => {
    if (!invoice || isTogglingPayment) return;
    
    const authToken = await api.getToken();
    const previousValue = invoice.allowOnlinePayment;
    const newValue = !previousValue;
    
    setInvoice((prev: any) => prev ? { ...prev, allowOnlinePayment: newValue } : prev);
    setIsTogglingPayment(true);
    
    try {
      const response = await fetch(`${API_URL}/api/invoices/${id}/online-payment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          allowOnlinePayment: newValue,
        }),
      });

      if (response.ok) {
        await loadData();
        showToast({ type: 'success', message: newValue 
            ? 'Online payment enabled - clients can pay with card' 
            : 'Online payment disabled for this invoice' });
      } else {
        setInvoice((prev: any) => prev ? { ...prev, allowOnlinePayment: previousValue } : prev);
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Failed to update payment settings';
        showToast({ type: 'error', message: errorMessage });
      }
    } catch (error) {
      setInvoice((prev: any) => prev ? { ...prev, allowOnlinePayment: previousValue } : prev);
      showToast({ type: 'error', message: 'Failed to update payment settings' });
    } finally {
      setIsTogglingPayment(false);
    }
  };

  const handleMarkPaid = () => {
    setShowPaymentMethodModal(true);
  };

  const handleRecordPayment = async () => {
    if (!invoice || isRecordingPayment) return;
    
    setIsRecordingPayment(true);
    try {
      const authToken = await api.getToken();
      const response = await fetch(`${API_URL}/api/invoices/${id}/record-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          amount: Number(invoice.total) || 0,
          paymentMethod: selectedPaymentMethod,
          reference: paymentReference || undefined,
          createReceipt: createReceiptOnPayment,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setShowPaymentMethodModal(false);
        setPaymentReference('');
        setSelectedPaymentMethod('cash');
        setCreateReceiptOnPayment(false);
        await loadData();
        
        const methodLabels: Record<string, string> = {
          cash: 'Cash',
          bank_transfer: 'Bank Transfer',
          cheque: 'Cheque',
          card: 'Card',
          other: 'Other'
        };
        
        if (createReceiptOnPayment && result.receiptId) {
          showToast({ type: 'info', message: 'Payment Recorded', description: `${formatCurrency(invoice.total)} received via ${methodLabels[selectedPaymentMethod]}. Receipt created.` });
        } else {
          Alert.alert(
            'Payment Recorded',
            `${formatCurrency(invoice.total)} received via ${methodLabels[selectedPaymentMethod]}`,
            [
              { 
                text: 'Not Now', 
                style: 'cancel',
              },
              {
                text: 'Generate Receipt',
                onPress: () => router.push(`/more/receipt/new?invoiceId=${id}`),
              },
            ]
          );
        }
      } else {
        const error = await response.json();
        showToast({ type: 'error', message: error.error || 'Failed to record payment' });
      }
    } catch (error) {
      if (__DEV__) console.log('Error recording payment:', error);
      showToast({ type: 'error', message: 'Failed to record payment. Please try again.' });
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const handleRecordOnSitePayment = async () => {
    if (!invoice || isRecordingOnSitePayment) return;
    
    Alert.alert(
      'Record On-Site Payment',
      `Record payment of ${formatCurrency(invoice.total)} received on-site from the client?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Record Payment',
          onPress: async () => {
            setIsRecordingOnSitePayment(true);
            try {
              const authToken = await api.getToken();
              const response = await fetch(`${API_URL}/api/invoices/${id}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                  status: 'paid',
                  paidAt: new Date().toISOString(),
                  amountPaid: invoice.total.toString(),
                  paymentMethod: 'on_site',
                }),
              });

              if (response.ok) {
                await loadData();
                showToast({ type: 'info', message: 'Payment Recorded', description: 'On-site payment has been recorded successfully' });
                maybeRequestReview('invoice_paid_on_site').catch(() => {});
              } else {
                const error = await response.json();
                showToast({ type: 'error', message: 'Error', description: error.error || 'Failed to record payment' });
              }
            } catch (error) {
              if (__DEV__) console.log('Error recording on-site payment:', error);
              showToast({ type: 'error', message: 'Error', description: 'Failed to record payment. Please try again.' });
            } finally {
              setIsRecordingOnSitePayment(false);
            }
          }
        }
      ]
    );
  };

  const handleSendReceipt = async () => {
    if (!invoice) return;
    
    const client = getClient(invoice.clientId);
    
    if (!client?.email && !client?.phone) {
      showToast({ type: 'info', message: 'No Contact Info', description: 'This client does not have an email address or phone number on file. Please add at least one to the client record first.' });
      return;
    }
    
    // Show options for sending
    Alert.alert(
      'Send Receipt',
      `To: ${client?.email || client?.phone || 'client'}`,
      [
        {
          text: 'JobRunner: Send Now',
          onPress: async () => {
            await handleSendReceiptViaJobRunner();
          },
        },
        {
          text: 'JobRunner: Edit Message',
          onPress: () => setShowReceiptEmailCompose(true),
        },
        {
          text: 'Send SMS',
          onPress: () => {
            setReceiptSendModalDefaultTab('sms');
            setShowReceiptSendModal(true);
          },
        },
        {
          text: 'Email & SMS',
          onPress: () => {
            setReceiptSendModalDefaultTab('email');
            setShowReceiptSendModal(true);
          },
        },
        {
          text: 'Manual: Share',
          onPress: () => showReceiptManualShareOptions(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };
  
  const downloadReceiptPdfToCache = useCallback(async (): Promise<string | null> => {
    if (!linkedReceipt) return null;
    
    const PDF_TIMEOUT_MS = 60000;
    
    const authToken = await api.getToken();
    if (!authToken) {
      throw new Error('Not authenticated. Please log in again.');
    }
    
    const receiptNumber = linkedReceipt.receiptNumber || linkedReceipt.id?.slice(0, 8);
    const fileUri = `${FileSystem.cacheDirectory}Receipt-${receiptNumber}_${Date.now()}.pdf`;
    const pdfUrl = `${API_URL}/api/receipts/${linkedReceipt.id}/pdf`;
    
    if (__DEV__) console.log('[PDF] Downloading receipt from:', pdfUrl);
    
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
    
    try {
      const downloadPromise = downloadResumable.downloadAsync();
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            await downloadResumable.pauseAsync();
          } catch (e) {}
          reject(new Error('PDF generation timed out. Please try again.'));
        }, PDF_TIMEOUT_MS);
      });
      
      const downloadResult = await Promise.race([downloadPromise, timeoutPromise]);
      
      if (timeoutId) clearTimeout(timeoutId);
      
      if (!downloadResult) {
        throw new Error('Download failed. Please try again.');
      }
      
      if (downloadResult.status !== 200) {
        throw new Error(`Server error (${downloadResult.status}). Please try again.`);
      }
      
      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      if (!fileInfo.exists || (fileInfo.size !== undefined && fileInfo.size < 100)) {
        throw new Error('PDF file is empty or corrupted. Please try again.');
      }

      return downloadResult.uri;
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      if (__DEV__) console.log('[PDF] Receipt download error:', error);
      throw error;
    }
  }, [linkedReceipt]);
  
  const showReceiptManualShareOptions = () => {
    if (!invoice || !linkedReceipt) return;
    
    Alert.alert(
      'Share Format',
      'How would you like to share this receipt?',
      [
        {
          text: 'PDF Attachment',
          onPress: () => handleShareReceiptAsPdf(),
        },
        {
          text: 'Composed Email',
          onPress: () => handleShareReceiptAsComposedEmail(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };
  
  const handleShareReceiptAsComposedEmail = async () => {
    if (!invoice || !linkedReceipt || isSendingReceipt) return;
    const client = getClient(invoice.clientId);
    const receiptNumber = linkedReceipt.receiptNumber || linkedReceipt.id?.slice(0, 8);
    
    setIsSendingReceipt(true);
    try {
      const businessName = businessSettings?.businessName || user?.name || 'Your tradie';
      const amount = formatCurrency(linkedReceipt.amount);
      const paidDate = linkedReceipt.paidAt ? formatDate(new Date(linkedReceipt.paidAt).toISOString()) : formatDate(new Date().toISOString());
      const invoiceNumber = invoice.invoiceNumber || invoice.number || invoice.id?.slice(0, 8);
      
      const subject = `Payment Receipt ${receiptNumber} from ${businessName}`;
      const body = `Hi ${client?.name || 'there'},

Thank you for your payment! Here are your receipt details:

Receipt Number: ${receiptNumber}
Invoice: ${invoiceNumber}
Amount Paid: ${amount}
Date: ${paidDate}

Thank you for your business!

${businessName}`;
      
      const emailUrl = `mailto:${client?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      const canOpen = await Linking.canOpenURL(emailUrl);
      if (canOpen) {
        await Linking.openURL(emailUrl);
      } else {
        showToast({ type: 'info', message: 'Email Not Available', description: 'Unable to open email app. Please send manually.' });
      }
    } catch (error: any) {
      if (__DEV__) console.log('Error composing receipt email:', error);
      showToast({ type: 'error', message: 'Failed to compose email. Please try again.' });
    } finally {
      setIsSendingReceipt(false);
    }
  };
  
  const handleShareReceiptAsImage = async () => {
    if (!invoice || !linkedReceipt || isSendingReceipt) return;
    const client = getClient(invoice.clientId);
    const receiptNumber = linkedReceipt.receiptNumber || linkedReceipt.id?.slice(0, 8);
    
    setIsSendingReceipt(true);
    try {
      const authToken = await api.getToken();
      const response = await fetch(`${API_URL}/api/receipts/${linkedReceipt.id}/image`, {
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
        showToast({ type: 'info', message: 'Sharing Not Available', description: 'Sharing is not available on this device.' });
      }
    } catch (error: any) {
      if (__DEV__) console.log('Error sharing receipt as image:', error);
      showToast({ type: 'error', message: 'Failed to generate image. Try sharing as PDF instead.' });
    } finally {
      setIsSendingReceipt(false);
    }
  };
  
  const handleShareReceiptAsPdf = async () => {
    if (!invoice || isSendingReceipt) return;
    
    const client = getClient(invoice.clientId);
    
    if (!linkedReceipt) {
      showToast({ type: 'info', message: 'No Receipt', description: 'No receipt found for this invoice. Please generate a receipt first.' });
      return;
    }
    
    setIsSendingReceipt(true);
    try {
      const uri = await downloadReceiptPdfToCache();
      if (!uri) {
        throw new Error('Failed to generate PDF');
      }
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        const receiptNumber = linkedReceipt.receiptNumber || linkedReceipt.id?.slice(0, 8);
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Receipt ${receiptNumber} to ${client?.name || 'client'}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        showToast({ type: 'info', message: 'Sharing Not Available', description: 'Please use "JobRunner" to send with PDF attached.' });
      }
    } catch (error: any) {
      if (__DEV__) console.log('Share receipt PDF error:', error);
      const message = error?.message || 'Failed to share PDF. Please try again.';
      showToast({ type: 'error', message: message });
    } finally {
      setIsSendingReceipt(false);
    }
  };
  
  const handleSendReceiptViaJobRunner = async () => {
    if (!invoice || isSendingReceipt) return;
    
    const client = getClient(invoice.clientId);
    const recipientEmail = client?.email;
    
    if (!recipientEmail) {
      showToast({ type: 'info', message: 'No Email Address', description: 'This client does not have an email address on file.' });
      return;
    }
    
    setIsSendingReceipt(true);
    try {
      const authToken = await api.getToken();
      const response = await fetch(`${API_URL}/api/invoices/${id}/send-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ email: recipientEmail }),
      });

      if (response.ok) {
        showToast({ type: 'info', message: 'Receipt Sent!', description: `Email sent to ${recipientEmail} with PDF attached.\n\nView it in Communications Hub to see the full email and delivery status.` });
      } else {
        const error = await response.json();
        showToast({ type: 'error', message: error.error || 'Failed to send receipt' });
      }
    } catch (error) {
      if (__DEV__) console.log('Error sending receipt:', error);
      showToast({ type: 'error', message: 'Failed to send receipt. Please try again.' });
    } finally {
      setIsSendingReceipt(false);
    }
  };
  
  const handleSendReceiptWithCustomMessage = async (customSubject: string, customMessage: string) => {
    if (!invoice) {
      throw new Error('Missing invoice information.');
    }
    
    const client = getClient(invoice.clientId);
    
    if (!client?.email) {
      throw new Error('Missing client email information.');
    }
    
    try {
      const authToken = await api.getToken();
      const response = await fetch(`${API_URL}/api/invoices/${id}/send-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          email: client.email,
          customSubject,
          customMessage,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send receipt');
      }
      
      // Refresh data to show updated status
      loadData();
      setShowReceiptEmailCompose(false);
      showToast({ type: 'info', message: 'Receipt Sent!', description: `Email sent to ${client.email} with PDF attached.` });
    } catch (error: any) {
      console.error('Error sending receipt email:', error);
      const message = error?.message || 'Failed to send receipt email';
      // Throw error so EmailComposeModal shows it and stays open for retry
      throw new Error(message);
    }
  };

  const generatePaymentLink = async () => {
    if (!invoice || isGeneratingPaymentLink) return;
    
    const authToken = await api.getToken();
    setIsGeneratingPaymentLink(true);
    try {
      const response = await fetch(`${API_URL}/api/invoices/${id}/generate-payment-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        await loadData();
        showToast({ type: 'success', message: 'Payment link generated successfully' });
        return data.paymentUrl;
      } else {
        const error = await response.json();
        showToast({ type: 'error', message: error.error || 'Failed to generate payment link' });
      }
    } catch (error) {
      if (__DEV__) console.log('Error generating payment link:', error);
      showToast({ type: 'error', message: 'Failed to generate payment link. Please try again.' });
    } finally {
      setIsGeneratingPaymentLink(false);
    }
    return null;
  };

  const getPaymentLinkUrl = () => {
    // Prefer Stripe payment link, fall back to internal payment page
    if (invoice?.stripePaymentLink) {
      return invoice.stripePaymentLink;
    }
    if (invoice?.paymentToken) {
      const baseUrl = API_URL.replace(/\/api.*$/, '');
      return `${baseUrl}/pay/${invoice.paymentToken}`;
    }
    return null;
  };

  const sharePaymentLink = async () => {
    let paymentUrl = getPaymentLinkUrl();
    
    // If no payment link exists, generate one first
    if (!paymentUrl) {
      const generatedUrl = await generatePaymentLink();
      if (!generatedUrl) {
        // generatePaymentLink already shows an error alert
        return;
      }
      paymentUrl = generatedUrl;
    }
    
    try {
      await Share.share({
        message: `Pay Invoice ${invoice.invoiceNumber}: ${paymentUrl}`,
        url: paymentUrl,
        title: `Invoice ${invoice.invoiceNumber} Payment Link`,
      });
    } catch (error) {
      if (__DEV__) console.log('Error sharing payment link:', error);
      showToast({ type: 'error', message: 'Failed to share link' });
    }
  };

  const copyPaymentLinkToClipboard = async () => {
    const paymentUrl = getPaymentLinkUrl();
    if (!paymentUrl) {
      showToast({ type: 'error', message: 'No payment link available. Please generate one first.' });
      return;
    }
    
    try {
      await Share.share({
        message: paymentUrl,
        title: 'Payment Link',
      });
    } catch (error) {
      showToast({ type: 'info', message: 'Share Payment Link', description: paymentUrl });
    }
  };

  const handleEmailPaymentLink = async () => {
    if (!invoice || !client?.email || isSendingPaymentLinkEmail) return;
    
    const paymentUrl = getPaymentLinkUrl();
    if (!paymentUrl) {
      showToast({ type: 'info', message: 'No Payment Link', description: 'Please generate a payment link first before emailing it.' });
      return;
    }
    
    setIsSendingPaymentLinkEmail(true);
    try {
      const response = await api.post<{ message?: string }>(`/api/invoices/${id}/send-payment-link`);
      
      if (response.error) {
        showToast({ type: 'error', message: response.error });
      } else {
        const message = response.data?.message || `Payment link emailed to ${client.email}`;
        showToast({ type: 'info', message: 'Payment Link Sent', description: message });
      }
    } catch (error) {
      if (__DEV__) console.log('Error sending payment link email:', error);
      showToast({ type: 'error', message: 'Failed to send payment link. Please try again.' });
    } finally {
      setIsSendingPaymentLinkEmail(false);
    }
  };

  const handleSaveMilestones = async () => {
    if (!invoice || isSavingMilestones) return;
    
    setIsSavingMilestones(true);
    try {
      let milestones: { label: string; percent: number; status?: string }[];
      if (milestonePreset === 'custom') {
        milestones = customMilestones.filter(m => m.label.trim() && m.percent > 0);
      } else {
        milestones = PRESET_MAP[milestonePreset] || [];
      }
      const retPct = retentionPercentStr ? parseFloat(retentionPercentStr) : undefined;
      
      const authToken = await api.getToken();
      const response = await fetch(`${API_URL}/api/invoices/${invoice.id}/milestones`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          milestones: milestones.length > 0 ? milestones : undefined,
          retentionPercent: retPct,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update milestones');
      }
      
      setShowMilestonesModal(false);
      await loadData();
      showToast({ type: 'success', message: 'Payment milestones and retention settings saved.' });
    } catch (error: any) {
      if (__DEV__) console.log('Error saving milestones:', error);
      showToast({ type: 'error', message: error.message || 'Failed to save milestones' });
    } finally {
      setIsSavingMilestones(false);
    }
  };

  const addCustomMilestone = () => {
    setCustomMilestones(prev => [...prev, { label: '', percent: 0, status: 'pending' }]);
  };

  const updateCustomMilestone = (index: number, field: string, value: string | number) => {
    setCustomMilestones(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeCustomMilestone = (index: number) => {
    setCustomMilestones(prev => prev.filter((_, i) => i !== index));
  };

  const customMilestoneTotalPercent = useMemo(() => {
    return customMilestones.reduce((sum, m) => sum + (m.percent || 0), 0);
  }, [customMilestones]);

  const handleCollectPayment = () => {
    router.push(`/more/collect-payment?invoiceId=${id}`);
  };

  const downloadPdfToCache = useCallback(async (): Promise<string | null> => {
    if (!invoice) return null;
    
    // REQUIRED FIX: 15 second timeout as per requirements
    const PDF_TIMEOUT_MS = 15000; 
    
    const authToken = await api.getToken();
    if (!authToken) {
      throw new Error('Not authenticated. Please log in again.');
    }
    
    const fileUri = `${FileSystem.cacheDirectory}${invoice.invoiceNumber || 'invoice'}_${Date.now()}.pdf`;
    
    // Build PDF URL with query parameters for photo and notes options
    const params = new URLSearchParams();
    if (includeBeforePhotos) params.set('includeBeforePhotos', 'true');
    if (includeAfterPhotos) params.set('includeAfterPhotos', 'true');
    if (!includeNotes) params.set('excludeNotes', 'true');
    const queryString = params.toString();
    const pdfUrl = `${API_URL}/api/invoices/${id}/pdf${queryString ? `?${queryString}` : ''}`;
    
    if (__DEV__) console.log('[PDF] Downloading from:', pdfUrl);
    
    // Use createDownloadResumable for cancellation support
    const downloadResumable = FileSystem.createDownloadResumable(
      pdfUrl,
      fileUri,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Accept': 'application/pdf',
        },
      }
    );
    
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    try {
      const downloadPromise = downloadResumable.downloadAsync();
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            await downloadResumable.pauseAsync();
          } catch (e) {
            // Ignore pause errors
          }
          reject(new Error('PDF download timed out (15s limit). Please check your connection and try again.'));
        }, PDF_TIMEOUT_MS);
      });
      
      const downloadResult = await Promise.race([downloadPromise, timeoutPromise]);
      
      if (timeoutId) clearTimeout(timeoutId);
      
      if (!downloadResult) {
        throw new Error('Download failed: No response from server.');
      }
      
      if (__DEV__) console.log('[PDF] Download result status:', downloadResult.status);

      if (downloadResult.status === 401) {
        throw new Error('Session expired. Please log in again.');
      }
      
      if (downloadResult.status === 403) {
        throw new Error('You do not have permission to download this invoice.');
      }

      if (downloadResult.status === 404) {
        throw new Error('Invoice not found. It may have been deleted.');
      }
      
      if (downloadResult.status !== 200) {
        throw new Error(`Server returned error ${downloadResult.status}. Please try again later.`);
      }
      
      // Verify the file was downloaded and has content
      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      if (!fileInfo.exists || (fileInfo.size !== undefined && fileInfo.size < 100)) {
        throw new Error('Downloaded PDF is invalid or too small. Please try again.');
      }

      return downloadResult.uri;
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);
      
      // Handle network errors gracefully
      if (error.message?.includes('Network request failed') || error.message?.includes('Network Error')) {
        throw new Error('Network error: Please check your internet connection and try again.');
      }

      if (__DEV__) console.log('[PDF] Download error details:', error);
      throw error;
    }
  }, [invoice, id, includeBeforePhotos, includeAfterPhotos, includeNotes]);

  const handleDownloadPdf = async () => {
    if (!invoice || isDownloadingPdf) return;
    
    setIsDownloadingPdf(true);
    try {
      const uri = await downloadPdfToCache();
      if (!uri) {
        throw new Error('Failed to generate PDF');
      }
      
      // Directly open native share sheet (like receipts) for reliable saving
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Save Invoice ${invoice?.invoiceNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        // Fallback: Copy to document directory
        const fileName = `${invoice?.invoiceNumber || 'invoice'}.pdf`;
        const destUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: uri, to: destUri });
        showToast({ type: 'success', message: `PDF saved to app documents: ${fileName}` });
      }
    } catch (error: any) {
      if (__DEV__) console.log('PDF download error:', error);
      const message = error?.message || 'Failed to download PDF. Please try again.';
      showToast({ type: 'info', message: 'PDF Download', description: message });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSharePdf = async () => {
    setShowShareSheet(false);
    setIsDownloadingPdf(true);
    
    try {
      const uri = pdfUri || await downloadPdfToCache();
      if (!uri) {
        throw new Error('Failed to generate PDF');
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Invoice ${invoice?.invoiceNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        showToast({ type: 'info', message: 'Sharing Not Available', description: 'Sharing is not available on this device. Try saving to device instead.' });
      }
    } catch (error: any) {
      if (__DEV__) console.log('Share PDF error:', error);
      const errorMessage = error?.message || 'Failed to share PDF.';
      Alert.alert(
        'PDF Share Failed',
        errorMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Again', onPress: () => handleSharePdf() },
        ]
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSaveToDevice = async () => {
    setShowShareSheet(false);
    setIsDownloadingPdf(true);
    
    try {
      const uri = pdfUri || await downloadPdfToCache();
      if (!uri) {
        throw new Error('Failed to generate PDF');
      }

      // Use native share sheet which includes "Save to Files" on iOS and "Save to Downloads" on Android
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Save Invoice ${invoice?.invoiceNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        // Fallback: Copy to document directory
        const fileName = `${invoice?.invoiceNumber || 'invoice'}.pdf`;
        const destUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: uri, to: destUri });
        showToast({ type: 'success', message: `PDF saved to app documents: ${fileName}` });
      }
    } catch (error: any) {
      if (__DEV__) console.log('Save to device error:', error);
      const errorMessage = error?.message || 'Failed to save PDF.';
      Alert.alert(
        'Save Failed',
        errorMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Again', onPress: () => handleSaveToDevice() },
        ]
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleEmailInvoice = () => {
    setShowShareSheet(false);
    setShowEmailCompose(true);
  };

  const handleCopyPaymentLink = async () => {
    const paymentUrl = getPaymentLinkUrl();
    if (!paymentUrl) {
      showToast({ type: 'info', message: 'No Payment Link', description: 'Generate a payment link first to share it.' });
      return;
    }
    
    setShowShareSheet(false);
    try {
      await Share.share({
        message: paymentUrl,
        title: 'Payment Link',
      });
    } catch (error) {
      showToast({ type: 'info', message: 'Share Payment Link', description: paymentUrl });
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
        <Stack.Screen options={{ title: 'Invoice' }} />
        <ScrollView style={styles.container}>
          <View style={styles.content}>
            <View style={styles.headerCard}>
              <View style={styles.headerTop}>
                <SkeletonBox width={120} height={20} />
                <SkeletonBox width={60} height={24} style={{ borderRadius: 12 }} />
              </View>
              <SkeletonBox width={180} height={40} style={{ marginTop: 12 }} />
              <SkeletonBox width={100} height={16} style={{ marginTop: 8 }} />
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ flex: 1 }}>
                  <SkeletonBox width={60} height={12} />
                  <SkeletonBox width="100%" height={16} style={{ marginTop: 4 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <SkeletonBox width={60} height={12} />
                  <SkeletonBox width="100%" height={16} style={{ marginTop: 4 }} />
                </View>
              </View>
            </View>
            <View style={styles.quickActions}>
              {[1, 2, 3, 4].map((i) => (
                <SkeletonBox key={i} width={80} height={48} style={{ flex: 1, borderRadius: 10 }} />
              ))}
            </View>
            <SkeletonBox width={100} height={14} style={{ marginBottom: 8, marginTop: 16 }} />
            <View style={styles.card}>
              <SkeletonBox width="100%" height={60} />
            </View>
            <SkeletonBox width={80} height={14} style={{ marginBottom: 8 }} />
            <View style={styles.card}>
              <SkeletonBox width="100%" height={80} />
            </View>
          </View>
        </ScrollView>
      </>
    );
  }

  if (!invoice) {
    return (
      <>
        <Stack.Screen options={{ title: 'Invoice' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Invoice not found</Text>
        </View>
      </>
    );
  }

  const client = getClient(invoice.clientId);
  const status = STATUS_CONFIG[invoice.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
  const amountDue = invoice.total - (invoice.amountPaid || 0);
  const lineItems = invoice.lineItems || [];

  const previewDocument = {
    id: invoice.id,
    number: invoice.invoiceNumber,
    status: invoice.status,
    clientName: client?.name || 'Unknown Client',
    clientEmail: client?.email,
    clientPhone: client?.phone,
    clientAddress: client?.address,
    subtotal: invoice.subtotal,
    gstAmount: invoice.gstAmount,
    total: invoice.total,
    notes: invoice.notes,
    createdAt: invoice.createdAt,
    dueDate: invoice.dueDate,
    lineItems: lineItems.map((item: any, index: number) => ({
      id: item.id || `item-${index}`,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    })),
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: invoice.invoiceNumber || 'Invoice',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button
                size="icon"
                variant="ghost"
                onPress={handleDownloadPdf}
                disabled={isDownloadingPdf}
                icon={<Feather name="file-text" size={22} color={colors.primary} />}
              >{null}</Button>
              <TouchableOpacity 
                onPress={handleDeleteInvoice}
                style={styles.headerButton}
                disabled={isDeleting}
                data-testid="button-delete-invoice"
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={colors.destructive} />
                ) : (
                  <Feather name="trash-2" size={22} color={colors.destructive} />
                )}
              </TouchableOpacity>
            </View>
          )
        }} 
      />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          {/* Summary Card */}
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
            </View>
            <Text style={styles.totalAmount}>{formatCurrency(invoice.total)}</Text>
            <Text style={styles.totalLabel}>Total (inc. GST)</Text>
            
            {invoice.status !== 'paid' && amountDue > 0 && (
              <View style={styles.dueContainer}>
                <Text style={styles.dueLabel}>Amount Due:</Text>
                <Text style={styles.dueAmount}>{formatCurrency(amountDue)}</Text>
              </View>
            )}
            
            <View style={styles.summaryDetailsRow}>
              <View style={styles.summaryDetailItem}>
                <Feather name="user" size={14} color={colors.mutedForeground} />
                <View>
                  <Text style={styles.summaryDetailLabel}>Client</Text>
                  <Text style={styles.summaryDetailValue} numberOfLines={1}>{client?.name || 'Unknown'}</Text>
                </View>
              </View>
              <View style={styles.summaryDetailItem}>
                <Feather name="calendar" size={14} color={invoice.status === 'overdue' ? colors.destructive : colors.mutedForeground} />
                <View>
                  <Text style={styles.summaryDetailLabel}>Due Date</Text>
                  <Text style={[styles.summaryDetailValue, invoice.status === 'overdue' && { color: colors.destructive }]} numberOfLines={1}>
                    {invoice.dueDate ? formatDate(invoice.dueDate) : 'Not set'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          
          {/* Quick Actions - Primary */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          {/* Primary Actions - Web-like prominent buttons */}
          <View style={styles.primaryActionsRow}>
            {/* Send Email - for draft/sent/overdue */}
            {(invoice.status === 'draft' || invoice.status === 'sent' || invoice.status === 'overdue') && (
              <PressableRow 
                style={[styles.primaryActionButton, { backgroundColor: colors.info }]}
                onPress={handleSend}
                disabled={isSendingInvoice}
              >
                {isSendingInvoice ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Feather name="mail" size={20} color={colors.white} />
                )}
                <Text style={styles.primaryActionText}>
                  {isSendingInvoice ? 'Sending...' : 'Send Email'}
                </Text>
              </PressableRow>
            )}
            
            {/* Payment Link - for sent/overdue */}
            {(invoice.status === 'sent' || invoice.status === 'overdue') && (
              <PressableRow 
                style={[styles.primaryActionButton, { backgroundColor: colors.success }]}
                onPress={sharePaymentLink}
                disabled={isGeneratingPaymentLink}
              >
                {isGeneratingPaymentLink ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Feather name="link" size={20} color={colors.white} />
                )}
                <Text style={styles.primaryActionText}>Payment Link</Text>
              </PressableRow>
            )}
            
            {/* Record Payment - for sent/overdue */}
            {(invoice.status === 'sent' || invoice.status === 'overdue') && (
              <PressableRow 
                style={[styles.primaryActionButton, { backgroundColor: colors.warning }]}
                onPress={handleMarkPaid}
              >
                <Feather name="dollar-sign" size={20} color={colors.warningForeground} />
                <Text style={[styles.primaryActionText, { color: colors.warningForeground }]}>Record Paid</Text>
              </PressableRow>
            )}

            {/* Paid invoice actions */}
            {isPaid && (
              <>
                {/* Send Receipt - for paid invoices */}
                <PressableRow 
                  style={[styles.primaryActionButton, { backgroundColor: colors.info }]}
                  onPress={handleSendReceipt}
                  disabled={isSendingReceipt || !client?.email}
                >
                  {isSendingReceipt ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Feather name="mail" size={20} color={colors.white} />
                  )}
                  <Text style={styles.primaryActionText}>
                    {isSendingReceipt ? 'Sending...' : 'Send Receipt'}
                  </Text>
                </PressableRow>

                {/* View Receipt - for paid invoices with linked receipt */}
                {linkedReceipt && (
                  <PressableRow 
                    style={[styles.primaryActionButton, { backgroundColor: colors.success }]}
                    onPress={() => router.push(`/more/receipt/${linkedReceipt.id}`)}
                  >
                    <Feather name="file-text" size={20} color={colors.white} />
                    <Text style={styles.primaryActionText}>View Receipt</Text>
                  </PressableRow>
                )}

                {/* Create Receipt - for paid invoices without linked receipt */}
                {!linkedReceipt && (
                  <PressableRow 
                    style={[styles.primaryActionButton, { backgroundColor: colors.success }]}
                    onPress={() => router.push(`/more/receipt/new?invoiceId=${id}`)}
                  >
                    <Feather name="plus" size={20} color={colors.white} />
                    <Text style={styles.primaryActionText}>Create Receipt</Text>
                  </PressableRow>
                )}
              </>
            )}
          </View>

          {/* Secondary Quick Actions */}
          <View style={styles.quickActions}>
            <PressableRow 
              style={styles.quickAction}
              onPress={handleDownloadPdf}
              disabled={isDownloadingPdf}
            >
              {isDownloadingPdf ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="file-text" size={20} color={colors.primary} />
              )}
              <Text style={styles.quickActionText}>{isDownloadingPdf ? 'Generating...' : 'PDF'}</Text>
            </PressableRow>
            {/* Only show Template for non-paid invoices - receipt viewing is in primary actions */}
            {!isPaid && (
              <PressableRow 
                style={styles.quickAction}
                onPress={() => setShowTemplateSelector(true)}
              >
                <Feather name="layout" size={20} color={colors.primary} />
                <Text style={styles.quickActionText}>Template</Text>
              </PressableRow>
            )}
            {invoice.status === 'draft' && (
              <PressableRow 
                style={styles.quickAction}
                onPress={() => router.push(`/more/invoice/new?editInvoiceId=${id}`)}
              >
                <Feather name="edit-2" size={20} color={colors.primary} />
                <Text style={styles.quickActionText}>Edit</Text>
              </PressableRow>
            )}
            <PressableRow 
              style={styles.quickAction}
              onPress={handleDeleteInvoice}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={colors.destructive} />
              ) : (
                <Feather name="trash-2" size={20} color={colors.destructive} />
              )}
              <Text style={[styles.quickActionText, { color: colors.destructive }]}>Delete</Text>
            </PressableRow>
          </View>

          {/* Payment Options - Only show if not paid - MOVED TO TOP for tradie visibility */}
          {invoice.status !== 'paid' && (
            <>
              <Text style={styles.sectionTitle}>Payment Options</Text>
              <View style={styles.card}>
                {/* Record On-Site Payment Button */}
                <TouchableOpacity 
                  style={styles.onSitePaymentButton}
                  onPress={handleRecordOnSitePayment}
                  disabled={isRecordingOnSitePayment}
                >
                  {isRecordingOnSitePayment ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Feather name="dollar-sign" size={20} color={colors.white} />
                  )}
                  <Text style={styles.onSitePaymentButtonText}>
                    Record On-Site Payment
                  </Text>
                </TouchableOpacity>
                <Text style={styles.onSitePaymentHint}>
                  Use when client pays cash, check, or direct transfer on-site
                </Text>
                
                <View style={styles.paymentDivider} />

                {/* Online Payment Toggle */}
                <View style={styles.paymentToggleRow}>
                  <View style={styles.paymentToggleInfo}>
                    <Feather name="credit-card" size={20} color={colors.primary} />
                    <View style={styles.paymentToggleText}>
                      <Text style={styles.paymentToggleTitle}>Accept Online Payments</Text>
                      <Text style={styles.paymentToggleDesc}>
                        Allow clients to pay with card, Apple Pay, or Google Pay
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={invoice.allowOnlinePayment || false}
                    onValueChange={async () => {
                      const newValue = !invoice.allowOnlinePayment;
                      await toggleOnlinePayment();
                      if (newValue && !invoice.stripePaymentLink && !invoice.paymentToken) {
                        await generatePaymentLink();
                      }
                    }}
                    disabled={isTogglingPayment || isGeneratingPaymentLink}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                  />
                </View>
                
                {/* Payment Link Section */}
                {invoice.allowOnlinePayment && (
                  <>
                    {(invoice.stripePaymentLink || invoice.paymentToken) ? (
                      <View style={styles.paymentLinkSection}>
                        <View style={styles.paymentLinkInfo}>
                          <Feather name="check-circle" size={16} color={colors.success} />
                          <Text style={styles.paymentLinkText}>
                            Payment link active
                          </Text>
                        </View>
                        <View style={styles.paymentLinkActions}>
                          <TouchableOpacity 
                            style={styles.copyLinkButton}
                            onPress={sharePaymentLink}
                          >
                            <Feather name="share-2" size={16} color={colors.primary} />
                            <Text style={styles.copyLinkButtonText}>Share</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.copyLinkButton}
                            onPress={copyPaymentLinkToClipboard}
                          >
                            <Feather name="copy" size={16} color={colors.primary} />
                            <Text style={styles.copyLinkButtonText}>Copy</Text>
                          </TouchableOpacity>
                          {client?.email && (
                            <TouchableOpacity 
                              style={styles.copyLinkButton}
                              onPress={handleEmailPaymentLink}
                              disabled={isSendingPaymentLinkEmail}
                            >
                              {isSendingPaymentLinkEmail ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                              ) : (
                                <Feather name="mail" size={16} color={colors.primary} />
                              )}
                              <Text style={styles.copyLinkButtonText}>Email</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ) : (
                      <View style={styles.paymentLinkSection}>
                        <TouchableOpacity 
                          style={styles.generateLinkButton}
                          onPress={generatePaymentLink}
                          disabled={isGeneratingPaymentLink}
                        >
                          {isGeneratingPaymentLink ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <>
                              <Feather name="link" size={16} color={colors.primary} />
                              <Text style={styles.generateLinkButtonText}>Generate Payment Link</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </View>
            </>
          )}

          {/* Overdue Alert */}
          {invoice.status === 'overdue' && (
            <View style={styles.overdueAlert}>
              <Feather name="alert-circle" size={20} color={colors.destructive} />
              <Text style={styles.overdueText}>This invoice is overdue</Text>
            </View>
          )}

          {/* Document Preview Section - Matches Receipt View Style */}
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <View style={styles.documentPreviewCard}>
            <View style={[styles.documentHeader, { borderBottomColor: brandColor }]}>
              <View style={styles.businessInfo}>
                {businessSettings?.logoUrl && (
                  <Image 
                    source={{ uri: businessSettings.logoUrl }} 
                    style={styles.documentLogo}
                    resizeMode="contain"
                  />
                )}
                <Text style={styles.documentBusinessName}>
                  {businessSettings?.businessName || user?.businessName || 'Your Business Name'}
                </Text>
                {(businessSettings?.abn || user?.abn) && (
                  <Text style={styles.documentBusinessDetail}>ABN: {businessSettings?.abn || user?.abn}</Text>
                )}
              </View>
              
              <View style={styles.documentTitleContainer}>
                <Text style={[styles.documentTitle, { color: isPaid ? colors.success : brandColor }]}>
                  {(businessSettings?.gstEnabled ?? true) && invoice.gstAmount > 0 ? 'TAX INVOICE' : 'INVOICE'}
                </Text>
                <Text style={styles.documentNumber}>{invoice.invoiceNumber}</Text>
              </View>
            </View>

            <View style={styles.documentSection}>
              <View style={styles.documentRow}>
                <View style={styles.documentColumn}>
                  <Text style={styles.documentSectionLabel}>BILL TO</Text>
                  <Text style={styles.documentClientName}>{client?.name || 'Customer'}</Text>
                  {client?.address && <Text style={styles.documentInfoText}>{client.address}</Text>}
                  {client?.email && <Text style={styles.documentInfoText}>{client.email}</Text>}
                  {client?.phone && <Text style={styles.documentInfoText}>{client.phone}</Text>}
                </View>
                
                <View style={styles.documentColumn}>
                  <Text style={styles.documentSectionLabel}>INVOICE DETAILS</Text>
                  <Text style={styles.documentInfoText}>
                    <Text style={styles.documentInfoLabel}>Date: </Text>
                    {formatDate(invoice.createdAt)}
                  </Text>
                  {invoice.dueDate && (
                    <Text style={[styles.documentInfoText, invoice.status === 'overdue' && { color: colors.destructive }]}>
                      <Text style={styles.documentInfoLabel}>Due: </Text>
                      {formatDate(invoice.dueDate)}
                    </Text>
                  )}
                  {invoice.status === 'paid' && invoice.paidAt && (
                    <Text style={[styles.documentInfoText, { color: colors.success }]}>
                      <Text style={styles.documentInfoLabel}>Paid: </Text>
                      {formatDate(invoice.paidAt)}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Line Items Preview */}
            {lineItems.length > 0 && (
              <View style={styles.documentItemsSection}>
                <View style={styles.documentItemsHeader}>
                  <Text style={[styles.documentItemsHeaderText, { flex: 2 }]}>Description</Text>
                  <Text style={[styles.documentItemsHeaderText, { flex: 0.5, textAlign: 'center' }]}>Qty</Text>
                  <Text style={[styles.documentItemsHeaderText, { flex: 1, textAlign: 'right' }]}>Price</Text>
                  <Text style={[styles.documentItemsHeaderText, { flex: 1, textAlign: 'right' }]}>Amount</Text>
                </View>
                {lineItems.slice(0, 5).map((item: any, index: number) => (
                  <View key={item.id || index} style={styles.documentItemRow}>
                    <Text style={[styles.documentItemText, { flex: 2 }]} numberOfLines={1}>{item.description}</Text>
                    <Text style={[styles.documentItemText, { flex: 0.5, textAlign: 'center' }]}>{item.quantity}</Text>
                    <Text style={[styles.documentItemText, { flex: 1, textAlign: 'right' }]}>{formatCurrency(item.unitPrice)}</Text>
                    <Text style={[styles.documentItemText, { flex: 1, textAlign: 'right' }]}>{formatCurrency(item.quantity * item.unitPrice)}</Text>
                  </View>
                ))}
                {lineItems.length > 5 && (
                  <Text style={styles.documentMoreItems}>+{lineItems.length - 5} more items...</Text>
                )}
              </View>
            )}

            <View style={[styles.documentSummary, { borderColor: isPaid ? colors.success : brandColor }]}>
              <View style={styles.documentSummaryHeader}>
                <Text style={[styles.documentSummaryTitle, { color: isPaid ? colors.success : brandColor }]}>
                  {isPaid ? 'Payment Received' : (invoice.status === 'overdue' ? 'Overdue Amount' : 'Amount Due')}
                </Text>
                <View style={[styles.documentStatusBadge, { backgroundColor: status.bg }]}>
                  <Text style={[styles.documentStatusBadgeText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>
              
              {invoice.gstAmount > 0 && (
                <>
                  <View style={styles.documentSummaryRow}>
                    <Text style={styles.documentSummaryLabel}>Subtotal (excl. GST)</Text>
                    <Text style={styles.documentSummaryValue}>{formatCurrency(invoice.subtotal)}</Text>
                  </View>
                  <View style={[styles.documentSummaryRow, styles.documentSummaryDivider]}>
                    <Text style={styles.documentSummaryLabel}>GST (10%)</Text>
                    <Text style={styles.documentSummaryValue}>{formatCurrency(invoice.gstAmount)}</Text>
                  </View>
                </>
              )}
              
              <View style={styles.documentTotalRow}>
                <Text style={styles.documentTotalLabel}>
                  Total {invoice.gstAmount > 0 ? '(incl. GST)' : ''}
                </Text>
                <Text style={[styles.documentTotalValue, isPaid && { color: colors.success }]}>{formatCurrency(invoice.total)}</Text>
              </View>
              
              {invoice.amountPaid > 0 && invoice.amountPaid < invoice.total && (
                <>
                  <View style={styles.documentSummaryRow}>
                    <Text style={[styles.documentSummaryLabel, { color: colors.success }]}>Amount Paid</Text>
                    <Text style={[styles.documentSummaryValue, { color: colors.success }]}>-{formatCurrency(invoice.amountPaid)}</Text>
                  </View>
                  <View style={styles.documentTotalRow}>
                    <Text style={[styles.documentTotalLabel, { color: colors.warning }]}>Balance Due</Text>
                    <Text style={[styles.documentTotalValue, { color: colors.warning }]}>{formatCurrency(amountDue)}</Text>
                  </View>
                </>
              )}
            </View>

            <View style={[styles.documentFooterSection, { backgroundColor: `${brandColor}10` }]}>
              <Text style={[styles.documentFooterText, { color: brandColor }]}>
                Thank you for your business!
              </Text>
              <Text style={styles.documentFooterSubtext}>
                {isPaid 
                  ? 'This invoice has been paid in full.' 
                  : `Payment is due ${invoice.dueDate ? `by ${formatDate(invoice.dueDate)}` : 'upon receipt'}.`}
              </Text>
            </View>
          </View>

          {/* Status History (Parity with Web Timeline) */}
          <Text style={styles.sectionTitle}>Status History</Text>
          <View style={styles.card}>
            <View style={styles.timelineItem}>
              <View style={styles.timelineIndicator}>
                <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                <View style={styles.timelineLine} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Invoice Created</Text>
                <Text style={styles.timelineDate}>{formatDate(invoice.createdAt)}</Text>
              </View>
            </View>
            {invoice.sentAt && (
              <View style={styles.timelineItem}>
                <View style={styles.timelineIndicator}>
                  <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                  <View style={styles.timelineLine} />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Invoice Sent</Text>
                  <Text style={styles.timelineDate}>{formatDate(invoice.sentAt)}</Text>
                </View>
              </View>
            )}
            {invoice.paidAt && (
              <View style={styles.timelineItem}>
                <View style={styles.timelineIndicator}>
                  <View style={[styles.timelineDot, { backgroundColor: colors.success }]} />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Payment Received</Text>
                  <Text style={styles.timelineDate}>{formatDate(invoice.paidAt)}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Client Info */}
          <Text style={styles.sectionTitle}>Client</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Feather name="user" size={18} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.clientName}>{client?.name || 'Unknown Client'}</Text>
              </View>
            </View>
            {client?.email && (
              <View style={styles.infoRow}>
                <Feather name="mail" size={16} color={colors.mutedForeground} />
                <Text style={styles.infoText}>{client.email}</Text>
              </View>
            )}
            {client?.phone && (
              <View style={styles.infoRow}>
                <Feather name="phone" size={16} color={colors.mutedForeground} />
                <Text style={styles.infoText}>{client.phone}</Text>
              </View>
            )}
            {client?.address && (
              <View style={styles.infoRow}>
                <Feather name="map-pin" size={16} color={colors.mutedForeground} />
                <Text style={styles.infoText}>{client.address}</Text>
              </View>
            )}
          </View>

          {/* Dates */}
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Feather name="calendar" size={18} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Created</Text>
                <Text style={styles.infoText}>{formatDate(invoice.createdAt)}</Text>
              </View>
            </View>
            {invoice.dueDate && (
              <View style={styles.infoRow}>
                <Feather name="clock" size={18} color={invoice.status === 'overdue' ? colors.destructive : colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Due Date</Text>
                  <Text style={[styles.infoText, invoice.status === 'overdue' && { color: colors.destructive }]}>
                    {formatDate(invoice.dueDate)}
                  </Text>
                </View>
              </View>
            )}
            {invoice.paidAt && (
              <View style={styles.infoRow}>
                <Feather name="check-circle" size={18} color={colors.success} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Paid</Text>
                  <Text style={styles.infoText}>{formatDate(invoice.paidAt)}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Related Documents */}
          {(linkedQuote || linkedJob || linkedReceipt) && (
            <>
              <Text style={styles.sectionTitle}>Related Documents</Text>
              <View style={styles.card}>
                {linkedQuote && (
                  <TouchableOpacity 
                    style={styles.linkedDocRow}
                    onPress={() => router.push(`/more/quote/${linkedQuote.id}`)}
                  >
                    <View style={[styles.linkedDocIcon, { backgroundColor: colors.infoLight }]}>
                      <Feather name="file" size={18} color={colors.info} />
                    </View>
                    <View style={styles.linkedDocInfo}>
                      <Text style={styles.linkedDocLabel}>Quote</Text>
                      <Text style={styles.linkedDocTitle}>{linkedQuote.quoteNumber || `Quote #${linkedQuote.id.slice(0,6)}`}</Text>
                    </View>
                    <View style={[styles.linkedDocStatus, { backgroundColor: linkedQuote.status === 'accepted' ? colors.successLight : colors.infoLight }]}>
                      <Text style={[styles.linkedDocStatusText, { color: linkedQuote.status === 'accepted' ? colors.success : colors.info }]}>
                        {linkedQuote.status.charAt(0).toUpperCase() + linkedQuote.status.slice(1)}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
                {linkedJob && (
                  <TouchableOpacity 
                    style={[styles.linkedDocRow, linkedQuote && styles.linkedDocRowBorder]}
                    onPress={() => router.push(`/job/${linkedJob.id}`)}
                  >
                    <View style={[styles.linkedDocIcon, { backgroundColor: colors.primaryLight }]}>
                      <Feather name="briefcase" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.linkedDocInfo}>
                      <Text style={styles.linkedDocLabel}>Job</Text>
                      <Text style={styles.linkedDocTitle} numberOfLines={1}>{linkedJob.title}</Text>
                    </View>
                    <View style={[styles.linkedDocStatus, { backgroundColor: linkedJob.status === 'completed' ? colors.successLight : colors.infoLight }]}>
                      <Text style={[styles.linkedDocStatusText, { color: linkedJob.status === 'completed' ? colors.success : colors.info }]}>
                        {linkedJob.status.charAt(0).toUpperCase() + linkedJob.status.slice(1)}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
                {linkedReceipt && (
                  <TouchableOpacity 
                    style={[styles.linkedDocRow, (linkedQuote || linkedJob) && styles.linkedDocRowBorder]}
                    onPress={() => router.push(`/more/receipt/${linkedReceipt.id}`)}
                  >
                    <View style={[styles.linkedDocIcon, { backgroundColor: colors.successLight }]}>
                      <Feather name="check-circle" size={18} color={colors.success} />
                    </View>
                    <View style={styles.linkedDocInfo}>
                      <Text style={styles.linkedDocLabel}>Receipt</Text>
                      <Text style={styles.linkedDocTitle}>{linkedReceipt.receiptNumber || `Receipt #${linkedReceipt.id.slice(0,6)}`}</Text>
                    </View>
                    <View style={[styles.linkedDocStatus, { backgroundColor: colors.successLight }]}>
                      <Text style={[styles.linkedDocStatusText, { color: colors.success }]}>Paid</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {/* Recurring Invoice Section */}
          {(invoice as any).isRecurring && (
            <>
              <Text style={styles.sectionTitle}>Recurring Schedule</Text>
              <View style={[styles.card, styles.recurringCard]}>
                <View style={styles.recurringHeader}>
                  <View style={styles.recurringBadge}>
                    <Feather name="repeat" size={14} color={colors.info} />
                    <Text style={styles.recurringBadgeText}>
                      {invoice.recurrencePattern === 'fortnightly' ? 'Fortnightly' : 
                       invoice.recurrencePattern?.charAt(0).toUpperCase() + invoice.recurrencePattern?.slice(1)}
                    </Text>
                  </View>
                  <Text style={styles.recurringActiveText}>Active</Text>
                </View>
                
                <View style={styles.recurringDetails}>
                  <View style={styles.recurringDetailRow}>
                    <Feather name="calendar" size={16} color={colors.mutedForeground} />
                    <View style={styles.recurringDetailContent}>
                      <Text style={styles.recurringDetailLabel}>Next Invoice</Text>
                      <Text style={styles.recurringDetailValue}>
                        {invoice.nextRecurrenceDate 
                          ? formatDate(invoice.nextRecurrenceDate)
                          : 'Not scheduled'}
                      </Text>
                    </View>
                  </View>
                  
                  {invoice.recurrenceEndDate && (
                    <View style={styles.recurringDetailRow}>
                      <Feather name="flag" size={16} color={colors.mutedForeground} />
                      <View style={styles.recurringDetailContent}>
                        <Text style={styles.recurringDetailLabel}>End Date</Text>
                        <Text style={styles.recurringDetailValue}>
                          {formatDate(invoice.recurrenceEndDate)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.recurringActions}>
                  <TouchableOpacity 
                    style={styles.recurringEditButton}
                    onPress={() => {
                      showToast({ type: 'info', message: 'Edit Schedule', description: 'To change the schedule, stop this recurring invoice and create a new one with your preferred settings.' });
                    }}
                  >
                    <Feather name="edit-2" size={16} color={colors.primary} />
                    <Text style={styles.recurringEditButtonText}>Edit Schedule</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.recurringStopButton}
                    onPress={async () => {
                      const ok = await confirm({ title: 'Stop Recurring', message: 'Are you sure you want to stop this recurring invoice? No more invoices will be automatically generated.', confirmText: 'Stop', cancelText: 'Cancel', destructive: true });
                      if (ok) {
                        try {
                          await api.patch(`/api/invoices/${invoice.id}`, {
                            isRecurring: false,
                            nextRecurrenceDate: null,
                          });
                          await fetchInvoices();
                          showToast({ type: 'success', message: 'Success', description: 'Recurring schedule has been stopped.' });
                        } catch (error) {
                          showToast({ type: 'error', message: 'Error', description: 'Failed to stop recurring invoice.' });
                        }
                      }
                    }}
                  >
                    <Feather name="x-circle" size={16} color={colors.destructive} />
                    <Text style={styles.recurringStopButtonText}>Stop Recurring</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {/* Line Items */}
          <Text style={styles.sectionTitle}>Items ({lineItems.length})</Text>
          {lineItems.length > 0 ? (
            <View style={styles.card}>
              {lineItems.map((item: any, index: number) => (
                <View 
                  key={item.id || index} 
                  style={[styles.lineItem, index > 0 && styles.lineItemBorder]}
                >
                  <View style={styles.lineItemHeader}>
                    <Feather name="package" size={16} color={colors.mutedForeground} />
                    <Text style={styles.lineItemDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  </View>
                  <View style={styles.lineItemDetails}>
                    <Text style={styles.lineItemQty}>
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                    </Text>
                    <Text style={styles.lineItemTotal}>
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyStateIcon}>
                <Feather name="inbox" size={24} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyStateText}>No line items added</Text>
              <Text style={styles.emptyStateSubtext}>Line items will appear here once added to the invoice</Text>
            </View>
          )}

          {/* Amounts */}
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.card}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Subtotal</Text>
              <Text style={styles.amountValue}>{formatCurrency(invoice.subtotal)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>GST (10%)</Text>
              <Text style={styles.amountValue}>{formatCurrency(invoice.gstAmount)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.amountRow}>
              <Text style={styles.totalLabel2}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(invoice.total)}</Text>
            </View>
            {parseFloat(invoice.retentionAmount || '0') > 0 && (
              <View style={styles.amountRow}>
                <Text style={[styles.amountLabel, { color: colors.warning }]}>
                  Retention ({invoice.retentionPercent || '0'}%)
                </Text>
                <Text style={[styles.amountValue, { color: colors.warning }]}>
                  -{formatCurrency(parseFloat(invoice.retentionAmount || '0'))}
                </Text>
              </View>
            )}
            {invoice.amountPaid > 0 && (
              <>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Amount Paid</Text>
                  <Text style={[styles.amountValue, { color: colors.success }]}>
                    -{formatCurrency(invoice.amountPaid)}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.amountRow}>
                  <Text style={[styles.totalLabel2, { color: colors.warning }]}>Balance Due</Text>
                  <Text style={[styles.totalValue, { color: colors.warning }]}>
                    {formatCurrency(Math.max(0, invoice.total - parseFloat(invoice.retentionAmount || '0') - (invoice.amountPaid || 0)))}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Payment Milestones & Retention - Only for unpaid invoices */}
          {invoice.status !== 'paid' && (
            <>
              <Text style={styles.sectionTitle}>Payment Milestones & Retention</Text>
              <View style={styles.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <Feather name="calendar" size={20} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                        Milestones & Retention
                      </Text>
                      <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, marginTop: 2 }}>
                        {invoice.paymentMilestones && Array.isArray(invoice.paymentMilestones) && invoice.paymentMilestones.length > 0
                          ? `${invoice.paymentMilestones.length} milestones defined`
                          : 'Define progress payment stages'}
                        {parseFloat(invoice.retentionPercent || '0') > 0 && ` | ${invoice.retentionPercent}% retention`}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.primary,
                      backgroundColor: colors.card,
                    }}
                    onPress={() => {
                      setRetentionPercentStr(invoice.retentionPercent || '');
                      if (invoice.paymentMilestones && Array.isArray(invoice.paymentMilestones) && invoice.paymentMilestones.length > 0) {
                        setCustomMilestones((invoice.paymentMilestones as any[]).map((m: any) => ({
                          label: m.label || '',
                          percent: m.percent || 0,
                          status: m.status || 'pending',
                        })));
                        setMilestonePreset('custom');
                      } else {
                        setCustomMilestones([]);
                        setMilestonePreset('custom');
                      }
                      setShowMilestonesModal(true);
                    }}
                  >
                    <Feather name="edit-2" size={14} color={colors.primary} />
                    <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.primary }}>
                      {invoice.paymentMilestones && (invoice.paymentMilestones as any[]).length > 0 ? 'Edit' : 'Set Up'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Display existing milestones */}
                {invoice.paymentMilestones && Array.isArray(invoice.paymentMilestones) && invoice.paymentMilestones.length > 0 && (
                  <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                    {(invoice.paymentMilestones as any[]).map((milestone: any, idx: number) => {
                      const milestoneAmount = (invoice.total * (milestone.percent || 0)) / 100;
                      const amountPaidSoFar = invoice.amountPaid || 0;
                      const cumulativeTarget = (invoice.paymentMilestones as any[])
                        .slice(0, idx + 1)
                        .reduce((sum: number, m: any) => sum + (invoice.total * (m.percent || 0)) / 100, 0);
                      const milestoneStatus = milestone.status || (amountPaidSoFar >= cumulativeTarget ? 'paid' : 'pending');
                      const statusConfig: Record<string, { bg: string; fg: string; icon: string; label: string }> = {
                        pending: { bg: colors.muted, fg: colors.mutedForeground, icon: 'clock', label: 'Pending' },
                        invoiced: { bg: colors.infoLight, fg: colors.info, icon: 'file-text', label: 'Invoiced' },
                        paid: { bg: colors.success, fg: colors.white, icon: 'check', label: 'Paid' },
                      };
                      const sc = statusConfig[milestoneStatus] || statusConfig.pending;
                      
                      return (
                        <View key={idx} style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          backgroundColor: milestoneStatus === 'paid' ? colors.successLight : milestoneStatus === 'invoiced' ? colors.infoLight : colors.background,
                          borderRadius: 8,
                          marginBottom: 6,
                          gap: 8,
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <View style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: milestoneStatus === 'paid' ? colors.success : milestoneStatus === 'invoiced' ? colors.info : colors.muted,
                            }}>
                              {milestoneStatus === 'paid' ? (
                                <Feather name="check" size={14} color={colors.white} />
                              ) : milestoneStatus === 'invoiced' ? (
                                <Feather name="file-text" size={12} color={colors.white} />
                              ) : (
                                <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.mutedForeground }}>{idx + 1}</Text>
                              )}
                            </View>
                            <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.foreground }}>{milestone.label}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>{milestone.percent}%</Text>
                            <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>{formatCurrency(milestoneAmount)}</Text>
                            <View style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 10,
                              backgroundColor: sc.bg,
                            }}>
                              <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: sc.fg }}>
                                {sc.label}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                    
                    {/* Milestone progress bar */}
                    <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
                      <View style={{ height: 6, backgroundColor: colors.muted, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' }}>
                        {(invoice.paymentMilestones as any[]).map((milestone: any, idx: number) => {
                          const milestoneStatus = milestone.status || 'pending';
                          const barColor = milestoneStatus === 'paid' ? colors.success : milestoneStatus === 'invoiced' ? colors.info : 'transparent';
                          return (
                            <View key={idx} style={{ flex: milestone.percent || 0, backgroundColor: barColor }} />
                          );
                        })}
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                        <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>
                          {(invoice.paymentMilestones as any[]).filter((m: any) => m.status === 'paid').length} of {(invoice.paymentMilestones as any[]).length} milestones paid
                        </Text>
                        <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.medium, color: colors.foreground }}>
                          {formatCurrency(
                            (invoice.paymentMilestones as any[])
                              .filter((m: any) => m.status === 'paid')
                              .reduce((sum: number, m: any) => sum + (invoice.total * (m.percent || 0)) / 100, 0)
                          )} / {formatCurrency(invoice.total)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Payment History Timeline */}
          {paymentRecords.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Payment History</Text>
              <View style={styles.card}>
                {paymentSummary && (
                  <View style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    paddingBottom: 12,
                    marginBottom: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}>
                    <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground }}>
                      {paymentRecords.length} payment{paymentRecords.length !== 1 ? 's' : ''} recorded
                    </Text>
                    <Text style={{ fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.success }}>
                      {formatCurrency(paymentSummary.totalPaid || 0)}
                    </Text>
                  </View>
                )}
                {paymentRecords.map((record: any, idx: number) => {
                  const methodLabels: Record<string, string> = {
                    cash: 'Cash',
                    bank_transfer: 'Bank Transfer',
                    cheque: 'Cheque',
                    card: 'Card',
                    stripe: 'Online (Stripe)',
                    tap_to_pay: 'Tap to Pay',
                    on_site: 'On-Site',
                    other: 'Other',
                  };
                  const methodIcons: Record<string, string> = {
                    cash: 'dollar-sign',
                    bank_transfer: 'briefcase',
                    cheque: 'file-text',
                    card: 'credit-card',
                    stripe: 'globe',
                    tap_to_pay: 'smartphone',
                    on_site: 'map-pin',
                    other: 'more-horizontal',
                  };
                  return (
                    <View key={record.id || idx} style={styles.timelineItem}>
                      <View style={styles.timelineIndicator}>
                        <View style={[styles.timelineDot, { backgroundColor: record.voided ? colors.destructive : colors.success }]} />
                        {idx < paymentRecords.length - 1 && <View style={styles.timelineLine} />}
                      </View>
                      <View style={[styles.timelineContent, { paddingBottom: idx < paymentRecords.length - 1 ? 16 : 4 }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.timelineLabel, record.voided && { textDecorationLine: 'line-through', color: colors.mutedForeground }]}>
                              {formatCurrency(record.amount)}
                            </Text>
                            <Text style={styles.timelineDate}>
                              {record.paidAt ? formatDate(record.paidAt) : formatDate(record.createdAt)}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Feather 
                              name={(methodIcons[record.paymentMethod] || 'dollar-sign') as any} 
                              size={12} 
                              color={colors.mutedForeground} 
                            />
                            <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>
                              {methodLabels[record.paymentMethod] || record.paymentMethod}
                            </Text>
                          </View>
                        </View>
                        {record.reference && (
                          <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 2 }}>
                            Ref: {record.reference}
                          </Text>
                        )}
                        {record.note && (
                          <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 2 }}>
                            {record.note}
                          </Text>
                        )}
                        {record.voided && (
                          <View style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            gap: 4, 
                            marginTop: 4,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            backgroundColor: colors.destructiveLight,
                            borderRadius: 6,
                            alignSelf: 'flex-start',
                          }}>
                            <Feather name="x-circle" size={10} color={colors.destructive} />
                            <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: colors.destructive }}>Voided</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Payment Info - Show when already paid */}
          {invoice.status === 'paid' && (
            <>
              <Text style={styles.sectionTitle}>Payment Received</Text>
              <View style={[styles.card, styles.paidCard]}>
                <View style={styles.paidInfo}>
                  <Feather name="check-circle" size={24} color={colors.success} />
                  <View style={styles.paidInfoText}>
                    <Text style={styles.paidAmount}>{formatCurrency(invoice.amountPaid || invoice.total)}</Text>
                    {invoice.paidAt && (
                      <Text style={styles.paidDate}>
                        {new Date(invoice.paidAt).toLocaleDateString('en-AU', { 
                          weekday: 'short', 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric' 
                        })} at {new Date(invoice.paidAt).toLocaleTimeString('en-AU', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </Text>
                    )}
                    {invoice.paymentMethod && (
                      <Text style={styles.paidMethod}>
                        {invoice.paymentMethod === 'on_site' ? 'On-Site' : 
                         invoice.paymentMethod === 'bank_transfer' ? 'Bank Transfer' :
                         invoice.paymentMethod === 'stripe' ? 'Online (Stripe)' :
                         invoice.paymentMethod === 'tap_to_pay' ? 'Tap to Pay' :
                         invoice.paymentMethod === 'cash' ? 'Cash' :
                         invoice.paymentMethod === 'card' ? 'Card' :
                         invoice.paymentMethod === 'cheque' ? 'Cheque' :
                         invoice.paymentMethod}
                      </Text>
                    )}
                    {invoice.paymentReference && (
                      <Text style={styles.paidReference}>Ref: {invoice.paymentReference}</Text>
                    )}
                  </View>
                </View>
                {/* Send Receipt Button */}
                {client?.email && (
                  <TouchableOpacity 
                    style={styles.sendReceiptButton}
                    onPress={handleSendReceipt}
                    disabled={isSendingReceipt}
                  >
                    {isSendingReceipt ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Feather name="mail" size={16} color={colors.primary} />
                    )}
                    <Text style={styles.sendReceiptButtonText}>
                      {isSendingReceipt ? 'Sending...' : 'Send Receipt'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {/* Notes */}
          {invoice.notes && (
            <>
              <Text style={styles.sectionTitle}>Notes</Text>
              <View style={[styles.card, styles.notesCard]}>
                <View style={[styles.notesAccentBar, { backgroundColor: brandColor }]} />
                <View style={styles.notesContent}>
                  <Text style={styles.notesText}>{invoice.notes}</Text>
                </View>
              </View>
            </>
          )}

          {/* Signatures Section - Shows all related signatures */}
          {allSignatures.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>
                Signatures ({allSignatures.length})
              </Text>
              {allSignatures.map((signature, index) => {
                const getSignatureLabel = (sig: Signature) => {
                  switch (sig.documentType) {
                    case 'quote_acceptance':
                      return 'Quote Acceptance';
                    case 'job_completion':
                      return sig.signerRole === 'worker' ? 'Worker Completion' : 'Client Approval';
                    case 'invoice':
                      return 'Invoice Signature';
                    default:
                      return 'Signature';
                  }
                };
                
                return (
                  <View key={signature.id || index} style={styles.card}>
                    <View style={styles.signatureLabelRow}>
                      <Feather 
                        name={signature.documentType === 'quote_acceptance' ? 'file-text' : signature.documentType === 'job_completion' ? 'check-square' : 'edit-3'} 
                        size={16} 
                        color={colors.primary} 
                      />
                      <Text style={styles.signatureLabel}>
                        {getSignatureLabel(signature)}
                      </Text>
                    </View>
                    <Image 
                      source={{ uri: signature.signatureData }} 
                      style={styles.signatureImage}
                      resizeMode="contain"
                    />
                    <View style={styles.signatureDetails}>
                      {signature.signerName && (
                        <Text style={styles.signatureInfo}>
                          Signed by: {signature.signerName}
                        </Text>
                      )}
                      {signature.signedAt && (
                        <Text style={styles.signatureInfo}>
                          Date: {formatDate(signature.signedAt)}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* Footer */}
          <View style={[styles.footerSection, { borderTopColor: brandColor }]}>
            <Text style={styles.thankYouText}>Thank you for your business!</Text>
            {(user?.abn || businessSettings?.abn) && (
              <Text style={styles.abnFooter}>ABN: {user?.abn || businessSettings?.abn}</Text>
            )}
          </View>

          {/* Actions */}
          {invoice.status === 'draft' && (
            <Button
              size="xl"
              variant="default"
              fullWidth
              loading={isSendingInvoice}
              disabled={isSendingInvoice}
              onPress={handleSend}
              icon={!isSendingInvoice ? <Feather name="send" size={18} color={colors.primaryForeground} /> : undefined}
            >
              {isSendingInvoice ? 'Sending...' : 'Send to Client'}
            </Button>
          )}
          
          {(invoice.status === 'sent' || invoice.status === 'overdue') && (
            <View style={styles.actionsColumn}>
              <Button
                size="xl"
                variant="default"
                fullWidth
                onPress={handleCollectPayment}
                icon={<Feather name="credit-card" size={18} color={colors.primaryForeground} />}
              >
                Collect Payment
              </Button>
              <Button
                size="xl"
                variant="outline"
                fullWidth
                loading={isRecordingPayment}
                disabled={isRecordingPayment}
                onPress={handleMarkPaid}
                icon={!isRecordingPayment ? <Feather name="dollar-sign" size={18} color={colors.foreground} /> : undefined}
              >
                Record Payment
              </Button>
            </View>
          )}

          {myobConnected && invoice.status !== 'paid' && invoice.status !== 'draft' && (
            <Button
              size="xl"
              variant="outline"
              fullWidth
              loading={isVoidingMyob}
              disabled={isVoidingMyob}
              onPress={handleVoidInMyob}
              icon={!isVoidingMyob ? <Feather name="alert-triangle" size={18} color={colors.foreground} /> : undefined}
            >
              Void in MYOB
            </Button>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Document Preview Modal */}
      <AppBottomSheet
        visible={showPreview}
        onDismiss={() => setShowPreview(false)}
        snapPoints={['95%']}
        scrollable={false}
        contentPadding={0}
      >
        <View style={styles.previewModalContainer}>
          <View style={styles.previewModalHeader}>
            <TouchableOpacity onPress={() => setShowPreview(false)} style={styles.previewCloseButton}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.previewModalTitle}>Invoice Preview</Text>
            <View style={styles.previewActionButtons}>
              <TouchableOpacity 
                onPress={() => {
                  setShowPreview(false);
                  setTimeout(() => setShowEmailCompose(true), 300);
                }}
                style={styles.previewActionButton}
                data-testid="button-preview-email"
              >
                <Feather name="mail" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleSharePdf}
                style={styles.previewActionButton}
                disabled={isDownloadingPdf}
                data-testid="button-preview-share"
              >
                <Feather name="share-2" size={20} color={isDownloadingPdf ? colors.mutedForeground : colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.previewOptionsRow}>
            {invoice.jobId && (
              <TouchableOpacity
                style={[styles.previewOptionChip, includeBeforePhotos && styles.previewOptionChipActive]}
                onPress={() => setIncludeBeforePhotos(!includeBeforePhotos)}
              >
                <Feather name={includeBeforePhotos ? "check-square" : "square"} size={14} color={includeBeforePhotos ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.previewOptionChipText, includeBeforePhotos && { color: colors.primary }]}>Before</Text>
              </TouchableOpacity>
            )}
            {invoice.jobId && (
              <TouchableOpacity
                style={[styles.previewOptionChip, includeAfterPhotos && styles.previewOptionChipActive]}
                onPress={() => setIncludeAfterPhotos(!includeAfterPhotos)}
              >
                <Feather name={includeAfterPhotos ? "check-square" : "square"} size={14} color={includeAfterPhotos ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.previewOptionChipText, includeAfterPhotos && { color: colors.primary }]}>After</Text>
              </TouchableOpacity>
            )}
            {invoice.notes && (
              <TouchableOpacity
                style={[styles.previewOptionChip, includeNotes && styles.previewOptionChipActive]}
                onPress={() => setIncludeNotes(!includeNotes)}
              >
                <Feather name={includeNotes ? "check-square" : "square"} size={14} color={includeNotes ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.previewOptionChipText, includeNotes && { color: colors.primary }]}>Notes</Text>
              </TouchableOpacity>
            )}
            {allSignatures.length > 0 && (
              <TouchableOpacity
                style={[styles.previewOptionChip, includeSignatures && styles.previewOptionChipActive]}
                onPress={() => setIncludeSignatures(!includeSignatures)}
              >
                <Feather name={includeSignatures ? "check-square" : "square"} size={14} color={includeSignatures ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.previewOptionChipText, includeSignatures && { color: colors.primary }]}>Signatures</Text>
              </TouchableOpacity>
            )}
            {invoice.terms && (
              <TouchableOpacity
                style={[styles.previewOptionChip, includeTerms && styles.previewOptionChipActive]}
                onPress={() => setIncludeTerms(!includeTerms)}
              >
                <Feather name={includeTerms ? "check-square" : "square"} size={14} color={includeTerms ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.previewOptionChipText, includeTerms && { color: colors.primary }]}>Terms</Text>
              </TouchableOpacity>
            )}
          </View>
          <LiveDocumentPreview
            type="invoice"
            documentNumber={invoice.invoiceNumber}
            date={invoice.createdAt}
            dueDate={invoice.dueDate}
            lineItems={lineItems.map((item: any) => ({
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
            }))}
            notes={includeNotes ? invoice.notes : undefined}
            business={{
              businessName: businessSettings?.businessName || user?.businessName,
              abn: businessSettings?.abn || user?.abn,
              address: businessSettings?.address || user?.address,
              phone: businessSettings?.phone || user?.phone,
              email: businessSettings?.email || user?.email,
              logoUrl: businessSettings?.logoUrl || user?.logoUrl,
              brandColor: brandColor,
              gstEnabled: user?.gstEnabled !== false,
            }}
            client={client ? {
              name: client.name,
              email: client.email,
              phone: client.phone,
              address: client.address,
            } : null}
            gstEnabled={user?.gstEnabled !== false}
            status={invoice.status}
            templateId={(invoice as any).documentTemplate || businessSettings?.documentTemplate}
            templateCustomization={(invoice as any).documentTemplateSettings || businessSettings?.documentTemplateSettings}
            jobSignatures={includeSignatures ? allSignatures.map(sig => ({
              id: sig.id,
              signerName: sig.signerName || 'Client',
              signatureData: sig.signatureData,
              signedAt: sig.signedAt || new Date().toISOString(),
              documentType: sig.documentType,
            })) : []}
            terms={includeTerms ? invoice.terms : undefined}
            serverSubtotal={invoice.subtotal}
            serverGstAmount={invoice.gstAmount}
            serverTotal={invoice.total}
            beforePhotos={includeBeforePhotos ? jobPhotos.filter((p: any) => p.category === 'before') : []}
            afterPhotos={includeAfterPhotos ? jobPhotos.filter((p: any) => p.category === 'after') : []}
          />
        </View>
      </AppBottomSheet>

      {/* Email Compose Modal for Invoice */}
      <EmailComposeModal
        visible={showEmailCompose}
        onClose={() => setShowEmailCompose(false)}
        type="invoice"
        documentId={id!}
        clientName={client?.name || 'Client'}
        clientEmail={client?.email || ''}
        documentNumber={invoice?.invoiceNumber || ''}
        documentTitle={invoice?.title || 'Invoice'}
        total={formatCurrency(invoice?.total || 0)}
        businessName={user?.businessName}
        onSend={handleEmailSend}
      />

      {/* Email Compose Modal for Receipt */}
      <EmailComposeModal
        visible={showReceiptEmailCompose}
        onClose={() => setShowReceiptEmailCompose(false)}
        type="receipt"
        documentId={id!}
        clientName={client?.name || 'Client'}
        clientEmail={client?.email || ''}
        documentNumber={invoice?.invoiceNumber || ''}
        documentTitle={`Payment Receipt for ${invoice?.invoiceNumber || 'Invoice'}`}
        total={formatCurrency(invoice?.total || 0)}
        businessName={user?.businessName}
        onSend={handleSendReceiptWithCustomMessage}
      />

      {/* Send Invoice Modal (Email & SMS) */}
      <MobileSendModal
        visible={showSendModal}
        onClose={() => setShowSendModal(false)}
        documentType="invoice"
        documentId={id as string}
        recipientName={client?.name || 'Client'}
        recipientEmail={client?.email}
        recipientPhone={client?.phone}
        documentTitle={invoice?.invoiceNumber || 'Invoice'}
        defaultTab={sendModalDefaultTab}
        onSendSuccess={() => { 
          loadData(); 
          setShowSendModal(false); 
        }}
      />

      {/* Send Receipt Modal (Email & SMS) */}
      <MobileSendModal
        visible={showReceiptSendModal}
        onClose={() => setShowReceiptSendModal(false)}
        documentType="receipt"
        documentId={id as string}
        recipientName={client?.name || 'Client'}
        recipientEmail={client?.email}
        recipientPhone={client?.phone}
        documentTitle={`Receipt for ${invoice?.invoiceNumber || 'Invoice'}`}
        defaultTab={receiptSendModalDefaultTab}
        onSendSuccess={() => { 
          loadData(); 
          setShowReceiptSendModal(false); 
        }}
      />

      {/* Template Selector Modal */}
      <AppBottomSheet
        visible={showTemplateSelector}
        onDismiss={() => setShowTemplateSelector(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.templateModalContent}>
            <View style={styles.templateModalHeader}>
              <Text style={styles.templateModalTitle}>Select Template</Text>
              <TouchableOpacity onPress={() => setShowTemplateSelector(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            {TEMPLATE_OPTIONS.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={[
                  styles.templateOption,
                  selectedTemplate === template.id && styles.templateOptionSelected
                ]}
                onPress={() => {
                  setSelectedTemplate(template.id as 'minimal' | 'professional' | 'modern');
                  setShowTemplateSelector(false);
                }}
              >
                <View style={styles.templateOptionContent}>
                  <Text style={styles.templateOptionName}>{template.name}</Text>
                  <Text style={styles.templateOptionDesc}>{template.description}</Text>
                </View>
                {selectedTemplate === template.id && (
                  <Feather name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </AppBottomSheet>

      {/* Share Action Sheet Modal */}
      <AppBottomSheet
        visible={showShareSheet}
        onDismiss={() => setShowShareSheet(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}
      >
        <TouchableOpacity 
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setShowShareSheet(false)}
        >
          <View style={styles.shareSheetContent}>
            <View style={styles.shareSheetHandle} />
            <Text style={styles.shareSheetTitle}>Share Invoice</Text>
            <Text style={styles.shareSheetSubtitle}>{invoice?.invoiceNumber}</Text>
            
            <View style={styles.shareOptions}>
              <TouchableOpacity 
                style={styles.shareOption}
                onPress={handleEmailInvoice}
              >
                <View style={[styles.shareOptionIcon, { backgroundColor: colors.primaryLight }]}>
                  <Feather name="mail" size={22} color={colors.primary} />
                </View>
                <Text style={styles.shareOptionText}>Email to Client</Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.shareOption}
                onPress={handleSharePdf}
              >
                <View style={[styles.shareOptionIcon, { backgroundColor: colors.successLight }]}>
                  <Feather name="share-2" size={22} color={colors.success} />
                </View>
                <Text style={styles.shareOptionText}>Share PDF</Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>

              {invoice?.allowOnlinePayment && (invoice?.stripePaymentLink || invoice?.paymentToken) && (
                <TouchableOpacity 
                  style={styles.shareOption}
                  onPress={handleCopyPaymentLink}
                >
                  <View style={[styles.shareOptionIcon, { backgroundColor: colors.infoLight }]}>
                    <Feather name="link" size={22} color={colors.info} />
                  </View>
                  <Text style={styles.shareOptionText}>Copy Payment Link</Text>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={styles.shareOption}
                onPress={handleSaveToDevice}
              >
                <View style={[styles.shareOptionIcon, { backgroundColor: colors.warningLight }]}>
                  <Feather name="download" size={22} color={colors.warning} />
                </View>
                <Text style={styles.shareOptionText}>Save to Device</Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.shareOption}
                onPress={handleSharePdf}
              >
                <View style={[styles.shareOptionIcon, { backgroundColor: colors.primaryLight }]}>
                  <Feather name="printer" size={22} color={colors.primary} />
                </View>
                <Text style={styles.shareOptionText}>Print</Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.shareSheetCancel}
              onPress={() => setShowShareSheet(false)}
            >
              <Text style={styles.shareSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </AppBottomSheet>

      {/* Milestones & Retention Modal */}
      <AppBottomSheet
        visible={showMilestonesModal}
        onDismiss={() => setShowMilestonesModal(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={{ flex: 1 }}>
          <View style={styles.paymentMethodModalContent}>
            <View style={styles.shareSheetHandle} />
            <Text style={styles.shareSheetTitle}>Payment Milestones</Text>
            <Text style={styles.shareSheetSubtitle}>
              Define progress payment stages and retention for construction/trade invoices
            </Text>

            <ScrollView style={styles.paymentMethodScrollContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.paymentMethodSectionTitle}>Milestone Preset</Text>
              <View style={styles.paymentMethodOptions}>
                {MILESTONE_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.id}
                    style={[
                      styles.paymentMethodOption,
                      milestonePreset === preset.id && styles.paymentMethodOptionSelected,
                    ]}
                    onPress={() => {
                      setMilestonePreset(preset.id);
                      if (preset.id !== 'custom' && PRESET_MAP[preset.id]) {
                        setCustomMilestones(PRESET_MAP[preset.id].map(m => ({ ...m, status: 'pending' })));
                      }
                    }}
                  >
                    <View style={[
                      styles.paymentMethodIcon,
                      milestonePreset === preset.id && styles.paymentMethodIconSelected,
                    ]}>
                      <Feather
                        name={preset.id === 'custom' ? 'sliders' : 'layers'}
                        size={18}
                        color={milestonePreset === preset.id ? colors.primaryForeground : colors.primary}
                      />
                    </View>
                    <Text style={[
                      styles.paymentMethodLabel,
                      milestonePreset === preset.id && styles.paymentMethodLabelSelected,
                    ]}>
                      {preset.label}
                    </Text>
                    {milestonePreset === preset.id && (
                      <Feather name="check-circle" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {milestonePreset !== 'custom' && PRESET_MAP[milestonePreset] && (
                <View style={{ marginTop: 12, padding: 12, backgroundColor: colors.background, borderRadius: 10 }}>
                  {PRESET_MAP[milestonePreset].map((m, i) => {
                    const amount = (invoice?.total || 0) * m.percent / 100;
                    return (
                      <View key={i} style={{ 
                        flexDirection: 'row', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 8,
                        borderBottomWidth: i < PRESET_MAP[milestonePreset].length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                      }}>
                        <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground, flex: 1 }}>{m.label}</Text>
                        <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, marginRight: 8 }}>{formatCurrency(amount)}</Text>
                        <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.primary }}>{m.percent}%</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {milestonePreset === 'custom' && (
                <>
                  <Text style={[styles.paymentMethodSectionTitle, { marginTop: 16 }]}>Custom Milestones</Text>
                  {customMilestones.map((milestone, idx) => {
                    const amount = (invoice?.total || 0) * (milestone.percent || 0) / 100;
                    return (
                      <View key={idx} style={{
                        backgroundColor: colors.background,
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.mutedForeground }}>Stage {idx + 1}</Text>
                          <TouchableOpacity onPress={() => removeCustomMilestone(idx)}>
                            <Feather name="x" size={18} color={colors.destructive} />
                          </TouchableOpacity>
                        </View>
                        <TextInput
                          style={[styles.paymentReferenceInput, { marginBottom: 8 }]}
                          placeholder="Milestone name (e.g. Deposit, Slab Complete)"
                          placeholderTextColor={colors.mutedForeground}
                          value={milestone.label}
                          onChangeText={(text) => updateCustomMilestone(idx, 'label', text)}
                        />
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginBottom: 4 }}>Percentage</Text>
                            <TextInput
                              style={styles.paymentReferenceInput}
                              placeholder="e.g. 25"
                              placeholderTextColor={colors.mutedForeground}
                              value={milestone.percent > 0 ? String(milestone.percent) : ''}
                              onChangeText={(text) => updateCustomMilestone(idx, 'percent', parseFloat(text) || 0)}
                              keyboardType="decimal-pad"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginBottom: 4 }}>Amount</Text>
                            <View style={[styles.paymentReferenceInput, { justifyContent: 'center' }]}>
                              <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground }}>{formatCurrency(amount)}</Text>
                            </View>
                          </View>
                        </View>
                        <View>
                          <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginBottom: 4 }}>Status</Text>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {(['pending', 'invoiced', 'paid'] as const).map((s) => {
                              const isActive = milestone.status === s;
                              const statusColors: Record<string, { bg: string; fg: string }> = {
                                pending: { bg: colors.muted, fg: colors.mutedForeground },
                                invoiced: { bg: colors.infoLight, fg: colors.info },
                                paid: { bg: colors.successLight, fg: colors.success },
                              };
                              return (
                                <TouchableOpacity
                                  key={s}
                                  onPress={() => updateCustomMilestone(idx, 'status', s)}
                                  style={{
                                    flex: 1,
                                    paddingVertical: 8,
                                    borderRadius: 8,
                                    alignItems: 'center',
                                    backgroundColor: isActive ? statusColors[s].bg : colors.background,
                                    borderWidth: 1,
                                    borderColor: isActive ? statusColors[s].fg : colors.border,
                                  }}
                                >
                                  <Text style={{
                                    fontSize: typography.captionSmall.fontSize,
                                    fontWeight: isActive ? fontWeights.semibold : fontWeights.regular,
                                    color: isActive ? statusColors[s].fg : colors.mutedForeground,
                                    textTransform: 'capitalize',
                                  }}>
                                    {s}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                  
                  <TouchableOpacity
                    onPress={addCustomMilestone}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.primary,
                      borderStyle: 'dashed',
                      marginTop: 4,
                    }}
                  >
                    <Feather name="plus" size={16} color={colors.primary} />
                    <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.primary }}>Add Milestone</Text>
                  </TouchableOpacity>

                  {customMilestones.length > 0 && (
                    <View style={{
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 8,
                      backgroundColor: customMilestoneTotalPercent === 100 ? colors.successLight : customMilestoneTotalPercent > 100 ? colors.destructiveLight : colors.warningLight,
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: typography.sizes.sm, color: colors.foreground }}>Total Allocation</Text>
                        <Text style={{ 
                          fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, 
                          color: customMilestoneTotalPercent === 100 ? colors.success : customMilestoneTotalPercent > 100 ? colors.destructive : colors.warning,
                        }}>
                          {customMilestoneTotalPercent}%
                        </Text>
                      </View>
                      {customMilestoneTotalPercent !== 100 && (
                        <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 4 }}>
                          {customMilestoneTotalPercent > 100 ? 'Total exceeds 100%' : `${100 - customMilestoneTotalPercent}% remaining`}
                        </Text>
                      )}
                    </View>
                  )}
                </>
              )}

              <Text style={[styles.paymentMethodSectionTitle, { marginTop: 16 }]}>Retention Percentage</Text>
              <TextInput
                style={styles.paymentReferenceInput}
                placeholder="e.g. 5"
                placeholderTextColor={colors.mutedForeground}
                value={retentionPercentStr}
                onChangeText={setRetentionPercentStr}
                keyboardType="decimal-pad"
              />
              <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 6 }}>
                Common in construction: hold back 5-10% until defect period ends
              </Text>

              {retentionPercentStr && parseFloat(retentionPercentStr) > 0 && (
                <View style={{
                  marginTop: 12,
                  padding: 12,
                  backgroundColor: colors.warningLight,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.warning,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground }}>Invoice Total</Text>
                    <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.foreground }}>
                      {formatCurrency(invoice?.total || 0)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                    <Text style={{ fontSize: typography.button.fontSize, color: colors.warning }}>
                      Retention ({retentionPercentStr}%)
                    </Text>
                    <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.warning }}>
                      -{formatCurrency((invoice?.total || 0) * parseFloat(retentionPercentStr) / 100)}
                    </Text>
                  </View>
                  <View style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'space-between', 
                    paddingTop: 8,
                    marginTop: 4,
                    borderTopWidth: 1,
                    borderTopColor: colors.warning,
                  }}>
                    <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>Payable Now</Text>
                    <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                      {formatCurrency((invoice?.total || 0) * (1 - parseFloat(retentionPercentStr) / 100))}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.paymentMethodActions}>
              <TouchableOpacity
                style={styles.paymentMethodCancelButton}
                onPress={() => {
                  setShowMilestonesModal(false);
                  setMilestonePreset('custom');
                  setRetentionPercentStr('');
                  setCustomMilestones([]);
                }}
              >
                <Text style={styles.paymentMethodCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentMethodConfirmButton, { backgroundColor: colors.primary }, isSavingMilestones && styles.buttonDisabled]}
                onPress={handleSaveMilestones}
                disabled={isSavingMilestones}
              >
                {isSavingMilestones ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <Feather name="check" size={18} color={colors.primaryForeground} />
                    <Text style={[styles.paymentMethodConfirmText, { color: colors.primaryForeground }]}>Save Milestones</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </AppBottomSheet>

      {/* Payment Method Selection Modal */}
      <AppBottomSheet
        visible={showPaymentMethodModal}
        onDismiss={() => setShowPaymentMethodModal(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={{ flex: 1 }}>
          <View style={styles.paymentMethodModalContent}>
            <View style={styles.shareSheetHandle} />
            <Text style={styles.shareSheetTitle}>Record Payment</Text>
            <Text style={styles.shareSheetSubtitle}>
              {formatCurrency(invoice?.total || 0)}
            </Text>
            
            <ScrollView 
              style={styles.paymentMethodScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text style={styles.paymentMethodSectionTitle}>Payment Method</Text>
              <View style={styles.paymentMethodOptions}>
                {PAYMENT_METHODS.map((method) => (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.paymentMethodOption,
                      selectedPaymentMethod === method.id && styles.paymentMethodOptionSelected
                    ]}
                    onPress={() => setSelectedPaymentMethod(method.id)}
                  >
                    <View style={[
                      styles.paymentMethodIcon,
                      selectedPaymentMethod === method.id && styles.paymentMethodIconSelected
                    ]}>
                      <Feather 
                        name={method.icon as any} 
                        size={20} 
                        color={selectedPaymentMethod === method.id ? colors.primaryForeground : colors.primary} 
                      />
                    </View>
                    <Text style={[
                      styles.paymentMethodLabel,
                      selectedPaymentMethod === method.id && styles.paymentMethodLabelSelected
                    ]}>
                      {method.label}
                    </Text>
                    {selectedPaymentMethod === method.id && (
                      <Feather name="check" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.paymentMethodSectionTitle}>Reference (Optional)</Text>
              <TextInput
                style={styles.paymentReferenceInput}
                placeholder="e.g. Check #1234 or Transfer ID"
                placeholderTextColor={colors.mutedForeground}
                value={paymentReference}
                onChangeText={setPaymentReference}
              />

              <View style={styles.receiptToggleContainer}>
                <View style={styles.receiptToggleTextContainer}>
                  <Text style={styles.receiptToggleLabel}>Also generate receipt</Text>
                  <Text style={styles.receiptToggleHint}>Create a receipt document automatically</Text>
                </View>
                <Switch
                  value={createReceiptOnPayment}
                  onValueChange={setCreateReceiptOnPayment}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
            </ScrollView>

            <View style={styles.paymentMethodActions}>
              <TouchableOpacity
                style={styles.paymentMethodCancelButton}
                onPress={() => {
                  setShowPaymentMethodModal(false);
                  setPaymentReference('');
                  setSelectedPaymentMethod('cash');
                  setCreateReceiptOnPayment(false);
                }}
              >
                <Text style={styles.paymentMethodCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentMethodConfirmButton, isRecordingPayment && styles.buttonDisabled]}
                onPress={handleRecordPayment}
                disabled={isRecordingPayment}
              >
                {isRecordingPayment ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Feather name="check" size={18} color={colors.white} />
                    <Text style={styles.paymentMethodConfirmText}>Record Payment</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </AppBottomSheet>

      {/* Task #96: Themed in-app modal for MYOB credit-note fallback */}
      <Modal
        visible={showMyobCreditNoteModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowMyobCreditNoteModal(false)}
      >
        <View style={styles.myobModalBackdrop}>
          <View style={styles.myobModalCard}>
            <View style={styles.myobModalHeader}>
              <View style={styles.myobModalIconWrap}>
                <Feather name="alert-triangle" size={22} color={colors.warning} />
              </View>
              <Text style={styles.myobModalTitle}>MYOB can't void this invoice</Text>
            </View>
            <Text style={styles.myobModalMessage}>
              {myobVoidExplanation}
            </Text>
            <Text style={styles.myobModalMessage}>
              Raise a credit note for the same amount instead?
            </Text>
            <View style={styles.myobModalActions}>
              <View style={styles.myobModalActionItem}>
                <Button
                  variant="outline"
                  size="lg"
                  fullWidth
                  disabled={isVoidingMyob}
                  onPress={() => setShowMyobCreditNoteModal(false)}
                >
                  Cancel
                </Button>
              </View>
              <View style={styles.myobModalActionItem}>
                <Button
                  variant="destructive"
                  size="lg"
                  fullWidth
                  loading={isVoidingMyob}
                  disabled={isVoidingMyob}
                  onPress={async () => {
                    const ok = await handleRaiseMyobCreditNote();
                    if (ok) setShowMyobCreditNoteModal(false);
                  }}
                >
                  Raise credit note instead
                </Button>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: typography.subtitle.fontSize,
    color: colors.mutedForeground,
  },
  headerButton: {
    padding: 8,
  },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  invoiceNumber: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.bold,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  totalAmount: {
    fontSize: 40,
    fontWeight: fontWeights.extrabold,
    color: colors.foreground,
    letterSpacing: -1,
  },
  totalLabel: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    fontWeight: fontWeights.medium,
  },
  dueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dueLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  dueAmount: {
    fontSize: typography.sizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.warning,
  },
  summaryDetailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    width: '100%',
  },
  summaryDetailItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  summaryDetailLabel: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryDetailValue: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginTop: 2,
  },
  primaryActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  primaryActionButton: {
    flex: 1,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.md,
  },
  primaryActionText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.white,
    letterSpacing: 0.1,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickAction: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 65,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 12,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  quickActionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickActionText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    textAlign: 'center',
  },
  pdfOptionsCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pdfOptionsTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  pdfOptionsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 16,
  },
  pdfOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  pdfOptionActive: {
    backgroundColor: `${colors.primary}10`,
  },
  pdfOptionText: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
  },
  previewOptionsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  previewOptionChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  previewOptionChipActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  previewOptionChipText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    fontWeight: fontWeights.medium,
  },
  overdueAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: colors.destructiveLight,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.destructive + '30',
  },
  overdueText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.destructive,
    flex: 1,
  },
  sectionTitle: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    minHeight: 50,
  },
  timelineIndicator: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  timelineLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  timelineDate: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 3,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  linkedDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  linkedDocRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkedDocIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedDocInfo: {
    flex: 1,
  },
  linkedDocLabel: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  linkedDocTitle: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  linkedDocStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  linkedDocStatusText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  infoContent: {
    flex: 1,
  },
  clientName: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  infoLabel: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  infoText: {
    fontSize: typography.sizes.md,
    color: colors.foreground,
  },
  lineItem: {
    paddingVertical: 12,
  },
  lineItemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  lineItemDescription: {
    flex: 1,
    fontSize: typography.button.fontSize,
    color: colors.foreground,
    lineHeight: 20,
  },
  lineItemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginLeft: 26,
  },
  lineItemQty: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
  },
  lineItemTotal: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  amountLabel: {
    fontSize: typography.sizes.md,
    color: colors.mutedForeground,
  },
  amountValue: {
    fontSize: typography.sizes.md,
    color: colors.foreground,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  totalLabel2: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  totalValue: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  notesText: {
    fontSize: typography.button.fontSize,
    color: colors.foreground,
    lineHeight: 22,
  },
  paymentToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentToggleInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentToggleText: {
    flex: 1,
  },
  paymentToggleTitle: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: 2,
  },
  paymentToggleDesc: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  paymentLinkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentLinkText: {
    fontSize: typography.sizes.sm,
    color: colors.success,
  },
  paymentLinkSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  paymentLinkActions: {
    flexDirection: 'row',
    gap: 8,
  },
  copyLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
  },
  copyLinkButtonText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.primary,
  },
  generateLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  generateLinkButtonText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.primary,
  },
  onSitePaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: colors.success,
    borderRadius: 14,
  },
  onSitePaymentButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.bold,
    color: colors.white,
    letterSpacing: 0.2,
  },
  onSitePaymentHint: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  paidCard: {
    borderColor: colors.success,
    borderWidth: 1.5,
    backgroundColor: colors.successLight,
  },
  paidInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  paidInfoText: {
    flex: 1,
  },
  paidAmount: {
    fontSize: typography.sizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.success,
  },
  paidDate: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    marginTop: 4,
  },
  paidMethod: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 3,
  },
  paidReference: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
    fontStyle: 'italic' as const,
  },
  sendReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  sendReceiptButtonText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.primary,
  },
  signatureLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  signatureLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  actionsColumn: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 50,
    paddingVertical: 16,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 50,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  primaryButtonText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  secondaryButtonText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    padding: 16,
  },
  sendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    marginBottom: 24,
  },
  sendInfoText: {
    flex: 1,
  },
  sendInfoLabel: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
  },
  sendInfoValue: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  inputLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    marginBottom: 8,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: typography.sizes.md,
    color: colors.foreground,
    backgroundColor: colors.card,
    minHeight: 120,
    marginBottom: 24,
  },
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  previewLabel: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
  },
  previewValue: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  previewTotal: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
  },
  sendButtonText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  notesCard: {
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
    padding: 0,
    overflow: 'hidden' as const,
  },
  notesAccentBar: {
    width: 4,
  },
  notesContent: {
    flex: 1,
    padding: 16,
  },
  emptyStateCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 32,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center' as const,
    gap: 10,
  },
  emptyStateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.muted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  emptyStateSubtext: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    textAlign: 'center' as const,
    lineHeight: 18,
    maxWidth: 240,
  },
  signatureImage: {
    width: '100%',
    height: 80,
    marginBottom: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 8,
  },
  signatureDetails: {
    gap: 4,
  },
  signatureInfo: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
  },
  footerSection: {
    marginTop: 8,
    marginBottom: 24,
    paddingTop: 20,
    paddingBottom: 8,
    borderTopWidth: 2,
    alignItems: 'center',
  },
  thankYouText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
    marginBottom: 6,
  },
  abnFooter: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    letterSpacing: 0.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  templateModalContent: {
    flex: 1,
    backgroundColor: colors.card,
    padding: 20,
  },
  templateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  templateModalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  templateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  templateOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  templateOptionContent: {
    flex: 1,
  },
  templateOptionName: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  templateOptionDesc: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  myobModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  myobModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  myobModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  myobModalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningLight,
  },
  myobModalTitle: {
    flex: 1,
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  myobModalMessage: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  myobModalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  myobModalActionItem: {
    flex: 1,
  },
  previewModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  previewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  previewCloseButton: {
    padding: 8,
    width: 40,
  },
  previewActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewActionButton: {
    padding: 8,
    borderRadius: 8,
  },
  previewModalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  shareSheetContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  shareSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  shareSheetTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: 4,
  },
  shareSheetSubtitle: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 20,
  },
  shareOptions: {
    gap: 8,
    marginBottom: 16,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  shareOptionText: {
    flex: 1,
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  shareSheetCancel: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareSheetCancelText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
  },
  recurringCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.info,
  },
  recurringHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.infoLight || colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  recurringBadgeText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.info,
  },
  recurringActiveText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recurringDetails: {
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 16,
  },
  recurringDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recurringDetailContent: {
    flex: 1,
  },
  recurringDetailLabel: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  recurringDetailValue: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  recurringActions: {
    flexDirection: 'row',
    gap: 12,
  },
  recurringEditButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
  },
  recurringEditButtonText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  recurringStopButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: colors.destructiveLight,
    borderRadius: 10,
  },
  recurringStopButtonText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.destructive,
  },
  paymentMethodModalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  paymentMethodScrollContent: {
    flexGrow: 0,
    marginBottom: 16,
  },
  paymentMethodSectionTitle: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginTop: 16,
    marginBottom: 12,
  },
  paymentMethodOptions: {
    gap: 8,
  },
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentMethodOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  paymentMethodIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: colors.primaryLight,
  },
  paymentMethodIconSelected: {
    backgroundColor: colors.primary,
  },
  paymentMethodLabel: {
    flex: 1,
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  paymentMethodLabelSelected: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  paymentReferenceInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: typography.sizes.md,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  receiptToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  receiptToggleTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  receiptToggleLabel: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  receiptToggleHint: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  paymentMethodActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  paymentMethodCancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentMethodCancelText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
  },
  paymentMethodConfirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.success,
  },
  paymentMethodConfirmText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.white,
  },
  documentPreviewCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    shadowColor: colors.foreground,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  documentHeader: {
    padding: 16,
    borderBottomWidth: 3,
  },
  businessInfo: {
    marginBottom: 16,
  },
  documentLogo: {
    width: 120,
    height: 50,
    marginBottom: 8,
  },
  documentBusinessName: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    marginBottom: 4,
  },
  documentBusinessDetail: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
  },
  documentTitleContainer: {
    alignItems: 'flex-end',
  },
  documentTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: fontWeights.extrabold,
    letterSpacing: 2,
  },
  documentNumber: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  documentSection: {
    padding: 16,
  },
  documentRow: {
    flexDirection: 'row',
    gap: 16,
  },
  documentColumn: {
    flex: 1,
  },
  documentSectionLabel: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    fontWeight: fontWeights.semibold,
    letterSpacing: 1,
    marginBottom: 8,
  },
  documentClientName: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: 4,
  },
  documentInfoText: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.foreground,
    marginBottom: 2,
  },
  documentInfoLabel: {
    fontWeight: fontWeights.semibold,
  },
  documentItemsSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  documentItemsHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  documentItemsHeaderText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  documentItemRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  documentItemText: {
    fontSize: typography.sizes.xs,
    color: colors.foreground,
  },
  documentMoreItems: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    fontStyle: 'italic',
    paddingVertical: 8,
    textAlign: 'center',
  },
  documentSummary: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 2,
  },
  documentSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  documentSummaryTitle: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  documentStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  documentStatusBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
  },
  documentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  documentSummaryDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  documentSummaryLabel: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
  },
  documentSummaryValue: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  documentTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  documentTotalLabel: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  documentTotalValue: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  documentFooterSection: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  documentFooterText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
  },
  documentFooterSubtext: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 4,
    textAlign: 'center',
  },
});
