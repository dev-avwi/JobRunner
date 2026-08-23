import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography, fontWeights } from '../../src/lib/design-tokens';
import { formatCurrency } from '../../src/lib/format';
import { showToast } from '../../src/lib/toast';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { DatePicker } from '../../src/components/ui/DatePicker';
import api, { API_URL } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import LiveDocumentPreview from '../../src/components/LiveDocumentPreview';

type DocType = 'invoice' | 'quote';

interface BusinessOption {
  businessOwnerId: string;
  businessName: string | null;
  roleName: string;
}

interface CompletedJob {
  jobId: string;
  jobTitle: string;
  jobStatus: string;
  completedAt: string | null;
  suggestedHours: number;
  hourlyRate: number;
  materialsCost: number;
  suggestedAmount: number;
  alreadyBilled: boolean;
}

interface LineItem {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  jobId: string | null;
}

interface CatalogItem {
  id?: string;
  name?: string;
  description?: string;
  price?: number;
  unitPrice?: number;
}

let keyCounter = 0;
const nextKey = () => `li-${Date.now()}-${keyCounter++}`;

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function SubbieBillBuilder() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const confirm = useConfirmDialog();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ docType?: string }>();
  const { user, businessSettings } = useAuthStore();

  const paramDocType: DocType | null =
    params.docType === 'quote' ? 'quote' : params.docType === 'invoice' ? 'invoice' : null;

  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [recipient, setRecipient] = useState<BusinessOption | null>(null);
  const businessOwnerId = recipient?.businessOwnerId ?? null;

  const [docType, setDocType] = useState<DocType | null>(paramDocType);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [gstEnabled, setGstEnabled] = useState(true);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [docDate, setDocDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  });

  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const [requestOnlinePayment, setRequestOnlinePayment] = useState(false);

  // Line item editor modal
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorKey, setEditorKey] = useState<string | null>(null);
  const [editorDesc, setEditorDesc] = useState('');
  const [editorQty, setEditorQty] = useState('1');
  const [editorPrice, setEditorPrice] = useState('0.00');

  // Catalog modal
  const [catalogVisible, setCatalogVisible] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const loadBusinesses = useCallback(async () => {
    setLoadingBusinesses(true);
    try {
      const res = await api.get<{ activeBusinessId?: string | null; businesses: BusinessOption[] }>(
        '/api/auth/my-businesses'
      );
      const all = Array.isArray(res.data?.businesses) ? res.data.businesses : [];
      const activeId = res.data?.activeBusinessId ?? null;
      // The recipient is the business this subcontractor is currently switched into.
      // Prefer the active workspace; fall back to the first joined (non-own) business.
      const joined = all.filter(b => b.businessOwnerId !== user?.id);
      const active = all.find(b => b.businessOwnerId === activeId);
      const pick =
        active && active.businessOwnerId !== user?.id ? active : joined[0] ?? null;
      setRecipient(pick);
    } catch {
      showToast({ type: 'error', message: 'Could not load business' });
    } finally {
      setLoadingBusinesses(false);
    }
  }, [user?.id]);

  const loadCompletedJobs = useCallback(async (ownerId: string) => {
    setLoadingJobs(true);
    try {
      const res = await api.get<CompletedJob[]>(`/api/subcontractor/completed-jobs?businessOwnerId=${ownerId}`);
      setCompletedJobs(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCompletedJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => { loadBusinesses(); }, [loadBusinesses]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ connected?: boolean; chargesEnabled?: boolean }>('/api/stripe-connect/status');
        if (!cancelled && !res.error) {
          setStripeReady(!!res.data?.connected && !!res.data?.chargesEnabled);
        }
      } catch {
        // leave stripeReady false
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (businessOwnerId) {
      loadCompletedJobs(businessOwnerId);
    } else {
      setCompletedJobs([]);
    }
  }, [businessOwnerId, loadCompletedJobs]);

  const addedJobIds = useMemo(
    () => new Set(lineItems.map(li => li.jobId).filter(Boolean) as string[]),
    [lineItems]
  );

  const addJob = useCallback((job: CompletedJob) => {
    setLineItems(prev => [
      ...prev,
      {
        key: nextKey(),
        description: job.jobTitle,
        quantity: '1',
        unitPrice: job.suggestedAmount.toFixed(2),
        jobId: job.jobId,
      },
    ]);
  }, []);

  const removeItem = useCallback((key: string) => {
    setLineItems(prev => prev.filter(li => li.key !== key));
  }, []);

  const openNewItem = useCallback(() => {
    setEditorKey(null);
    setEditorDesc('');
    setEditorQty('1');
    setEditorPrice('0.00');
    setEditorVisible(true);
  }, []);

  const openEditItem = useCallback((li: LineItem) => {
    setEditorKey(li.key);
    setEditorDesc(li.description);
    setEditorQty(li.quantity);
    setEditorPrice(li.unitPrice);
    setEditorVisible(true);
  }, []);

  const saveEditorItem = useCallback(() => {
    const desc = editorDesc.trim();
    if (!desc) {
      showToast({ type: 'error', message: 'Add a description' });
      return;
    }
    const qty = editorQty.trim() || '1';
    const price = editorPrice.trim() || '0';
    if (editorKey) {
      setLineItems(prev => prev.map(li => (li.key === editorKey ? { ...li, description: desc, quantity: qty, unitPrice: price } : li)));
    } else {
      setLineItems(prev => [...prev, { key: nextKey(), description: desc, quantity: qty, unitPrice: price, jobId: null }]);
    }
    setEditorVisible(false);
  }, [editorKey, editorDesc, editorQty, editorPrice]);

  const openCatalog = useCallback(async () => {
    setCatalogVisible(true);
    setLoadingCatalog(true);
    try {
      const res = await api.get<CatalogItem[]>('/api/catalog');
      setCatalogItems(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCatalogItems([]);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  const addCatalogItem = useCallback((item: CatalogItem) => {
    setLineItems(prev => [
      ...prev,
      {
        key: nextKey(),
        description: item.name || item.description || '',
        quantity: '1',
        unitPrice: String(item.price ?? item.unitPrice ?? 0),
        jobId: null,
      },
    ]);
    setCatalogVisible(false);
  }, []);

  const subtotal = useMemo(
    () => lineItems.reduce((sum, li) => sum + (parseFloat(li.quantity) || 0) * (parseFloat(li.unitPrice) || 0), 0),
    [lineItems]
  );
  const gst = gstEnabled ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
  const total = Math.round((subtotal + gst) * 100) / 100;

  const docNoun = docType === 'quote' ? 'Quote' : 'Invoice';

  const previewBusiness = {
    businessName: businessSettings?.businessName || user?.businessName || 'Your Business',
    abn: (businessSettings as any)?.abn,
    email: businessSettings?.email || user?.email,
    phone: (businessSettings as any)?.phone,
    address: (businessSettings as any)?.address,
    logoUrl: (businessSettings as any)?.logoUrl,
    brandColor: (businessSettings as any)?.brandColor,
  };
  const previewClient = recipient ? { name: recipient.businessName || 'Business' } : null;
  const previewLineItems = lineItems.map(li => ({
    description: li.description,
    quantity: parseFloat(li.quantity) || 0,
    unitPrice: parseFloat(li.unitPrice) || 0,
  }));

  const cameFromParam = paramDocType !== null;
  const handleBack = () => {
    if (docType && !cameFromParam) {
      setDocType(null);
      setActiveTab('edit');
    } else {
      router.back();
    }
  };

  const downloadAndShare = useCallback(async (id: string, label: string) => {
    try {
      const token = await api.getToken();
      if (!token) throw new Error('Not signed in');
      const fileUri = `${FileSystem.cacheDirectory}${label}_${Date.now()}.pdf`;
      const result = await FileSystem.createDownloadResumable(
        `${API_URL}/api/subcontractor/invoices/${id}/pdf`,
        fileUri,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' } }
      ).downloadAsync();
      if (!result || result.status !== 200) throw new Error('Could not generate PDF');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Save ${label}` });
      } else {
        showToast({ type: 'success', message: 'PDF saved' });
      }
    } catch (e) {
      showToast({ type: 'error', message: e instanceof Error ? e.message : 'PDF failed' });
    }
  }, []);

  const submit = useCallback(async () => {
    if (!businessOwnerId) {
      showToast({ type: 'error', message: 'No business to bill' });
      return;
    }
    const cleaned = lineItems.filter(li => li.description.trim().length > 0);
    if (cleaned.length === 0) {
      showToast({ type: 'error', message: 'Add at least one line item' });
      return;
    }
    const ok = await confirm({
      title: `Send ${docNoun}?`,
      message: `This ${docNoun.toLowerCase()} for ${formatCurrency(total)} will be sent to the business for review.`,
      confirmText: 'Send',
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await api.post<{ id: string; invoiceNumber?: string }>('/api/subcontractor/billing-documents', {
        businessOwnerId,
        docType,
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
        gstEnabled,
        validUntil: docType === 'quote' ? formatLocalDate(docDate) : undefined,
        dueDate: docType === 'invoice' ? formatLocalDate(docDate) : undefined,
        items: cleaned.map(li => ({
          description: li.description.trim(),
          quantity: parseFloat(li.quantity) || 0,
          unitPrice: parseFloat(li.unitPrice) || 0,
          jobId: li.jobId || undefined,
        })),
        requestOnlinePayment: docType === 'invoice' && stripeReady ? requestOnlinePayment : undefined,
      });
      if (res.error || !res.data?.id) {
        showToast({ type: 'error', message: res.error || `Could not create ${docNoun.toLowerCase()}` });
        return;
      }
      const newId = res.data.id;
      const label = res.data.invoiceNumber || docNoun;
      showToast({ type: 'success', message: `${docNoun} sent` });
      const viewPdf = await confirm({
        title: `${docNoun} Sent`,
        message: 'Do you want to view the PDF now?',
        confirmText: 'View PDF',
        cancelText: 'Done',
      });
      if (viewPdf) {
        await downloadAndShare(newId, label);
      }
      router.replace('/more/subbie-earnings' as any);
    } catch (e) {
      showToast({ type: 'error', message: e instanceof Error ? e.message : 'Something went wrong' });
    } finally {
      setSubmitting(false);
    }
  }, [businessOwnerId, lineItems, docType, title, notes, gstEnabled, docDate, total, docNoun, confirm, downloadAndShare, stripeReady, requestOnlinePayment]);

  const editorTotal = (parseFloat(editorQty) || 0) * (parseFloat(editorPrice) || 0);
  const suggestedJobs = completedJobs.filter(j => !addedJobIds.has(j.jobId));

  // ---- Chooser screen ----
  if (docType === null) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <PressableRow style={styles.backButton} onPress={handleBack}>
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </PressableRow>
          <Text style={styles.headerTitle}>Bill a Business</Text>
          <View style={styles.headerRight} />
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          <Text style={styles.chooserHeading}>What do you want to create?</Text>
          <PressableRow style={styles.chooserCard} onPress={() => setDocType('invoice')}>
            <View style={styles.chooserIcon}>
              <Feather name="file-text" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chooserTitle}>Invoice</Text>
              <Text style={styles.chooserSub}>Bill a business for completed work</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </PressableRow>
          <PressableRow style={styles.chooserCard} onPress={() => setDocType('quote')}>
            <View style={styles.chooserIcon}>
              <Feather name="file" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chooserTitle}>Quote</Text>
              <Text style={styles.chooserSub}>Send a price estimate before the work</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
          </PressableRow>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Sticky header with total + tabs */}
      <View style={styles.stickyHeader}>
        <View style={styles.headerRow}>
          <PressableRow style={styles.backButton} onPress={handleBack}>
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </PressableRow>
          <Text style={styles.headerTitle}>New {docNoun}</Text>
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>{formatCurrency(total)}</Text>
          </View>
        </View>

        <View style={styles.tabBar}>
          <PressableRow
            style={[styles.tabItem, activeTab === 'edit' && styles.tabItemActive]}
            onPress={() => setActiveTab('edit')}
          >
            <Feather name="edit-2" size={16} color={activeTab === 'edit' ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[styles.tabText, activeTab === 'edit' && styles.tabTextActive]}>Edit</Text>
          </PressableRow>
          <PressableRow
            style={[styles.tabItem, activeTab === 'preview' && styles.tabItemActive]}
            onPress={() => setActiveTab('preview')}
          >
            <Feather name="eye" size={16} color={activeTab === 'preview' ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[styles.tabText, activeTab === 'preview' && styles.tabTextActive]}>Preview</Text>
          </PressableRow>
        </View>
      </View>

      {activeTab === 'preview' ? (
        <View style={styles.previewContainer}>
          <View style={styles.previewBar}>
            <Text style={styles.previewBarLabel}>Live Preview</Text>
            <View style={styles.previewBarBadge}>
              <Text style={styles.previewBarBadgeText}>Updates as you type</Text>
            </View>
          </View>
          <LiveDocumentPreview
            type={docType}
            title={title}
            date={formatLocalDate(new Date())}
            validUntil={docType === 'quote' ? formatLocalDate(docDate) : undefined}
            dueDate={docType === 'invoice' ? formatLocalDate(docDate) : undefined}
            lineItems={previewLineItems}
            notes={notes}
            business={previewBusiness}
            client={previewClient}
            gstEnabled={gstEnabled}
            templateId={(businessSettings as any)?.documentTemplate || 'minimal'}
            templateCustomization={(businessSettings as any)?.documentTemplateSettings}
            bottomPadding={insets.bottom + 120}
          />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {loadingBusinesses ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : !recipient ? (
            <View style={styles.loadingWrap}>
              <Feather name="briefcase" size={32} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>No business to bill</Text>
              <Text style={styles.empty}>
                You're not currently working under a business. Switch into a business workspace to bill it.
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + 120, gap: spacing.lg }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Billing To (locked) */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Feather name="briefcase" size={16} color={colors.primary} />
                  <Text style={styles.cardHeaderText}>Billing To</Text>
                </View>
                <View style={styles.recipientRow}>
                  <View style={styles.recipientAvatar}>
                    <Text style={styles.recipientAvatarText}>
                      {(recipient.businessName || 'B').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recipientName}>{recipient.businessName || 'Business'}</Text>
                    <Text style={styles.recipientSub}>The business you're working under</Text>
                  </View>
                  <Feather name="lock" size={16} color={colors.mutedForeground} />
                </View>
              </View>

              {/* Details */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Feather name="file-text" size={16} color={colors.primary} />
                  <Text style={styles.cardHeaderText}>{docNoun} Details</Text>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Title (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder={docType === 'quote' ? 'e.g. Bathroom reno quote' : 'e.g. October works'}
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <DatePicker
                    label={docType === 'quote' ? 'Valid Until' : 'Due Date'}
                    value={docDate}
                    onChange={setDocDate}
                    minimumDate={new Date()}
                  />
                </View>
              </View>

              {/* Line Items */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeader}>
                    <Feather name="package" size={16} color={colors.primary} />
                    <Text style={styles.cardHeaderText}>Line Items</Text>
                  </View>
                  <View style={styles.itemCountBadge}>
                    <Text style={styles.itemCountText}>
                      {lineItems.length} {lineItems.length === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                </View>

                {/* Suggested from completed jobs */}
                {loadingJobs ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.sm }} />
                ) : suggestedJobs.length > 0 ? (
                  <View style={styles.suggestBox}>
                    <Text style={styles.suggestLabel}>Tap to add from completed jobs</Text>
                    <View style={{ gap: spacing.xs }}>
                      {suggestedJobs.map(job => {
                        const blockedBilled = docType === 'invoice' && job.alreadyBilled;
                        return (
                          <PressableRow
                            key={job.jobId}
                            style={[styles.suggestRow, blockedBilled && { opacity: 0.5 }]}
                            onPress={() => !blockedBilled && addJob(job)}
                            disabled={blockedBilled}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.suggestJobTitle} numberOfLines={1}>{job.jobTitle}</Text>
                              <Text style={styles.suggestJobMeta}>
                                {formatCurrency(job.suggestedAmount)}
                                {job.alreadyBilled ? '  ·  already invoiced' : ''}
                              </Text>
                            </View>
                            <Feather
                              name={blockedBilled ? 'slash' : 'plus-circle'}
                              size={20}
                              color={blockedBilled ? colors.mutedForeground : colors.primary}
                            />
                          </PressableRow>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {lineItems.map(li => {
                  const itemTotal = (parseFloat(li.quantity) || 0) * (parseFloat(li.unitPrice) || 0);
                  return (
                    <View key={li.key} style={styles.lineItemRow}>
                      <View style={styles.lineItemInfo}>
                        <Text style={styles.lineItemDescription} numberOfLines={1}>{li.description}</Text>
                        <Text style={styles.lineItemMeta}>
                          {li.quantity} × {formatCurrency(parseFloat(li.unitPrice) || 0)}
                        </Text>
                      </View>
                      <Text style={styles.lineItemTotal}>{formatCurrency(itemTotal)}</Text>
                      <View style={styles.lineItemActions}>
                        <PressableRow style={styles.iconButton} onPress={() => openEditItem(li)}>
                          <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                        </PressableRow>
                        <PressableRow style={styles.iconButton} onPress={() => removeItem(li.key)}>
                          <Feather name="trash-2" size={14} color={colors.destructive} />
                        </PressableRow>
                      </View>
                    </View>
                  );
                })}

                <View style={styles.addButtonsRow}>
                  <PressableRow style={styles.addItemButton} onPress={openNewItem}>
                    <Feather name="plus" size={16} color={colors.foreground} />
                    <Text style={styles.addItemText}>Add Item</Text>
                  </PressableRow>
                  <PressableRow style={styles.catalogButton} onPress={openCatalog}>
                    <Feather name="book-open" size={16} color={colors.foreground} />
                    <Text style={styles.addItemText}>Catalog</Text>
                  </PressableRow>
                </View>
              </View>

              {/* Totals */}
              {lineItems.length > 0 && (
                <View style={styles.totalsCard}>
                  {gstEnabled ? (
                    <>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Subtotal</Text>
                        <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>GST (10%)</Text>
                        <Text style={styles.totalValue}>{formatCurrency(gst)}</Text>
                      </View>
                      <View style={[styles.totalRow, styles.grandTotalRow]}>
                        <Text style={styles.grandTotalLabel}>Total (inc. GST)</Text>
                        <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.totalRow}>
                      <Text style={styles.grandTotalLabel}>Total</Text>
                      <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* GST */}
              <View style={styles.card}>
                <View style={styles.toggleHeader}>
                  <View style={styles.cardHeader}>
                    <Feather name="percent" size={16} color={colors.primary} />
                    <Text style={styles.cardHeaderText}>Add GST (10%)</Text>
                  </View>
                  <PressableRow
                    style={[styles.toggleSwitch, gstEnabled && styles.toggleSwitchOn]}
                    onPress={() => setGstEnabled(v => !v)}
                  >
                    <View style={[styles.toggleKnob, gstEnabled && styles.toggleKnobOn]} />
                  </PressableRow>
                </View>
              </View>

              {/* Online card payment */}
              {docType === 'invoice' && stripeReady && (
                <View style={styles.card}>
                  <View style={styles.toggleHeader}>
                    <View style={styles.cardHeader}>
                      <Feather name="credit-card" size={16} color={colors.primary} />
                      <Text style={styles.cardHeaderText}>Accept card payment</Text>
                    </View>
                    <PressableRow
                      style={[styles.toggleSwitch, requestOnlinePayment && styles.toggleSwitchOn]}
                      onPress={() => setRequestOnlinePayment(v => !v)}
                    >
                      <View style={[styles.toggleKnob, requestOnlinePayment && styles.toggleKnobOn]} />
                    </PressableRow>
                  </View>
                  <Text style={styles.toggleHint}>
                    Adds a secure card payment link so the business can pay this invoice online. Funds go to your Stripe account. Fees apply: 2.5% platform fee plus Stripe processing fees, deducted from the payout.
                  </Text>
                </View>
              )}

              {/* Notes */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Feather name="message-square" size={16} color={colors.primary} />
                  <Text style={styles.cardHeaderText}>Notes</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Anything the business should know..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>
          )}

          {recipient && (
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
              <PressableRow
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={submit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <>
                    <Feather name="check" size={18} color={colors.primaryForeground} />
                    <Text style={styles.submitText}>Send {docNoun}</Text>
                  </>
                )}
              </PressableRow>
            </View>
          )}
        </KeyboardAvoidingView>
      )}

      {/* Line item editor */}
      <AppBottomSheet
        visible={editorVisible}
        onDismiss={() => setEditorVisible(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editorKey ? 'Edit Item' : 'Add Item'}</Text>
            <PressableRow onPress={() => setEditorVisible(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.input}
                value={editorDesc}
                onChangeText={setEditorDesc}
                placeholder="e.g. Labour - 4 hours"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
              />
            </View>
            <View style={styles.editorRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={editorQty}
                  onChangeText={setEditorQty}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Unit Price</Text>
                <TextInput
                  style={styles.input}
                  value={editorPrice}
                  onChangeText={setEditorPrice}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>
            <View style={styles.editorTotalRow}>
              <Text style={styles.totalLabel}>Amount</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(editorTotal)}</Text>
            </View>
            <PressableRow style={styles.modalSaveBtn} onPress={saveEditorItem}>
              <Feather name="check" size={18} color={colors.primaryForeground} />
              <Text style={styles.submitText}>{editorKey ? 'Save Item' : 'Add Item'}</Text>
            </PressableRow>
          </ScrollView>
        </View>
      </AppBottomSheet>

      {/* Catalog */}
      <AppBottomSheet
        visible={catalogVisible}
        onDismiss={() => setCatalogVisible(false)}
        snapPoints={['80%']}
        scrollable={false}
        contentPadding={0}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Catalog</Text>
            <PressableRow onPress={() => setCatalogVisible(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
          </View>
          {loadingCatalog ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
          ) : catalogItems.length === 0 ? (
            <Text style={[styles.empty, { padding: spacing.lg }]}>No catalog items yet.</Text>
          ) : (
            <ScrollView style={styles.modalContent}>
              {catalogItems.map((item, idx) => (
                <PressableRow
                  key={item.id || String(idx)}
                  style={styles.catalogRow}
                  onPress={() => addCatalogItem(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineItemDescription} numberOfLines={1}>
                      {item.name || item.description}
                    </Text>
                    <Text style={styles.lineItemMeta}>
                      {formatCurrency(item.price ?? item.unitPrice ?? 0)}
                    </Text>
                  </View>
                  <Feather name="plus-circle" size={20} color={colors.primary} />
                </PressableRow>
              ))}
            </ScrollView>
          )}
        </View>
      </AppBottomSheet>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
    emptyTitle: { fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, marginTop: spacing.sm },
    empty: { fontSize: typography.sizes.sm, color: colors.mutedForeground, textAlign: 'center', lineHeight: 19 },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    stickyHeader: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: typography.sizes.lg, fontWeight: fontWeights.semibold, color: colors.foreground },
    headerRight: { width: 36 },
    totalBadge: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.md,
      minWidth: 80,
      alignItems: 'center',
    },
    totalBadgeText: { fontSize: typography.sizes.md, fontWeight: fontWeights.bold, color: colors.primary },

    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.muted,
      borderRadius: 12,
      padding: 4,
      gap: 4,
      marginTop: 8,
    },
    tabItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 44,
      borderRadius: 8,
    },
    tabItemActive: { backgroundColor: colors.primary },
    tabText: { fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.foreground },
    tabTextActive: { color: colors.primaryForeground },

    previewContainer: { flex: 1, backgroundColor: colors.background },
    previewBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    previewBarLabel: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.medium,
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    previewBarBadge: {
      backgroundColor: colors.muted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewBarBadgeText: { fontSize: typography.sizes.xs, fontWeight: fontWeights.medium, color: colors.mutedForeground },

    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardHeaderText: { fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground },

    recipientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    recipientAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recipientAvatarText: { fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.bold, color: colors.primary },
    recipientName: { fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.foreground },
    recipientSub: { fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 2 },

    inputGroup: { gap: 6 },
    inputLabel: { fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.mutedForeground },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: typography.sizes.md,
      color: colors.foreground,
      letterSpacing: 0,
      textAlign: 'left',
    },
    textArea: { height: 88, paddingTop: 10 },

    itemCountBadge: {
      backgroundColor: colors.muted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.sm,
    },
    itemCountText: { fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.mutedForeground },

    suggestBox: {
      backgroundColor: colors.background,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
      gap: spacing.xs,
    },
    suggestLabel: { fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.mutedForeground, marginBottom: 2 },
    suggestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 8,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.card,
      borderRadius: radius.sm,
    },
    suggestJobTitle: { fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.foreground },
    suggestJobMeta: { fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 2 },

    lineItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    lineItemInfo: { flex: 1 },
    lineItemDescription: { fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.foreground },
    lineItemMeta: { fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 2 },
    lineItemTotal: { fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground },
    lineItemActions: { flexDirection: 'row', gap: 4 },
    iconButton: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },

    addButtonsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    addItemButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: 12,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      overflow: 'hidden',
    },
    addItemText: { fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground },
    catalogButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
    },

    totalsCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.xs,
    },
    totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    totalLabel: { fontSize: typography.button.fontSize, color: colors.mutedForeground },
    totalValue: { fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.foreground },
    grandTotalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs, paddingTop: spacing.sm },
    grandTotalLabel: { fontSize: typography.sizes.md, fontWeight: fontWeights.bold, color: colors.foreground },
    grandTotalValue: { fontSize: typography.sizes.lg, fontWeight: fontWeights.bold, color: colors.primary },

    toggleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    toggleHint: { fontSize: typography.sizes.sm, color: colors.mutedForeground, lineHeight: 18, marginTop: spacing.sm, letterSpacing: 0 },
    toggleSwitch: {
      width: 48,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.muted,
      padding: 3,
      justifyContent: 'center',
    },
    toggleSwitchOn: { backgroundColor: colors.primary },
    toggleKnob: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.card,
    },
    toggleKnobOn: { alignSelf: 'flex-end' },

    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: 14,
      borderRadius: radius.md,
    },
    submitText: { fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: colors.primaryForeground },

    // Chooser
    chooserHeading: { fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.xs },
    chooserCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    chooserIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chooserTitle: { fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground },
    chooserSub: { fontSize: typography.sizes.sm, color: colors.mutedForeground, marginTop: 2 },

    // Modals
    modalContainer: { flex: 1 },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: { fontSize: typography.sizes.lg, fontWeight: fontWeights.semibold, color: colors.foreground },
    modalContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    editorRow: { flexDirection: 'row', gap: spacing.md },
    editorTotalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.muted,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    modalSaveBtn: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: 14,
      borderRadius: radius.md,
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
    },
    catalogRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
  });
}
