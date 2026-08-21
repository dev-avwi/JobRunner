import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { AppBottomSheet, BottomSheetScrollView } from '../../src/components/ui/AppBottomSheet';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { api } from '../../src/lib/api';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { spacing, radius, typography, iconSizes, sizes, fontWeights } from '../../src/lib/design-tokens';
import { OwnerOnlyGuard } from '../../src/components/ui/OwnerOnlyGuard';

type LeadSource = 'phone' | 'email' | 'website' | 'referral' | 'other';
type LeadStatus = 'new' | 'contacted' | 'quoted' | 'won' | 'lost';
type FilterType = 'all' | 'active' | LeadStatus;

interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  source?: LeadSource;
  status?: LeadStatus;
  description?: string;
  estimatedValue?: string;
  notes?: string;
  followUpDate?: string;
  createdAt?: string;
}

const SOURCE_OPTIONS: { value: LeadSource; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: 'phone', label: 'Phone', icon: 'phone' },
  { value: 'email', label: 'Email', icon: 'mail' },
  { value: 'website', label: 'Website', icon: 'globe' },
  { value: 'referral', label: 'Referral', icon: 'user-plus' },
  { value: 'other', label: 'Other', icon: 'message-square' },
];

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

const getStatusConfig = (status: LeadStatus | undefined, colors: ThemeColors) => {
  switch (status) {
    case 'new':
      return { label: 'New', color: colors.primary, bgColor: colors.primaryLight, icon: 'star' as const };
    case 'contacted':
      return { label: 'Contacted', color: colors.info, bgColor: colors.infoLight, icon: 'phone-forwarded' as const };
    case 'quoted':
      return { label: 'Quoted', color: colors.warning, bgColor: colors.warningLight, icon: 'file-text' as const };
    case 'won':
      return { label: 'Won', color: colors.success, bgColor: colors.successLight, icon: 'check-circle' as const };
    case 'lost':
      return { label: 'Lost', color: colors.destructive, bgColor: colors.destructiveLight || colors.muted, icon: 'x-circle' as const };
    default:
      return { label: 'New', color: colors.mutedForeground, bgColor: colors.muted, icon: 'star' as const };
  }
};

const getSourceIcon = (source: LeadSource | undefined): keyof typeof Feather.glyphMap => {
  const found = SOURCE_OPTIONS.find(s => s.value === source);
  return found?.icon || 'message-square';
};

const formatCurrency = (amount: string | number | undefined): string => {
  const { formatCurrency: fmt } = require('../../src/lib/format');
  return fmt(amount);
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatRelativeDate = (dateString?: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

function LeadsScreenInner() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('active');
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    source: 'other' as LeadSource,
    status: 'new' as LeadStatus,
    description: '',
    estimatedValue: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [convertOptions, setConvertOptions] = useState({
    createJob: false,
    createQuote: false,
    createInspection: false,
  });

  const fetchLeads = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<Lead[]>('/api/leads');
      setLeads(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError('Failed to load leads. Pull down to retry.');
      console.error('Error fetching leads:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeads();
  }, [fetchLeads]);

  const filteredLeads = useMemo(() => {
    return (Array.isArray(leads) ? leads : []).filter((lead) => {
      const matchesSearch = searchQuery === '' ||
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const leadStatus = lead.status || 'new';
      const matchesFilter = activeFilter === 'all' ||
        (activeFilter === 'active' && ['new', 'contacted', 'quoted'].includes(leadStatus)) ||
        leadStatus === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [leads, searchQuery, activeFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length, active: 0 };
    leads.forEach(lead => {
      const s = lead.status || 'new';
      counts[s] = (counts[s] || 0) + 1;
      if (['new', 'contacted', 'quoted'].includes(s)) {
        counts.active = (counts.active || 0) + 1;
      }
    });
    return counts;
  }, [leads]);

  const totalPipelineValue = useMemo(() => {
    return leads
      .filter(l => ['new', 'contacted', 'quoted'].includes(l.status || 'new'))
      .reduce((sum, l) => sum + (parseFloat(l.estimatedValue || '0') || 0), 0);
  }, [leads]);

  const wonValue = useMemo(() => {
    return leads
      .filter(l => l.status === 'won')
      .reduce((sum, l) => sum + (parseFloat(l.estimatedValue || '0') || 0), 0);
  }, [leads]);

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '', source: 'other', status: 'new', description: '', estimatedValue: '', notes: '' });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Required', 'Lead name is required');
      return;
    }
    if (formData.estimatedValue && isNaN(parseFloat(formData.estimatedValue))) {
      Alert.alert('Invalid', 'Estimated value must be a valid number');
      return;
    }
    setSaving(true);
    try {
      const parsedValue = formData.estimatedValue ? parseFloat(formData.estimatedValue) : null;
      const payload = {
        ...formData,
        estimatedValue: parsedValue !== null && !isNaN(parsedValue) ? parsedValue.toFixed(2) : null,
      };
      if (editingLead) {
        await api.put(`/api/leads/${editingLead.id}`, payload);
      } else {
        await api.post('/api/leads', payload);
      }
      resetForm();
      setShowForm(false);
      setEditingLead(null);
      fetchLeads();
    } catch (e) {
      Alert.alert('Error', 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (lead: Lead) => {
    setFormData({
      name: lead.name,
      email: lead.email || '',
      phone: lead.phone || '',
      source: (lead.source || 'other') as LeadSource,
      status: (lead.status || 'new') as LeadStatus,
      description: lead.description || '',
      estimatedValue: lead.estimatedValue || '',
      notes: lead.notes || '',
    });
    setEditingLead(lead);
    setShowForm(true);
  };

  const handleDelete = async (lead: Lead) => {
    const ok = await confirm({ title: 'Delete Lead', message: `Are you sure you want to delete "${lead.name}"?`, confirmText: 'Delete', cancelText: 'Cancel', destructive: true });
    if (ok) {
      try {
        await api.delete(`/api/leads/${lead.id}`);
        fetchLeads();
      } catch (e) {
        Alert.alert('Error', 'Failed to delete lead');
      }
    }
  };

  const handleStatusChange = async (lead: Lead, newStatus: LeadStatus) => {
    try {
      await api.put(`/api/leads/${lead.id}`, { status: newStatus });
      fetchLeads();
    } catch (e) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleConvert = async () => {
    if (!leadToConvert) return;
    setSaving(true);
    try {
      const res = await api.post<{ client?: { id: string } }>(`/api/leads/${leadToConvert.id}/convert`, convertOptions);
      setShowConvertModal(false);
      setLeadToConvert(null);
      setConvertOptions({ createJob: false, createQuote: false, createInspection: false });
      fetchLeads();
      if (res.data?.client?.id) {
        router.push(`/more/client/${res.data.client.id}` as any);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to convert lead');
    } finally {
      setSaving(false);
    }
  };

  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = createStyles(colors);

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'contacted', label: 'Contacted' },
    { key: 'quoted', label: 'Quoted' },
    { key: 'won', label: 'Won' },
    { key: 'lost', label: 'Lost' },
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading leads...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomNavHeight }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroSection}>
          <Text style={styles.pageTitle}>Leads</Text>
          <Text style={styles.pageSubtitle}>
            Track and convert potential customers into paying clients.
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: `${colors.primary}15` }]}>
                <Feather name="users" size={16} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>{statusCounts.active || 0}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: `${colors.success}15` }]}>
                <Feather name="check-circle" size={16} color={colors.success} />
              </View>
              <Text style={styles.statValue}>{statusCounts.won || 0}</Text>
              <Text style={styles.statLabel}>Won</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: `${colors.warning}15` }]}>
                <Feather name="dollar-sign" size={16} color={colors.warning} />
              </View>
              <Text style={styles.statValue}>{totalPipelineValue > 0 ? `$${Math.round(totalPipelineValue / 1000)}k` : '$0'}</Text>
              <Text style={styles.statLabel}>Pipeline</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: `${colors.success}15` }]}>
                <Feather name="trending-up" size={16} color={colors.success} />
              </View>
              <Text style={styles.statValue}>{wonValue > 0 ? `$${Math.round(wonValue / 1000)}k` : '$0'}</Text>
              <Text style={styles.statLabel}>Won</Text>
            </View>
          </View>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search leads..."
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

          <PressableRow style={styles.addButton} onPress={() => { resetForm(); setEditingLead(null); setShowForm(true); }} >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
          </PressableRow>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll} style={{ flexGrow: 0 }}>
          {FILTERS.map(f => (
            <PressableRow key={f.key} style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]} onPress={() => setActiveFilter(f.key)} >
              <Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>
                {f.label} {statusCounts[f.key] ? `(${statusCounts[f.key]})` : ''}
              </Text>
            </PressableRow>
          ))}
        </ScrollView>

        <View style={styles.listSection}>
          {error ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { backgroundColor: `${colors.destructive}12` }]}>
                <Feather name="alert-circle" size={28} color={colors.destructive} />
              </View>
              <Text style={styles.emptyTitle}>Something went wrong</Text>
              <Text style={styles.emptySubtitle}>{error}</Text>
              <PressableRow style={styles.emptyButton} onPress={() => { setLoading(true); fetchLeads(); }}>
                <Feather name="refresh-cw" size={iconSizes.sm} color={colors.primaryForeground} />
                <Text style={styles.emptyButtonText}>Retry</Text>
              </PressableRow>
            </View>
          ) : filteredLeads.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Feather name="user-plus" size={32} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No Leads Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || activeFilter !== 'all' ? 'Try adjusting your filters' : 'Add your first lead to start building your pipeline'}
              </Text>
              {!searchQuery && activeFilter === 'all' && (
                <PressableRow style={styles.emptyButton} onPress={() => { resetForm(); setEditingLead(null); setShowForm(true); }}>
                  <Feather name="plus" size={iconSizes.sm} color={colors.primaryForeground} />
                  <Text style={styles.emptyButtonText}>Add Lead</Text>
                </PressableRow>
              )}
            </View>
          ) : (
            filteredLeads.map(lead => {
              const statusConfig = getStatusConfig(lead.status as LeadStatus, colors);
              const hasValue = lead.estimatedValue && parseFloat(lead.estimatedValue) > 0;
              return (
                <PressableRow key={lead.id} style={styles.card} onPress={() => handleEdit(lead)} >
                  <View style={styles.cardTop}>
                    <View style={styles.cardAvatar}>
                      <Text style={styles.cardAvatarText}>{lead.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Text style={styles.cardName} numberOfLines={1}>{lead.name}</Text>
                        {lead.createdAt && (
                          <Text style={styles.cardTime}>{formatRelativeDate(lead.createdAt)}</Text>
                        )}
                      </View>
                      {lead.description ? (
                        <Text style={styles.cardDescription} numberOfLines={1}>{lead.description}</Text>
                      ) : lead.phone ? (
                        <Text style={styles.cardDescription}>{lead.phone}</Text>
                      ) : lead.email ? (
                        <Text style={styles.cardDescription} numberOfLines={1}>{lead.email}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                      <Feather name={statusConfig.icon} size={11} color={statusConfig.color} />
                      <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                    </View>
                  </View>

                  <View style={styles.cardBottom}>
                    <View style={styles.cardMetaRow}>
                      <View style={styles.metaChip}>
                        <Feather name={getSourceIcon(lead.source as LeadSource)} size={11} color={colors.mutedForeground} />
                        <Text style={styles.metaChipText}>{SOURCE_OPTIONS.find(s => s.value === lead.source)?.label || 'Other'}</Text>
                      </View>
                      {hasValue && (
                        <View style={[styles.metaChip, { backgroundColor: `${colors.success}10` }]}>
                          <Feather name="dollar-sign" size={11} color={colors.success} />
                          <Text style={[styles.metaChipText, { color: colors.success, fontWeight: fontWeights.semibold }]}>{formatCurrency(lead.estimatedValue)}</Text>
                        </View>
                      )}
                      {lead.followUpDate && (
                        <View style={[styles.metaChip, { backgroundColor: `${colors.warning}10` }]}>
                          <Feather name="calendar" size={11} color={colors.warning} />
                          <Text style={[styles.metaChipText, { color: colors.warning }]}>{formatDate(lead.followUpDate)}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.cardActionRow}>
                      {(lead.status || 'new') !== 'won' && (
                        <PressableRow style={[styles.cardActionBtn, { backgroundColor: `${colors.success}12` }]} onPress={(e) => { e.stopPropagation?.(); setLeadToConvert(lead); setShowConvertModal(true); }} >
                          <Feather name="user-check" size={13} color={colors.success} />
                          <Text style={[styles.cardActionText, { color: colors.success }]}>Convert</Text>
                        </PressableRow>
                      )}
                      <PressableRow style={[styles.cardActionBtn, { backgroundColor: colors.muted }]} onPress={(e) => { e.stopPropagation?.(); handleDelete(lead); }} >
                        <Feather name="trash-2" size={13} color={colors.destructive} />
                      </PressableRow>
                    </View>
                  </View>
                </PressableRow>
              );
            })
          )}
        </View>
      </ScrollView>

      <AppBottomSheet visible={showForm} onDismiss={() => { setShowForm(false); setEditingLead(null); resetForm(); }} snapPoints={['92%']} scrollable={false} contentPadding={0}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalHeader, { paddingTop: spacing.md }]}>
            <PressableRow onPress={() => { setShowForm(false); setEditingLead(null); resetForm(); }}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
            <Text style={styles.modalTitle}>{editingLead ? 'Edit Lead' : 'New Lead'}</Text>
            <PressableRow onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.modalSave}>Save</Text>}
            </PressableRow>
          </View>
          <BottomSheetScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Name *</Text>
              <TextInput style={styles.formInput} value={formData.name} onChangeText={v => setFormData(p => ({ ...p, name: v }))} placeholder="Lead name" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Email</Text>
              <TextInput style={styles.formInput} value={formData.email} onChangeText={v => setFormData(p => ({ ...p, email: v }))} placeholder="email@example.com" placeholderTextColor={colors.mutedForeground} keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Phone</Text>
              <TextInput style={styles.formInput} value={formData.phone} onChangeText={v => setFormData(p => ({ ...p, phone: v }))} placeholder="Phone number" placeholderTextColor={colors.mutedForeground} keyboardType="phone-pad" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Source</Text>
              <View style={styles.optionRow}>
                {SOURCE_OPTIONS.map(opt => (
                  <PressableRow key={opt.value} style={[styles.optionChip, formData.source === opt.value && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]} onPress={() => setFormData(p => ({ ...p, source: opt.value }))} >
                    <Feather name={opt.icon} size={14} color={formData.source === opt.value ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.optionChipText, formData.source === opt.value && { color: colors.primary }]}>{opt.label}</Text>
                  </PressableRow>
                ))}
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Status</Text>
              <View style={styles.optionRow}>
                {STATUS_OPTIONS.map(opt => {
                  const sc = getStatusConfig(opt.value, colors);
                  return (
                    <PressableRow key={opt.value} style={[styles.optionChip, formData.status === opt.value && { backgroundColor: sc.bgColor, borderColor: sc.color }]} onPress={() => setFormData(p => ({ ...p, status: opt.value }))} >
                      <Text style={[styles.optionChipText, formData.status === opt.value && { color: sc.color }]}>{opt.label}</Text>
                    </PressableRow>
                  );
                })}
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Estimated Value</Text>
              <TextInput style={styles.formInput} value={formData.estimatedValue} onChangeText={v => setFormData(p => ({ ...p, estimatedValue: v }))} placeholder="0.00" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput style={[styles.formInput, styles.formTextarea]} value={formData.description} onChangeText={v => setFormData(p => ({ ...p, description: v }))} placeholder="Brief description of the lead" placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} textAlignVertical="top" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes</Text>
              <TextInput style={[styles.formInput, styles.formTextarea]} value={formData.notes} onChangeText={v => setFormData(p => ({ ...p, notes: v }))} placeholder="Internal notes" placeholderTextColor={colors.mutedForeground} multiline numberOfLines={3} textAlignVertical="top" />
            </View>
          </BottomSheetScrollView>
        </KeyboardAvoidingView>
      </AppBottomSheet>

      <AppBottomSheet
        visible={showConvertModal}
        onDismiss={() => { setShowConvertModal(false); setLeadToConvert(null); }}
        title="Convert Lead to Client"
        showCloseButton
        snapPoints={['60%']}
      >
        <View>
            <Text style={styles.convertSubtitle}>
              {leadToConvert?.name} will be converted to a client. Optionally create related records:
            </Text>
            <PressableRow style={styles.convertOption} onPress={() => setConvertOptions(p => ({ ...p, createJob: !p.createJob }))}>
              <View style={[styles.convertCheckbox, convertOptions.createJob && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {convertOptions.createJob && <Feather name="check" size={14} color={colors.primaryForeground} />}
              </View>
              <Text style={styles.convertOptionText}>Create a job</Text>
            </PressableRow>
            <PressableRow style={styles.convertOption} onPress={() => setConvertOptions(p => ({ ...p, createQuote: !p.createQuote }))}>
              <View style={[styles.convertCheckbox, convertOptions.createQuote && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {convertOptions.createQuote && <Feather name="check" size={14} color={colors.primaryForeground} />}
              </View>
              <Text style={styles.convertOptionText}>Create a quote</Text>
            </PressableRow>
            <PressableRow style={styles.convertOption} onPress={() => setConvertOptions(p => ({ ...p, createInspection: !p.createInspection }))}>
              <View style={[styles.convertCheckbox, convertOptions.createInspection && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {convertOptions.createInspection && <Feather name="check" size={14} color={colors.primaryForeground} />}
              </View>
              <Text style={styles.convertOptionText}>Create an inspection</Text>
            </PressableRow>
            <View style={styles.convertActions}>
              <PressableRow style={styles.convertCancelBtn} onPress={() => { setShowConvertModal(false); setLeadToConvert(null); }}>
                <Text style={styles.convertCancelText}>Cancel</Text>
              </PressableRow>
              <PressableRow style={[styles.convertConfirmBtn, { backgroundColor: colors.primary }]} onPress={handleConvert} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : (
                  <>
                    <Feather name="user-check" size={16} color={colors.primaryForeground} />
                    <Text style={styles.convertConfirmText}>Convert</Text>
                  </>
                )}
              </PressableRow>
            </View>
        </View>
      </AppBottomSheet>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { ...typography.body, color: colors.mutedForeground },
  heroSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  pageTitle: { fontSize: typography.sizes['3xl'], fontWeight: fontWeights.extrabold, color: colors.foreground, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: typography.button.fontSize, color: colors.mutedForeground, marginTop: spacing.xs, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  statIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  statValue: { fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.bold, color: colors.foreground },
  statLabel: { fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 1 },
  searchSection: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: spacing.sm, gap: spacing.xs, height: 44, borderWidth: 1, borderColor: colors.cardBorder },
  searchInput: { flex: 1, fontSize: typography.sizes.md, color: colors.foreground },
  addButton: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  filterScroll: { paddingHorizontal: spacing.lg, gap: spacing.xs, paddingBottom: spacing.sm },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  filterChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  filterChipText: { fontSize: typography.sizes.sm, color: colors.mutedForeground, fontWeight: fontWeights.medium },
  filterChipTextActive: { color: colors.primary, fontWeight: fontWeights.semibold },
  listSection: { paddingHorizontal: spacing.lg },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2, paddingHorizontal: spacing.lg, gap: spacing.sm },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyTitle: { fontSize: typography.sizes.lg, fontWeight: fontWeights.semibold, color: colors.foreground },
  emptySubtitle: { fontSize: typography.button.fontSize, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.lg, marginTop: spacing.sm },
  emptyButtonText: { fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.primaryForeground },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, paddingBottom: spacing.sm },
  cardAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' },
  cardAvatarText: { fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.bold, color: colors.primary },
  cardName: { fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.foreground, flex: 1 },
  cardTime: { fontSize: typography.sizes.xs, color: colors.mutedForeground },
  cardDescription: { fontSize: typography.sizes.sm, color: colors.mutedForeground, marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full },
  statusBadgeText: { fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold },
  cardBottom: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingTop: spacing.xs },
  cardMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.muted, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  metaChipText: { fontSize: typography.sizes.xs, color: colors.mutedForeground },
  cardActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs },
  cardActionBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md },
  cardActionText: { fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalCancel: { ...typography.body, color: colors.mutedForeground },
  modalTitle: { ...typography.subtitle, color: colors.foreground },
  modalSave: { ...typography.body, color: colors.primary, fontWeight: fontWeights.semibold },
  formScroll: { flex: 1 },
  formContent: { padding: spacing.md, gap: spacing.md },
  formGroup: { gap: spacing.xs },
  formLabel: { fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground },
  formInput: { backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.sm, height: sizes.inputHeight, borderWidth: 1, borderColor: colors.border, ...typography.body, color: colors.foreground },
  formTextarea: { height: 80, paddingVertical: spacing.sm },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  optionChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  optionChipText: { ...typography.caption, color: colors.mutedForeground },
  convertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: spacing.lg },
  convertModal: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  convertTitle: { ...typography.subtitle, color: colors.foreground, marginBottom: spacing.xs },
  convertSubtitle: { ...typography.body, color: colors.mutedForeground, marginBottom: spacing.md },
  convertOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  convertCheckbox: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  convertOptionText: { ...typography.body, color: colors.foreground },
  convertActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
  convertCancelBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  convertCancelText: { ...typography.body, color: colors.mutedForeground },
  convertConfirmBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  convertConfirmText: { ...typography.label, color: colors.primaryForeground },
});

export default function LeadsScreen() {
  return (
    <OwnerOnlyGuard requiredPermission={['view_leads', 'read_leads']}>
      <LeadsScreenInner />
    </OwnerOnlyGuard>
  );
}
