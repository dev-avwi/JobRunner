import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '@/components/ui/PressableRow';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/lib/theme';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { BottomSheetScrollView } from '../../src/components/ui/AppBottomSheet';
import { api } from '../../src/lib/api';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, componentStyles, fontWeights } from '../../src/lib/design-tokens';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { useUserRole } from '../../src/hooks/use-user-role';

type TabType = 'items' | 'categories' | 'lowStock' | 'purchaseOrders' | 'suppliers';
type TransactionType = 'in' | 'out' | 'adjustment';
type SortField = 'name' | 'currentStock' | 'sellPrice';
type SortDir = 'asc' | 'desc';
type POStatus = 'pending' | 'approved' | 'sent' | 'received' | 'cancelled';

interface InventoryCategory {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

interface InventoryItem {
  id: string;
  categoryId?: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  unit?: string;
  costPrice?: string;
  sellPrice?: string;
  currentStock?: number;
  minimumStock?: number;
  maximumStock?: number;
  reorderLevel?: number;
  reorderQuantity?: number;
  supplierId?: string;
  location?: string;
  isActive?: boolean;
}

interface InventoryTransaction {
  id: string;
  itemId: string;
  type: TransactionType;
  quantity: number;
  unitCost?: string;
  totalCost?: string;
  reference?: string;
  notes?: string;
  transactionDate?: string;
  createdAt?: string;
}

interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  abn?: string;
  address?: string;
  paymentTerms?: string;
  notes?: string;
}

interface SupplierPOStats {
  poCount: number;
  totalSpend: string;
  openPoCount: number;
  lastOrderDate: string | null;
}

interface PurchaseOrder {
  id: string;
  supplierId: string;
  poNumber: string;
  orderDate?: string;
  requiredDate?: string;
  status?: POStatus;
  subtotal?: string;
  gstAmount?: string;
  total?: string;
  notes?: string;
}

const formatCurrency = (amount: string | number | undefined | null) => {
  const { formatCurrency: fmt } = require('../../src/lib/format');
  return fmt(amount);
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getStockColor = (current: number, minimum: number, reorder: number) => {
  if (current <= 0) return '#ef4444';
  if (current <= reorder || current <= minimum) return '#f59e0b';
  return '#22c55e';
};

const getPOStatusConfig = (status: POStatus) => {
  switch (status) {
    case 'pending':
      return { label: 'Pending', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' };
    case 'approved':
      return { label: 'Approved', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' };
    case 'sent':
      return { label: 'Sent', color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.1)' };
    case 'received':
      return { label: 'Received', color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' };
    case 'cancelled':
      return { label: 'Cancelled', color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' };
    default:
      return { label: status, color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' };
  }
};

const defaultItemForm = {
  name: '',
  sku: '',
  unit: 'each',
  costPrice: '',
  sellPrice: '',
  categoryId: '',
  minimumStock: '',
  reorderLevel: '',
  reorderQuantity: '',
  location: '',
  description: '',
};

const defaultAdjustmentForm = {
  type: 'in' as TransactionType,
  quantity: '',
  notes: '',
  reference: '',
};

const defaultPOForm = {
  supplierId: '',
  poNumber: '',
  requiredDate: '',
  notes: '',
};

const defaultSupplierForm = {
  name: '',
  abn: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  paymentTerms: 'Net 30',
  notes: '',
};

function validateAbn(abn: string): boolean {
  const digits = abn.replace(/[^0-9]/g, '');
  if (digits.length !== 11) return false;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const d = digits.split('').map(Number);
  d[0] -= 1;
  const total = d.reduce((acc, digit, i) => acc + digit * weights[i], 0);
  return total % 89 === 0;
}

function formatAbn(raw: string): string {
  const d = raw.replace(/[^0-9]/g, '');
  if (d.length !== 11) return raw.trim();
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8, 11)}`;
}

export default function InventoryScreen() {
  const { colors } = useTheme();
  const { isOwner, isManager } = useUserRole();
  const canManageSuppliers = isOwner || isManager;
  const confirm = useConfirmDialog();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);

  const [activeTab, setActiveTab] = useState<TabType>('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState(defaultItemForm);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState(defaultAdjustmentForm);
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [showFilterPicker, setShowFilterPicker] = useState(false);

  const [showPOModal, setShowPOModal] = useState(false);
  const [poForm, setPOForm] = useState(defaultPOForm);
  const [isSavingPO, setIsSavingPO] = useState(false);
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);

  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState(defaultSupplierForm);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showSupplierDetail, setShowSupplierDetail] = useState(false);
  const [supplierPOs, setSupplierPOs] = useState<PurchaseOrder[]>([]);
  const [supplierStats, setSupplierStats] = useState<SupplierPOStats | null>(null);
  const [isLoadingSupplierPOs, setIsLoadingSupplierPOs] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [itemsRes, catsRes, suppRes, poRes] = await Promise.all([
        api.get<InventoryItem[]>('/api/inventory/items'),
        api.get<InventoryCategory[]>('/api/inventory/categories'),
        api.get<Supplier[]>('/api/suppliers'),
        api.get<PurchaseOrder[]>('/api/purchase-orders'),
      ]);
      if (itemsRes.error) {
        setError(itemsRes.error);
      } else {
        setItems(itemsRes.data || []);
      }
      if (!catsRes.error) setCategories(catsRes.data || []);
      if (!suppRes.error) setSuppliers(suppRes.data || []);
      if (!poRes.error) setPurchaseOrders(poRes.data || []);
    } catch (err) {
      setError('Failed to load inventory');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const filteredItems = useMemo(() => {
    let result = [...items];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        i => i.name.toLowerCase().includes(q) ||
             (i.sku && i.sku.toLowerCase().includes(q)) ||
             (i.description && i.description.toLowerCase().includes(q))
      );
    }
    if (filterCategoryId) {
      result = result.filter(i => i.categoryId === filterCategoryId);
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'currentStock') {
        cmp = (a.currentStock ?? 0) - (b.currentStock ?? 0);
      } else if (sortField === 'sellPrice') {
        cmp = parseFloat(a.sellPrice || '0') - parseFloat(b.sellPrice || '0');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [items, searchQuery, filterCategoryId, sortField, sortDir]);

  const lowStockItems = useMemo(() => {
    return items.filter(i => {
      const stock = i.currentStock ?? 0;
      const reorder = i.reorderLevel ?? 0;
      const min = i.minimumStock ?? 0;
      return stock <= reorder || stock <= min;
    });
  }, [items]);

  const filteredSuppliers = useMemo(() => {
    let result = [...suppliers];
    if (supplierSearch.trim()) {
      const q = supplierSearch.toLowerCase();
      result = result.filter(
        s => s.name.toLowerCase().includes(q) ||
             (s.contactName && s.contactName.toLowerCase().includes(q)) ||
             (s.phone && s.phone.toLowerCase().includes(q)) ||
             (s.email && s.email.toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [suppliers, supplierSearch]);

  const selectedPOSupplier = useMemo(
    () => suppliers.find(s => s.id === poForm.supplierId) || null,
    [suppliers, poForm.supplierId]
  );

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return null;
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || null;
  };

  const getSupplierName = (supplierId?: string) => {
    if (!supplierId) return null;
    const s = suppliers.find(sup => sup.id === supplierId);
    return s?.name || null;
  };

  const openCreateItem = () => {
    setItemForm(defaultItemForm);
    setEditingItem(null);
    setShowItemModal(true);
  };

  const openEditItem = (item: InventoryItem) => {
    setItemForm({
      name: item.name || '',
      sku: item.sku || '',
      unit: item.unit || 'each',
      costPrice: item.costPrice || '',
      sellPrice: item.sellPrice || '',
      categoryId: item.categoryId || '',
      minimumStock: item.minimumStock != null ? String(item.minimumStock) : '',
      reorderLevel: item.reorderLevel != null ? String(item.reorderLevel) : '',
      reorderQuantity: item.reorderQuantity != null ? String(item.reorderQuantity) : '',
      location: item.location || '',
      description: item.description || '',
    });
    setEditingItem(item);
    setShowDetailModal(false);
    setShowItemModal(true);
  };

  const handleSubmitItem = async () => {
    if (!itemForm.name.trim()) {
      Alert.alert('Required', 'Item name is required.');
      return;
    }
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: itemForm.name.trim(),
        unit: itemForm.unit || 'each',
      };
      if (itemForm.sku) payload.sku = itemForm.sku;
      if (itemForm.costPrice) payload.costPrice = itemForm.costPrice;
      if (itemForm.sellPrice) payload.sellPrice = itemForm.sellPrice;
      if (itemForm.categoryId) payload.categoryId = itemForm.categoryId;
      if (itemForm.minimumStock) payload.minimumStock = parseFloat(itemForm.minimumStock);
      if (itemForm.reorderLevel) payload.reorderLevel = parseFloat(itemForm.reorderLevel);
      if (itemForm.reorderQuantity) payload.reorderQuantity = parseFloat(itemForm.reorderQuantity);
      if (itemForm.location) payload.location = itemForm.location;
      if (itemForm.description) payload.description = itemForm.description;

      if (editingItem) {
        const res = await api.patch(`/api/inventory/items/${editingItem.id}`, payload);
        if (res.error) { Alert.alert('Error', res.error); return; }
        Alert.alert('Success', 'Item updated.');
      } else {
        const res = await api.post('/api/inventory/items', payload);
        if (res.error) { Alert.alert('Error', res.error); return; }
        Alert.alert('Success', 'Item added.');
      }
      setShowItemModal(false);
      setItemForm(defaultItemForm);
      setEditingItem(null);
      fetchData();
    } catch (err) {
      Alert.alert('Error', 'Failed to save item.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = (item: InventoryItem) => {
    confirm({
      title: 'Delete Item',
      message: `Are you sure you want to delete "${item.name}"?`,
      confirmText: 'Delete',
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      try {
        const res = await api.delete(`/api/inventory/items/${item.id}`);
        if (res.error) { Alert.alert('Error', res.error); return; }
        setShowDetailModal(false);
        setSelectedItem(null);
        fetchData();
      } catch (err) {
        Alert.alert('Error', 'Failed to delete item.');
      }
    });
  };

  const openDetail = async (item: InventoryItem) => {
    setSelectedItem(item);
    setShowDetailModal(true);
    setIsLoadingTransactions(true);
    try {
      const res = await api.get<InventoryTransaction[]>(`/api/inventory/items/${item.id}/transactions`);
      if (!res.error) setTransactions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setTransactions([]);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const handleAdjustmentSubmit = async () => {
    if (!adjustmentForm.quantity || parseFloat(adjustmentForm.quantity) === 0) {
      Alert.alert('Required', 'Quantity is required.');
      return;
    }
    if (!selectedItem) return;
    setIsSavingAdjustment(true);
    try {
      const payload: Record<string, unknown> = {
        type: adjustmentForm.type,
        quantity: parseFloat(adjustmentForm.quantity),
      };
      if (adjustmentForm.notes) payload.notes = adjustmentForm.notes;
      if (adjustmentForm.reference) payload.reference = adjustmentForm.reference;

      const res = await api.post(`/api/inventory/items/${selectedItem.id}/transactions`, payload);
      if (res.error) { Alert.alert('Error', res.error); return; }
      Alert.alert('Success', 'Stock adjusted.');
      setShowAdjustmentModal(false);
      setAdjustmentForm(defaultAdjustmentForm);
      const updatedRes = await api.get<InventoryTransaction[]>(`/api/inventory/items/${selectedItem.id}/transactions`);
      if (!updatedRes.error) setTransactions(updatedRes.data || []);
      fetchData();
    } catch (err) {
      Alert.alert('Error', 'Failed to adjust stock.');
    } finally {
      setIsSavingAdjustment(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setIsCreatingCategory(true);
    try {
      const res = await api.post('/api/inventory/categories', {
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined,
      });
      if (res.error) { Alert.alert('Error', res.error); return; }
      setShowCategoryModal(false);
      setNewCategoryName('');
      setNewCategoryDescription('');
      const catRes = await api.get<InventoryCategory[]>('/api/inventory/categories');
      if (!catRes.error) setCategories(catRes.data || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to create category.');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleCreatePO = async () => {
    if (!poForm.supplierId) {
      Alert.alert('Required', 'Select a supplier.');
      return;
    }
    if (!poForm.poNumber.trim()) {
      Alert.alert('Required', 'PO number is required.');
      return;
    }
    setIsSavingPO(true);
    try {
      const payload: Record<string, unknown> = {
        supplierId: poForm.supplierId,
        poNumber: poForm.poNumber.trim(),
      };
      if (poForm.requiredDate) payload.requiredDate = new Date(poForm.requiredDate).toISOString();
      if (poForm.notes) payload.notes = poForm.notes;

      const res = await api.post('/api/purchase-orders', payload);
      if (res.error) { Alert.alert('Error', res.error); return; }
      Alert.alert('Success', 'Purchase order created.');
      setShowPOModal(false);
      setPOForm(defaultPOForm);
      fetchData();
    } catch (err) {
      Alert.alert('Error', 'Failed to create purchase order.');
    } finally {
      setIsSavingPO(false);
    }
  };

  const openCreateSupplier = () => {
    setSupplierForm(defaultSupplierForm);
    setEditingSupplier(null);
    setShowSupplierModal(true);
  };

  const openEditSupplier = (supplier: Supplier) => {
    setSupplierForm({
      name: supplier.name || '',
      abn: supplier.abn || '',
      contactName: supplier.contactName || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      paymentTerms: supplier.paymentTerms || 'Net 30',
      notes: supplier.notes || '',
    });
    setEditingSupplier(supplier);
    setShowSupplierDetail(false);
    setShowSupplierModal(true);
  };

  const handleSubmitSupplier = async () => {
    if (!supplierForm.name.trim()) {
      Alert.alert('Required', 'Company name is required.');
      return;
    }
    if (supplierForm.abn.trim()) {
      const digits = supplierForm.abn.replace(/[^0-9]/g, '');
      if (digits.length !== 11 || !validateAbn(supplierForm.abn)) {
        Alert.alert('Invalid ABN', 'Please enter a valid 11-digit ABN or leave the field blank.');
        return;
      }
    }
    setIsSavingSupplier(true);
    try {
      const payload: Record<string, unknown> = {
        name: supplierForm.name.trim(),
      };
      // Always send abn on edits so existing values can be cleared; omit on create when blank
      if (editingSupplier) {
        payload.abn = supplierForm.abn.trim() || null;
      } else if (supplierForm.abn.trim()) {
        payload.abn = supplierForm.abn.trim();
      }
      if (supplierForm.contactName) payload.contactName = supplierForm.contactName.trim();
      if (supplierForm.phone) payload.phone = supplierForm.phone.trim();
      if (supplierForm.email) payload.email = supplierForm.email.trim();
      if (supplierForm.address) payload.address = supplierForm.address.trim();
      if (supplierForm.paymentTerms) payload.paymentTerms = supplierForm.paymentTerms.trim();
      if (supplierForm.notes) payload.notes = supplierForm.notes.trim();

      if (editingSupplier) {
        const res = await api.patch(`/api/suppliers/${editingSupplier.id}`, payload);
        if (res.error) { Alert.alert('Error', res.error); return; }
        Alert.alert('Success', 'Supplier updated.');
      } else {
        const res = await api.post('/api/suppliers', payload);
        if (res.error) { Alert.alert('Error', res.error); return; }
        Alert.alert('Success', 'Supplier added.');
      }
      setShowSupplierModal(false);
      setSupplierForm(defaultSupplierForm);
      setEditingSupplier(null);
      fetchData();
    } catch (err) {
      Alert.alert('Error', 'Failed to save supplier.');
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleDeleteSupplier = (supplier: Supplier) => {
    confirm({
      title: 'Delete Supplier',
      message: `Are you sure you want to delete "${supplier.name}"?`,
      confirmText: 'Delete',
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      try {
        const res = await api.delete(`/api/suppliers/${supplier.id}`);
        if (res.error) { Alert.alert('Error', res.error); return; }
        setShowSupplierDetail(false);
        setSelectedSupplier(null);
        fetchData();
      } catch (err) {
        Alert.alert('Error', 'Failed to delete supplier.');
      }
    });
  };

  const openSupplierDetail = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowSupplierDetail(true);
    setSupplierPOs([]);
    setSupplierStats(null);
    setIsLoadingSupplierPOs(true);
    try {
      const res = await api.get<{ purchaseOrders: PurchaseOrder[]; stats: SupplierPOStats }>(
        `/api/suppliers/${supplier.id}/purchase-orders`
      );
      if (!res.error && res.data) {
        setSupplierPOs(Array.isArray(res.data.purchaseOrders) ? res.data.purchaseOrders : []);
        setSupplierStats(res.data.stats || null);
      }
    } catch (err) {
      setSupplierPOs([]);
      setSupplierStats(null);
    } finally {
      setIsLoadingSupplierPOs(false);
    }
  };

  const transactionTypeOptions: { value: TransactionType; label: string }[] = [
    { value: 'in', label: 'Stock In' },
    { value: 'out', label: 'Stock Out' },
    { value: 'adjustment', label: 'Adjustment' },
  ];

  const sortOptions: { value: SortField; label: string }[] = [
    { value: 'name', label: 'Name' },
    { value: 'currentStock', label: 'Stock Level' },
    { value: 'sellPrice', label: 'Price' },
  ];

  const tabs: { key: TabType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: 'items', label: 'Items', icon: 'package' },
    { key: 'categories', label: 'Categories', icon: 'grid' },
    { key: 'lowStock', label: 'Low Stock', icon: 'alert-triangle' },
    { key: 'purchaseOrders', label: 'Orders', icon: 'shopping-cart' },
    ...(canManageSuppliers
      ? [{ key: 'suppliers' as TabType, label: 'Suppliers', icon: 'truck' as keyof typeof Feather.glyphMap }]
      : []),
  ];

  const renderPickerModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    options: { value: string; label: string }[],
    selectedValue: string,
    onSelect: (value: string) => void,
  ) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerTitle}>{title}</Text>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.pickerOption, selectedValue === opt.value && styles.pickerOptionActive]}
              onPress={() => { onSelect(opt.value); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerOptionText, selectedValue === opt.value && styles.pickerOptionTextActive]}>
                {opt.label}
              </Text>
              {selectedValue === opt.value && (
                <Feather name="check" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.pickerCancel} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.pickerCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderTabBar = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
      <View style={styles.tabContainer}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = tab.key === 'lowStock' ? lowStockItems.length :
                        tab.key === 'items' ? items.length :
                        tab.key === 'categories' ? categories.length :
                        tab.key === 'suppliers' ? suppliers.length :
                        purchaseOrders.length;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabChip, isActive && styles.activeTabChip]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Feather
                name={tab.icon}
                size={iconSizes.sm}
                color={isActive ? colors.primaryForeground : colors.mutedForeground}
              />
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                {tab.label}
              </Text>
              <View style={[styles.tabBadge, isActive && styles.activeTabBadge]}>
                <Text style={[styles.tabBadgeText, isActive && styles.activeTabBadgeText]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderPageHeader = () => {
    let onAddPress: (() => void) | null = null;
    let addLabel = '';
    if (activeTab === 'items') { onAddPress = openCreateItem; addLabel = 'Add Item'; }
    else if (activeTab === 'categories') { onAddPress = () => setShowCategoryModal(true); addLabel = 'Add Category'; }
    else if (activeTab === 'purchaseOrders') { onAddPress = () => setShowPOModal(true); addLabel = 'New Order'; }
    else if (activeTab === 'suppliers') { onAddPress = openCreateSupplier; addLabel = 'Add Supplier'; }

    return (
      <View style={styles.pageHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Inventory</Text>
          <Text style={styles.pageSubtitle}>Track stock, categories, and orders</Text>
        </View>
        {onAddPress && (
          <PressableRow style={styles.pageHeaderAdd} onPress={onAddPress}>
            <Feather name="plus" size={18} color={colors.primaryForeground} />
            <Text style={styles.pageHeaderAddText}>{addLabel}</Text>
          </PressableRow>
        )}
      </View>
    );
  };

  const renderSummaryCards = () => {
    const totalItems = items.length;
    const totalValue = items.reduce((sum, i) => sum + ((i.currentStock ?? 0) * parseFloat(i.costPrice || '0')), 0);
    const lowCount = lowStockItems.length;

    return (
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
            <Feather name="package" size={16} color="#3b82f6" />
          </View>
          <Text style={styles.statValue}>{totalItems}</Text>
          <Text style={styles.statLabel}>ITEMS</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
            <Feather name="alert-triangle" size={16} color="#f59e0b" />
          </View>
          <Text style={styles.statValue}>{lowCount}</Text>
          <Text style={styles.statLabel}>LOW STOCK</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
            <Feather name="dollar-sign" size={16} color="#22c55e" />
          </View>
          <Text style={styles.statValue}>{formatCurrency(totalValue)}</Text>
          <Text style={styles.statLabel}>VALUE</Text>
        </View>
      </View>
    );
  };

  const renderItemCard = ({ item }: { item: InventoryItem }) => {
    const stock = item.currentStock ?? 0;
    const min = item.minimumStock ?? 0;
    const reorder = item.reorderLevel ?? 0;
    const stockColor = getStockColor(stock, min, reorder);
    const categoryName = getCategoryName(item.categoryId);

    return (
      <PressableRow
        style={styles.card}
        onPress={() => openDetail(item)}

      >
        <View style={styles.cardTopRow}>
          <View style={styles.cardNameRow}>
            <View style={[styles.statusDot, { backgroundColor: stockColor }]} />
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          </View>
          {item.sku ? (
            <Text style={styles.cardModel} numberOfLines={1}>SKU: {item.sku}</Text>
          ) : null}
        </View>

        {categoryName ? (
          <View style={styles.cardMetaRow}>
            <Feather name="grid" size={13} color={colors.mutedForeground} />
            <Text style={styles.cardMetaText} numberOfLines={1}>{categoryName}</Text>
          </View>
        ) : null}

        {item.location ? (
          <View style={styles.cardMetaRow}>
            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
            <Text style={styles.cardMetaText} numberOfLines={1}>{item.location}</Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <View style={styles.cardStockRow}>
            <Text style={[styles.cardStock, { color: stockColor }]}>{stock}</Text>
            <Text style={styles.cardUnit}>{item.unit || 'each'}</Text>
          </View>
          <View style={styles.cardPriceRow}>
            {item.costPrice ? (
              <Text style={styles.cardPriceLabel}>
                Cost: {formatCurrency(item.costPrice)}
              </Text>
            ) : null}
            {item.sellPrice ? (
              <Text style={styles.cardPrice}>
                Sell: {formatCurrency(item.sellPrice)}
              </Text>
            ) : null}
          </View>
        </View>
      </PressableRow>
    );
  };

  const renderSearchAndFilter = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchInputWrapper}>
        <Feather name="search" size={iconSizes.md} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search items..."
          placeholderTextColor={colors.mutedForeground}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
            <Feather name="x" size={iconSizes.md} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setShowFilterPicker(true)}
          activeOpacity={0.7}
        >
          <Feather name="filter" size={iconSizes.sm} color={colors.mutedForeground} />
          <Text style={styles.filterBtnText}>
            {filterCategoryId ? getCategoryName(filterCategoryId) || 'Category' : 'All'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setShowSortPicker(true)}
          activeOpacity={0.7}
        >
          <Feather name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'} size={iconSizes.sm} color={colors.mutedForeground} />
          <Text style={styles.filterBtnText}>
            {sortOptions.find(o => o.value === sortField)?.label || 'Sort'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          activeOpacity={0.7}
        >
          <Feather name="repeat" size={iconSizes.sm} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderItemsTab = () => (
    <>
      {renderSearchAndFilter()}
      {filteredItems.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="package" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>No Items Found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery || filterCategoryId
              ? 'Try adjusting your search or filters.'
              : 'Add your first inventory item to start tracking stock.'}
          </Text>
          {!searchQuery && !filterCategoryId && (
            <TouchableOpacity style={styles.emptyButton} onPress={openCreateItem} activeOpacity={0.7}>
              <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground} />
              <Text style={styles.emptyButtonText}>Add Item</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItemCard}
          scrollEnabled={false}
          contentContainerStyle={{ gap: spacing.sm }}
        />
      )}
    </>
  );

  const renderCategoriesTab = () => (
    <>
      {categories.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="grid" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>No Categories</Text>
          <Text style={styles.emptySubtitle}>
            Create categories to organize your inventory items.
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => setShowCategoryModal(true)} activeOpacity={0.7}>
            <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground} />
            <Text style={styles.emptyButtonText}>Add Category</Text>
          </TouchableOpacity>
        </View>
      ) : (
        categories.map((cat) => {
          const itemCount = items.filter(i => i.categoryId === cat.id).length;
          return (
            <View key={cat.id} style={styles.categoryCard}>
              <View style={styles.categoryIconContainer}>
                <Feather name="grid" size={iconSizes.lg} color={colors.primary} />
              </View>
              <View style={styles.categoryContent}>
                <Text style={styles.categoryName}>{cat.name}</Text>
                {cat.description ? (
                  <Text style={styles.categoryDesc} numberOfLines={1}>{cat.description}</Text>
                ) : null}
              </View>
              <View style={styles.categoryCount}>
                <Text style={styles.categoryCountText}>{itemCount}</Text>
                <Text style={styles.categoryCountLabel}>items</Text>
              </View>
            </View>
          );
        })
      )}
    </>
  );

  const renderLowStockTab = () => (
    <>
      {lowStockItems.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="check-circle" size={40} color="#22c55e" />
          </View>
          <Text style={styles.emptyTitle}>All Stocked Up</Text>
          <Text style={styles.emptySubtitle}>
            No items are below their reorder level. Great job!
          </Text>
        </View>
      ) : (
        <FlatList
          data={lowStockItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const stock = item.currentStock ?? 0;
            const reorder = item.reorderLevel ?? 0;
            const stockColor = stock <= 0 ? '#ef4444' : '#f59e0b';
            return (
              <TouchableOpacity
                style={styles.lowStockCard}
                onPress={() => openDetail(item)}
                activeOpacity={0.7}
              >
                <View style={styles.lowStockLeft}>
                  <View style={[styles.statusDot, { backgroundColor: stockColor }]} />
                  <View style={styles.lowStockInfo}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cardMetaText}>
                      Stock: {stock} / Reorder at: {reorder}
                    </Text>
                  </View>
                </View>
                <View style={[styles.lowStockBadge, { backgroundColor: stock <= 0 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)' }]}>
                  <Text style={[styles.lowStockBadgeText, { color: stockColor }]}>
                    {stock <= 0 ? 'Out' : 'Low'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          scrollEnabled={false}
          contentContainerStyle={{ gap: spacing.sm }}
        />
      )}
    </>
  );

  const renderPurchaseOrdersTab = () => (
    <>
      {purchaseOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="shopping-cart" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>No Purchase Orders</Text>
          <Text style={styles.emptySubtitle}>
            Create purchase orders to track your supply orders.
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => setShowPOModal(true)} activeOpacity={0.7}>
            <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground} />
            <Text style={styles.emptyButtonText}>New Order</Text>
          </TouchableOpacity>
        </View>
      ) : (
        purchaseOrders.map((po) => {
          const statusConfig = getPOStatusConfig((po.status || 'pending') as POStatus);
          const supplierName = getSupplierName(po.supplierId);
          return (
            <View key={po.id} style={styles.poCard}>
              <View style={styles.poHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{po.poNumber}</Text>
                  {supplierName && (
                    <Text style={styles.cardMetaText}>{supplierName}</Text>
                  )}
                </View>
                <View style={[styles.poBadge, { backgroundColor: statusConfig.bgColor }]}>
                  <Text style={[styles.poBadgeText, { color: statusConfig.color }]}>
                    {statusConfig.label}
                  </Text>
                </View>
              </View>
              <View style={styles.poFooter}>
                {po.orderDate && (
                  <Text style={styles.cardMetaText}>
                    Ordered: {formatDate(po.orderDate)}
                  </Text>
                )}
                <Text style={styles.poTotal}>{formatCurrency(po.total)}</Text>
              </View>
            </View>
          );
        })
      )}
    </>
  );

  const renderSuppliersTab = () => (
    <>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Feather name="search" size={iconSizes.md} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            value={supplierSearch}
            onChangeText={setSupplierSearch}
            placeholder="Search suppliers..."
            placeholderTextColor={colors.mutedForeground}
          />
          {supplierSearch ? (
            <TouchableOpacity onPress={() => setSupplierSearch('')} activeOpacity={0.7}>
              <Feather name="x" size={iconSizes.md} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {filteredSuppliers.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="truck" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>No Suppliers</Text>
          <Text style={styles.emptySubtitle}>
            {supplierSearch
              ? 'Try adjusting your search.'
              : 'Add your suppliers to keep contact details and order history in one place.'}
          </Text>
          {!supplierSearch && (
            <TouchableOpacity style={styles.emptyButton} onPress={openCreateSupplier} activeOpacity={0.7}>
              <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground} />
              <Text style={styles.emptyButtonText}>Add Supplier</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredSuppliers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PressableRow style={styles.card} onPress={() => openSupplierDetail(item)}>
              <View style={styles.cardTopRow}>
                <View style={styles.cardNameRow}>
                  <View style={styles.supplierAvatar}>
                    <Feather name="truck" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                </View>
                {item.paymentTerms ? (
                  <View style={[styles.poBadge, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.poBadgeText, { color: colors.mutedForeground }]}>{item.paymentTerms}</Text>
                  </View>
                ) : null}
              </View>
              {item.contactName ? (
                <View style={styles.cardMetaRow}>
                  <Feather name="user" size={13} color={colors.mutedForeground} />
                  <Text style={styles.cardMetaText} numberOfLines={1}>{item.contactName}</Text>
                </View>
              ) : null}
              {item.phone ? (
                <View style={styles.cardMetaRow}>
                  <Feather name="phone" size={13} color={colors.mutedForeground} />
                  <Text style={styles.cardMetaText} numberOfLines={1}>{item.phone}</Text>
                </View>
              ) : null}
            </PressableRow>
          )}
          scrollEnabled={false}
          contentContainerStyle={{ gap: spacing.sm }}
        />
      )}
    </>
  );

  const renderSupplierDetailModal = () => {
    if (!selectedSupplier) return null;
    const s = selectedSupplier;
    return (
      <AppBottomSheet
        visible={showSupplierDetail}
        onDismiss={() => setShowSupplierDetail(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, {}]}>
            <TouchableOpacity onPress={() => setShowSupplierDetail(false)} activeOpacity={0.7}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>{s.name}</Text>
            <View style={{ width: 24 }} />
          </View>
          <BottomSheetScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.detailActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openEditSupplier(s)}
                activeOpacity={0.7}
              >
                <Feather name="edit-2" size={iconSizes.md} color={colors.foreground} />
                <Text style={[styles.editButtonText, { color: colors.foreground }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteSupplier(s)}
                activeOpacity={0.7}
              >
                <Feather name="trash-2" size={iconSizes.md} color="#ef4444" />
              </TouchableOpacity>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>DETAILS</Text>
              <View style={styles.detailGrid}>
                {s.abn ? (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>ABN</Text>
                    <Text style={styles.detailItemValue}>{formatAbn(s.abn)}</Text>
                  </View>
                ) : null}
                {s.contactName ? (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Contact</Text>
                    <Text style={styles.detailItemValue}>{s.contactName}</Text>
                  </View>
                ) : null}
                {s.phone ? (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Phone</Text>
                    <Text style={styles.detailItemValue}>{s.phone}</Text>
                  </View>
                ) : null}
                {s.email ? (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Email</Text>
                    <Text style={styles.detailItemValue}>{s.email}</Text>
                  </View>
                ) : null}
                {s.paymentTerms ? (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Payment Terms</Text>
                    <Text style={styles.detailItemValue}>{s.paymentTerms}</Text>
                  </View>
                ) : null}
                {s.address ? (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Address</Text>
                    <Text style={styles.detailItemValue}>{s.address}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {s.notes ? (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>NOTES</Text>
                <Text style={[styles.detailItemValue, { marginTop: spacing.xs }]}>{s.notes}</Text>
              </View>
            ) : null}

            {supplierStats ? (
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <View style={[styles.statIconContainer, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                    <Feather name="dollar-sign" size={16} color="#22c55e" />
                  </View>
                  <Text style={styles.statValue}>{formatCurrency(supplierStats.totalSpend)}</Text>
                  <Text style={styles.statLabel}>TOTAL SPEND</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIconContainer, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                    <Feather name="shopping-cart" size={16} color="#3b82f6" />
                  </View>
                  <Text style={styles.statValue}>{supplierStats.openPoCount}</Text>
                  <Text style={styles.statLabel}>OPEN POS</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={[styles.statIconContainer, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                    <Feather name="calendar" size={16} color="#8b5cf6" />
                  </View>
                  <Text style={styles.statValue}>{supplierStats.lastOrderDate ? formatDate(supplierStats.lastOrderDate) : '-'}</Text>
                  <Text style={styles.statLabel}>LAST ORDER</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>PURCHASE ORDER HISTORY</Text>
              {isLoadingSupplierPOs ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.md }} />
              ) : supplierPOs.length === 0 ? (
                <View style={styles.noMaintenanceContainer}>
                  <Text style={styles.noMaintenanceText}>No purchase orders yet</Text>
                </View>
              ) : (
                <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  {supplierPOs.map((po) => {
                    const statusConfig = getPOStatusConfig((po.status || 'pending') as POStatus);
                    return (
                      <View key={po.id} style={styles.poCard}>
                        <View style={styles.poHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>{po.poNumber}</Text>
                            {po.orderDate ? (
                              <Text style={styles.cardMetaText}>{formatDate(po.orderDate)}</Text>
                            ) : null}
                          </View>
                          <View style={[styles.poBadge, { backgroundColor: statusConfig.bgColor }]}>
                            <Text style={[styles.poBadgeText, { color: statusConfig.color }]}>
                              {statusConfig.label}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.poFooter}>
                          <View />
                          <Text style={styles.poTotal}>{formatCurrency(po.total)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </BottomSheetScrollView>
        </View>
      </AppBottomSheet>
    );
  };

  const renderSupplierFormModal = () => (
    <AppBottomSheet visible={showSupplierModal} onDismiss={() => setShowSupplierModal(false)} snapPoints={['92%']} scrollable={false} contentPadding={0}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalHeader, {}]}>
          <TouchableOpacity onPress={() => setShowSupplierModal(false)} activeOpacity={0.7}>
            <Feather name="x" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</Text>
          <TouchableOpacity onPress={handleSubmitSupplier} disabled={isSavingSupplier} activeOpacity={0.7}>
            {isSavingSupplier ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.modalSaveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
        <BottomSheetScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Company Name *</Text>
          <TextInput
            style={styles.textInput}
            value={supplierForm.name}
            onChangeText={(text) => setSupplierForm({ ...supplierForm, name: text })}
            placeholder="e.g., Reece Plumbing"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={styles.fieldLabel}>ABN</Text>
          <TextInput
            style={[
              styles.textInput,
              (() => {
                const digits = supplierForm.abn.replace(/[^0-9]/g, '');
                const nonEmpty = supplierForm.abn.trim() !== '';
                const bad = nonEmpty && (digits.length !== 11 || !validateAbn(supplierForm.abn));
                return bad ? { borderColor: '#f59e0b', borderWidth: 1 } : {};
              })(),
            ]}
            value={supplierForm.abn}
            onChangeText={(text) => setSupplierForm({ ...supplierForm, abn: text })}
            placeholder="e.g., 12 345 678 901"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
          />
          {(() => {
            const digits = supplierForm.abn.replace(/[^0-9]/g, '');
            const nonEmpty = supplierForm.abn.trim() !== '';
            if (!nonEmpty) return null;
            if (digits.length !== 11) {
              return <Text style={{ color: '#f59e0b', fontSize: 12, marginTop: 2 }}>ABN must be 11 digits.</Text>;
            }
            if (digits.length === 11 && !validateAbn(supplierForm.abn)) {
              return <Text style={{ color: '#f59e0b', fontSize: 12, marginTop: 2 }}>Invalid ABN checksum. Please double-check the number.</Text>;
            }
            if (digits.length === 11) {
              return <Text style={{ color: '#22c55e', fontSize: 12, marginTop: 2 }}>Valid ABN</Text>;
            }
            return null;
          })()}

          <Text style={styles.fieldLabel}>Contact Name</Text>
          <TextInput
            style={styles.textInput}
            value={supplierForm.contactName}
            onChangeText={(text) => setSupplierForm({ ...supplierForm, contactName: text })}
            placeholder="e.g., Jane Smith"
            placeholderTextColor={colors.mutedForeground}
          />

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput
                style={styles.textInput}
                value={supplierForm.phone}
                onChangeText={(text) => setSupplierForm({ ...supplierForm, phone: text })}
                placeholder="e.g., 0400 000 000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Payment Terms</Text>
              <TextInput
                style={styles.textInput}
                value={supplierForm.paymentTerms}
                onChangeText={(text) => setSupplierForm({ ...supplierForm, paymentTerms: text })}
                placeholder="Net 30"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.textInput}
            value={supplierForm.email}
            onChangeText={(text) => setSupplierForm({ ...supplierForm, email: text })}
            placeholder="e.g., orders@supplier.com"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.fieldLabel}>Address</Text>
          <TextInput
            style={styles.textInput}
            value={supplierForm.address}
            onChangeText={(text) => setSupplierForm({ ...supplierForm, address: text })}
            placeholder="e.g., 12 Trade St, Sydney NSW"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={supplierForm.notes}
            onChangeText={(text) => setSupplierForm({ ...supplierForm, notes: text })}
            placeholder="Additional notes..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
          />
        </BottomSheetScrollView>
      </KeyboardAvoidingView>
    </AppBottomSheet>
  );

  const renderDetailModal = () => {
    if (!selectedItem) return null;
    const stock = selectedItem.currentStock ?? 0;
    const min = selectedItem.minimumStock ?? 0;
    const reorder = selectedItem.reorderLevel ?? 0;
    const stockColor = getStockColor(stock, min, reorder);

    return (
      <AppBottomSheet
        visible={showDetailModal}
        onDismiss={() => setShowDetailModal(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, {}]}>
            <TouchableOpacity onPress={() => setShowDetailModal(false)} activeOpacity={0.7}>
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>{selectedItem.name}</Text>
            <View style={{ width: 24 }} />
          </View>
          <BottomSheetScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.detailStatusRow}>
              <View style={styles.cardStockRow}>
                <Text style={[styles.detailStockValue, { color: stockColor }]}>{stock}</Text>
                <Text style={styles.detailStockUnit}>{selectedItem.unit || 'each'}</Text>
              </View>
              {stock <= reorder && stock > 0 && (
                <View style={[styles.poBadge, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                  <Text style={[styles.poBadgeText, { color: '#f59e0b' }]}>Low Stock</Text>
                </View>
              )}
              {stock <= 0 && (
                <View style={[styles.poBadge, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                  <Text style={[styles.poBadgeText, { color: '#ef4444' }]}>Out of Stock</Text>
                </View>
              )}
            </View>

            <View style={styles.detailActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openEditItem(selectedItem)}
                activeOpacity={0.7}
              >
                <Feather name="edit-2" size={iconSizes.md} color={colors.foreground} />
                <Text style={[styles.editButtonText, { color: colors.foreground }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setAdjustmentForm(defaultAdjustmentForm);
                  setShowAdjustmentModal(true);
                }}
                activeOpacity={0.7}
              >
                <Feather name="plus-circle" size={iconSizes.md} color={colors.primaryForeground} />
                <Text style={[styles.editButtonText, { color: colors.primaryForeground }]}>Adjust Stock</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteItem(selectedItem)}
                activeOpacity={0.7}
              >
                <Feather name="trash-2" size={iconSizes.md} color="#ef4444" />
              </TouchableOpacity>
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>DETAILS</Text>
              <View style={styles.detailGrid}>
                {selectedItem.sku && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>SKU</Text>
                    <Text style={styles.detailItemValue}>{selectedItem.sku}</Text>
                  </View>
                )}
                {selectedItem.categoryId && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Category</Text>
                    <Text style={styles.detailItemValue}>{getCategoryName(selectedItem.categoryId) || '-'}</Text>
                  </View>
                )}
                <View style={styles.detailItem}>
                  <Text style={styles.detailItemLabel}>Cost Price</Text>
                  <Text style={styles.detailItemValue}>{selectedItem.costPrice ? formatCurrency(selectedItem.costPrice) : '-'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailItemLabel}>Sell Price</Text>
                  <Text style={styles.detailItemValue}>{selectedItem.sellPrice ? formatCurrency(selectedItem.sellPrice) : '-'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailItemLabel}>Min Stock</Text>
                  <Text style={styles.detailItemValue}>{min}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailItemLabel}>Reorder Level</Text>
                  <Text style={styles.detailItemValue}>{reorder}</Text>
                </View>
                {selectedItem.location && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Location</Text>
                    <Text style={styles.detailItemValue}>{selectedItem.location}</Text>
                  </View>
                )}
                {selectedItem.unit && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Unit</Text>
                    <Text style={styles.detailItemValue}>{selectedItem.unit}</Text>
                  </View>
                )}
              </View>
            </View>

            {selectedItem.description ? (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>DESCRIPTION</Text>
                <Text style={[styles.detailItemValue, { marginTop: spacing.xs }]}>{selectedItem.description}</Text>
              </View>
            ) : null}

            <View style={styles.detailSection}>
              <View style={styles.maintenanceHeader}>
                <Text style={styles.detailSectionTitle}>STOCK HISTORY</Text>
              </View>
              {isLoadingTransactions ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.md }} />
              ) : transactions.length === 0 ? (
                <View style={styles.noMaintenanceContainer}>
                  <Text style={styles.noMaintenanceText}>No stock transactions yet</Text>
                </View>
              ) : (
                <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  {transactions.slice(0, 10).map((tx) => (
                    <View key={tx.id} style={styles.transactionCard}>
                      <View style={styles.transactionHeader}>
                        <View style={styles.transactionTypeRow}>
                          <View style={[
                            styles.transactionIcon,
                            {
                              backgroundColor: tx.type === 'in' ? 'rgba(34,197,94,0.1)' :
                                             tx.type === 'out' ? 'rgba(239,68,68,0.1)' :
                                             'rgba(59,130,246,0.1)',
                            }
                          ]}>
                            <Feather
                              name={tx.type === 'in' ? 'arrow-down' : tx.type === 'out' ? 'arrow-up' : 'refresh-cw'}
                              size={14}
                              color={tx.type === 'in' ? '#22c55e' : tx.type === 'out' ? '#ef4444' : '#3b82f6'}
                            />
                          </View>
                          <Text style={styles.transactionType}>
                            {tx.type === 'in' ? 'Stock In' : tx.type === 'out' ? 'Stock Out' : 'Adjustment'}
                          </Text>
                        </View>
                        <Text style={[
                          styles.transactionQty,
                          { color: tx.type === 'in' ? '#22c55e' : tx.type === 'out' ? '#ef4444' : '#3b82f6' }
                        ]}>
                          {tx.type === 'in' ? '+' : tx.type === 'out' ? '-' : ''}{tx.quantity}
                        </Text>
                      </View>
                      {tx.notes && <Text style={styles.transactionNotes}>{tx.notes}</Text>}
                      <Text style={styles.transactionDate}>{formatDate(tx.transactionDate || tx.createdAt)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </BottomSheetScrollView>
        </View>
      </AppBottomSheet>
    );
  };

  const renderItemFormModal = () => (
    <AppBottomSheet visible={showItemModal} onDismiss={() => setShowItemModal(false)} snapPoints={['92%']} scrollable={false} contentPadding={0}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalHeader, {}]}>
          <TouchableOpacity onPress={() => setShowItemModal(false)} activeOpacity={0.7}>
            <Feather name="x" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{editingItem ? 'Edit Item' : 'Add Item'}</Text>
          <TouchableOpacity onPress={handleSubmitItem} disabled={isSaving} activeOpacity={0.7}>
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.modalSaveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
        <BottomSheetScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput
            style={styles.textInput}
            value={itemForm.name}
            onChangeText={(text) => setItemForm({ ...itemForm, name: text })}
            placeholder="e.g., 20mm Copper Pipe"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={styles.fieldLabel}>SKU</Text>
          <TextInput
            style={styles.textInput}
            value={itemForm.sku}
            onChangeText={(text) => setItemForm({ ...itemForm, sku: text })}
            placeholder="e.g., COP-020"
            placeholderTextColor={colors.mutedForeground}
          />

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Unit</Text>
              <TextInput
                style={styles.textInput}
                value={itemForm.unit}
                onChangeText={(text) => setItemForm({ ...itemForm, unit: text })}
                placeholder="each"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Location</Text>
              <TextInput
                style={styles.textInput}
                value={itemForm.location}
                onChangeText={(text) => setItemForm({ ...itemForm, location: text })}
                placeholder="e.g., Shelf A3"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Cost Price</Text>
              <TextInput
                style={styles.textInput}
                value={itemForm.costPrice}
                onChangeText={(text) => setItemForm({ ...itemForm, costPrice: text })}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Sell Price</Text>
              <TextInput
                style={styles.textInput}
                value={itemForm.sellPrice}
                onChangeText={(text) => setItemForm({ ...itemForm, sellPrice: text })}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.categoryRow}>
            <TouchableOpacity
              style={[styles.textInput, styles.pickerTrigger]}
              onPress={() => setShowCategoryPicker(true)}
              activeOpacity={0.7}
            >
              <Text style={itemForm.categoryId ? styles.pickerTriggerText : styles.pickerPlaceholder}>
                {itemForm.categoryId ? (getCategoryName(itemForm.categoryId) || 'Select category') : 'Select category'}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addCategoryBtn}
              onPress={() => setShowCategoryModal(true)}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={iconSizes.lg} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Min Stock</Text>
              <TextInput
                style={styles.textInput}
                value={itemForm.minimumStock}
                onChangeText={(text) => setItemForm({ ...itemForm, minimumStock: text })}
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Reorder Level</Text>
              <TextInput
                style={styles.textInput}
                value={itemForm.reorderLevel}
                onChangeText={(text) => setItemForm({ ...itemForm, reorderLevel: text })}
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={itemForm.description}
            onChangeText={(text) => setItemForm({ ...itemForm, description: text })}
            placeholder="Item description..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
          />
        </BottomSheetScrollView>
      </KeyboardAvoidingView>
    </AppBottomSheet>
  );

  const renderAdjustmentModal = () => (
    <AppBottomSheet
        visible={showAdjustmentModal}
        onDismiss={() => setShowAdjustmentModal(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalHeader, {}]}>
          <TouchableOpacity onPress={() => setShowAdjustmentModal(false)} activeOpacity={0.7}>
            <Feather name="x" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Adjust Stock</Text>
          <TouchableOpacity onPress={handleAdjustmentSubmit} disabled={isSavingAdjustment} activeOpacity={0.7}>
            {isSavingAdjustment ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.modalSaveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
        <BottomSheetScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Type</Text>
          <TouchableOpacity
            style={[styles.textInput, styles.pickerTrigger]}
            onPress={() => setShowTypePicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.pickerTriggerText}>
              {transactionTypeOptions.find(o => o.value === adjustmentForm.type)?.label || 'Stock In'}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>Quantity *</Text>
          <TextInput
            style={styles.textInput}
            value={adjustmentForm.quantity}
            onChangeText={(text) => setAdjustmentForm({ ...adjustmentForm, quantity: text })}
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
          />

          <Text style={styles.fieldLabel}>Reference</Text>
          <TextInput
            style={styles.textInput}
            value={adjustmentForm.reference}
            onChangeText={(text) => setAdjustmentForm({ ...adjustmentForm, reference: text })}
            placeholder="e.g., PO-001 or Job #123"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={styles.fieldLabel}>Notes / Reason</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={adjustmentForm.notes}
            onChangeText={(text) => setAdjustmentForm({ ...adjustmentForm, notes: text })}
            placeholder="Reason for adjustment..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
          />
        </BottomSheetScrollView>
      </KeyboardAvoidingView>
    </AppBottomSheet>
  );

  const renderCategoryModal = () => (
    <Modal visible={showCategoryModal} transparent animationType="fade" onRequestClose={() => setShowCategoryModal(false)}>
      <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowCategoryModal(false)}>
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerTitle}>New Category</Text>
          <TextInput
            style={styles.textInput}
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            placeholder="Category name"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
          />
          <TextInput
            style={[styles.textInput, { marginTop: spacing.sm }]}
            value={newCategoryDescription}
            onChangeText={setNewCategoryDescription}
            placeholder="Description (optional)"
            placeholderTextColor={colors.mutedForeground}
          />
          <View style={styles.categoryModalActions}>
            <TouchableOpacity style={styles.categoryModalCancel} onPress={() => setShowCategoryModal(false)} activeOpacity={0.7}>
              <Text style={{ ...typography.bodySemibold, color: colors.foreground }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.categoryModalSave} onPress={handleCreateCategory} disabled={isCreatingCategory} activeOpacity={0.7}>
              {isCreatingCategory ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={styles.categoryModalSaveText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderPOModal = () => (
    <AppBottomSheet
        visible={showPOModal}
        onDismiss={() => setShowPOModal(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalHeader, {}]}>
          <TouchableOpacity onPress={() => setShowPOModal(false)} activeOpacity={0.7}>
            <Feather name="x" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>New Purchase Order</Text>
          <TouchableOpacity onPress={handleCreatePO} disabled={isSavingPO} activeOpacity={0.7}>
            {isSavingPO ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.modalSaveText}>Create</Text>
            )}
          </TouchableOpacity>
        </View>
        <BottomSheetScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Supplier *</Text>
          <TouchableOpacity
            style={[styles.textInput, styles.pickerTrigger]}
            onPress={() => setShowSupplierPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={poForm.supplierId ? styles.pickerTriggerText : styles.pickerPlaceholder}>
              {poForm.supplierId ? (getSupplierName(poForm.supplierId) || 'Select supplier') : 'Select supplier'}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          {selectedPOSupplier ? (
            <View style={styles.supplierAutofill}>
              {selectedPOSupplier.contactName ? (
                <View style={styles.supplierAutofillRow}>
                  <Feather name="user" size={13} color={colors.mutedForeground} />
                  <Text style={styles.supplierAutofillText} numberOfLines={1}>{selectedPOSupplier.contactName}</Text>
                </View>
              ) : null}
              {selectedPOSupplier.phone ? (
                <View style={styles.supplierAutofillRow}>
                  <Feather name="phone" size={13} color={colors.mutedForeground} />
                  <Text style={styles.supplierAutofillText} numberOfLines={1}>{selectedPOSupplier.phone}</Text>
                </View>
              ) : null}
              {selectedPOSupplier.email ? (
                <View style={styles.supplierAutofillRow}>
                  <Feather name="mail" size={13} color={colors.mutedForeground} />
                  <Text style={styles.supplierAutofillText} numberOfLines={1}>{selectedPOSupplier.email}</Text>
                </View>
              ) : null}
              {selectedPOSupplier.address ? (
                <View style={styles.supplierAutofillRow}>
                  <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                  <Text style={styles.supplierAutofillText} numberOfLines={1}>{selectedPOSupplier.address}</Text>
                </View>
              ) : null}
              {selectedPOSupplier.paymentTerms ? (
                <View style={styles.supplierAutofillRow}>
                  <Feather name="clock" size={13} color={colors.mutedForeground} />
                  <Text style={styles.supplierAutofillText} numberOfLines={1}>{selectedPOSupplier.paymentTerms}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>PO Number *</Text>
          <TextInput
            style={styles.textInput}
            value={poForm.poNumber}
            onChangeText={(text) => setPOForm({ ...poForm, poNumber: text })}
            placeholder="e.g., PO-001"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={styles.fieldLabel}>Required Date</Text>
          <TextInput
            style={styles.textInput}
            value={poForm.requiredDate}
            onChangeText={(text) => setPOForm({ ...poForm, requiredDate: text })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={poForm.notes}
            onChangeText={(text) => setPOForm({ ...poForm, notes: text })}
            placeholder="Additional notes..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
          />
        </BottomSheetScrollView>
      </KeyboardAvoidingView>
    </AppBottomSheet>
  );

  const renderFab = () => null;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Feather name="alert-circle" size={40} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh} activeOpacity={0.7}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {renderPageHeader()}
        {renderSummaryCards()}
        {renderTabBar()}

        {activeTab === 'items' && renderItemsTab()}
        {activeTab === 'categories' && renderCategoriesTab()}
        {activeTab === 'lowStock' && renderLowStockTab()}
        {activeTab === 'purchaseOrders' && renderPurchaseOrdersTab()}
        {activeTab === 'suppliers' && canManageSuppliers && renderSuppliersTab()}
      </ScrollView>

      {renderFab()}

      {renderDetailModal()}
      {renderItemFormModal()}
      {renderAdjustmentModal()}
      {renderCategoryModal()}
      {renderPOModal()}
      {renderSupplierDetailModal()}
      {renderSupplierFormModal()}

      {renderPickerModal(
        showCategoryPicker,
        () => setShowCategoryPicker(false),
        'Select Category',
        [{ value: '', label: 'All Categories' }, ...categories.map(c => ({ value: c.id, label: c.name }))],
        itemForm.categoryId,
        (value) => setItemForm({ ...itemForm, categoryId: value }),
      )}

      {renderPickerModal(
        showTypePicker,
        () => setShowTypePicker(false),
        'Transaction Type',
        transactionTypeOptions.map(o => ({ value: o.value, label: o.label })),
        adjustmentForm.type,
        (value) => setAdjustmentForm({ ...adjustmentForm, type: value as TransactionType }),
      )}

      {renderPickerModal(
        showSortPicker,
        () => setShowSortPicker(false),
        'Sort By',
        sortOptions.map(o => ({ value: o.value, label: o.label })),
        sortField,
        (value) => setSortField(value as SortField),
      )}

      {renderPickerModal(
        showFilterPicker,
        () => setShowFilterPicker(false),
        'Filter by Category',
        [{ value: '', label: 'All Categories' }, ...categories.map(c => ({ value: c.id, label: c.name }))],
        filterCategoryId,
        setFilterCategoryId,
      )}

      {renderPickerModal(
        showSupplierPicker,
        () => setShowSupplierPicker(false),
        'Select Supplier',
        suppliers.map(s => ({ value: s.id, label: s.name })),
        poForm.supplierId,
        (value) => setPOForm({ ...poForm, supplierId: value }),
      )}
    </View>
  );
}

const createStyles = (colors: any, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: bottomNavHeight,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.subtitle,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  statLabel: {
    ...typography.label,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  tabScroll: {
    marginBottom: spacing.lg,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },
  activeTabChip: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
  },
  activeTabText: {
    color: colors.primaryForeground || colors.white,
  },
  tabBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.full,
    minWidth: 20,
    alignItems: 'center',
  },
  activeTabBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabBadgeText: {
    ...typography.badge,
    color: colors.mutedForeground,
  },
  activeTabBadgeText: {
    color: colors.white,
  },
  searchContainer: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    height: sizes.inputHeight,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnText: {
    ...typography.caption,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  supplierAvatar: {
    width: 28,
    height: 28,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  supplierAutofill: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  supplierAutofillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  supplierAutofillText: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    flex: 1,
  },
  cardModel: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  cardMetaText: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  cardStockRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  cardStock: {
    fontSize: typography.sizes.xl,
    fontWeight: fontWeights.bold,
  },
  cardUnit: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  cardPriceRow: {
    alignItems: 'flex-end',
  },
  cardPriceLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  cardPrice: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
    gap: spacing.md,
    ...shadows.sm,
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryContent: {
    flex: 1,
  },
  categoryName: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  categoryDesc: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  categoryCount: {
    alignItems: 'center',
  },
  categoryCountText: {
    ...typography.subtitle,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  categoryCountLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  lowStockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.md,
    ...shadows.sm,
  },
  lowStockLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  lowStockInfo: {
    flex: 1,
  },
  lowStockBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  lowStockBadgeText: {
    ...typography.badge,
    fontWeight: fontWeights.semibold,
  },
  poCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  poHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  poBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  poBadgeText: {
    ...typography.badge,
    fontWeight: fontWeights.semibold,
  },
  poFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  poTotal: {
    ...typography.body,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    marginTop: spacing.lg,
  },
  emptyButtonText: {
    ...typography.button,
    color: colors.primaryForeground || colors.white,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  errorText: {
    ...typography.body,
    color: colors.foreground,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    ...typography.button,
    color: colors.primaryForeground || colors.white,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  pageTitle: {
    fontSize: typography.sizes['3xl'],
    fontWeight: fontWeights.extrabold,
    color: colors.foreground,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  pageSubtitle: {
    fontSize: typography.button.fontSize,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  pageHeaderAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
  },
  pageHeaderAddText: {
    color: colors.primaryForeground,
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
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
    gap: spacing.sm,
    minHeight: 52,
  },
  modalTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    flex: 1,
    textAlign: 'center',
  },
  modalSaveText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  modalContent: {
    flex: 1,
    padding: spacing.md,
  },
  fieldLabel: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  textInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.foreground,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fieldHalf: {
    flex: 1,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  addCategoryBtn: {
    width: sizes.inputHeight,
    height: sizes.inputHeight,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  pickerTriggerText: {
    ...typography.body,
    color: colors.foreground,
  },
  pickerPlaceholder: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  pickerContainer: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    ...shadows.md,
  },
  pickerTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  pickerOptionText: {
    ...typography.body,
    color: colors.foreground,
  },
  pickerOptionTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  pickerCancel: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  pickerCancelText: {
    ...typography.body,
    color: colors.mutedForeground,
    fontWeight: fontWeights.medium,
  },
  detailStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  detailStockValue: {
    fontSize: typography.sizes['4xl'],
    fontWeight: fontWeights.bold,
  },
  detailStockUnit: {
    ...typography.body,
    color: colors.mutedForeground,
    marginLeft: spacing.xs,
  },
  detailActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  editButtonText: {
    ...typography.button,
  },
  detailSection: {
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  detailSectionTitle: {
    ...typography.label,
    fontWeight: fontWeights.bold,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detailItem: {
    width: '47%',
  },
  detailItemLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  detailItemValue: {
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  maintenanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  noMaintenanceContainer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginTop: spacing.sm,
  },
  noMaintenanceText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  transactionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  transactionTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  transactionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionType: {
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  transactionQty: {
    ...typography.subtitle,
    fontWeight: fontWeights.bold,
  },
  transactionNotes: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  transactionDate: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  categoryModalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  categoryModalCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryModalSave: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
  },
  categoryModalSaveText: {
    ...typography.bodySemibold,
    color: colors.primaryForeground,
  },
});
