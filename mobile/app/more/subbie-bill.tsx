import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius } from '../../src/lib/design-tokens';
import { formatCurrency } from '../../src/lib/format';
import { showToast } from '../../src/lib/toast';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import api, { API_URL } from '../../src/lib/api';

type DocType = 'invoice' | 'quote';

interface BusinessOption {
  businessOwnerId: string;
  businessName: string;
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

let keyCounter = 0;
const nextKey = () => `li-${Date.now()}-${keyCounter++}`;

export default function SubbieBillBuilder() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const confirm = useConfirmDialog();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [businessOwnerId, setBusinessOwnerId] = useState<string | null>(null);

  const [docType, setDocType] = useState<DocType>('invoice');
  const [gstEnabled, setGstEnabled] = useState(true);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadBusinesses = useCallback(async () => {
    setLoadingBusinesses(true);
    try {
      const res = await api.get<{ businesses: BusinessOption[] }>('/api/auth/my-businesses');
      const all = res.data?.businesses || [];
      const subOnly = all.filter(b => (b.roleName || '').toLowerCase().includes('subcontractor'));
      const list = subOnly.length > 0 ? subOnly : all;
      setBusinesses(list);
      if (list.length === 1) {
        setBusinessOwnerId(list[0].businessOwnerId);
      }
    } catch {
      showToast({ type: 'error', message: 'Could not load businesses' });
    } finally {
      setLoadingBusinesses(false);
    }
  }, []);

  const loadCompletedJobs = useCallback(async (ownerId: string) => {
    setLoadingJobs(true);
    try {
      const res = await api.get<CompletedJob[]>(`/api/subcontractor/completed-jobs?businessOwnerId=${ownerId}`);
      setCompletedJobs(res.data || []);
    } catch {
      setCompletedJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => { loadBusinesses(); }, [loadBusinesses]);

  useEffect(() => {
    if (businessOwnerId) {
      setLineItems([]);
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

  const addBlank = useCallback(() => {
    setLineItems(prev => [...prev, { key: nextKey(), description: '', quantity: '1', unitPrice: '0.00', jobId: null }]);
  }, []);

  const updateItem = useCallback((key: string, field: 'description' | 'quantity' | 'unitPrice', value: string) => {
    setLineItems(prev => prev.map(li => (li.key === key ? { ...li, [field]: value } : li)));
  }, []);

  const removeItem = useCallback((key: string) => {
    setLineItems(prev => prev.filter(li => li.key !== key));
  }, []);

  const subtotal = useMemo(
    () => lineItems.reduce((sum, li) => sum + (parseFloat(li.quantity) || 0) * (parseFloat(li.unitPrice) || 0), 0),
    [lineItems]
  );
  const gst = gstEnabled ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
  const total = Math.round((subtotal + gst) * 100) / 100;

  const docNoun = docType === 'invoice' ? 'Invoice' : 'Quote';

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
      showToast({ type: 'error', message: 'Pick a business first' });
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
        items: cleaned.map(li => ({
          description: li.description.trim(),
          quantity: parseFloat(li.quantity) || 0,
          unitPrice: parseFloat(li.unitPrice) || 0,
          jobId: li.jobId || undefined,
        })),
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
  }, [businessOwnerId, lineItems, docType, title, notes, gstEnabled, total, docNoun, confirm, downloadAndShare]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Bill a Business', headerShown: true }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Doc type toggle */}
          <View style={styles.segment}>
            {(['invoice', 'quote'] as DocType[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.segmentItem, docType === t && styles.segmentItemActive]}
                onPress={() => setDocType(t)}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, docType === t && styles.segmentTextActive]}>
                  {t === 'invoice' ? 'Invoice' : 'Quote'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Business picker */}
          <Text style={styles.label}>Business</Text>
          {loadingBusinesses ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : businesses.length === 0 ? (
            <Text style={styles.empty}>You have not joined any business yet.</Text>
          ) : (
            <View style={{ gap: spacing.xs }}>
              {businesses.map(b => (
                <TouchableOpacity
                  key={b.businessOwnerId}
                  style={[styles.pickRow, businessOwnerId === b.businessOwnerId && styles.pickRowActive]}
                  onPress={() => setBusinessOwnerId(b.businessOwnerId)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pickRowText}>{b.businessName}</Text>
                  {businessOwnerId === b.businessOwnerId && (
                    <Feather name="check" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {businessOwnerId && (
            <>
              {/* Completed jobs */}
              <Text style={styles.label}>Completed jobs</Text>
              {loadingJobs ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
              ) : completedJobs.length === 0 ? (
                <Text style={styles.empty}>No completed jobs to bill for this business.</Text>
              ) : (
                <View style={{ gap: spacing.xs }}>
                  {completedJobs.map(job => {
                    const added = addedJobIds.has(job.jobId);
                    const blockedBilled = docType === 'invoice' && job.alreadyBilled;
                    const disabled = added || blockedBilled;
                    return (
                      <TouchableOpacity
                        key={job.jobId}
                        style={[styles.jobRow, blockedBilled && { opacity: 0.5 }]}
                        onPress={() => !disabled && addJob(job)}
                        activeOpacity={disabled ? 1 : 0.8}
                        disabled={disabled}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.jobTitle}>{job.jobTitle}</Text>
                          <Text style={styles.jobMeta}>
                            {formatCurrency(job.suggestedAmount)}
                            {job.alreadyBilled ? '  ·  already invoiced' : ''}
                          </Text>
                        </View>
                        <Feather
                          name={added ? 'check-circle' : blockedBilled ? 'slash' : 'plus-circle'}
                          size={20}
                          color={added ? colors.success : blockedBilled ? colors.mutedForeground : colors.primary}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Title */}
              <Text style={styles.label}>Title (optional)</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={docType === 'quote' ? 'e.g. Bathroom reno quote' : 'e.g. October works'}
                placeholderTextColor={colors.mutedForeground}
              />

              {/* Line items */}
              <View style={styles.lineHeader}>
                <Text style={styles.label}>Line items</Text>
                <TouchableOpacity onPress={addBlank} activeOpacity={0.8} style={styles.addBtn}>
                  <Feather name="plus" size={16} color={colors.primary} />
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
              {lineItems.length === 0 ? (
                <Text style={styles.empty}>Tap a completed job above or add a line manually.</Text>
              ) : (
                lineItems.map(li => (
                  <View key={li.key} style={styles.itemCard}>
                    <View style={styles.itemTopRow}>
                      <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        value={li.description}
                        onChangeText={v => updateItem(li.key, 'description', v)}
                        placeholder="Description"
                        placeholderTextColor={colors.mutedForeground}
                      />
                      <TouchableOpacity onPress={() => removeItem(li.key)} style={styles.removeBtn} activeOpacity={0.7}>
                        <Feather name="trash-2" size={18} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.itemBottomRow}>
                      <View style={styles.qtyBox}>
                        <Text style={styles.miniLabel}>Qty</Text>
                        <TextInput
                          style={styles.miniInput}
                          value={li.quantity}
                          onChangeText={v => updateItem(li.key, 'quantity', v)}
                          keyboardType="decimal-pad"
                          placeholderTextColor={colors.mutedForeground}
                        />
                      </View>
                      <View style={styles.qtyBox}>
                        <Text style={styles.miniLabel}>Unit price</Text>
                        <TextInput
                          style={styles.miniInput}
                          value={li.unitPrice}
                          onChangeText={v => updateItem(li.key, 'unitPrice', v)}
                          keyboardType="decimal-pad"
                          placeholderTextColor={colors.mutedForeground}
                        />
                      </View>
                      <View style={styles.lineTotalBox}>
                        <Text style={styles.miniLabel}>Amount</Text>
                        <Text style={styles.lineTotal}>
                          {formatCurrency((parseFloat(li.quantity) || 0) * (parseFloat(li.unitPrice) || 0))}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}

              {/* GST toggle */}
              <TouchableOpacity style={styles.gstRow} onPress={() => setGstEnabled(v => !v)} activeOpacity={0.8}>
                <View>
                  <Text style={styles.jobTitle}>Add GST (10%)</Text>
                  <Text style={styles.jobMeta}>Australian GST on this {docNoun.toLowerCase()}</Text>
                </View>
                <Feather name={gstEnabled ? 'check-square' : 'square'} size={22} color={gstEnabled ? colors.primary : colors.mutedForeground} />
              </TouchableOpacity>

              {/* Notes */}
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, { height: 88, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Anything the business should know"
                placeholderTextColor={colors.mutedForeground}
                multiline
              />

              {/* Totals */}
              <View style={styles.totalsCard}>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
                </View>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>GST</Text>
                  <Text style={styles.totalValue}>{formatCurrency(gst)}</Text>
                </View>
                <View style={[styles.totalLine, styles.grandLine]}>
                  <Text style={styles.grandLabel}>Total (AUD)</Text>
                  <Text style={styles.grandValue}>{formatCurrency(total)}</Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {businessOwnerId && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={submit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={styles.submitText}>Send {docNoun}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.mutedForeground,
      marginTop: spacing.lg,
      marginBottom: spacing.xs,
    },
    empty: { fontSize: 13, color: colors.mutedForeground, paddingVertical: spacing.sm },
    segment: {
      flexDirection: 'row',
      backgroundColor: colors.muted,
      borderRadius: radius.md,
      padding: 4,
      gap: 4,
    },
    segmentItem: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
    segmentItemActive: { backgroundColor: colors.card },
    segmentText: { fontSize: 14, fontWeight: '600', color: colors.mutedForeground },
    segmentTextActive: { color: colors.foreground },
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    pickRowActive: { borderColor: colors.primary },
    pickRowText: { fontSize: 15, fontWeight: '500', color: colors.foreground },
    jobRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    jobTitle: { fontSize: 15, fontWeight: '500', color: colors.foreground },
    jobMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 15,
      color: colors.foreground,
      marginBottom: spacing.xs,
    },
    lineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.lg, marginBottom: spacing.xs },
    addBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
    itemCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    removeBtn: { padding: spacing.xs },
    itemBottomRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    qtyBox: { flex: 1 },
    lineTotalBox: { flex: 1, alignItems: 'flex-end' },
    miniLabel: { fontSize: 11, color: colors.mutedForeground, marginBottom: 2 },
    miniInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      fontSize: 14,
      color: colors.foreground,
    },
    lineTotal: { fontSize: 14, fontWeight: '600', color: colors.foreground, paddingVertical: spacing.xs },
    gstRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      marginTop: spacing.lg,
    },
    totalsCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.lg,
    },
    totalLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
    totalLabel: { fontSize: 14, color: colors.mutedForeground },
    totalValue: { fontSize: 14, fontWeight: '500', color: colors.foreground },
    grandLine: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs, paddingTop: spacing.sm },
    grandLabel: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    grandValue: { fontSize: 18, fontWeight: '700', color: colors.foreground },
    footer: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitText: { fontSize: 16, fontWeight: '700', color: colors.primaryForeground },
  });
}
