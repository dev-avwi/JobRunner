import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useClientsStore, useInvoicesStore, useJobsStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { spacing, radius, shadows, typography, iconSizes, sizes, pageShell, usePageShell, fontWeights } from '../../src/lib/design-tokens';
import { AnimatedCardPressable } from '../../src/components/ui/AnimatedPressable';
import api from '../../src/lib/api';
import { showSmsLockedAlert, useSmsLocked, handleDedicatedNumberError } from '../../src/lib/smsGate';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { OwnerOnlyGuard } from '../../src/components/ui/OwnerOnlyGuard';
import { SkeletonListItem } from '../../src/components/Skeleton';

type FilterKey = 'all' | 'residential' | 'commercial' | 'vip' | 'outstanding' | 'inactive_6mo' | 'with_email' | 'with_phone' | 'with_address';

const SEGMENT_FILTERS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'users' },
  { key: 'residential', label: 'Residential', icon: 'home' },
  { key: 'commercial', label: 'Commercial', icon: 'briefcase' },
  { key: 'vip', label: 'VIP', icon: 'star' },
  { key: 'outstanding', label: 'Outstanding', icon: 'alert-circle' },
  { key: 'inactive_6mo', label: 'Inactive 6mo+', icon: 'clock' },
  { key: 'with_email', label: 'With Email', icon: 'mail' },
  { key: 'with_phone', label: 'With Phone', icon: 'phone' },
  { key: 'with_address', label: 'With Address', icon: 'map-pin' },
];

const handleCreateClient = () => {
  router.push('/more/client/new');
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = 12;
const HORIZONTAL_PADDING = 16;

function KPIBox({ 
  icon, 
  title, 
  value, 
  onPress 
}: { 
  icon: string; 
  title: string; 
  value: string; 
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <PressableRow style={styles.kpiBox} onPress={onPress} >
      <View style={[styles.kpiIconContainer, { backgroundColor: colors.primaryLight }]}>
        <Feather name={icon as any} size={iconSizes.md} color={colors.primary} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiTitle}>{title}</Text>
    </PressableRow>
  );
}

function ClientCard({ 
  client, 
  onPress,
  onCall,
  onEmail,
  onSms,
  onCreateJob,
  onDelete,
  smsLocked,
}: { 
  client: any; 
  onPress: () => void;
  onCall?: () => void;
  onEmail?: () => void;
  onSms?: () => void;
  onCreateJob?: () => void;
  onDelete?: () => void;
  smsLocked?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <AnimatedCardPressable
      onPress={onPress}
      style={styles.clientCardFull}
    >
      <View style={styles.clientCardRow}>
        <TeamAvatar
          name={client.name}
          userId={String(client.id)}
          size={40}
        />
        
        <View style={styles.clientCardInfo}>
          <Text style={styles.clientName} numberOfLines={1}>{client.name}</Text>
          <View style={styles.clientMeta}>
            <View style={styles.jobsBadge}>
              <Text style={styles.jobsBadgeText}>
                {client.jobsCount || 0} {(client.jobsCount || 0) === 1 ? 'job' : 'jobs'}
              </Text>
            </View>
            {client.clientType && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{client.clientType}</Text>
              </View>
            )}
          </View>
          {client.tags && client.tags.length > 0 && (
            <View style={styles.clientTagsRow}>
              {client.tags.slice(0, 3).map((tag: string, idx: number) => (
                <View key={idx} style={styles.clientTagBadge}>
                  <Text style={styles.clientTagBadgeText}>{tag}</Text>
                </View>
              ))}
              {client.tags.length > 3 && (
                <Text style={styles.clientTagMore}>+{client.tags.length - 3}</Text>
              )}
            </View>
          )}
          
          <View style={styles.contactRow}>
            {client.email && (
              <View style={styles.contactItem}>
                <Feather name="mail" size={12} color={colors.mutedForeground} />
                <Text style={styles.contactItemText} numberOfLines={1}>{client.email}</Text>
              </View>
            )}
            {client.phone && (
              <View style={styles.contactItem}>
                <Feather name="phone" size={12} color={colors.mutedForeground} />
                <Text style={styles.contactItemText}>{client.phone}</Text>
              </View>
            )}
            {client.address && (
              <View style={styles.contactItem}>
                <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                <Text style={styles.contactItemText} numberOfLines={1}>{client.address}</Text>
              </View>
            )}
          </View>
        </View>
        
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </View>
      
      <View style={styles.clientCardActions}>
        {client.phone && (
          <PressableRow style={styles.cardActionButton} onPress={(e) => { e.stopPropagation(); onCall?.(); }} >
            <Feather name="phone" size={14} color={colors.primary} />
            <Text style={styles.cardActionText}>Call</Text>
          </PressableRow>
        )}
        {client.email && (
          <PressableRow style={styles.cardActionButton} onPress={(e) => { e.stopPropagation(); onEmail?.(); }} >
            <Feather name="mail" size={14} color={colors.primary} />
            <Text style={styles.cardActionText}>Email</Text>
          </PressableRow>
        )}
        {client.phone && (
          <PressableRow style={[styles.cardActionButton, smsLocked && { opacity: 0.65 }]} onPress={(e) => { e.stopPropagation(); onSms?.(); }} >
            <Feather name={smsLocked ? 'lock' : 'message-circle'} size={14} color={colors.primary} />
            <Text style={styles.cardActionText}>SMS</Text>
          </PressableRow>
        )}
        <PressableRow style={[styles.cardActionButton, styles.cardActionButtonPrimary]} onPress={(e) => { e.stopPropagation(); onCreateJob?.(); }} >
          <Feather name="briefcase" size={14} color={colors.primaryForeground} />
          <Text style={[styles.cardActionText, styles.cardActionTextPrimary]}>Job</Text>
        </PressableRow>
        <PressableRow style={[styles.cardActionButton, styles.cardActionButtonDestructive]} onPress={(e) => { e.stopPropagation(); onDelete?.(); }} >
          <Feather name="trash-2" size={14} color={colors.destructive} />
        </PressableRow>
      </View>
    </AnimatedCardPressable>
  );
}

function ClientsScreenInner() {
  const confirm = useConfirmDialog();
  const { clients, fetchClients, isLoading, deleteClient } = useClientsStore();
  const { invoices, fetchInvoices } = useInvoicesStore();
  const { jobs, fetchJobs } = useJobsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const { colors } = useTheme();
  const responsiveShell = usePageShell();
  const bottomInset = useBottomInset(40);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const smsLocked = useSmsLocked();

  const refreshData = useCallback(async () => {
    await Promise.all([fetchClients(), fetchInvoices(), fetchJobs()]);
  }, [fetchClients, fetchInvoices, fetchJobs]);

  useEffect(() => {
    refreshData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  const clientsWithOutstanding = useMemo(() => {
    const outstandingSet = new Set<string>();
    invoices.forEach(inv => {
      if (inv.clientId && inv.status !== 'paid') {
        outstandingSet.add(inv.clientId);
      }
    });
    return outstandingSet;
  }, [invoices]);

  const sixMonthsAgo = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d;
  }, []);

  const inactiveClientIds = useMemo(() => {
    const lastActivity: Record<string, Date> = {};
    jobs.forEach(job => {
      if (!job.clientId) return;
      const date = new Date(job.scheduledAt || 0);
      if (!lastActivity[job.clientId] || date > lastActivity[job.clientId]) {
        lastActivity[job.clientId] = date;
      }
    });
    const inactiveSet = new Set<string>();
    clients.forEach(c => {
      const last = lastActivity[c.id];
      if (!last || last < sixMonthsAgo) {
        inactiveSet.add(c.id);
      }
    });
    return inactiveSet;
  }, [jobs, clients, sixMonthsAgo]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    clients.forEach(c => {
      (c.tags || []).forEach((t: string) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [clients]);

  const filterCounts: Record<FilterKey, number> = useMemo(() => ({
    all: clients.length,
    residential: clients.filter(c => c.clientType === 'Residential').length,
    commercial: clients.filter(c => c.clientType === 'Commercial').length,
    vip: clients.filter(c => (c.tags || []).some((t: string) => t.toLowerCase() === 'vip')).length,
    outstanding: clients.filter(c => clientsWithOutstanding.has(c.id)).length,
    inactive_6mo: clients.filter(c => inactiveClientIds.has(c.id)).length,
    with_email: clients.filter(c => c.email).length,
    with_phone: clients.filter(c => c.phone).length,
    with_address: clients.filter(c => c.address).length,
  }), [clients, clientsWithOutstanding, inactiveClientIds]);

  const filteredClients = useMemo(() => clients.filter(client => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      client.name?.toLowerCase().includes(searchLower) ||
      client.email?.toLowerCase().includes(searchLower) ||
      client.phone?.includes(searchQuery) ||
      client.address?.toLowerCase().includes(searchLower) ||
      (client.tags || []).some((t: string) => t.toLowerCase().includes(searchLower));
    
    let matchesFilter = true;
    switch (activeFilter) {
      case 'residential': matchesFilter = client.clientType === 'Residential'; break;
      case 'commercial': matchesFilter = client.clientType === 'Commercial'; break;
      case 'vip': matchesFilter = (client.tags || []).some((t: string) => t.toLowerCase() === 'vip'); break;
      case 'outstanding': matchesFilter = clientsWithOutstanding.has(client.id); break;
      case 'inactive_6mo': matchesFilter = inactiveClientIds.has(client.id); break;
      case 'with_email': matchesFilter = !!client.email; break;
      case 'with_phone': matchesFilter = !!client.phone; break;
      case 'with_address': matchesFilter = !!client.address; break;
    }

    let matchesTag = true;
    if (activeTagFilter) {
      matchesTag = (client.tags || []).includes(activeTagFilter);
    }
    
    return matchesSearch && matchesFilter && matchesTag;
  }), [clients, searchQuery, activeFilter, activeTagFilter, clientsWithOutstanding, inactiveClientIds]);

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  const [isSendingSms, setIsSendingSms] = useState(false);

  const handleSms = async (phone: string) => {
    if (smsLocked) {
      showSmsLockedAlert({
        label: 'Call Instead',
        onPress: () => Linking.openURL(`tel:${phone}`),
      });
      return;
    }
    const message = `Hi, just reaching out regarding your service.`;
    setIsSendingSms(true);
    try {
      const response = await api.post('/api/sms/send', {
        clientPhone: phone,
        message,
      });
      if (response.error) {
        if (handleDedicatedNumberError(response)) return;
        Alert.alert(
          'Send via SMS App?',
          'Could not send directly. Would you like to open your messaging app instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open SMS App',
              onPress: () => {
                const url = `sms:${phone}`;
                Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open SMS app'));
              },
            },
          ]
        );
      } else {
        Alert.alert('SMS Sent', `Message sent to ${phone}`);
      }
    } catch {
      Alert.alert(
        'Send via SMS App?',
        'Could not send directly. Would you like to open your messaging app instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open SMS App',
            onPress: () => {
              const url = `sms:${phone}`;
              Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open SMS app'));
            },
          },
        ]
      );
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleCreateJob = (clientId: string) => {
    router.push(`/more/create-job?clientId=${clientId}`);
  };

  const handleDeleteClient = async (client: any) => {
    const ok = await confirm({
      title: 'Delete Client',
      message: `Are you sure you want to delete "${client.name}"? This will also delete all associated jobs, quotes, and invoices.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (ok) {
      const success = await deleteClient(client.id, true);
      if (success) {
        Alert.alert('Success', 'Client deleted successfully');
      } else {
        Alert.alert('Error', 'Failed to delete client');
      }
    }
  };

  const renderItem = useCallback(({ item }: { item: any }) => (
    <View style={styles.clientItemWrapper}>
      <ClientCard
        client={item}
        onPress={() => router.push(`/more/client/${item.id}`)}
        onCall={() => item.phone && handleCall(item.phone)}
        onEmail={() => item.email && handleEmail(item.email)}
        onSms={() => item.phone && handleSms(item.phone)}
        onCreateJob={() => handleCreateJob(item.id)}
        onDelete={() => handleDeleteClient(item)}
        smsLocked={smsLocked}
      />
    </View>
  ), [styles, handleCall, handleEmail, handleSms, handleCreateJob, handleDeleteClient, smsLocked]);

  const ListHeaderComponent = useMemo(() => (
    <>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.pageTitle}>Clients</Text>
          <Text style={styles.pageSubtitle}>All your clients in one place</Text>
        </View>
        <View style={styles.headerActions}>
          <PressableRow style={styles.importButton} onPress={() => router.push('/more/import-contacts')} >
            <Feather name="download" size={18} color={colors.primary} />
          </PressableRow>
          <PressableRow style={styles.newButton} onPress={handleCreateClient} >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
            <Text style={styles.newButtonText}>New Client</Text>
          </PressableRow>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Feather name="search" size={iconSizes.xl} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search clients..."
          placeholderTextColor={colors.mutedForeground}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {SEGMENT_FILTERS.map((filter) => {
          const count = filterCounts[filter.key];
          const isActive = activeFilter === filter.key;
          
          return (
            <PressableRow key={filter.key} onPress={() => { setActiveFilter(filter.key); setActiveTagFilter(null); }} style={[ styles.filterPill, isActive && styles.filterPillActive ]} >
              <Text style={[
                styles.filterPillText,
                isActive && styles.filterPillTextActive
              ]}>
                {filter.label}
              </Text>
              <View style={[
                styles.filterCount,
                isActive && styles.filterCountActive
              ]}>
                <Text style={[
                  styles.filterCountText,
                  isActive && styles.filterCountTextActive
                ]}>
                  {count}
                </Text>
              </View>
            </PressableRow>
          );
        })}
      </ScrollView>

      {allTags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagsFilterScroll}
          contentContainerStyle={styles.filtersContent}
        >
          <PressableRow onPress={() => setActiveTagFilter(null)} style={[styles.tagFilterPill, !activeTagFilter && styles.tagFilterPillActive]} >
            <Feather name="tag" size={12} color={!activeTagFilter ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[styles.tagFilterPillText, !activeTagFilter && styles.tagFilterPillTextActive]}>All Tags</Text>
          </PressableRow>
          {allTags.map((tag) => (
            <PressableRow key={tag} onPress={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)} style={[styles.tagFilterPill, activeTagFilter === tag && styles.tagFilterPillActive]} >
              <Text style={[styles.tagFilterPillText, activeTagFilter === tag && styles.tagFilterPillTextActive]}>{tag}</Text>
            </PressableRow>
          ))}
        </ScrollView>
      )}

      <View style={styles.kpiRow}>
        <KPIBox 
          icon="users" 
          title="Total" 
          value={filterCounts.all.toString()} 
          onPress={() => setActiveFilter('all')}
        />
        <KPIBox 
          icon="mail" 
          title="With Email" 
          value={filterCounts.with_email.toString()} 
          onPress={() => setActiveFilter('with_email')}
        />
        <KPIBox 
          icon="phone" 
          title="With Phone" 
          value={filterCounts.with_phone.toString()} 
          onPress={() => setActiveFilter('with_phone')}
        />
        <KPIBox 
          icon="map-pin" 
          title="With Addr" 
          value={filterCounts.with_address.toString()} 
          onPress={() => setActiveFilter('with_address')}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Feather name="users" size={iconSizes.md} color={colors.primary} />
        <Text style={styles.sectionTitle}>ALL CLIENTS</Text>
      </View>

      {isLoading && (
        <View style={{ paddingHorizontal: spacing.md }}>
          {[1, 2, 3, 4, 5].map((i) => <SkeletonListItem key={i} />)}
        </View>
      )}
    </>
  ), [styles, clients.length, searchQuery, activeFilter, activeTagFilter, filterCounts, isLoading, colors, allTags]);

  const ListEmptyComponent = useMemo(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyStateIcon}>
          <Feather name="users" size={iconSizes['4xl']} color={colors.mutedForeground} />
        </View>
        <Text style={styles.emptyStateTitle}>No clients found</Text>
        <Text style={styles.emptyStateSubtitle}>
          {searchQuery || activeFilter !== 'all'
            ? 'Try adjusting your search or filters'
            : 'Save client details once, use them everywhere. Makes quoting and invoicing a breeze.'}
        </Text>
        {!searchQuery && activeFilter === 'all' && (
          <PressableRow style={styles.emptyStateButton} onPress={handleCreateClient} >
            <Feather name="plus" size={16} color={colors.primaryForeground} />
            <Text style={styles.emptyStateButtonText}>Add Your First Client</Text>
          </PressableRow>
        )}
      </View>
    );
  }, [isLoading, styles, colors, searchQuery, activeFilter]);

  // Dynamic content container style for iPad-responsive padding
  const responsiveContentStyle = useMemo(() => ({
    paddingHorizontal: responsiveShell.paddingHorizontal,
    paddingTop: responsiveShell.paddingTop,
    paddingBottom: responsiveShell.paddingBottom,
  }), [responsiveShell]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <FlatList
          data={filteredClients}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.scrollView}
          contentContainerStyle={[responsiveContentStyle, { paddingBottom: bottomInset }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={ListHeaderComponent}
          ListEmptyComponent={ListEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshData}
              tintColor={colors.primary}
            />
          }
        />
      </View>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    paddingBottom: pageShell.paddingBottom,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerLeft: {
    flex: 1,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  importButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    minWidth: 40,
  },
  newButton: {
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
  newButtonText: {
    color: colors.primaryForeground,
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    height: sizes.searchBarHeight,
    marginBottom: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
  },

  filtersScroll: {
    marginBottom: spacing.lg,
    marginHorizontal: -pageShell.paddingHorizontal,
  },
  filtersContent: {
    paddingHorizontal: pageShell.paddingHorizontal,
    gap: spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.xs,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  filterPillTextActive: {
    color: colors.primaryForeground,
  },
  filterCount: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    minWidth: sizes.filterCountMin,
    alignItems: 'center',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterCountText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  filterCountTextActive: {
    color: colors.white,
  },
  tagsFilterScroll: {
    marginBottom: spacing.lg,
    marginHorizontal: -pageShell.paddingHorizontal,
  },
  tagFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.xs,
  },
  tagFilterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tagFilterPillText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  tagFilterPillTextActive: {
    color: colors.primaryForeground,
  },

  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.foreground,
    letterSpacing: 0.5,
  },

  loadingContainer: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyStateIcon: {
    marginBottom: spacing.lg,
  },
  emptyStateTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptyStateSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  emptyStateButtonText: {
    color: colors.primaryForeground,
    fontWeight: fontWeights.semibold,
    fontSize: typography.button.fontSize,
  },

  kpiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  kpiIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  kpiValue: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  kpiTitle: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    marginTop: 2,
    textAlign: 'center',
  },

  clientsList: {
    gap: spacing.md,
  },
  clientItemWrapper: {
    marginBottom: spacing.md,
  },
  clientCardFull: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  clientCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  clientCardInfo: {
    flex: 1,
  },
  clientMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  jobsBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  jobsBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
  },
  typeBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  typeBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  clientTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: spacing.xs,
  },
  clientTagBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  clientTagBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  clientTagMore: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
    alignSelf: 'center',
  },
  contactRow: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contactItemText: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    flex: 1,
  },
  clientCardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  cardActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    gap: spacing.xs,
  },
  cardActionButtonPrimary: {
    backgroundColor: colors.primary,
    marginLeft: 'auto',
  },
  cardActionButtonDestructive: {
    backgroundColor: colors.destructive + '15',
    paddingHorizontal: spacing.sm,
  },
  cardActionText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  cardActionTextPrimary: {
    color: colors.primaryForeground,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  clientName: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    lineHeight: 20,
  },
});

export default function ClientsScreen() {
  return (
    <OwnerOnlyGuard requiredPermission={['edit_clients', 'create_clients', 'write_clients']}>
      <ClientsScreenInner />
    </OwnerOnlyGuard>
  );
}
