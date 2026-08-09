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
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { BottomSheetScrollView } from '../../src/components/ui/AppBottomSheet';
import { api } from '../../src/lib/api';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, componentStyles, fontWeights } from '../../src/lib/design-tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

type EquipmentStatus = 'active' | 'maintenance' | 'retired' | 'sold' | 'in_use' | 'available';
type FilterType = 'all' | 'active' | 'maintenance' | 'retired';
type MaintenanceType = 'scheduled' | 'repair' | 'inspection';

interface Equipment {
  id: string;
  name: string;
  description?: string;
  model?: string;
  serialNumber?: string;
  manufacturer?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  currentValue?: number;
  warrantyExpiresAt?: string;
  location?: string;
  status: EquipmentStatus;
  categoryId?: string;
  assignedTo?: string;
  photos?: string[];
  isActive?: boolean;
  createdAt?: string;
}

interface EquipmentCategory {
  id: string;
  name: string;
}

interface MaintenanceRecord {
  id: string;
  equipmentId: string;
  title: string;
  type: MaintenanceType;
  description?: string;
  cost?: string;
  scheduledDate?: string;
  nextDueDate?: string;
  vendor?: string;
  createdAt?: string;
}

const formatCurrency = (amount: number) => {
  const { formatCurrency: fmt } = require('../../src/lib/format');
  return fmt(amount, { compact: true });
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getStatusConfig = (status: EquipmentStatus) => {
  switch (status) {
    case 'active':
    case 'available':
      return { label: 'Available', color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)', icon: 'check-circle' as const };
    case 'in_use':
      return { label: 'In Use', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)', icon: 'activity' as const };
    case 'maintenance':
      return { label: 'Maintenance', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)', icon: 'tool' as const };
    case 'retired':
      return { label: 'Retired', color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)', icon: 'archive' as const };
    case 'sold':
      return { label: 'Sold', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)', icon: 'tag' as const };
    default:
      return { label: status, color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)', icon: 'help-circle' as const };
  }
};

const defaultFormData = {
  name: '',
  categoryId: '',
  serialNumber: '',
  manufacturer: '',
  model: '',
  purchaseDate: '',
  purchasePrice: '',
  status: 'active' as EquipmentStatus,
  location: '',
  description: '',
};

const defaultMaintenanceForm = {
  title: '',
  type: 'scheduled' as MaintenanceType,
  description: '',
  cost: '',
  scheduledDate: '',
  nextDueDate: '',
};

export default function EquipmentScreen() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [categories, setCategories] = useState<EquipmentCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [isLoadingMaintenance, setIsLoadingMaintenance] = useState(false);

  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState(defaultMaintenanceForm);
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [equipRes, catRes] = await Promise.all([
        api.get<Equipment[]>('/api/equipment'),
        api.get<EquipmentCategory[]>('/api/equipment/categories'),
      ]);
      if (equipRes.error) {
        setError(equipRes.error);
      } else {
        setEquipment(equipRes.data || []);
      }
      if (!catRes.error) {
        setCategories(catRes.data || []);
      }
    } catch (err) {
      setError('Failed to load equipment');
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

  const filteredEquipment = useMemo(() => {
    if (activeFilter === 'all') return equipment;
    if (activeFilter === 'active') return equipment.filter(e => e.status === 'active' || e.status === 'available');
    return equipment.filter(e => e.status === activeFilter);
  }, [equipment, activeFilter]);

  const filterCounts = useMemo(() => ({
    all: equipment.length,
    active: equipment.filter(e => e.status === 'active' || e.status === 'available').length,
    maintenance: equipment.filter(e => e.status === 'maintenance').length,
    retired: equipment.filter(e => e.status === 'retired').length,
  }), [equipment]);

  const totalValue = useMemo(() => {
    return equipment.reduce((sum, e) => {
      const val = e.currentValue ?? e.purchasePrice ?? 0;
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [equipment]);

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return null;
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || null;
  };

  const openCreate = () => {
    setFormData(defaultFormData);
    setEditingItem(null);
    setShowFormModal(true);
  };

  const openEdit = (item: Equipment) => {
    setFormData({
      name: item.name || '',
      categoryId: item.categoryId || '',
      serialNumber: item.serialNumber || '',
      manufacturer: item.manufacturer || '',
      model: item.model || '',
      purchaseDate: item.purchaseDate ? new Date(item.purchaseDate).toISOString().split('T')[0] : '',
      purchasePrice: item.purchasePrice ? String(item.purchasePrice) : '',
      status: item.status || 'active',
      location: item.location || '',
      description: item.description || '',
    });
    setEditingItem(item);
    setShowDetailModal(false);
    setShowFormModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Required', 'Equipment name is required.');
      return;
    }
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        status: formData.status,
      };
      if (formData.categoryId) payload.categoryId = formData.categoryId;
      if (formData.serialNumber) payload.serialNumber = formData.serialNumber;
      if (formData.manufacturer) payload.manufacturer = formData.manufacturer;
      if (formData.model) payload.model = formData.model;
      if (formData.purchaseDate) payload.purchaseDate = new Date(formData.purchaseDate).toISOString();
      if (formData.purchasePrice) payload.purchasePrice = formData.purchasePrice;
      if (formData.location) payload.location = formData.location;
      if (formData.description) payload.description = formData.description;

      if (editingItem) {
        const res = await api.patch(`/api/equipment/${editingItem.id}`, payload);
        if (res.error) {
          Alert.alert('Error', res.error);
          return;
        }
        Alert.alert('Success', 'Equipment updated.');
      } else {
        const res = await api.post('/api/equipment', payload);
        if (res.error) {
          Alert.alert('Error', res.error);
          return;
        }
        Alert.alert('Success', 'Equipment added.');
      }
      setShowFormModal(false);
      setFormData(defaultFormData);
      setEditingItem(null);
      fetchData();
    } catch (err) {
      Alert.alert('Error', 'Failed to save equipment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: Equipment) => {
    const ok = await confirm({
      title: 'Delete Equipment',
      message: `Are you sure you want to delete "${item.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (ok) {
      try {
        const res = await api.delete(`/api/equipment/${item.id}`);
        if (res.error) {
          Alert.alert('Error', res.error);
          return;
        }
        setShowDetailModal(false);
        setSelectedItem(null);
        fetchData();
      } catch (err) {
        Alert.alert('Error', 'Failed to delete equipment.');
      }
    }
  };

  const openDetail = async (item: Equipment) => {
    setSelectedItem(item);
    setShowDetailModal(true);
    setIsLoadingMaintenance(true);
    try {
      const res = await api.get<MaintenanceRecord[]>(`/api/equipment/${item.id}/maintenance`);
      if (!res.error) {
        setMaintenanceRecords(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      setMaintenanceRecords([]);
    } finally {
      setIsLoadingMaintenance(false);
    }
  };

  const handleMaintenanceSubmit = async () => {
    if (!maintenanceForm.title.trim()) {
      Alert.alert('Required', 'Maintenance title is required.');
      return;
    }
    if (!selectedItem) return;
    setIsSavingMaintenance(true);
    try {
      const payload: Record<string, unknown> = {
        title: maintenanceForm.title.trim(),
        type: maintenanceForm.type,
      };
      if (maintenanceForm.description) payload.description = maintenanceForm.description;
      if (maintenanceForm.cost) payload.cost = maintenanceForm.cost;
      if (maintenanceForm.scheduledDate) payload.scheduledDate = new Date(maintenanceForm.scheduledDate).toISOString();
      if (maintenanceForm.nextDueDate) payload.nextDueDate = new Date(maintenanceForm.nextDueDate).toISOString();

      const res = await api.post(`/api/equipment/${selectedItem.id}/maintenance`, payload);
      if (res.error) {
        Alert.alert('Error', res.error);
        return;
      }
      Alert.alert('Success', 'Maintenance record added.');
      setShowMaintenanceModal(false);
      setMaintenanceForm(defaultMaintenanceForm);
      const updatedRes = await api.get<MaintenanceRecord[]>(`/api/equipment/${selectedItem.id}/maintenance`);
      if (!updatedRes.error) {
        setMaintenanceRecords(updatedRes.data || []);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to add maintenance record.');
    } finally {
      setIsSavingMaintenance(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setIsCreatingCategory(true);
    try {
      const res = await api.post('/api/equipment/categories', { name: newCategoryName.trim() });
      if (res.error) {
        Alert.alert('Error', res.error);
        return;
      }
      setShowCategoryModal(false);
      setNewCategoryName('');
      const catRes = await api.get<EquipmentCategory[]>('/api/equipment/categories');
      if (!catRes.error) {
        setCategories(catRes.data || []);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to create category.');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const statusOptions: { value: EquipmentStatus; label: string }[] = [
    { value: 'active', label: 'Available' },
    { value: 'in_use', label: 'In Use' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'retired', label: 'Retired' },
  ];

  const maintenanceTypeOptions: { value: MaintenanceType; label: string }[] = [
    { value: 'scheduled', label: 'Service' },
    { value: 'repair', label: 'Repair' },
    { value: 'inspection', label: 'Inspection' },
  ];

  const renderFilterChips = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
      <View style={styles.filterContainer}>
        {(['all', 'active', 'maintenance', 'retired'] as FilterType[]).map((filter) => {
          const isActive = activeFilter === filter;
          const config = filter === 'all' ? null : getStatusConfig(filter as EquipmentStatus);
          return (
            <PressableRow key={filter} style={[styles.filterChip, isActive && styles.activeFilterChip]} onPress={() => setActiveFilter(filter)} >
              {config && (
                <Feather
                  name={config.icon}
                  size={iconSizes.sm}
                  color={isActive ? colors.primaryForeground : config.color}
                />
              )}
              <Text style={[styles.filterText, isActive && styles.activeFilterText]}>
                {filter === 'all' ? 'All' : config!.label}
              </Text>
              <View style={[styles.filterBadge, isActive && styles.activeFilterBadge]}>
                <Text style={[styles.filterBadgeText, isActive && styles.activeFilterBadgeText]}>
                  {filterCounts[filter]}
                </Text>
              </View>
            </PressableRow>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderSummaryCards = () => (
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
          <Feather name="check-circle" size={16} color="#22c55e" />
        </View>
        <Text style={styles.statValue}>{filterCounts.active}</Text>
        <Text style={styles.statLabel}>ACTIVE</Text>
      </View>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
          <Feather name="tool" size={16} color="#f59e0b" />
        </View>
        <Text style={styles.statValue}>{filterCounts.maintenance}</Text>
        <Text style={styles.statLabel}>MAINTENANCE</Text>
      </View>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
          <Feather name="dollar-sign" size={16} color="#3b82f6" />
        </View>
        <Text style={styles.statValue}>{formatCurrency(totalValue)}</Text>
        <Text style={styles.statLabel}>TOTAL VALUE</Text>
      </View>
    </View>
  );

  const renderCard = (item: Equipment) => {
    const statusConfig = getStatusConfig(item.status);
    const categoryName = getCategoryName(item.categoryId);

    return (
      <PressableRow key={item.id} style={styles.card} onPress={() => openDetail(item)} >
        <View style={styles.cardTopRow}>
          <View style={styles.cardNameRow}>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          </View>
          {item.model ? (
            <Text style={styles.cardModel} numberOfLines={1}>{item.model}</Text>
          ) : null}
        </View>

        {categoryName ? (
          <View style={styles.cardMetaRow}>
            <Feather name="folder" size={13} color={colors.mutedForeground} />
            <Text style={styles.cardMetaText} numberOfLines={1}>{categoryName}</Text>
          </View>
        ) : null}

        {item.location ? (
          <View style={styles.cardMetaRow}>
            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
            <Text style={styles.cardMetaText} numberOfLines={1}>{item.location}</Text>
          </View>
        ) : null}

        {item.serialNumber ? (
          <View style={styles.cardMetaRow}>
            <Feather name="hash" size={13} color={colors.mutedForeground} />
            <Text style={styles.cardMetaText} numberOfLines={1}>SN: {item.serialNumber}</Text>
          </View>
        ) : item.manufacturer ? (
          <View style={styles.cardMetaRow}>
            <Feather name="box" size={13} color={colors.mutedForeground} />
            <Text style={styles.cardMetaText} numberOfLines={1}>{item.manufacturer}</Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          {item.purchasePrice != null ? (
            <Text style={styles.cardPrice}>{formatCurrency(item.purchasePrice)}</Text>
          ) : <View />}
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <View style={[styles.statusBadgeDot, { backgroundColor: statusConfig.color }]} />
            <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>
      </PressableRow>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Feather name="tool" size={40} color={colors.mutedForeground} />
      </View>
      <Text style={styles.emptyTitle}>No Equipment Found</Text>
      <Text style={styles.emptySubtitle}>
        {activeFilter !== 'all'
          ? `No ${activeFilter} equipment items. Try a different filter.`
          : 'Add your first piece of equipment to start tracking your tools and assets.'}
      </Text>
      {activeFilter === 'all' && (
        <PressableRow style={styles.emptyButton} onPress={openCreate} >
          <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground} />
          <Text style={styles.emptyButtonText}>Add Equipment</Text>
        </PressableRow>
      )}
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Feather name="alert-circle" size={40} color="#ef4444" />
      <Text style={styles.errorText}>{error}</Text>
      <PressableRow style={styles.retryButton} onPress={handleRefresh} >
        <Text style={styles.retryButtonText}>Try Again</Text>
      </PressableRow>
    </View>
  );

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
            <PressableRow key={opt.value} style={[styles.pickerOption, selectedValue === opt.value && styles.pickerOptionActive]} onPress={() => { onSelect(opt.value); onClose(); }} >
              <Text style={[styles.pickerOptionText, selectedValue === opt.value && styles.pickerOptionTextActive]}>
                {opt.label}
              </Text>
              {selectedValue === opt.value && (
                <Feather name="check" size={18} color={colors.primary} />
              )}
            </PressableRow>
          ))}
          <PressableRow style={styles.pickerCancel} onPress={onClose} >
            <Text style={styles.pickerCancelText}>Cancel</Text>
          </PressableRow>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderFormModal = () => (
    <AppBottomSheet visible={showFormModal} onDismiss={() => setShowFormModal(false)} snapPoints={['92%']} scrollable={false} contentPadding={0}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalHeader}>
          <PressableRow onPress={() => setShowFormModal(false)} >
            <Feather name="x" size={24} color={colors.foreground} />
          </PressableRow>
          <Text style={styles.modalTitle}>{editingItem ? 'Edit Equipment' : 'Add Equipment'}</Text>
          <PressableRow onPress={handleSubmit} disabled={isSaving} >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.modalSaveText}>Save</Text>
            )}
          </PressableRow>
        </View>
        <BottomSheetScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput
            style={styles.textInput}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="e.g., Makita Impact Driver"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.categoryRow}>
            <PressableRow style={[styles.textInput, styles.pickerTrigger]} onPress={() => setShowCategoryPicker(true)} >
              <Text style={formData.categoryId ? styles.pickerTriggerText : styles.pickerPlaceholder}>
                {formData.categoryId ? (getCategoryName(formData.categoryId) || 'Select category') : 'Select category'}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </PressableRow>
            <PressableRow style={styles.addCategoryBtn} onPress={() => setShowCategoryModal(true)} >
              <Feather name="plus" size={18} color={colors.primary} />
            </PressableRow>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Serial Number</Text>
              <TextInput
                style={styles.textInput}
                value={formData.serialNumber}
                onChangeText={(text) => setFormData({ ...formData, serialNumber: text })}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Manufacturer</Text>
              <TextInput
                style={styles.textInput}
                value={formData.manufacturer}
                onChangeText={(text) => setFormData({ ...formData, manufacturer: text })}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Model</Text>
          <TextInput
            style={styles.textInput}
            value={formData.model}
            onChangeText={(text) => setFormData({ ...formData, model: text })}
            placeholderTextColor={colors.mutedForeground}
          />

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Purchase Date</Text>
              <TextInput
                style={styles.textInput}
                value={formData.purchaseDate}
                onChangeText={(text) => setFormData({ ...formData, purchaseDate: text })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Purchase Cost (AUD)</Text>
              <TextInput
                style={styles.textInput}
                value={formData.purchasePrice}
                onChangeText={(text) => setFormData({ ...formData, purchasePrice: text })}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Status</Text>
          <PressableRow style={[styles.textInput, styles.pickerTrigger]} onPress={() => setShowStatusPicker(true)} >
            <Text style={styles.pickerTriggerText}>
              {statusOptions.find(o => o.value === formData.status)?.label || 'Available'}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </PressableRow>

          <Text style={styles.fieldLabel}>Location</Text>
          <TextInput
            style={styles.textInput}
            value={formData.location}
            onChangeText={(text) => setFormData({ ...formData, location: text })}
            placeholder="e.g., Workshop, Van 1"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholderTextColor={colors.mutedForeground}
          />
        </BottomSheetScrollView>
      </KeyboardAvoidingView>
      {renderPickerModal(
        showStatusPicker,
        () => setShowStatusPicker(false),
        'Select Status',
        statusOptions,
        formData.status,
        (val) => setFormData({ ...formData, status: val as EquipmentStatus }),
      )}
      {renderPickerModal(
        showCategoryPicker,
        () => setShowCategoryPicker(false),
        'Select Category',
        [{ value: '', label: 'No category' }, ...categories.map(c => ({ value: c.id, label: c.name }))],
        formData.categoryId,
        (val) => setFormData({ ...formData, categoryId: val }),
      )}
    </AppBottomSheet>
  );

  const renderDetailModal = () => {
    if (!selectedItem) return null;
    const statusConfig = getStatusConfig(selectedItem.status);
    const categoryName = getCategoryName(selectedItem.categoryId);

    return (
      <AppBottomSheet
        visible={showDetailModal}
        onDismiss={() => setShowDetailModal(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <PressableRow onPress={() => setShowDetailModal(false)} >
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
            <Text style={styles.modalTitle} numberOfLines={1}>{selectedItem.name}</Text>
            <PressableRow onPress={() => openEdit(selectedItem)} >
              <Feather name="edit-2" size={20} color={colors.primary} />
            </PressableRow>
          </View>
          <BottomSheetScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.detailStatusRow}>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                <View style={[styles.statusBadgeDot, { backgroundColor: statusConfig.color }]} />
                <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
              </View>
              {selectedItem.purchasePrice != null && (
                <Text style={styles.detailPrice}>{formatCurrency(selectedItem.purchasePrice)}</Text>
              )}
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>DETAILS</Text>
              <View style={styles.detailGrid}>
                {categoryName && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Category</Text>
                    <Text style={styles.detailItemValue}>{categoryName}</Text>
                  </View>
                )}
                {selectedItem.serialNumber && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Serial Number</Text>
                    <Text style={styles.detailItemValue}>{selectedItem.serialNumber}</Text>
                  </View>
                )}
                {selectedItem.manufacturer && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Manufacturer</Text>
                    <Text style={styles.detailItemValue}>{selectedItem.manufacturer}</Text>
                  </View>
                )}
                {selectedItem.model && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Model</Text>
                    <Text style={styles.detailItemValue}>{selectedItem.model}</Text>
                  </View>
                )}
                {selectedItem.purchaseDate && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Purchase Date</Text>
                    <Text style={styles.detailItemValue}>{formatDate(selectedItem.purchaseDate)}</Text>
                  </View>
                )}
                {selectedItem.location && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Location</Text>
                    <Text style={styles.detailItemValue}>{selectedItem.location}</Text>
                  </View>
                )}
                {selectedItem.currentValue != null && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Current Value</Text>
                    <Text style={styles.detailItemValue}>{formatCurrency(selectedItem.currentValue)}</Text>
                  </View>
                )}
                {selectedItem.warrantyExpiresAt && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Warranty Expires</Text>
                    <Text style={styles.detailItemValue}>{formatDate(selectedItem.warrantyExpiresAt)}</Text>
                  </View>
                )}
              </View>
              {selectedItem.description ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.detailItemLabel}>Notes</Text>
                  <Text style={[styles.detailItemValue, { marginTop: 4 }]}>{selectedItem.description}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.detailActions}>
              <PressableRow style={styles.editButton} onPress={() => openEdit(selectedItem)} >
                <Feather name="edit-2" size={16} color={colors.primary} />
                <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit</Text>
              </PressableRow>
              <PressableRow style={styles.deleteButton} onPress={() => handleDelete(selectedItem)} >
                <Feather name="trash-2" size={16} color="#ef4444" />
                <Text style={[styles.editButtonText, { color: '#ef4444' }]}>Delete</Text>
              </PressableRow>
            </View>

            <View style={styles.detailSection}>
              <View style={styles.maintenanceHeader}>
                <Text style={styles.detailSectionTitle}>MAINTENANCE HISTORY</Text>
                <PressableRow style={styles.addMaintenanceBtn} onPress={() => { setMaintenanceForm(defaultMaintenanceForm); setShowMaintenanceModal(true); }} >
                  <Feather name="plus" size={14} color={colors.primaryForeground} />
                  <Text style={styles.addMaintenanceBtnText}>Add</Text>
                </PressableRow>
              </View>

              {isLoadingMaintenance ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
              ) : maintenanceRecords.length === 0 ? (
                <View style={styles.noMaintenanceContainer}>
                  <Text style={styles.noMaintenanceText}>No maintenance records yet</Text>
                </View>
              ) : (
                <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  {maintenanceRecords.map((record) => (
                    <View key={record.id} style={styles.maintenanceCard}>
                      <View style={styles.maintenanceCardHeader}>
                        <Text style={styles.maintenanceCardTitle}>{record.title}</Text>
                        <View style={styles.maintenanceTypeBadge}>
                          <Text style={styles.maintenanceTypeBadgeText}>
                            {record.type === 'scheduled' ? 'Service' : record.type === 'repair' ? 'Repair' : 'Inspection'}
                          </Text>
                        </View>
                      </View>
                      {record.description ? (
                        <Text style={styles.maintenanceDescription}>{record.description}</Text>
                      ) : null}
                      <View style={styles.maintenanceMetaRow}>
                        {record.scheduledDate && (
                          <View style={styles.maintenanceMetaItem}>
                            <Feather name="calendar" size={12} color={colors.mutedForeground} />
                            <Text style={styles.maintenanceMetaText}>{formatDate(record.scheduledDate)}</Text>
                          </View>
                        )}
                        {record.cost && (
                          <Text style={styles.maintenanceMetaText}>{formatCurrency(parseFloat(record.cost))}</Text>
                        )}
                      </View>
                      {record.nextDueDate && (
                        <View style={styles.maintenanceNextDue}>
                          <Feather name="clock" size={12} color="#f59e0b" />
                          <Text style={styles.maintenanceNextDueText}>Next due: {formatDate(record.nextDueDate)}</Text>
                        </View>
                      )}
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

  const renderMaintenanceModal = () => (
    <AppBottomSheet
        visible={showMaintenanceModal}
        onDismiss={() => setShowMaintenanceModal(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalHeader}>
          <PressableRow onPress={() => setShowMaintenanceModal(false)} >
            <Feather name="x" size={24} color={colors.foreground} />
          </PressableRow>
          <Text style={styles.modalTitle}>Add Maintenance Record</Text>
          <PressableRow onPress={handleMaintenanceSubmit} disabled={isSavingMaintenance} >
            {isSavingMaintenance ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.modalSaveText}>Save</Text>
            )}
          </PressableRow>
        </View>
        <BottomSheetScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Title *</Text>
          <TextInput
            style={styles.textInput}
            value={maintenanceForm.title}
            onChangeText={(text) => setMaintenanceForm({ ...maintenanceForm, title: text })}
            placeholder="e.g., Annual Service"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={styles.fieldLabel}>Type</Text>
          <PressableRow style={[styles.textInput, styles.pickerTrigger]} onPress={() => setShowTypePicker(true)} >
            <Text style={styles.pickerTriggerText}>
              {maintenanceTypeOptions.find(o => o.value === maintenanceForm.type)?.label || 'Service'}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </PressableRow>

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={maintenanceForm.description}
            onChangeText={(text) => setMaintenanceForm({ ...maintenanceForm, description: text })}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholderTextColor={colors.mutedForeground}
          />

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput
                style={styles.textInput}
                value={maintenanceForm.scheduledDate}
                onChangeText={(text) => setMaintenanceForm({ ...maintenanceForm, scheduledDate: text })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Cost (AUD)</Text>
              <TextInput
                style={styles.textInput}
                value={maintenanceForm.cost}
                onChangeText={(text) => setMaintenanceForm({ ...maintenanceForm, cost: text })}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Next Due Date</Text>
          <TextInput
            style={styles.textInput}
            value={maintenanceForm.nextDueDate}
            onChangeText={(text) => setMaintenanceForm({ ...maintenanceForm, nextDueDate: text })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
          />
        </BottomSheetScrollView>
      </KeyboardAvoidingView>
      {renderPickerModal(
        showTypePicker,
        () => setShowTypePicker(false),
        'Select Type',
        maintenanceTypeOptions,
        maintenanceForm.type,
        (val) => setMaintenanceForm({ ...maintenanceForm, type: val as MaintenanceType }),
      )}
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
            placeholder="e.g., Power Tools"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
          />
          <View style={styles.categoryModalActions}>
            <PressableRow style={styles.categoryModalCancel} onPress={() => setShowCategoryModal(false)} >
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </PressableRow>
            <PressableRow style={[styles.categoryModalSave, (!newCategoryName.trim() || isCreatingCategory) && { opacity: 0.5 }]} onPress={handleCreateCategory} disabled={!newCategoryName.trim() || isCreatingCategory} >
              {isCreatingCategory ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={styles.categoryModalSaveText}>Create</Text>
              )}
            </PressableRow>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {isLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading equipment...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.pageTitle}>Equipment</Text>
                <Text style={styles.pageSubtitle}>{equipment.length} total items</Text>
              </View>
              <PressableRow style={styles.addButton} onPress={openCreate} >
                <Feather name="plus" size={18} color={colors.primaryForeground} />
                <Text style={styles.addButtonText}>Add</Text>
              </PressableRow>
            </View>

            {renderFilterChips()}
            {renderSummaryCards()}

            {error ? renderError() : filteredEquipment.length === 0 ? renderEmptyState() : (
              <View>
                <Text style={styles.sectionLabel}>EQUIPMENT LIST</Text>
                <View style={styles.cardList}>
                  {filteredEquipment.map(renderCard)}
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>
      {renderFormModal()}
      {renderDetailModal()}
      {renderMaintenanceModal()}
      {renderCategoryModal()}
    </>
  );
}

const createStyles = (colors: any, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: bottomNavHeight,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  loadingText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  pageTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
  },
  addButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  filterScroll: {
    marginBottom: spacing.sm,
    marginHorizontal: -pageShell.paddingHorizontal,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: pageShell.paddingHorizontal,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    height: sizes.filterChipHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  activeFilterChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    ...typography.caption,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  activeFilterText: {
    color: colors.primaryForeground,
  },
  filterBadge: {
    minWidth: sizes.filterCountMin,
    height: sizes.filterCountMin,
    borderRadius: sizes.filterCountMin / 2,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  activeFilterBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterBadgeText: {
    ...typography.badge,
    color: colors.mutedForeground,
  },
  activeFilterBadgeText: {
    color: colors.white,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
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
    fontSize: typography.sizes['2xl'],
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
    color: colors.foreground,
  },
  statLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
    fontSize: typography.sizes.xs,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  cardList: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusDot: {
    width: sizes.dotSm,
    height: sizes.dotSm,
    borderRadius: sizes.dotSm / 2,
  },
  cardTitle: {
    ...typography.cardTitle,
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
    gap: spacing.sm,
    marginBottom: spacing.xs,
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
  },
  cardPrice: {
    ...typography.bodySemibold,
    color: colors.foreground,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    ...typography.badge,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 260,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    marginTop: spacing.md,
  },
  emptyButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  errorText: {
    ...typography.body,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
  },
  retryButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
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
    paddingTop: Platform.OS === 'ios' ? 56 : spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    flex: 1,
    textAlign: 'center',
  },
  modalSaveText: {
    ...typography.bodySemibold,
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
  detailPrice: {
    fontSize: typography.sizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  editButtonText: {
    ...typography.button,
  },
  maintenanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  addMaintenanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  addMaintenanceBtnText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
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
  maintenanceCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  maintenanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  maintenanceCardTitle: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    flex: 1,
  },
  maintenanceTypeBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.xs,
  },
  maintenanceTypeBadgeText: {
    ...typography.badge,
    color: colors.mutedForeground,
  },
  maintenanceDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  maintenanceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  maintenanceMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  maintenanceMetaText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  maintenanceNextDue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  maintenanceNextDueText: {
    ...typography.captionSmall,
    color: '#f59e0b',
    fontWeight: fontWeights.medium,
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
