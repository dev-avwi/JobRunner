import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { spacing, radius, typography, sizes, pageShell, iconSizes, fontWeights } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { showToast } from '../../src/lib/toast';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { format } from 'date-fns';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { OwnerOnlyGuard } from '../../src/components/ui/OwnerOnlyGuard';

interface Expense {
  id: string;
  jobId: string | null;
  categoryId: string;
  amount: string;
  gstAmount: string | null;
  description: string;
  vendor: string | null;
  receiptUrl: string | null;
  receiptNumber: string | null;
  expenseDate: string;
  isBillable: boolean;
  status: string;
  categoryName?: string;
  jobTitle?: string;
  createdAt: string;
}

interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface Job {
  id: string;
  title: string;
  status: string;
  clientName?: string;
}

interface ExpensePhase {
  id: string;
  name: string;
  phaseCode?: string | null;
  status?: string;
  sortOrder?: number;
}
type FilterKey = 'all' | string;

const formatCurrency = (amount: number | string) => {
  const { formatCurrency: fmt } = require('../../src/lib/format');
  return fmt(amount);
};

function ExpenseCard({
  expense,
  onDelete,
}: {
  expense: Expense;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.expenseCard}>
      <View style={styles.expenseCardContent}>
        <View style={styles.expenseCardHeader}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.expenseDescription} numberOfLines={1}>{expense.description}</Text>
            {expense.categoryName && (
              <View style={[styles.categoryBadge, { backgroundColor: colors.primaryLight }]}>
                <Feather name="tag" size={10} color={colors.primary} />
                <Text style={[styles.categoryBadgeText, { color: colors.primary }]}>
                  {expense.categoryName}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.expenseTotal, { color: colors.destructive }]}>
            -{formatCurrency(expense.amount)}
          </Text>
        </View>

        <View style={styles.expenseMetaRow}>
          {expense.vendor && (
            <View style={styles.expenseMetaChip}>
              <Feather name="shopping-bag" size={11} color={colors.mutedForeground} />
              <Text style={styles.expenseMetaText} numberOfLines={1}>{expense.vendor}</Text>
            </View>
          )}
          {expense.jobTitle && (
            <View style={styles.expenseMetaChip}>
              <Feather name="briefcase" size={11} color={colors.mutedForeground} />
              <Text style={styles.expenseMetaText} numberOfLines={1}>{expense.jobTitle}</Text>
            </View>
          )}
          <View style={styles.expenseMetaChip}>
            <Feather name="calendar" size={11} color={colors.mutedForeground} />
            <Text style={styles.expenseMetaText} numberOfLines={1}>
              {expense.expenseDate
                ? format(new Date(expense.expenseDate), 'dd MMM yyyy')
                : 'No date'}
            </Text>
          </View>
        </View>
      </View>
      <PressableRow style={styles.deleteButton} onPress={(e) => { e.stopPropagation(); onDelete(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} >
        <Feather name="trash-2" size={14} color={colors.destructive} />
      </PressableRow>
    </View>
  );
}

function ExpensesScreenInner() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const { jobId: routeJobId, phaseId: routePhaseId } = useLocalSearchParams<{ jobId?: string; phaseId?: string }>();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [phases, setPhases] = useState<ExpensePhase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPhases, setIsLoadingPhases] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [filterByJobId, setFilterByJobId] = useState<string | null>(routeJobId || null);

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedImageUri, setScannedImageUri] = useState<string | null>(null);

  const [formCategoryId, setFormCategoryId] = useState('');
  const [formJobId, setFormJobId] = useState('');
  const [formPhaseId, setFormPhaseId] = useState(routePhaseId || '');
  const [formAmount, setFormAmount] = useState('');
  const [formGst, setFormGst] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formVendor, setFormVendor] = useState('');
  const [formReceiptNumber, setFormReceiptNumber] = useState('');
  const [formDate, setFormDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [showPhasePicker, setShowPhasePicker] = useState(false);
  const [jobPickerSearch, setJobPickerSearch] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeFilter !== 'all') params.append('categoryId', activeFilter);
      if (filterByJobId) params.append('jobId', filterByJobId);

      const [expensesRes, categoriesRes, jobsRes] = await Promise.all([
        api.get<Expense[]>(`/api/expenses?${params.toString()}`),
        api.get<ExpenseCategory[]>('/api/expense-categories'),
        api.get<Job[]>('/api/jobs'),
      ]);
      setExpenses(expensesRes.data || []);
      setCategories(categoriesRes.data || []);
      setJobs(jobsRes.data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, filterByJobId]);

  useEffect(() => {
    fetchData();
  }, [activeFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    if (!formJobId) {
      setPhases([]);
      setIsLoadingPhases(false);
      return;
    }

    let cancelled = false;
    setIsLoadingPhases(true);

    api.get<ExpensePhase[]>(`/api/jobs/${formJobId}/phases`)
      .then((response) => {
        if (cancelled) return;
        const nextPhases = Array.isArray(response.data)
          ? [...response.data].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          : [];
        setPhases(nextPhases);
        setFormPhaseId((currentPhaseId) => (
          currentPhaseId && !nextPhases.some((phase) => phase.id === currentPhaseId)
            ? ''
            : currentPhaseId
        ));
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Error fetching job phases:', error);
          setPhases([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPhases(false);
      });

    return () => {
      cancelled = true;
    };
  }, [formJobId]);

  const resetForm = () => {
    setFormCategoryId('');
    setFormJobId(routeJobId || '');
    setFormPhaseId(routePhaseId || '');
    setFormAmount('');
    setFormGst('');
    setFormDescription('');
    setFormVendor('');
    setFormReceiptNumber('');
    setFormDate(new Date());
    setScannedImageUri(null);
    setIsScanning(false);
  };

  const handleAmountChange = (value: string) => {
    setFormAmount(value);
    const amount = parseFloat(value) || 0;
    setFormGst((amount * 0.1).toFixed(2));
  };

  const handleScanReceipt = async (source: 'camera' | 'library') => {
    try {
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera access is needed to scan receipts.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Photo library access is needed to scan receipts.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
      }

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setScannedImageUri(asset.uri);
      setIsScanning(true);
      setShowExpenseModal(true);

      try {
        // Read base64 from the file URI rather than asking the picker to return
        // it inline (base64:true). On Android the inline payload bloats the
        // Activity-result Intent and holds the whole image in memory, which can
        // get the app killed mid-pick and crash with BadParcelableException.
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const base64Image = `data:image/jpeg;base64,${base64}`;
        const scanRes = await api.post<any>('/api/expenses/scan-receipt', { image: base64Image });

        if (!scanRes.error && scanRes.data && typeof scanRes.data === 'object') {
          const data = scanRes.data;
          if (data.total) {
            const totalStr = String(data.total);
            setFormAmount(totalStr);
            const gst = data.gst ? String(data.gst) : (parseFloat(totalStr) * 0.1).toFixed(2);
            setFormGst(gst);
          }
          if (data.vendor) setFormVendor(data.vendor);
          if (data.lineItems?.length > 0) {
            const desc = data.lineItems.map((item: any) => item.description).filter(Boolean).join(', ');
            if (desc) setFormDescription(desc);
          }
          if (data.date) setFormDate(new Date(data.date));

          showToast({ type: 'info', message: 'Receipt Scanned', description: 'Fields pre-filled from receipt. Review and save.' });
        }
      } catch (err: any) {
        showToast({ type: 'error', message: 'Scan Failed', description: err.message || 'Could not read receipt. Fill in manually.' });
      } finally {
        setIsScanning(false);
      }
    } catch (err) {
      setIsScanning(false);
      showToast({ type: 'error', message: 'Error', description: 'Failed to capture image' });
    }
  };

  const handleSubmitExpense = async () => {
    if (!formDescription.trim()) {
      showToast({ type: 'error', message: 'Please enter a description' });
      return;
    }
    if (!formAmount.trim() || isNaN(parseFloat(formAmount))) {
      showToast({ type: 'error', message: 'Please enter a valid amount' });
      return;
    }
    if (!formCategoryId) {
      showToast({ type: 'error', message: 'Please select a category' });
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/expenses', {
        categoryId: formCategoryId,
        jobId: formJobId || undefined,
        phaseId: formPhaseId || undefined,
        amount: formAmount,
        gstAmount: formGst || '0.00',
        description: formDescription.trim(),
        vendor: formVendor.trim() || undefined,
        receiptNumber: formReceiptNumber.trim() || undefined,
        receiptUrl: scannedImageUri || undefined,
        expenseDate: formDate.toISOString(),
        isBillable: true,
      });
      setShowExpenseModal(false);
      resetForm();
      fetchData();
      showToast({ type: 'success', message: 'Success', description: 'Expense recorded' });
    } catch (err: any) {
      showToast({ type: 'error', message: 'Error', description: err.message || 'Failed to record expense' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      showToast({ type: 'error', message: 'Please enter a category name' });
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/api/expense-categories', {
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined,
        isActive: true,
      });
      setShowCategoryModal(false);
      setNewCategoryName('');
      setNewCategoryDescription('');
      fetchData();
      showToast({ type: 'success', message: 'Success', description: 'Category created' });
    } catch (err: any) {
      showToast({ type: 'error', message: 'Error', description: err.message || 'Failed to create category' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Expense',
      message: 'Are you sure you want to delete this expense?',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/api/expenses/${id}`);
      fetchData();
    } catch (err: any) {
      showToast({ type: 'error', message: 'Error', description: err.message || 'Failed to delete expense' });
    }
  };

  const stats = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);
    const count = expenses.length;
    return { total, count };
  }, [expenses]);

  const categoryFilters = useMemo(() => {
    const filters: { key: string; label: string; count: number }[] = [
      { key: 'all', label: 'All', count: expenses.length },
    ];
    categories.forEach((cat) => {
      const count = expenses.filter((e) => e.categoryId === cat.id).length;
      filters.push({ key: cat.id, label: cat.name, count });
    });
    return filters;
  }, [categories, expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        expense.description?.toLowerCase().includes(searchLower) ||
        (expense.vendor || '').toLowerCase().includes(searchLower) ||
        (expense.categoryName || '').toLowerCase().includes(searchLower) ||
        (expense.jobTitle || '').toLowerCase().includes(searchLower);
      return matchesSearch;
    });
  }, [expenses, searchQuery]);

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    const dateA = new Date(a.expenseDate || a.createdAt).getTime();
    const dateB = new Date(b.expenseDate || b.createdAt).getTime();
    return dateB - dateA;
  });

  const groupedExpenses = useMemo(() => {
    const groups: Record<string, Expense[]> = {};
    sortedExpenses.forEach((exp) => {
      const key = format(new Date(exp.expenseDate || exp.createdAt), 'dd MMM yyyy');
      if (!groups[key]) groups[key] = [];
      groups[key].push(exp);
    });
    return Object.entries(groups);
  }, [sortedExpenses]);

  const selectedCategoryName = categories.find((c) => c.id === formCategoryId)?.name || 'Select Category';
  const selectedJobName = jobs.find((j) => j.id === formJobId)?.title || 'No Job';
  const selectedPhase = phases.find((phase) => phase.id === formPhaseId);
  const selectedPhaseName = selectedPhase
    ? `${selectedPhase.phaseCode ? `${selectedPhase.phaseCode} · ` : ''}${selectedPhase.name}`
    : formPhaseId || 'No phase selected';
  const shouldShowPhasePicker = Boolean(formJobId && (isLoadingPhases || phases.length > 0 || formPhaseId));

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={fetchData} tintColor={colors.primary} />
          }
        >
          <View style={styles.heroSection}>
            <Text style={styles.pageTitle}>{filterByJobId ? 'Job Expenses' : 'Expenses'}</Text>
            <Text style={styles.pageSubtitle}>
              {filterByJobId
                ? (jobs.find(j => j.id === filterByJobId)?.title || 'Filtered by job')
                : 'Track and manage costs across all your jobs'}
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: `${colors.destructive}15` }]}>
                  <Feather name="trending-down" size={16} color={colors.destructive} />
                </View>
                <Text style={styles.statValue}>{formatCurrency(stats.total)}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: `${colors.primary}15` }]}>
                  <Feather name="hash" size={16} color={colors.primary} />
                </View>
                <Text style={styles.statValue}>{stats.count}</Text>
                <Text style={styles.statLabel}>Recorded</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: `${colors.info}15` }]}>
                  <Feather name="tag" size={16} color={colors.info} />
                </View>
                <Text style={styles.statValue}>{categories.length}</Text>
                <Text style={styles.statLabel}>Categories</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: `${colors.warning}15` }]}>
                  <Feather name="briefcase" size={16} color={colors.warning} />
                </View>
                <Text style={styles.statValue}>{new Set(expenses.filter((e) => e.jobId).map((e) => e.jobId)).size}</Text>
                <Text style={styles.statLabel}>Jobs</Text>
              </View>
            </View>
          </View>

          {filterByJobId && (
            <PressableRow onPress={() => setFilterByJobId(null)} style={styles.jobFilterBanner} >
              <Feather name="x-circle" size={14} color={colors.primary} />
              <Text style={{ fontSize: typography.sizes.sm, color: colors.primary, fontWeight: fontWeights.medium }}>Show all expenses</Text>
            </PressableRow>
          )}

          <PressableRow style={styles.scanBanner} onPress={() => { Alert.alert( 'AI Receipt Scanner', 'Take a photo of a receipt or invoice and AI will automatically extract the vendor, amount, GST, date and line items.', [ { text: 'Take Photo', onPress: () => handleScanReceipt('camera') }, { text: 'Choose from Library', onPress: () => handleScanReceipt('library') }, { text: 'Cancel', style: 'cancel' }, ] ); }} >
            <View style={styles.scanBannerIcon}>
              <Feather name="camera" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanBannerTitle}>Scan Receipt with AI</Text>
              <Text style={styles.scanBannerSubtitle}>
                Auto-extract vendor, amount, GST & items
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </PressableRow>

          <View style={styles.searchSection}>
            <View style={styles.searchBar}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search expenses..."
                placeholderTextColor={colors.mutedForeground}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <PressableRow onPress={() => setSearchQuery('')}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </PressableRow>
              )}
            </View>
            <PressableRow style={styles.addButton} onPress={() => { resetForm(); setShowExpenseModal(true); }} >
              <Feather name="plus" size={18} color={colors.primaryForeground} />
            </PressableRow>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
            style={{ flexGrow: 0 }}
          >
            {categoryFilters.map((filter) => {
              const isActive = activeFilter === filter.key;
              return (
                <PressableRow key={filter.key} onPress={() => setActiveFilter(filter.key)} style={[styles.filterChip, isActive && styles.filterChipActive]} >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {filter.label} ({filter.count})
                  </Text>
                </PressableRow>
              );
            })}
            <PressableRow onPress={() => setShowCategoryModal(true)} style={[styles.filterChip, { borderStyle: 'dashed' as any }]} >
              <Feather name="plus" size={12} color={colors.mutedForeground} />
              <Text style={styles.filterChipText}>Add</Text>
            </PressableRow>
          </ScrollView>

          <View style={styles.listSection}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : sortedExpenses.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Feather name="file-text" size={28} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>No Expenses Found</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery || activeFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Record your first expense or scan a receipt to get started'}
                </Text>
                {!searchQuery && activeFilter === 'all' && (
                  <PressableRow style={styles.emptyButton} onPress={() => { resetForm(); setShowExpenseModal(true); }} >
                    <Feather name="plus" size={14} color={colors.primaryForeground} />
                    <Text style={styles.emptyButtonText}>Record Expense</Text>
                  </PressableRow>
                )}
              </View>
            ) : (
              <View style={styles.expensesList}>
                {groupedExpenses.map(([dateLabel, dateExpenses]) => (
                  <View key={dateLabel}>
                    <Text style={styles.dateGroupLabel}>{dateLabel}</Text>
                    {dateExpenses.map((expense) => (
                      <ExpenseCard
                        key={expense.id}
                        expense={expense}
                        onDelete={() => handleDeleteExpense(expense.id)}
                      />
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        <AppBottomSheet
          visible={showExpenseModal}
          onDismiss={() => {
            setShowExpenseModal(false);
            resetForm();
          }}
          snapPoints={['88%']}
          contentPadding={0}>
          <View style={{ backgroundColor: colors.background }}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <PressableRow onPress={() => { setShowExpenseModal(false); resetForm(); }} >
                <Text style={[styles.modalCancel, { color: colors.primary }]}>Cancel</Text>
              </PressableRow>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Record Expense</Text>
              <PressableRow onPress={handleSubmitExpense} disabled={isSubmitting}>
                <Text style={[styles.modalSave, { color: isSubmitting ? colors.mutedForeground : colors.primary }]}>
                  {isSubmitting ? 'Saving...' : 'Save'}
                </Text>
              </PressableRow>
            </View>

            <View style={styles.modalScrollContent}>
              {isScanning && (
                <View style={[styles.scanningBanner, { backgroundColor: colors.primaryLight, borderColor: colors.promoBorder }]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <View>
                    <Text style={[styles.scanningTitle, { color: colors.foreground }]}>Reading receipt...</Text>
                    <Text style={[styles.scanningSubtitle, { color: colors.mutedForeground }]}>
                      AI is extracting details
                    </Text>
                  </View>
                </View>
              )}

              {scannedImageUri && !isScanning && (
                <View style={[styles.receiptPreview, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Image source={{ uri: scannedImageUri }} style={styles.receiptImage} />
                  <View>
                    <Text style={[styles.receiptAttachedText, { color: colors.foreground }]}>Receipt attached</Text>
                    <Text style={[styles.receiptHintText, { color: colors.mutedForeground }]}>Review pre-filled fields</Text>
                  </View>
                </View>
              )}

              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Description *</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.foreground }]}
                  placeholder="What was this expense for?"
                  placeholderTextColor={colors.mutedForeground}
                  value={formDescription}
                  onChangeText={setFormDescription}
                />
              </View>

              <View style={styles.formRow}>
                <View style={styles.formHalf}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>Amount (AUD) *</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.foreground }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    value={formAmount}
                    onChangeText={handleAmountChange}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.formHalf}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>GST</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.muted, borderColor: colors.cardBorder, color: colors.mutedForeground }]}
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    value={formGst}
                    editable={false}
                  />
                </View>
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Category *</Text>
                <PressableRow style={[styles.formInput, styles.pickerButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => setShowCategoryPicker(true)} >
                  <Text style={{ color: formCategoryId ? colors.foreground : colors.mutedForeground }}>
                    {selectedCategoryName}
                  </Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </PressableRow>
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Job (Optional)</Text>
                <PressableRow style={[styles.formInput, styles.pickerButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => setShowJobPicker(true)} >
                  <Text style={{ color: formJobId ? colors.foreground : colors.mutedForeground }}>
                    {selectedJobName}
                  </Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </PressableRow>
              </View>

              {shouldShowPhasePicker && (
                <View style={styles.formSection}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>Phase (Optional)</Text>
                  <PressableRow
                    testID="expense-phase-picker"
                    accessibilityRole="button"
                    accessibilityLabel={formPhaseId ? `Phase: ${selectedPhaseName}` : 'Select phase'}
                    style={[
                      styles.phaseChip,
                      {
                        backgroundColor: formPhaseId ? colors.primaryLight : colors.card,
                        borderColor: formPhaseId ? colors.primary : colors.cardBorder,
                      },
                    ]}
                    onPress={() => setShowPhasePicker(true)}
                  >
                    <View style={styles.phaseChipContent}>
                      <Feather name="layers" size={15} color={formPhaseId ? colors.primary : colors.mutedForeground} />
                      <Text
                        style={[styles.phaseChipText, { color: formPhaseId ? colors.foreground : colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {formPhaseId ? `Phase: ${selectedPhaseName}` : 'No phase selected'}
                      </Text>
                    </View>
                    {isLoadingPhases ? (
                      <ActivityIndicator size="small" color={colors.mutedForeground} />
                    ) : (
                      <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                    )}
                  </PressableRow>
                </View>
              )}

              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Vendor</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.foreground }]}
                  placeholder="e.g., Bunnings"
                  placeholderTextColor={colors.mutedForeground}
                  value={formVendor}
                  onChangeText={setFormVendor}
                />
              </View>

              <View style={styles.formRow}>
                <View style={styles.formHalf}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>Date</Text>
                  <PressableRow style={[styles.formInput, styles.pickerButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => setShowDatePicker(true)} >
                    <Feather name="calendar" size={14} color={colors.mutedForeground} />
                    <Text style={{ color: colors.foreground }}>{format(formDate, 'dd MMM yyyy')}</Text>
                  </PressableRow>
                </View>
                <View style={styles.formHalf}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>Receipt #</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.foreground }]}
                    placeholder="Optional"
                    placeholderTextColor={colors.mutedForeground}
                    value={formReceiptNumber}
                    onChangeText={setFormReceiptNumber}
                  />
                </View>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={formDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  onChange={(event, date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) setFormDate(date);
                  }}
                />
              )}

              {!scannedImageUri && (
                <PressableRow style={[styles.scanButton, { borderColor: colors.cardBorder }]} onPress={() => { Alert.alert('Scan Receipt', 'Choose source', [ { text: 'Camera', onPress: () => handleScanReceipt('camera') }, { text: 'Photo Library', onPress: () => handleScanReceipt('library') }, { text: 'Cancel', style: 'cancel' }, ]); }} >
                  <Feather name="camera" size={18} color={colors.mutedForeground} />
                  <Text style={[styles.scanButtonText, { color: colors.mutedForeground }]}>
                    Scan Receipt to Auto-Fill
                  </Text>
                </PressableRow>
              )}
            </View>
          </View>
        
        <AppBottomSheet
        visible={showCategoryPicker}
        onDismiss={() => setShowCategoryPicker(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <PressableRow onPress={() => setShowCategoryPicker(false)}>
                <Text style={[styles.modalCancel, { color: colors.primary }]}>Done</Text>
              </PressableRow>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Category</Text>
              <PressableRow onPress={() => { setShowCategoryPicker(false); setShowCategoryModal(true); }}>
                <Feather name="plus" size={20} color={colors.primary} />
              </PressableRow>
            </View>
            <ScrollView>
              {categories.length === 0 ? (
                <View style={styles.emptyPicker}>
                  <Text style={[styles.emptyPickerText, { color: colors.mutedForeground }]}>
                    No categories yet. Create one first.
                  </Text>
                  <PressableRow style={[styles.emptyPickerButton, { backgroundColor: colors.primary }]} onPress={() => { setShowCategoryPicker(false); setShowCategoryModal(true); }} >
                    <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold }}>Add Category</Text>
                  </PressableRow>
                </View>
              ) : (
                categories.map((cat) => (
                  <PressableRow key={cat.id} style={[ styles.pickerItem, { borderBottomColor: colors.border }, formCategoryId === cat.id && { backgroundColor: colors.primaryLight }, ]} onPress={() => { setFormCategoryId(cat.id); setShowCategoryPicker(false); }} >
                    <View style={styles.pickerItemContent}>
                      <Feather name="tag" size={16} color={formCategoryId === cat.id ? colors.primary : colors.mutedForeground} />
                      <Text style={[styles.pickerItemText, { color: colors.foreground }]}>{cat.name}</Text>
                    </View>
                    {formCategoryId === cat.id && (
                      <Feather name="check" size={18} color={colors.primary} />
                    )}
                  </PressableRow>
                ))
              )}
            </ScrollView>
          </View>
        </AppBottomSheet>

        <AppBottomSheet
        visible={showJobPicker}
        onDismiss={() => { setShowJobPicker(false); setJobPickerSearch(''); }}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <PressableRow onPress={() => { setShowJobPicker(false); setJobPickerSearch(''); }}>
                <Text style={[styles.modalCancel, { color: colors.primary }]}>Done</Text>
              </PressableRow>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Job</Text>
              <View style={{ width: 20 }} />
            </View>
            <View style={[styles.pickerSearchWrap, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.pickerSearchInput, { color: colors.foreground }]}
                placeholder="Search jobs or clients..."
                placeholderTextColor={colors.mutedForeground}
                value={jobPickerSearch}
                onChangeText={setJobPickerSearch}
                autoCorrect={false}
              />
              {jobPickerSearch.length > 0 && (
                <PressableRow onPress={() => setJobPickerSearch('')}>
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </PressableRow>
              )}
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
               <PressableRow style={[ styles.pickerItem, { borderBottomColor: colors.border }, !formJobId && { backgroundColor: colors.primaryLight }, ]} onPress={() => { setFormJobId(''); setFormPhaseId(''); setShowJobPicker(false); setJobPickerSearch(''); }} >
                <View style={styles.pickerItemContent}>
                  <Feather name="minus-circle" size={16} color={!formJobId ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.pickerItemText, { color: colors.foreground }]}>No Job</Text>
                </View>
                {!formJobId && <Feather name="check" size={18} color={colors.primary} />}
              </PressableRow>
              {jobs.filter((job) => {
                const q = jobPickerSearch.trim().toLowerCase();
                if (!q) return true;
                return job.title?.toLowerCase().includes(q) || job.clientName?.toLowerCase().includes(q);
              }).map((job) => (
                <PressableRow key={job.id} style={[ styles.pickerItem, { borderBottomColor: colors.border }, formJobId === job.id && { backgroundColor: colors.primaryLight }, ]} onPress={() => { if (formJobId !== job.id) setFormPhaseId(''); setFormJobId(job.id); setShowJobPicker(false); }} >
                  <View style={styles.pickerItemContent}>
                    <Feather name="briefcase" size={16} color={formJobId === job.id ? colors.primary : colors.mutedForeground} />
                    <View>
                      <Text style={[styles.pickerItemText, { color: colors.foreground }]}>{job.title}</Text>
                      {job.clientName && (
                        <Text style={[styles.pickerItemSubtext, { color: colors.mutedForeground }]}>{job.clientName}</Text>
                      )}
                    </View>
                  </View>
                  {formJobId === job.id && <Feather name="check" size={18} color={colors.primary} />}
                </PressableRow>
              ))}
            </ScrollView>
          </View>
        </AppBottomSheet>

        <AppBottomSheet
          visible={showPhasePicker}
          onDismiss={() => setShowPhasePicker(false)}
          snapPoints={['90%']}
          scrollable={false}
          contentPadding={0}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <PressableRow onPress={() => setShowPhasePicker(false)}>
                <Text style={[styles.modalCancel, { color: colors.primary }]}>Done</Text>
              </PressableRow>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Select Phase</Text>
              <View style={{ width: 20 }} />
            </View>
            <ScrollView>
              {isLoadingPhases ? (
                <View style={styles.loadingPicker}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : phases.length === 0 ? (
                <View style={styles.emptyPicker}>
                  <Text style={[styles.emptyPickerText, { color: colors.mutedForeground }]}>
                    No phases are available for this job.
                  </Text>
                </View>
              ) : (
                <>
                  <PressableRow
                    testID="expense-phase-none"
                    style={[
                      styles.pickerItem,
                      { borderBottomColor: colors.border },
                      !formPhaseId && { backgroundColor: colors.primaryLight },
                    ]}
                    onPress={() => {
                      setFormPhaseId('');
                      setShowPhasePicker(false);
                    }}
                  >
                    <View style={styles.pickerItemContent}>
                      <Feather name="minus-circle" size={16} color={!formPhaseId ? colors.primary : colors.mutedForeground} />
                      <Text style={[styles.pickerItemText, { color: colors.foreground }]}>No Phase</Text>
                    </View>
                    {!formPhaseId && <Feather name="check" size={18} color={colors.primary} />}
                  </PressableRow>
                  {phases.map((phase) => {
                    const isSelected = formPhaseId === phase.id;
                    const phaseName = `${phase.phaseCode ? `${phase.phaseCode} · ` : ''}${phase.name}`;
                    return (
                      <PressableRow
                        key={phase.id}
                        testID={`expense-phase-option-${phase.id}`}
                        style={[
                          styles.pickerItem,
                          { borderBottomColor: colors.border },
                          isSelected && { backgroundColor: colors.primaryLight },
                        ]}
                        onPress={() => {
                          setFormPhaseId(phase.id);
                          setShowPhasePicker(false);
                        }}
                      >
                        <View style={styles.pickerItemContent}>
                          <Feather name="layers" size={16} color={isSelected ? colors.primary : colors.mutedForeground} />
                          <Text style={[styles.pickerItemText, { color: colors.foreground }]} numberOfLines={1}>
                            {phaseName}
                          </Text>
                        </View>
                        {isSelected && <Feather name="check" size={18} color={colors.primary} />}
                      </PressableRow>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </AppBottomSheet>

        <AppBottomSheet
        visible={showCategoryModal && showExpenseModal}
        onDismiss={() => setShowCategoryModal(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}
      >
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <PressableRow onPress={() => setShowCategoryModal(false)}>
                <Text style={[styles.modalCancel, { color: colors.primary }]}>Cancel</Text>
              </PressableRow>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Category</Text>
              <PressableRow onPress={handleCreateCategory} disabled={isSubmitting}>
                <Text style={[styles.modalSave, { color: isSubmitting ? colors.mutedForeground : colors.primary }]}>
                  {isSubmitting ? 'Saving...' : 'Save'}
                </Text>
              </PressableRow>
            </View>
            <View style={styles.modalScrollContent}>
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Category Name *</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.foreground }]}
                  placeholder="e.g., Materials, Fuel, Tools"
                  placeholderTextColor={colors.mutedForeground}
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                />
              </View>
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Description (Optional)</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.foreground }]}
                  placeholder="Describe what this category covers..."
                  placeholderTextColor={colors.mutedForeground}
                  value={newCategoryDescription}
                  onChangeText={setNewCategoryDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </View>
        </AppBottomSheet>
        </AppBottomSheet>

        <AppBottomSheet
        visible={showCategoryModal && !showExpenseModal}
        onDismiss={() => setShowCategoryModal(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}
      >
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <PressableRow onPress={() => setShowCategoryModal(false)}>
                <Text style={[styles.modalCancel, { color: colors.primary }]}>Cancel</Text>
              </PressableRow>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Category</Text>
              <PressableRow onPress={handleCreateCategory} disabled={isSubmitting}>
                <Text style={[styles.modalSave, { color: isSubmitting ? colors.mutedForeground : colors.primary }]}>
                  {isSubmitting ? 'Saving...' : 'Save'}
                </Text>
              </PressableRow>
            </View>
            <View style={styles.modalScrollContent}>
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Category Name *</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.foreground }]}
                  placeholder="e.g., Materials, Fuel, Tools"
                  placeholderTextColor={colors.mutedForeground}
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                />
              </View>
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Description (Optional)</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.foreground }]}
                  placeholder="Describe what this category covers..."
                  placeholderTextColor={colors.mutedForeground}
                  value={newCategoryDescription}
                  onChangeText={setNewCategoryDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </View>
        </AppBottomSheet>

        
      </View>
    </>
  );
}

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: bottomNavHeight,
    },
    heroSection: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
    },
    pageTitle: {
      fontSize: typography.sizes['3xl'],
      fontWeight: fontWeights.extrabold,
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    pageSubtitle: {
      fontSize: typography.button.fontSize,
      color: colors.mutedForeground,
      marginTop: spacing.xs,
      lineHeight: 20,
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.sm,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    statIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    statValue: {
      fontSize: typography.subtitle.fontSize,
      fontWeight: fontWeights.bold,
      color: colors.foreground,
    },
    statLabel: {
      fontSize: typography.sizes.xs,
      color: colors.mutedForeground,
      marginTop: 1,
    },
    jobFilterBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    scanBanner: {
      alignSelf: 'stretch',
      marginHorizontal: spacing.lg,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.promoBorder,
      borderRadius: radius.xl,
      padding: spacing.md,
      marginBottom: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    scanBannerIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: `${colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanBannerTitle: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.bold,
      color: colors.foreground,
    },
    scanBannerSubtitle: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    searchSection: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    searchBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.sm,
      gap: spacing.xs,
      height: 44,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.sizes.md,
      color: colors.foreground,
    },
    addButton: {
      width: 44,
      height: 44,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterScroll: {
      paddingHorizontal: spacing.lg,
      gap: spacing.xs,
      paddingBottom: spacing.sm,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: 7,
      borderRadius: radius.full,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: 4,
    },
    filterChipActive: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontSize: typography.sizes.sm,
      color: colors.mutedForeground,
      fontWeight: fontWeights.medium,
    },
    filterChipTextActive: {
      color: colors.primary,
      fontWeight: fontWeights.semibold,
    },
    listSection: {
      paddingHorizontal: spacing.lg,
    },
    loadingContainer: {
      paddingVertical: spacing['3xl'],
      alignItems: 'center',
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl * 2,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: `${colors.primary}12`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    emptyTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    emptySubtitle: {
      fontSize: typography.button.fontSize,
      color: colors.mutedForeground,
      textAlign: 'center',
      lineHeight: 20,
    },
    emptyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      marginTop: spacing.sm,
    },
    emptyButtonText: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.primaryForeground,
    },
    expensesList: {
      gap: spacing.xs,
    },
    dateGroupLabel: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.mutedForeground,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
      letterSpacing: 0.3,
    },
    expenseCard: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: spacing.sm,
    },
    expenseCardContent: {
      flex: 1,
      padding: spacing.md,
    },
    expenseCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    expenseDescription: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    expenseTotal: {
      fontSize: typography.subtitle.fontSize,
      fontWeight: fontWeights.bold,
    },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.full,
      gap: 3,
      marginTop: spacing.xs,
      alignSelf: 'flex-start',
    },
    categoryBadgeText: {
      fontSize: typography.sizes.xs,
      fontWeight: fontWeights.semibold,
    },
    expenseMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: spacing.sm,
    },
    expenseMetaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.muted,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.full,
    },
    expenseMetaText: {
      fontSize: typography.sizes.xs,
      color: colors.mutedForeground,
    },
    deleteButton: {
      alignSelf: 'flex-start',
      padding: spacing.md,
    },
    modalContainer: {
      flex: 1,
    },
    pickerSearchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderRadius: radius.xl,
    },
    pickerSearchInput: {
      flex: 1,
      ...typography.body,
      letterSpacing: 0,
      textAlign: 'left',
      paddingVertical: 0,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
    },
    modalCancel: {
      ...typography.body,
      fontWeight: fontWeights.medium,
    },
    modalTitle: {
      ...typography.cardTitle,
    },
    modalSave: {
      ...typography.body,
      fontWeight: fontWeights.semibold,
    },
    modalScroll: {
      flex: 1,
    },
    modalScrollContent: {
      padding: spacing.lg,
      gap: spacing.lg,
    },
    scanningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
    },
    scanningTitle: {
      ...typography.bodySemibold,
    },
    scanningSubtitle: {
      ...typography.caption,
    },
    receiptPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
    },
    receiptImage: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
    },
    receiptAttachedText: {
      ...typography.bodySemibold,
    },
    receiptHintText: {
      ...typography.caption,
    },
    formSection: {
      marginBottom: spacing.lg,
    },
    formRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    formHalf: {
      flex: 1,
    },
    formLabel: {
      ...typography.caption,
      fontWeight: fontWeights.semibold,
      marginBottom: spacing.sm,
    },
    formInput: {
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      height: sizes.inputHeight,
      ...typography.body,
    },
    textArea: {
      height: 88,
      paddingTop: spacing.md,
      textAlignVertical: 'top',
    },
    pickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    phaseChip: {
      minHeight: sizes.inputHeight,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
    },
    phaseChipContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    phaseChipText: {
      ...typography.body,
      flex: 1,
      fontWeight: fontWeights.medium,
    },
    scanButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
    },
    scanButtonText: {
      ...typography.body,
      fontWeight: fontWeights.medium,
    },
    emptyPicker: {
      alignItems: 'center',
      paddingVertical: spacing['4xl'],
      paddingHorizontal: spacing.lg,
    },
    loadingPicker: {
      alignItems: 'center',
      paddingVertical: spacing['4xl'],
    },
    emptyPickerText: {
      ...typography.body,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    emptyPickerButton: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
    },
    pickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
    },
    pickerItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flex: 1,
    },
    pickerItemText: {
      ...typography.body,
      fontWeight: fontWeights.medium,
    },
    pickerItemSubtext: {
      ...typography.caption,
      marginTop: 2,
    },
  });

export default function ExpensesScreen() {
  return (
    <OwnerOnlyGuard requiredPermission={['read_expenses', 'write_expenses']}>
      <ExpensesScreenInner />
    </OwnerOnlyGuard>
  );
}
