import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Linking,
  Image,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '@/components/ui/PressableRow';
import * as Clipboard from 'expo-clipboard';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useQuotesStore, useClientsStore, useAuthStore, useJobsStore, useInvoicesStore } from '../../../src/lib/store';
import { useTheme, ThemeColors } from '../../../src/lib/theme';
import { AppBottomSheet } from '../../../src/components/ui/AppBottomSheet';
import LiveDocumentPreview from '../../../src/components/LiveDocumentPreview';
import { EmailComposeModal } from '../../../src/components/EmailComposeModal';
import { MobileSendModal } from '../../../src/components/MobileSendModal';
import { API_URL, api } from '../../../src/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../../src/components/BottomNav';
import { showToast } from '../../../src/lib/toast';
import { Button } from '../../../src/components/ui/Button';
import { useConfirmDialog } from '../../../src/components/ui/ConfirmDialog';
import { typography, fontWeights, spacing } from '../../../src/lib/design-tokens';

interface LinkedInvoice {
  id: string;
  invoiceNumber?: string;
  total: number;
  status: string;
}

interface LinkedJob {
  id: string;
  title: string;
  status: string;
}

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

export default function QuoteDetailScreen() {
  const { id, autoEmail } = useLocalSearchParams<{ id: string; autoEmail?: string }>();
  const { getQuote, updateQuoteStatus } = useQuotesStore();
  const { invoices, fetchInvoices } = useInvoicesStore();
  const { jobs, fetchJobs } = useJobsStore();
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
    accepted: { label: 'Accepted', color: colors.success, bg: colors.successLight },
    rejected: { label: 'Rejected', color: colors.destructive, bg: colors.destructiveLight },
    expired: { label: 'Expired', color: colors.mutedForeground, bg: colors.cardHover },
  }), [colors]);
  const [quote, setQuote] = useState<any>(null);
  const [linkedInvoice, setLinkedInvoice] = useState<LinkedInvoice | null>(null);
  const [linkedJob, setLinkedJob] = useState<LinkedJob | null>(null);
  const [allSignatures, setAllSignatures] = useState<Signature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(businessSettings?.documentTemplate || 'professional');
  const [showDepositEditor, setShowDepositEditor] = useState(false);
  const [depositPercent, setDepositPercent] = useState('');
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [includeBeforePhotos, setIncludeBeforePhotos] = useState(false);
  const [includeAfterPhotos, setIncludeAfterPhotos] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [hideSignature, setHideSignature] = useState(false);
  const [jobPhotos, setJobPhotos] = useState<any[]>([]);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [isMarkingSent, setIsMarkingSent] = useState(false);
  const [isMarkingAccepted, setIsMarkingAccepted] = useState(false);
  const [isPushingToXero, setIsPushingToXero] = useState(false);
  const [xeroConnected, setXeroConnected] = useState(false);
  const [isSendingQuote, setIsSendingQuote] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendModalDefaultTab, setSendModalDefaultTab] = useState<'email' | 'sms'>('email');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  
  const brandColor = businessSettings?.brandColor || user?.brandColor || '#2563eb';

  const loadVersionHistory = async () => {
    if (!id) return;
    setIsLoadingVersions(true);
    try {
      const response = await api.get<any[]>(`/api/quotes/${id}/versions`);
      if (response.data && Array.isArray(response.data)) {
        setVersionHistory(response.data);
      }
    } catch (error) {
      console.error('Error loading version history:', error);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleShowVersionHistory = () => {
    setShowVersionHistory(true);
    loadVersionHistory();
  };

  const handleDeleteQuote = async () => {
    if (!quote) return;
    
    const ok = await confirm({ title: 'Delete Quote', message: 'Are you sure you want to delete this quote? This cannot be undone.', confirmText: 'Delete', cancelText: 'Cancel', destructive: true });
    if (ok) {
      setIsDeleting(true);
      try {
        await api.delete(`/api/quotes/${quote.id}`);
        showToast({ type: 'success', message: 'Success', description: 'Quote deleted successfully' });
        router.back();
      } catch (error) {
        console.error('Error deleting quote:', error);
        showToast({ type: 'error', message: 'Error', description: 'Failed to delete quote' });
      } finally {
        setIsDeleting(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Task #93: check Xero connection so we can show the Push to Xero button.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getXeroStatus();
        if (!cancelled) setXeroConnected(!!res.data?.connected);
      } catch {
        if (!cancelled) setXeroConnected(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-open email compose when navigated with autoEmail param
  useEffect(() => {
    if (autoEmail === 'true' && quote && !isLoading) {
      setTimeout(() => setShowEmailCompose(true), 300);
    }
  }, [autoEmail, quote, isLoading]);

  // Fetch job photos when preview opens and quote has a jobId
  useEffect(() => {
    if (!showPreview || !quote?.jobId) {
      setJobPhotos([]);
      return;
    }
    const fetchPhotos = async () => {
      try {
        const response = await api.get<any[]>(`/api/jobs/${quote.jobId}/photos`);
        if (Array.isArray(response.data)) setJobPhotos(response.data);
      } catch (e) {
        setJobPhotos([]);
      }
    };
    fetchPhotos();
  }, [showPreview, quote?.jobId]);

  const loadData = async () => {
    setIsLoading(true);
    const quoteData = await getQuote(id!);
    setQuote(quoteData);
    
    // Fetch related data - don't block on optional fetches
    try {
      await fetchClients();
    } catch (e) {
      if (__DEV__) console.log('Could not fetch clients:', e);
    }
    
    // Fetch invoices and jobs for related documents (optional, don't block)
    try {
      await fetchInvoices();
    } catch (e) {
      if (__DEV__) console.log('Could not fetch invoices:', e);
    }
    try {
      await fetchJobs();
    } catch (e) {
      if (__DEV__) console.log('Could not fetch jobs:', e);
    }
    
    const signatures: Signature[] = [];
    const authToken = await api.getToken();
    
    // Fetch quote acceptance signatures
    try {
      const response = await fetch(`${API_URL}/api/digital-signatures?documentType=quote_acceptance&documentId=${id}`, {
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
    
    // Fetch job signatures if quote has jobId
    if (quoteData?.jobId) {
      try {
        const response = await fetch(`${API_URL}/api/jobs/${quoteData.jobId}/signatures`, {
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
    
    setAllSignatures(signatures);
    
    // Find linked invoice (invoice created from this quote)
    const invoicesArray = useInvoicesStore.getState().invoices;
    const foundInvoice = invoicesArray.find((inv: any) => inv.quoteId === id);
    if (foundInvoice) {
      setLinkedInvoice({
        id: foundInvoice.id,
        invoiceNumber: foundInvoice.invoiceNumber,
        total: foundInvoice.total,
        status: foundInvoice.status,
      });
    } else {
      setLinkedInvoice(null);
    }
    
    // Find linked job (job created from this quote or quote linked to job)
    const jobsArray = useJobsStore.getState().jobs;
    const foundJob = jobsArray.find((job: any) => job.quoteId === id || quoteData?.jobId === job.id);
    if (foundJob) {
      setLinkedJob({
        id: foundJob.id,
        title: foundJob.title,
        status: foundJob.status,
      });
    } else {
      setLinkedJob(null);
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
    if (!quote) return;
    const client = getClient(quote.clientId);
    
    Alert.alert(
      'Send Quote',
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
  
  const handleSendViaJobRunner = async () => {
    if (!quote || isSendingQuote) return;
    
    const client = getClient(quote.clientId);
    const recipientEmail = client?.email;
    
    if (!recipientEmail) {
      showToast({ type: 'info', message: 'No Email Address', description: 'This client does not have an email address on file.' });
      return;
    }
    
    setIsSendingQuote(true);
    try {
      const authToken = await api.getToken();
      const response = await fetch(`${API_URL}/api/quotes/${id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ email: recipientEmail }),
      });

      if (response.ok) {
        await loadData();
        showToast({ type: 'info', message: 'Quote Sent!', description: `Email sent to ${recipientEmail} with PDF attached.\n\nView it in Communications Hub to see the full email, PDF preview and delivery status.` });
      } else {
        const error = await response.json();
        showToast({ type: 'error', message: error.error || 'Failed to send quote' });
      }
    } catch (error) {
      if (__DEV__) console.log('Error sending quote:', error);
      showToast({ type: 'error', message: 'Failed to send quote. Please try again.' });
    } finally {
      setIsSendingQuote(false);
    }
  };
  
  const showManualShareOptions = () => {
    if (!quote) return;
    
    Alert.alert(
      'Share Format',
      'How would you like to share this quote?',
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
    if (!quote) return;
    const client = getClient(quote.clientId);
    const quoteNumber = quote.quoteNumber || quote.number || quote.id?.slice(0, 8);
    
    setIsDownloadingPdf(true);
    try {
      // Generate share token if needed
      const authToken = await api.getToken();
      const tokenResponse = await fetch(`${API_URL}/api/quotes/${quote.id}/generate-share-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      if (!tokenResponse.ok) {
        throw new Error('Failed to generate quote link');
      }
      
      const { acceptanceToken } = await tokenResponse.json();
      
      // Build the public URL
      const baseUrl = API_URL.replace('/api', '').replace(':5000', '');
      const publicUrl = `${baseUrl}/q/${acceptanceToken}`;
      
      // Compose email with link
      const businessName = businessSettings?.businessName || user?.name || 'Your tradie';
      const total = formatCurrency(quote.total);
      const subject = `Quote ${quoteNumber} from ${businessName}`;
      const body = `Hi ${client?.name || 'there'},

Please find your quote attached below.

Quote Number: ${quoteNumber}
Total: ${total}

View and accept your quote online:
${publicUrl}

Thank you for your business!

${businessName}`;
      
      const emailUrl = `mailto:${client?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      const canOpen = await Linking.canOpenURL(emailUrl);
      if (canOpen) {
        await Linking.openURL(emailUrl);
        
        // Ask if they want to mark as sent
        Alert.alert(
          'Did you send the quote?',
          'Would you like to mark this quote as sent?',
          [
            { text: 'Not Yet', style: 'cancel' },
            { 
              text: 'Mark as Sent', 
              onPress: async () => {
                await updateQuoteStatus(id!, 'sent');
                await loadData();
              }
            },
          ]
        );
      } else {
        // Fallback: copy link to clipboard
        await Clipboard.setStringAsync(publicUrl);
        showToast({ type: 'info', message: 'Email Not Available', description: `Quote link copied to clipboard:\n${publicUrl}` });
      }
    } catch (error: any) {
      if (__DEV__) console.log('Error composing email:', error);
      showToast({ type: 'error', message: 'Failed to compose email. Please try again.' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };
  
  const handleShareAsImage = async () => {
    if (!quote) return;
    const client = getClient(quote.clientId);
    const quoteNumber = quote.quoteNumber || quote.id?.slice(0, 8);
    
    setIsDownloadingPdf(true);
    try {
      const authToken = await api.getToken();
      const response = await fetch(`${API_URL}/api/quotes/${quote.id}/image`, {
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
      
      const imageUri = FileSystem.cacheDirectory + `quote-${quoteNumber}.png`;
      await FileSystem.writeAsStringAsync(imageUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(imageUri, {
          mimeType: 'image/png',
          dialogTitle: `Share Quote ${quoteNumber}`,
          UTI: 'public.png',
        });
        
        Alert.alert(
          'Did you send the quote?',
          'Would you like to mark this quote as sent?',
          [
            { text: 'Not Yet', style: 'cancel' },
            { 
              text: 'Mark as Sent', 
              onPress: async () => {
                await updateQuoteStatus(id!, 'sent');
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
    if (!quote) return;
    const client = getClient(quote.clientId);
    
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
        const quoteNumber = quote.quoteNumber || quote.id?.slice(0, 8);
        const total = formatCurrency(quote.total);
        
        // Note: Share sheet will pass the PDF - user types their own message in their email app
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Quote ${quoteNumber} to ${client?.name || 'client'}`,
          UTI: 'com.adobe.pdf',
        });
        
        // After sharing, ask if they want to mark as sent
        Alert.alert(
          'Did you send the quote?',
          'Would you like to mark this quote as sent?',
          [
            { text: 'Not Yet', style: 'cancel' },
            { 
              text: 'Mark as Sent', 
              onPress: async () => {
                await updateQuoteStatus(id!, 'sent');
                await loadData();
              }
            },
          ]
        );
      } else {
        // Fallback to mailto without attachment
        const quoteNumber = quote.quoteNumber || quote.id?.slice(0, 8);
        const total = formatCurrency(quote.total);
        const subject = `Quote ${quoteNumber} - ${total}`;
        const publicUrl = quote.acceptanceToken 
          ? `${API_URL.replace('/api', '')}/q/${quote.acceptanceToken}` 
          : '';
        
        const body = `G'day ${client?.name || 'there'},\n\nPlease find your quote for ${quote.title || 'the requested work'}.\n\nTotal: ${total}\n\n${publicUrl ? `View and accept your quote here:\n${publicUrl}\n\n` : ''}Let me know if you have any questions!\n\nCheers`;
        
        const mailtoUrl = `mailto:${client?.email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        const canOpen = await Linking.canOpenURL(mailtoUrl);
        if (canOpen) {
          await Linking.openURL(mailtoUrl);
          showToast({ type: 'info', message: 'Note', description: 'Your device doesn\'t support file sharing. Please use "Use JobRunner" option to send with PDF attached.' });
        } else {
          showToast({ type: 'error', message: 'Unable to open email app. Please check your email settings.' });
        }
      }
    } catch (error: any) {
      if (__DEV__) console.log('Error preparing email:', error);
      showToast({ type: 'error', message: error.message || 'Failed to prepare email with PDF. Please try "Use JobRunner" option instead.' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleEmailSend = async (subject: string, message: string) => {
    const authToken = await api.getToken();
    
    try {
      // Use the email-with-pdf endpoint (same as web app) which attaches PDF automatically
      const response = await fetch(`${API_URL}/api/quotes/${id}/email-with-pdf`, {
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
        showToast({ type: 'info', message: 'Quote Sent!', description: `Email sent to ${result.recipientEmail} with PDF attached.\n\nView it in Communications Hub to see the full email and delivery status.` });
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
      showToast({ type: 'info', message: 'Quote Updated', description: 'Quote has been processed.' });

    } catch (networkError) {
      if (__DEV__) console.log('Network error sending quote:', networkError);
      throw new Error('Unable to send quote. Please check your connection and try again.');
    }
  };

  const handleAccept = async () => {
    if (isMarkingAccepted) return;
    Alert.alert(
      'Accept Quote',
      'Mark this quote as accepted by the client?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setIsMarkingAccepted(true);
            try {
              const success = await updateQuoteStatus(id!, 'accepted');
              if (success) {
                await loadData();
                showToast({ type: 'success', message: 'Success', description: 'Quote marked as accepted' });
              }
            } finally {
              setIsMarkingAccepted(false);
            }
          }
        }
      ]
    );
  };

  const handleConvertToInvoice = () => {
    if (!quote || isCreatingInvoice) return;
    
    Alert.alert(
      'Create Invoice',
      'This will create an invoice from this quote. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Invoice',
          onPress: async () => {
            setIsCreatingInvoice(true);
            try {
              const authToken = await api.getToken();
              const client = getClient(quote.clientId);
              
              const response = await fetch(`${API_URL}/api/invoices`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                  clientId: quote.clientId,
                  jobId: quote.jobId || undefined,
                  quoteId: quote.id,
                  title: quote.title || `Invoice from Quote #${quote.quoteNumber || id?.slice(0, 6)}`,
                  description: quote.description || undefined,
                  lineItems: quote.lineItems || [],
                  subtotal: quote.subtotal,
                  gstAmount: quote.gstAmount,
                  total: quote.total,
                  notes: quote.notes,
                  includesGst: quote.includesGst,
                  status: 'draft',
                  depositRequired: quote.depositRequired || false,
                  depositPercent: quote.depositPercent || undefined,
                  depositAmount: quote.depositAmount || undefined,
                  documentTemplate: quote.documentTemplate || businessSettings?.documentTemplate || 'professional',
                  documentTemplateSettings: quote.documentTemplateSettings || businessSettings?.documentTemplateSettings || null,
                }),
              });

              if (response.ok) {
                const newInvoice = await response.json();
                await fetchInvoices();
                await loadData();
                Alert.alert('Success', 'Invoice created from quote!', [
                  { text: 'View Invoice', onPress: () => router.push(`/more/invoice/${newInvoice.id}`) },
                  { text: 'OK' }
                ]);
              } else {
                const error = await response.json();
                showToast({ type: 'error', message: 'Error', description: error.error || 'Failed to create invoice' });
              }
            } catch (error) {
              if (__DEV__) console.log('Error creating invoice from quote:', error);
              showToast({ type: 'error', message: 'Error', description: 'Failed to create invoice. Please try again.' });
            } finally {
              setIsCreatingInvoice(false);
            }
          },
        },
      ]
    );
  };

  const handleConvertToJob = async () => {
    if (!quote || isCreatingJob) return;
    
    Alert.alert(
      'Create Job',
      'This will create a job from this quote. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Job',
          onPress: async () => {
            setIsCreatingJob(true);
            const { fetchJobs } = useJobsStore.getState();
            
            try {
              const authToken = await api.getToken();
              const response = await fetch(`${API_URL}/api/jobs`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                  title: `Job from Quote #${quote?.quoteNumber || id?.slice(0, 6)}`,
                  description: quote?.notes || '',
                  clientId: quote?.clientId,
                  quoteId: id,
                  status: 'pending',
                  address: getClient(quote?.clientId)?.address || '',
                }),
              });

              if (response.ok) {
                const newJob = await response.json();
                await fetchJobs();
                await loadData();
                Alert.alert('Success', 'Job created from quote!', [
                  { text: 'View Job', onPress: () => router.push(`/job/${newJob.id}`) },
                  { text: 'OK' }
                ]);
              } else {
                const error = await response.json();
                showToast({ type: 'error', message: 'Error', description: error.error || 'Failed to create job' });
              }
            } catch (error) {
              if (__DEV__) console.log('Error creating job from quote:', error);
              showToast({ type: 'error', message: 'Error', description: 'Failed to create job. Please try again.' });
            } finally {
              setIsCreatingJob(false);
            }
          },
        },
      ]
    );
  };
  
  // Task #93: push the quote to Xero via the real Xero Quotes API.
  const handlePushToXero = async () => {
    if (!quote || isPushingToXero) return;
    setIsPushingToXero(true);
    try {
      const res = await api.pushQuoteToXero(id!);
      if (res.data?.success && res.data?.xeroQuoteId) {
        showToast({ type: 'success', message: 'Quote pushed to Xero' });
        await loadData();
      } else if (res.data?.success) {
        showToast({ type: 'info', message: res.data?.message || 'Connect Xero first to push this quote.' });
      } else {
        showToast({ type: 'error', message: res.error || 'Failed to push quote to Xero' });
      }
    } catch (error: any) {
      if (__DEV__) console.log('Error pushing quote to Xero:', error);
      showToast({ type: 'error', message: error?.message || 'Failed to push quote to Xero' });
    } finally {
      setIsPushingToXero(false);
    }
  };

  const handleMarkAsSent = async () => {
    if (!quote || isMarkingSent) return;
    
    setIsMarkingSent(true);
    try {
      const success = await updateQuoteStatus(id!, 'sent');
      if (success) {
        await loadData();
        showToast({ type: 'success', message: 'Quote marked as sent' });
      } else {
        showToast({ type: 'error', message: 'Failed to update quote status' });
      }
    } catch (error) {
      if (__DEV__) console.log('Error marking quote as sent:', error);
      showToast({ type: 'error', message: 'Failed to update quote status' });
    } finally {
      setIsMarkingSent(false);
    }
  };

  const downloadPdfToCache = useCallback(async (): Promise<string | null> => {
    if (!quote) return null;
    
    // REQUIRED FIX: 15 second timeout as per requirements
    const PDF_TIMEOUT_MS = 15000; 
    
    const authToken = await api.getToken();
    if (!authToken) {
      throw new Error('Not authenticated. Please log in again.');
    }
    
    const fileUri = `${FileSystem.cacheDirectory}${quote.quoteNumber || 'quote'}_${Date.now()}.pdf`;
    const params = new URLSearchParams();
    if (includeBeforePhotos) params.set('includeBeforePhotos', 'true');
    if (includeAfterPhotos) params.set('includeAfterPhotos', 'true');
    if (!includeNotes) params.set('excludeNotes', 'true');
    if (hideSignature) params.set('hideSignature', 'true');
    const queryString = params.toString();
    const pdfUrl = `${API_URL}/api/quotes/${id}/pdf${queryString ? `?${queryString}` : ''}`;
    
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
        throw new Error('You do not have permission to download this quote.');
      }

      if (downloadResult.status === 404) {
        throw new Error('Quote not found. It may have been deleted.');
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
  }, [quote, id, includeBeforePhotos, includeAfterPhotos, includeNotes, hideSignature]);

  const handleDownloadPdf = async () => {
    if (!quote || isDownloadingPdf) return;
    
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
          dialogTitle: `Save Quote ${quote?.quoteNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        // Fallback: Copy to document directory
        const fileName = `${quote?.quoteNumber || 'quote'}.pdf`;
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
    
    try {
      const uri = pdfUri || await downloadPdfToCache();
      if (!uri) {
        throw new Error('Failed to generate PDF');
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Quote ${quote?.quoteNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        showToast({ type: 'info', message: 'Sharing Not Available', description: 'Sharing is not available on this device. Try saving to device instead.' });
      }
    } catch (error) {
      if (__DEV__) console.log('Share PDF error:', error);
      showToast({ type: 'error', message: 'Failed to share PDF. Please try again.' });
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
          dialogTitle: `Save Quote ${quote?.quoteNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        // Fallback: Copy to document directory
        const fileName = `${quote?.quoteNumber || 'quote'}.pdf`;
        const destUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: uri, to: destUri });
        showToast({ type: 'success', message: `PDF saved to app documents: ${fileName}` });
      }
    } catch (error) {
      if (__DEV__) console.log('Save to device error:', error);
      showToast({ type: 'error', message: 'Failed to save PDF. Please try again.' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleEmailQuote = () => {
    setShowShareSheet(false);
    setShowEmailCompose(true);
  };

  const handleCopyLink = async () => {
    try {
      let token = quote?.acceptanceToken;
      if (!token) {
        const response = await api.post<{ acceptanceToken?: string }>(`/api/quotes/${quote?.id}/generate-token`);
        token = response.data?.acceptanceToken;
        if (!token) {
          showToast({ type: 'error', message: 'Could not generate a shareable link. Please try again.' });
          return;
        }
      }
      
      const publicUrl = `${API_URL.replace('/api', '')}/q/${token}`;
      await Clipboard.setStringAsync(publicUrl);
      showToast({ type: 'info', message: 'Link Copied', description: 'The quote link has been copied to your clipboard. Share it with your client so they can view and accept the quote online.' });
    } catch (error) {
      console.error('Failed to copy link:', error);
      showToast({ type: 'error', message: 'Failed to copy link to clipboard' });
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Quote' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  if (!quote) {
    return (
      <>
        <Stack.Screen options={{ title: 'Quote' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Quote not found</Text>
        </View>
      </>
    );
  }

  const client = getClient(quote.clientId);
  const status = STATUS_CONFIG[quote.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
  const lineItems = quote.lineItems || [];

  const previewDocument = {
    id: quote.id,
    number: quote.quoteNumber,
    status: quote.status,
    clientName: client?.name || 'Unknown Client',
    clientEmail: client?.email,
    clientPhone: client?.phone,
    clientAddress: client?.address,
    subtotal: quote.subtotal,
    gstAmount: quote.gstAmount,
    total: quote.total,
    notes: quote.notes,
    createdAt: quote.createdAt,
    validUntil: quote.validUntil,
    lineItems: lineItems.map((item: any, index: number) => ({
      id: item.id || `item-${index}`,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    })),
    depositRequired: quote.depositAmount,
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: quote.quoteNumber || 'Quote',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Button
                size="icon"
                variant="ghost"
                onPress={() => setShowPreview(true)}
                icon={<Feather name="eye" size={22} color={colors.primary} />}
              >{null}</Button>
              <TouchableOpacity 
                onPress={handleDeleteQuote}
                style={styles.headerButton}
                disabled={isDeleting}
                data-testid="button-delete-quote"
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
          {/* Header Card */}
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <Text style={styles.quoteNumber}>{quote.quoteNumber}</Text>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
            </View>
            <Text style={styles.totalAmount}>{formatCurrency(quote.total)}</Text>
            <Text style={styles.totalLabel}>Total (inc. GST)</Text>
          </View>

          {/* Quick Actions Row 1 */}
          <View style={styles.quickActions}>
            <PressableRow 
              style={styles.quickAction}
              onPress={() => router.push(`/more/quote/new?editQuoteId=${id}`)}
            >
              <Feather name="edit-2" size={20} color={colors.primary} />
              <Text style={styles.quickActionText}>Edit</Text>
            </PressableRow>
            <PressableRow 
              style={styles.quickAction}
              onPress={() => setShowPreview(true)}
            >
              <Feather name="eye" size={20} color={colors.primary} />
              <Text style={styles.quickActionText}>Preview</Text>
            </PressableRow>
            <PressableRow 
              style={styles.quickAction}
              onPress={handleDownloadPdf}
              disabled={isDownloadingPdf}
            >
              {isDownloadingPdf ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="download" size={20} color={colors.primary} />
              )}
              <Text style={styles.quickActionText}>{isDownloadingPdf ? 'Generating...' : 'PDF'}</Text>
            </PressableRow>
            <PressableRow 
              style={styles.quickAction}
              onPress={handleCopyLink}
            >
              <Feather name="link" size={20} color={colors.primary} />
              <Text style={styles.quickActionText}>Copy Link</Text>
            </PressableRow>
            <PressableRow 
              style={styles.quickAction}
              onPress={() => setShowTemplateSelector(true)}
            >
              <Feather name="layout" size={20} color={colors.primary} />
              <Text style={styles.quickActionText}>Template</Text>
            </PressableRow>
            <PressableRow 
              style={styles.quickAction}
              onPress={handleDeleteQuote}
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
          
          {/* Quick Actions Row 2 - Draft status: Mark as Sent */}
          {quote.status === 'draft' && (
            <View style={[styles.quickActions, { marginTop: spacing.sm }]}>
              <PressableRow 
                style={[styles.quickAction, styles.quickActionPrimary, isSendingQuote && { opacity: 0.6 }]}
                onPress={handleSend}
                disabled={isSendingQuote || isMarkingSent}
                data-testid="button-send-to-client"
              >
                {isSendingQuote ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather name="send" size={20} color={colors.primaryForeground} />
                )}
                <Text style={[styles.quickActionText, { color: colors.primaryForeground }]}>
                  {isSendingQuote ? 'Sending...' : 'Send to Client'}
                </Text>
              </PressableRow>
              <PressableRow 
                style={[styles.quickAction, { backgroundColor: colors.info }, isMarkingSent && { opacity: 0.6 }]}
                onPress={handleMarkAsSent}
                disabled={isMarkingSent || isSendingQuote}
                data-testid="button-mark-as-sent"
              >
                {isMarkingSent ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Feather name="check" size={20} color={colors.white} />
                )}
                <Text style={[styles.quickActionText, { color: colors.white }]}>
                  {isMarkingSent ? 'Updating...' : 'Mark as Sent'}
                </Text>
              </PressableRow>
            </View>
          )}
          
          {/* Quick Actions Row 2 - Sent status: Resend */}
          {quote.status === 'sent' && (
            <View style={[styles.quickActions, { marginTop: spacing.sm }]}>
              <PressableRow 
                style={[styles.quickAction, styles.quickActionPrimary, isSendingQuote && { opacity: 0.6 }]}
                onPress={handleSend}
                disabled={isSendingQuote}
              >
                {isSendingQuote ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather name="send" size={20} color={colors.primaryForeground} />
                )}
                <Text style={[styles.quickActionText, { color: colors.primaryForeground }]}>
                  {isSendingQuote ? 'Sending...' : 'Resend to Client'}
                </Text>
              </PressableRow>
              <PressableRow 
                style={[styles.quickAction, { backgroundColor: colors.success }, isMarkingAccepted && { opacity: 0.6 }]}
                onPress={handleAccept}
                disabled={isMarkingAccepted}
              >
                {isMarkingAccepted ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Feather name="check-circle" size={20} color={colors.white} />
                )}
                <Text style={[styles.quickActionText, { color: colors.white }]}>
                  {isMarkingAccepted ? 'Updating...' : 'Mark Accepted'}
                </Text>
              </PressableRow>
            </View>
          )}
          
          {/* Quick Actions Row 2 - Accepted status: Create Invoice/Job */}
          {quote.status === 'accepted' && !linkedInvoice && !linkedJob && (
            <View style={[styles.quickActions, { marginTop: spacing.sm }]}>
              <PressableRow 
                style={[styles.quickAction, styles.quickActionPrimary]}
                onPress={handleConvertToInvoice}
                disabled={isCreatingInvoice}
                data-testid="button-create-invoice"
              >
                {isCreatingInvoice ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather name="file-text" size={20} color={colors.primaryForeground} />
                )}
                <Text style={[styles.quickActionText, { color: colors.primaryForeground }]}>
                  {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
                </Text>
              </PressableRow>
              <PressableRow 
                style={[styles.quickAction, { backgroundColor: colors.success }]}
                onPress={handleConvertToJob}
                disabled={isCreatingJob}
                data-testid="button-create-job"
              >
                {isCreatingJob ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Feather name="briefcase" size={20} color={colors.white} />
                )}
                <Text style={[styles.quickActionText, { color: colors.white }]}>
                  {isCreatingJob ? 'Creating...' : 'Create Job'}
                </Text>
              </PressableRow>
            </View>
          )}
          
          {/* If accepted but has one linked doc, show option to create the other */}
          {quote.status === 'accepted' && (linkedInvoice || linkedJob) && (!linkedInvoice || !linkedJob) && (
            <View style={[styles.quickActions, { marginTop: spacing.sm }]}>
              {!linkedInvoice && (
                <PressableRow 
                  style={[styles.quickAction, styles.quickActionPrimary, { flex: 1 }]}
                  onPress={handleConvertToInvoice}
                  disabled={isCreatingInvoice}
                  data-testid="button-create-invoice"
                >
                  {isCreatingInvoice ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Feather name="file-text" size={20} color={colors.primaryForeground} />
                  )}
                  <Text style={[styles.quickActionText, { color: colors.primaryForeground }]}>
                    {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
                  </Text>
                </PressableRow>
              )}
              {!linkedJob && (
                <PressableRow 
                  style={[styles.quickAction, { backgroundColor: colors.success, flex: 1 }]}
                  onPress={handleConvertToJob}
                  disabled={isCreatingJob}
                  data-testid="button-create-job"
                >
                  {isCreatingJob ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Feather name="briefcase" size={20} color={colors.white} />
                  )}
                  <Text style={[styles.quickActionText, { color: colors.white }]}>
                    {isCreatingJob ? 'Creating...' : 'Create Job'}
                  </Text>
                </PressableRow>
              )}
            </View>
          )}

          {/* Task #93: Push to Xero (real Xero Quotes API). Treat both
              xeroQuoteId (new path) and xeroInvoiceId (legacy DRAFT-invoice
              path) as already-synced so legacy quotes don't get double-pushed. */}
          {xeroConnected && (quote.status === 'sent' || quote.status === 'accepted') && !quote.xeroQuoteId && !quote.xeroInvoiceId && (
            <View style={[styles.quickActions, { marginTop: spacing.sm }]}>
              <PressableRow
                style={[styles.quickAction, { backgroundColor: colors.info, flex: 1 }, isPushingToXero && { opacity: 0.6 }]}
                onPress={handlePushToXero}
                disabled={isPushingToXero}
                data-testid="button-push-quote-to-xero"
              >
                {isPushingToXero ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Feather name="upload-cloud" size={20} color={colors.white} />
                )}
                <Text style={[styles.quickActionText, { color: colors.white }]}>
                  {isPushingToXero ? 'Pushing...' : 'Push to Xero'}
                </Text>
              </PressableRow>
            </View>
          )}
          {xeroConnected && (!!quote.xeroQuoteId || !!quote.xeroInvoiceId) && (
            <View style={[styles.card, { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }]}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>Pushed to Xero</Text>
            </View>
          )}

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
                <Text style={styles.infoText}>{formatDate(quote.createdAt)}</Text>
              </View>
            </View>
            {quote.validUntil && (
              <View style={styles.infoRow}>
                <Feather name="clock" size={18} color={colors.primary} />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Valid Until</Text>
                  <Text style={styles.infoText}>{formatDate(quote.validUntil)}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Version History */}
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}
            onPress={handleShowVersionHistory}
          >
            <Text style={styles.sectionTitle}>Edit History</Text>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Related Documents */}
          {(linkedInvoice || linkedJob) && (
            <>
              <Text style={styles.sectionTitle}>Related Documents</Text>
              <View style={styles.card}>
                {linkedJob && (
                  <TouchableOpacity 
                    style={styles.linkedDocRow}
                    onPress={() => router.push(`/job/${linkedJob.id}`)}
                  >
                    <View style={styles.linkedDocIcon}>
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
                {linkedInvoice && (
                  <TouchableOpacity 
                    style={[styles.linkedDocRow, linkedJob && styles.linkedDocRowBorder]}
                    onPress={() => router.push(`/more/invoice/${linkedInvoice.id}`)}
                  >
                    <View style={[styles.linkedDocIcon, { backgroundColor: colors.warningLight }]}>
                      <Feather name="file-text" size={18} color={colors.warning} />
                    </View>
                    <View style={styles.linkedDocInfo}>
                      <Text style={styles.linkedDocLabel}>Invoice</Text>
                      <Text style={styles.linkedDocTitle}>{linkedInvoice.invoiceNumber || `Invoice #${linkedInvoice.id.slice(0,6)}`}</Text>
                    </View>
                    <View style={[styles.linkedDocStatus, { 
                      backgroundColor: linkedInvoice.status === 'paid' ? colors.successLight : 
                                       linkedInvoice.status === 'overdue' ? colors.destructiveLight : 
                                       colors.infoLight 
                    }]}>
                      <Text style={[styles.linkedDocStatusText, { 
                        color: linkedInvoice.status === 'paid' ? colors.success : 
                               linkedInvoice.status === 'overdue' ? colors.destructive : 
                               colors.info 
                      }]}>
                        {linkedInvoice.status.charAt(0).toUpperCase() + linkedInvoice.status.slice(1)}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
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
              <Text style={styles.emptyStateSubtext}>Line items will appear here once added to the quote</Text>
            </View>
          )}

          {/* Amounts */}
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.card}>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Subtotal</Text>
              <Text style={styles.amountValue}>{formatCurrency(quote.subtotal)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>GST (10%)</Text>
              <Text style={styles.amountValue}>{formatCurrency(quote.gstAmount)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.amountRow}>
              <Text style={styles.totalLabel2}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(quote.total)}</Text>
            </View>
            {quote.depositAmount && quote.depositAmount > 0 && (
              <View style={styles.depositRow}>
                <Text style={styles.depositLabel}>Deposit Required</Text>
                <Text style={styles.depositValue}>{formatCurrency(quote.depositAmount)}</Text>
              </View>
            )}
          </View>

          {/* Notes */}
          {quote.notes && (
            <>
              <Text style={styles.sectionTitle}>Notes</Text>
              <View style={[styles.card, styles.notesCard]}>
                <View style={[styles.notesAccentBar, { backgroundColor: brandColor }]} />
                <View style={styles.notesContent}>
                  <Text style={styles.notesText}>{quote.notes}</Text>
                </View>
              </View>
            </>
          )}

          {/* Quote Acceptance Section */}
          {quote.status !== 'accepted' && quote.status !== 'rejected' && (
            <>
              <Text style={styles.sectionTitle}>Quote Acceptance</Text>
              <View style={styles.acceptanceCard}>
                <Text style={styles.acceptanceText}>
                  By signing below, I accept this quote and authorise the work to proceed in accordance with the terms and conditions above.
                </Text>
                <View style={styles.signaturePlaceholder}>
                  <View style={styles.signaturePlaceholderIcon}>
                    <Feather name="edit-3" size={18} color={colors.mutedForeground} />
                  </View>
                  <Text style={styles.signaturePlaceholderText}>Client signature area</Text>
                </View>
              </View>
            </>
          )}

          {/* Accepted Quote Signatures */}
          {quote.status === 'accepted' && allSignatures.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Quote Accepted</Text>
              {allSignatures.filter(sig => sig.documentType === 'quote_acceptance').map((sig, index) => (
                <View key={sig.id || index} style={[styles.card, styles.acceptedCard]}>
                  <View style={styles.acceptedHeader}>
                    <Feather name="check-circle" size={20} color={colors.success} />
                    <Text style={styles.acceptedTitle}>Quote Accepted</Text>
                  </View>
                  <View style={styles.signatureImageContainer}>
                    <Text style={styles.signatureLabel}>Client Signature:</Text>
                    {sig.signatureData && (
                      <Image 
                        source={{ uri: sig.signatureData }} 
                        style={styles.signatureImage}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                  {sig.signerName && (
                    <Text style={styles.acceptedInfo}>
                      Accepted by: {sig.signerName}
                    </Text>
                  )}
                  {sig.signedAt && (
                    <Text style={styles.acceptedInfo}>
                      Date: {formatDate(sig.signedAt)}
                    </Text>
                  )}
                </View>
              ))}
            </>
          )}

          {quote.status === 'accepted' && allSignatures.filter(sig => sig.documentType === 'quote_acceptance').length === 0 && quote.acceptedBy && (
            <>
              <Text style={styles.sectionTitle}>Quote Accepted</Text>
              <View style={[styles.card, styles.acceptedCard]}>
                <Text style={styles.acceptedInfo}>Accepted by: {quote.acceptedBy}</Text>
                {quote.acceptedAt && (
                  <Text style={styles.acceptedInfo}>Date: {formatDate(quote.acceptedAt)}</Text>
                )}
              </View>
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
          {quote.status === 'draft' && (
            <View style={styles.actionButtonsContainer}>
              <Button
                size="xl"
                variant="default"
                fullWidth
                loading={isSendingQuote}
                disabled={isSendingQuote || isMarkingSent}
                onPress={handleSend}
                icon={!isSendingQuote ? <Feather name="send" size={18} color={colors.primaryForeground} /> : undefined}
              >
                {isSendingQuote ? 'Sending...' : 'Send to Client'}
              </Button>
              <View style={{ height: 12 }} />
              <Button
                size="xl"
                variant="outline"
                fullWidth
                loading={isMarkingSent}
                disabled={isMarkingSent || isSendingQuote}
                onPress={handleMarkAsSent}
                icon={!isMarkingSent ? <Feather name="check" size={18} color={colors.foreground} /> : undefined}
              >
                {isMarkingSent ? 'Updating...' : 'Mark as Sent'}
              </Button>
            </View>
          )}
          
          {quote.status === 'sent' && (
            <View style={styles.actionButtonsContainer}>
              <Button
                size="xl"
                variant="default"
                fullWidth
                loading={isSendingQuote}
                disabled={isSendingQuote}
                onPress={handleSend}
                icon={!isSendingQuote ? <Feather name="send" size={18} color={colors.primaryForeground} /> : undefined}
              >
                {isSendingQuote ? 'Sending...' : 'Resend to Client'}
              </Button>
              <View style={{ height: 12 }} />
              <Button
                size="xl"
                variant="default"
                fullWidth
                loading={isMarkingAccepted}
                disabled={isMarkingAccepted}
                onPress={handleAccept}
                icon={!isMarkingAccepted ? <Feather name="check-circle" size={18} color={colors.primaryForeground} /> : undefined}
              >
                {isMarkingAccepted ? 'Updating...' : 'Mark as Accepted'}
              </Button>
            </View>
          )}

          {quote.status === 'accepted' && !linkedJob && (
            <Button
              size="xl"
              variant="default"
              fullWidth
              loading={isCreatingJob}
              disabled={isCreatingJob}
              onPress={handleConvertToJob}
              icon={!isCreatingJob ? <Feather name="briefcase" size={18} color={colors.primaryForeground} /> : undefined}
            >
              {isCreatingJob ? 'Creating Job...' : 'Create Job from Quote'}
            </Button>
          )}
          
          {quote.status === 'accepted' && !linkedInvoice && (
            <View style={{ marginTop: linkedJob ? 0 : 12 }}>
              <Button
                size="xl"
                variant="default"
                fullWidth
                loading={isCreatingInvoice}
                disabled={isCreatingInvoice}
                onPress={handleConvertToInvoice}
                icon={!isCreatingInvoice ? <Feather name="file-text" size={18} color={colors.primaryForeground} /> : undefined}
              >
                {isCreatingInvoice ? 'Creating Invoice...' : 'Convert to Invoice'}
              </Button>
            </View>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Version History Modal */}
      <AppBottomSheet
        visible={showVersionHistory}
        onDismiss={() => setShowVersionHistory(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: typography.sizes.lg, fontWeight: fontWeights.bold, color: colors.foreground }}>Edit History</Text>
            <TouchableOpacity onPress={() => setShowVersionHistory(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: spacing.lg }}>
            {isLoadingVersions ? (
              <View style={{ alignItems: 'center', padding: spacing['4xl'] }}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : versionHistory.length === 0 ? (
              <View style={{ alignItems: 'center', padding: spacing['4xl'] }}>
                <Feather name="clock" size={40} color={colors.mutedForeground} />
                <Text style={{ fontSize: typography.subtitle.fontSize, color: colors.mutedForeground, marginTop: spacing.md }}>No edit history yet</Text>
                <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground, marginTop: spacing.xs, textAlign: 'center' }}>
                  Changes will be recorded here when you edit the quote
                </Text>
              </View>
            ) : (
              versionHistory.map((version: any, index: number) => {
                const snapshot = version.snapshot || {};
                return (
                  <View key={version.id || index} style={{ backgroundColor: colors.card, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.bold, color: colors.primary }}>v{version.versionNumber}</Text>
                        </View>
                        <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                          {version.editedBy || 'Unknown'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>
                        {version.createdAt ? formatDate(version.createdAt) : ''}
                      </Text>
                    </View>
                    {version.changeNote && (
                      <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, marginBottom: spacing.sm, fontStyle: 'italic' }}>
                        {version.changeNote}
                      </Text>
                    )}
                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm }}>
                      <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, marginBottom: spacing.xs }}>
                        Total: {formatCurrency(snapshot.total)}
                      </Text>
                      {snapshot.lineItems && snapshot.lineItems.length > 0 && (
                        <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>
                          {snapshot.lineItems.length} item{snapshot.lineItems.length !== 1 ? 's' : ''}: {snapshot.lineItems.map((li: any) => li.description).join(', ')}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </AppBottomSheet>

      {/* Document Preview Modal */}
      <AppBottomSheet
        visible={showPreview}
        onDismiss={() => setShowPreview(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}
      >
        <View style={styles.previewModalContainer}>
          <View style={styles.previewModalHeader}>
            <TouchableOpacity onPress={() => setShowPreview(false)} style={styles.previewCloseButton}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.previewModalTitle}>Quote Preview</Text>
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
          {(quote.jobId || quote.notes || (quote.status === 'accepted' && allSignatures.length > 0)) && (
            <View style={styles.previewOptionsRow}>
              {quote.jobId && (
                <TouchableOpacity
                  style={[styles.previewOptionChip, includeBeforePhotos && styles.previewOptionChipActive]}
                  onPress={() => setIncludeBeforePhotos(!includeBeforePhotos)}
                >
                  <Feather name={includeBeforePhotos ? "check-square" : "square"} size={14} color={includeBeforePhotos ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.previewOptionChipText, includeBeforePhotos && { color: colors.primary }]}>Before</Text>
                </TouchableOpacity>
              )}
              {quote.jobId && (
                <TouchableOpacity
                  style={[styles.previewOptionChip, includeAfterPhotos && styles.previewOptionChipActive]}
                  onPress={() => setIncludeAfterPhotos(!includeAfterPhotos)}
                >
                  <Feather name={includeAfterPhotos ? "check-square" : "square"} size={14} color={includeAfterPhotos ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.previewOptionChipText, includeAfterPhotos && { color: colors.primary }]}>After</Text>
                </TouchableOpacity>
              )}
              {quote.notes && (
                <TouchableOpacity
                  style={[styles.previewOptionChip, includeNotes && styles.previewOptionChipActive]}
                  onPress={() => setIncludeNotes(!includeNotes)}
                >
                  <Feather name={includeNotes ? "check-square" : "square"} size={14} color={includeNotes ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.previewOptionChipText, includeNotes && { color: colors.primary }]}>Notes</Text>
                </TouchableOpacity>
              )}
              {quote.status === 'accepted' && allSignatures.length > 0 && (
                <TouchableOpacity
                  style={[styles.previewOptionChip, !hideSignature && styles.previewOptionChipActive]}
                  onPress={() => setHideSignature(!hideSignature)}
                >
                  <Feather name={!hideSignature ? "check-square" : "square"} size={14} color={!hideSignature ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.previewOptionChipText, !hideSignature && { color: colors.primary }]}>Signature</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <LiveDocumentPreview
            type="quote"
            documentNumber={quote.quoteNumber}
            date={quote.createdAt}
            validUntil={quote.validUntil}
            lineItems={lineItems.map((item: any) => ({
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
            }))}
            notes={includeNotes ? quote.notes : undefined}
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
            showDepositSection={!!quote.depositAmount && quote.depositAmount > 0}
            depositPercent={quote.depositAmount && quote.total ? Math.round((quote.depositAmount / quote.total) * 100) : 0}
            gstEnabled={user?.gstEnabled !== false}
            status={quote.status}
            templateId={quote.documentTemplate || businessSettings?.documentTemplate}
            templateCustomization={quote.documentTemplateSettings || businessSettings?.documentTemplateSettings}
            jobSignatures={!hideSignature ? allSignatures.map(sig => ({
              id: sig.id,
              signerName: sig.signerName || 'Client',
              signatureData: sig.signatureData,
              signedAt: sig.signedAt || new Date().toISOString(),
              documentType: sig.documentType,
            })) : []}
            acceptedAt={!hideSignature ? quote.acceptedAt : undefined}
            acceptedBy={!hideSignature ? quote.acceptedBy : undefined}
            clientSignatureData={!hideSignature ? client?.savedSignatureData ?? undefined : undefined}
            serverSubtotal={quote.subtotal}
            serverGstAmount={quote.gstAmount}
            serverTotal={quote.total}
            beforePhotos={includeBeforePhotos ? jobPhotos.filter((p: any) => p.category === 'before') : []}
            afterPhotos={includeAfterPhotos ? jobPhotos.filter((p: any) => p.category === 'after') : []}
          />
        </View>
      </AppBottomSheet>

      {/* Email Compose Modal */}
      <EmailComposeModal
        visible={showEmailCompose}
        onClose={() => setShowEmailCompose(false)}
        type="quote"
        documentId={id!}
        clientName={client?.name || 'Client'}
        clientEmail={client?.email || ''}
        documentNumber={quote?.quoteNumber || ''}
        documentTitle={quote?.title || 'Quote'}
        total={formatCurrency(quote?.total || 0)}
        businessName={user?.businessName}
        onSend={handleEmailSend}
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
            <Text style={styles.shareSheetTitle}>Share Quote</Text>
            <Text style={styles.shareSheetSubtitle}>{quote?.quoteNumber}</Text>
            
            <View style={styles.shareOptions}>
              <TouchableOpacity 
                style={styles.shareOption}
                onPress={handleEmailQuote}
              >
                <View style={[styles.shareOptionIcon, { backgroundColor: colors.primaryLight }]}>
                  <Feather name="mail" size={22} color={colors.primary} />
                </View>
                <Text style={styles.shareOptionText}>Email to Client</Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.shareOption}
                onPress={() => {
                  setShowShareSheet(false);
                  handleCopyLink();
                }}
              >
                <View style={[styles.shareOptionIcon, { backgroundColor: colors.infoLight }]}>
                  <Feather name="link" size={22} color={colors.info} />
                </View>
                <Text style={styles.shareOptionText}>Copy Quote Link</Text>
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

              <TouchableOpacity 
                style={styles.shareOption}
                onPress={handleSaveToDevice}
              >
                <View style={[styles.shareOptionIcon, { backgroundColor: colors.infoLight }]}>
                  <Feather name="download" size={22} color={colors.info} />
                </View>
                <Text style={styles.shareOptionText}>Save to Device</Text>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.shareOption}
                onPress={handleSharePdf}
              >
                <View style={[styles.shareOptionIcon, { backgroundColor: colors.warningLight }]}>
                  <Feather name="printer" size={22} color={colors.warning} />
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

      <MobileSendModal
        visible={showSendModal}
        onClose={() => setShowSendModal(false)}
        documentType="quote"
        documentId={id as string}
        recipientName={getClient(quote?.clientId)?.name || 'Client'}
        recipientEmail={getClient(quote?.clientId)?.email}
        recipientPhone={getClient(quote?.clientId)?.phone}
        documentTitle={quote?.quoteNumber || quote?.title || 'Quote'}
        defaultTab={sendModalDefaultTab}
        onSendSuccess={() => { loadData(); setShowSendModal(false); }}
      />
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
    padding: spacing.sm,
  },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: spacing['2xl'],
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  quoteNumber: {
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
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  quickAction: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 90,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 6,
    backgroundColor: colors.card,
    borderRadius: 16,
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
  sectionTitle: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.bold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  linkedDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  linkedDocRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkedDocIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedDocInfo: {
    flex: 1,
  },
  linkedDocLabel: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginBottom: spacing.xxs,
  },
  linkedDocTitle: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  linkedDocStatus: {
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  linkedDocStatusText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
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
    marginBottom: spacing.xxs,
  },
  infoText: {
    fontSize: typography.sizes.md,
    color: colors.foreground,
  },
  lineItem: {
    paddingVertical: spacing.md,
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
    marginTop: spacing.sm,
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
    paddingVertical: spacing.sm,
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
    marginVertical: spacing.sm,
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
  depositRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    padding: 14,
    borderRadius: 12,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  depositLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.warningDark,
  },
  depositValue: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.bold,
    color: colors.warningDark,
  },
  notesText: {
    fontSize: typography.button.fontSize,
    color: colors.foreground,
    lineHeight: 22,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 50,
    paddingVertical: spacing.lg,
  },
  successButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.success,
    borderRadius: 50,
    paddingVertical: spacing.lg,
  },
  primaryButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.bold,
    color: colors.primaryForeground,
    letterSpacing: 0.2,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 50,
    paddingVertical: spacing.lg,
  },
  secondaryButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  actionButtonsContainer: {
    marginTop: spacing.sm,
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
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
  sendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    marginBottom: spacing['2xl'],
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
    marginBottom: spacing.sm,
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
    marginBottom: spacing['2xl'],
  },
  previewCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing['2xl'],
  },
  previewTitle: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: spacing.md,
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
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.lg,
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
    padding: spacing.lg,
  },
  emptyStateCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing['3xl'],
    marginBottom: spacing['2xl'],
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
    marginBottom: spacing.xs,
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
  acceptanceCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.xl,
    marginBottom: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  acceptanceText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  signaturePlaceholder: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    paddingVertical: spacing['3xl'],
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed' as const,
    backgroundColor: colors.background,
    borderRadius: 10,
    marginTop: spacing.sm,
  },
  signaturePlaceholderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  signaturePlaceholderText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    fontWeight: fontWeights.medium,
    letterSpacing: 0.2,
  },
  acceptedCard: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
    borderWidth: 1.5,
  },
  acceptedHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: spacing.lg,
  },
  acceptedTitle: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.bold,
    color: colors.success,
  },
  signatureImageContainer: {
    marginBottom: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signatureLabel: {
    fontSize: typography.sizes.xs,
    color: colors.successDark,
    marginBottom: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    fontWeight: fontWeights.semibold,
  },
  signatureImage: {
    width: '100%' as const,
    height: 80,
  },
  acceptedInfo: {
    fontSize: typography.sizes.sm,
    color: colors.successDark,
    marginTop: spacing.xs,
  },
  footerSection: {
    marginTop: spacing.sm,
    marginBottom: spacing['2xl'],
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
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
    padding: spacing.xl,
  },
  templateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  templateModalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  templateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
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
    marginTop: spacing.xxs,
  },
  previewModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  previewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  previewCloseButton: {
    padding: spacing.sm,
    width: 40,
  },
  previewActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  previewActionButton: {
    padding: spacing.sm,
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
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  shareSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  shareSheetTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  shareSheetSubtitle: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  shareOptions: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
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
    paddingVertical: spacing.lg,
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
  previewOptionsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
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
  pdfOptionsCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pdfOptionsTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  pdfOptionsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.md,
  },
  pdfOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  pdfOptionActive: {
    backgroundColor: `${colors.primary}10`,
  },
  pdfOptionText: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
  },
});
