import { useState, useCallback, useMemo, useEffect } from 'react';
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
  Linking,
} from 'react-native';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, typographySizes, fontWeights } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { format, formatDistanceToNow } from 'date-fns';

interface CommunicationItem {
  id: string;
  type: 'email' | 'sms';
  direction: 'outbound' | 'inbound';
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  recipient: string;
  recipientEmail?: string;
  recipientPhone?: string;
  subject?: string;
  body: string;
  fullBody?: string;
  timestamp: Date;
  entityType?: string;
  entityId?: string;
  entityNumber?: string;
  hasAttachment?: boolean;
  attachmentType?: string;
  source?: 'mobile' | 'web';
}

interface ActivityLog {
  id: string;
  type: string;
  title?: string;
  description?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
}

interface SmsConversation {
  id: string;
  clientName?: string;
  clientPhone?: string;
  jobId?: string;
  messages?: Array<{
    id: string;
    body: string;
    direction: 'inbound' | 'outbound';
    status?: string;
    createdAt?: string;
  }>;
}

type TabType = 'all' | 'email' | 'sms';
type StatusFilter = 'all' | 'sent' | 'delivered' | 'failed' | 'pending';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  heroLeft: {
    flex: 1,
  },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    ...shadows.sm,
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: fontWeights.extrabold,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    marginTop: 3,
    fontWeight: fontWeights.medium,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  filterChipTextActive: {
    color: colors.primaryForeground,
    fontWeight: fontWeights.semibold,
  },
  filterBadge: {
    backgroundColor: `${colors.mutedForeground}30`,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
    minWidth: 18,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.mutedForeground,
  },
  filterBadgeTextActive: {
    color: colors.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typographySizes.md,
    color: colors.foreground,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  itemContent: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailIcon: {
    backgroundColor: colors.infoLight,
  },
  smsIcon: {
    backgroundColor: colors.successLight,
  },
  itemDetails: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  itemRecipient: {
    fontSize: typographySizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  itemSubject: {
    fontSize: typographySizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  itemBody: {
    fontSize: typographySizes.sm,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  itemTime: {
    fontSize: typographySizes.xs,
    color: colors.mutedForeground,
  },
  itemMeta: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusText: {
    fontSize: typographySizes.xs,
    fontWeight: fontWeights.semibold,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  typeBadgeText: {
    fontSize: typographySizes.xs,
    color: colors.mutedForeground,
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  attachmentText: {
    fontSize: typographySizes.xs,
    color: colors.mutedForeground,
  },
  entityLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  entityLinkText: {
    fontSize: typographySizes.xs,
    color: colors.primary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typographySizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: typographySizes.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  modalTitle: {
    flex: 1,
    fontSize: typographySizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  modalBody: {
    padding: spacing.md,
  },
  detailSection: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailLabel: {
    fontSize: typographySizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: typographySizes.md,
    color: colors.foreground,
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
});

export default function CommunicationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  const getStatusConfig = useCallback((status: string) => {
    switch (status) {
      case 'delivered':
        return { label: 'Delivered', color: colors.success, bgColor: colors.successLight };
      case 'sent':
        return { label: 'Sent', color: colors.info, bgColor: colors.infoLight };
      case 'failed':
        return { label: 'Failed', color: colors.destructive, bgColor: colors.destructiveLight };
      case 'pending':
        return { label: 'Pending', color: colors.warning, bgColor: colors.warningLight };
      default:
        return { label: status, color: colors.mutedForeground, bgColor: colors.muted };
    }
  }, [colors]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [communications, setCommunications] = useState<CommunicationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CommunicationItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  
  const fetchData = useCallback(async () => {
    try {
      const [activityRes, smsRes] = await Promise.all([
        api.get<ActivityLog[]>('/api/communications/activity/100'),
        api.get<SmsConversation[]>('/api/communications/conversations'),
      ]);
      
      const items: CommunicationItem[] = [];
      
      const activityLogs = activityRes.data || [];
      if (Array.isArray(activityLogs)) {
        activityLogs
          .filter(log => 
            log.type?.includes('sent') || 
            log.type?.includes('email') ||
            log.type === 'quote_sent' ||
            log.type === 'invoice_sent' ||
            log.type === 'receipt_sent'
          )
          .forEach(log => {
            const metadata = (log.metadata || {}) as Record<string, any>;
            
            let subject = '';
            let hasAttachment = false;
            let attachmentType = '';
            
            // Use stored emailSubject if available (actual subject sent to client)
            if (metadata.emailSubject) {
              subject = metadata.emailSubject;
            } else if (log.type === 'quote_sent') {
              subject = `Quote ${metadata.quoteNumber || ''} - ${metadata.quoteTitle || 'Quote'}`;
            } else if (log.type === 'invoice_sent') {
              subject = `Invoice ${metadata.invoiceNumber || ''} - ${metadata.invoiceTitle || 'Invoice'}`;
            } else if (log.type === 'receipt_sent') {
              subject = `Receipt ${metadata.receiptNumber || ''} - Payment Confirmation`;
            } else {
              subject = log.title || `${log.type?.replace(/_/g, ' ')}`;
            }
            
            // Set attachment info based on type
            if (log.type === 'quote_sent') {
              hasAttachment = true;
              attachmentType = 'Quote';
            } else if (log.type === 'invoice_sent') {
              hasAttachment = true;
              attachmentType = 'Invoice';
            } else if (log.type === 'receipt_sent') {
              hasAttachment = true;
              attachmentType = 'Receipt';
            }
            
            items.push({
              id: `email-${log.id}`,
              type: 'email',
              direction: 'outbound',
              status: 'sent',
              recipient: metadata.clientName || metadata.recipientName || 'Client',
              recipientEmail: metadata.recipientEmail || metadata.clientEmail,
              subject,
              body: log.description || '',
              fullBody: metadata.emailBody || metadata.messageBody || log.description || '',
              timestamp: log.createdAt ? new Date(log.createdAt) : new Date(),
              entityType: log.entityType || undefined,
              entityId: log.entityId || undefined,
              entityNumber: metadata.quoteNumber || metadata.invoiceNumber || metadata.receiptNumber,
              hasAttachment,
              attachmentType,
              source: metadata.source === 'mobile' ? 'mobile' : metadata.source === 'web' ? 'web' : undefined,
            });
          });
      }
      
      const smsConversations = smsRes.data || [];
      if (Array.isArray(smsConversations)) {
        smsConversations.forEach((conv: SmsConversation) => {
          if (conv.messages && Array.isArray(conv.messages)) {
            conv.messages
              .filter((msg) => msg.direction === 'outbound')
              .forEach((msg) => {
                items.push({
                  id: `sms-${msg.id}`,
                  type: 'sms',
                  direction: 'outbound',
                  status: (msg.status as any) || 'sent',
                  recipient: conv.clientName || conv.clientPhone || 'Client',
                  recipientPhone: conv.clientPhone,
                  body: msg.body || '',
                  fullBody: msg.body || '',
                  timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
                  entityType: conv.jobId ? 'job' : undefined,
                  entityId: conv.jobId || undefined,
                });
              });
          }
        });
      }
      
      items.sort((a, b) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0));
      setCommunications(items);
    } catch (error) {
      console.error('Failed to fetch communications:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);
  
  const filteredCommunications = useMemo(() => {
    return communications.filter(item => {
      if (activeTab !== 'all' && item.type !== activeTab) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          item.recipient.toLowerCase().includes(query) ||
          item.body.toLowerCase().includes(query) ||
          item.subject?.toLowerCase().includes(query) ||
          item.recipientEmail?.toLowerCase().includes(query) ||
          item.recipientPhone?.includes(query)
        );
      }
      return true;
    });
  }, [communications, activeTab, statusFilter, searchQuery]);
  
  const stats = useMemo(() => ({
    total: communications.length,
    emails: communications.filter(c => c.type === 'email').length,
    sms: communications.filter(c => c.type === 'sms').length,
    delivered: communications.filter(c => c.status === 'delivered' || c.status === 'sent').length,
  }), [communications]);
  
  const handleViewEntity = (type: string, id: string) => {
    setShowDetail(false);
    switch (type) {
      case 'quote':
        router.push(`/more/quote/${id}`);
        break;
      case 'invoice':
        router.push(`/more/invoice/${id}`);
        break;
      case 'job':
        router.push(`/job/${id}`);
        break;
      case 'receipt':
        router.push(`/more/receipt/${id}`);
        break;
    }
  };
  
  const renderItem = (item: CommunicationItem) => {
    const statusConfig = getStatusConfig(item.status);
    
    return (
      <PressableRow key={item.id} style={styles.itemCard} onPress={() => { setSelectedItem(item); setShowDetail(true); }} >
        <View style={styles.itemContent}>
          <View style={[
            styles.itemIconContainer,
            item.type === 'email' ? styles.emailIcon : styles.smsIcon
          ]}>
            <Feather 
              name={item.type === 'email' ? 'mail' : 'message-square'} 
              size={iconSizes.md} 
              color={item.type === 'email' ? colors.info : colors.success} 
            />
          </View>
          
          <View style={styles.itemDetails}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemRecipient} numberOfLines={1}>{item.recipient}</Text>
              {item.hasAttachment && (
                <View style={styles.attachmentBadge}>
                  <Feather name="paperclip" size={10} color={colors.mutedForeground} />
                  <Text style={styles.attachmentText}>PDF</Text>
                </View>
              )}
            </View>
            
            {item.subject && (
              <Text style={styles.itemSubject} numberOfLines={1}>{item.subject}</Text>
            )}
            
            <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
            
            <View style={styles.itemFooter}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather name="clock" size={12} color={colors.mutedForeground} />
                <Text style={styles.itemTime as any}>
                  {item.timestamp && !isNaN(item.timestamp.getTime()) ? formatDistanceToNow(item.timestamp, { addSuffix: true }) : ''}
                </Text>
                {item.source && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: item.source === 'mobile' ? `${colors.info}15` : `${colors.success}15`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Feather name={item.source === 'mobile' ? 'smartphone' : 'monitor'} size={10} color={item.source === 'mobile' ? colors.info : colors.success} />
                    <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: item.source === 'mobile' ? colors.info : colors.success }}>{item.source === 'mobile' ? 'Mobile' : 'Web'}</Text>
                  </View>
                )}
              </View>
              
              {item.entityType && item.entityId && (
                <PressableRow style={styles.entityLink} onPress={() => handleViewEntity(item.entityType!, item.entityId!)} >
                  <Feather name="external-link" size={12} color={colors.primary} />
                  <Text style={styles.entityLinkText}>
                    View {item.entityType} {item.entityNumber ? `#${item.entityNumber}` : ''}
                  </Text>
                </PressableRow>
              )}
            </View>
          </View>
          
          <View style={styles.itemMeta}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>
                {item.type === 'email' ? 'Email' : 'SMS'}
              </Text>
            </View>
          </View>
        </View>
      </PressableRow>
    );
  };
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.heroSection}>
        <View style={styles.heroLeft}>
          <Text style={styles.pageTitle}>Communications</Text>
          <Text style={styles.pageSubtitle}>Emails & SMS history</Text>
        </View>
        <PressableRow onPress={onRefresh} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <View style={styles.heroIconWrap}>
            <Feather name="refresh-cw" size={15} color={colors.primary} />
          </View>
        </PressableRow>
      </View>
      
      <View style={styles.statsRow}>
        {[
          { icon: 'activity' as const, value: stats.total, label: 'Total', color: colors.primary },
          { icon: 'mail' as const, value: stats.emails, label: 'Emails', color: colors.info },
          { icon: 'message-square' as const, value: stats.sms, label: 'SMS', color: colors.success },
          { icon: 'check-circle' as const, value: stats.delivered, label: 'Delivered', color: '#8b5cf6' },
        ].map((stat, idx) => (
          <View key={idx} style={styles.statCard}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${stat.color}12`, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              <Feather name={stat.icon} size={14} color={stat.color} />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
      
      <View style={{ flexGrow: 0, flexShrink: 0 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(['all', 'email', 'sms'] as TabType[]).map((tab) => {
            const count = tab === 'all' ? stats.total : tab === 'email' ? stats.emails : stats.sms;
            const isActive = activeTab === tab;
            const iconName = tab === 'all' ? 'inbox' : tab === 'email' ? 'mail' : 'message-square';
            return (
              <PressableRow key={tab} style={[styles.filterChip, isActive && styles.filterChipActive]} onPress={() => setActiveTab(tab)} >
                <Feather
                  name={iconName as any}
                  size={13}
                  color={isActive ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {tab === 'all' ? 'All' : tab === 'email' ? 'Email' : 'SMS'}
                </Text>
                <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              </PressableRow>
            );
          })}
        </ScrollView>
      </View>
      
      <View style={styles.searchContainer}>
        <Feather name="search" size={iconSizes.sm} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by recipient, content..."
          placeholderTextColor={colors.mutedForeground}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <PressableRow onPress={() => setSearchQuery('')}>
            <Feather name="x" size={iconSizes.sm} color={colors.mutedForeground} />
          </PressableRow>
        )}
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredCommunications.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.emptyIconContainer}>
            <Feather name="inbox" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyText}>No communications yet</Text>
          <Text style={styles.emptySubtext}>
            Sent emails and SMS messages will appear here
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: spacing.xl + insets.bottom }]}
        >
          {filteredCommunications.map(renderItem)}
        </ScrollView>
      )}
      
      <AppBottomSheet
        visible={showDetail}
        onDismiss={() => setShowDetail(false)}
        title={selectedItem ? `${selectedItem.type === 'email' ? 'Email' : 'SMS'} Details` : 'Details'}
        showCloseButton
        snapPoints={['85%']}
      >
        <View>
            {selectedItem && (
              <>
                <View style={styles.modalBody}>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Recipient</Text>
                    <Text style={styles.detailValue}>{selectedItem.recipient}</Text>
                    {selectedItem.recipientEmail && (
                      <Text style={[styles.detailValue, { color: colors.mutedForeground }]}>
                        {selectedItem.recipientEmail}
                      </Text>
                    )}
                    {selectedItem.recipientPhone && (
                      <Text style={[styles.detailValue, { color: colors.mutedForeground }]}>
                        {selectedItem.recipientPhone}
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailValue}>{getStatusConfig(selectedItem.status).label}</Text>
                      <View style={[
                        styles.statusBadge, 
                        { backgroundColor: getStatusConfig(selectedItem.status).bgColor }
                      ]}>
                        <Text style={[
                          styles.statusText, 
                          { color: getStatusConfig(selectedItem.status).color }
                        ]}>
                          {getStatusConfig(selectedItem.status).label}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={{ color: colors.mutedForeground, fontSize: typographySizes.sm }}>
                        Sent at
                      </Text>
                      <Text style={{ fontSize: typographySizes.sm, color: colors.foreground }}>
                        {selectedItem.timestamp && !isNaN(new Date(selectedItem.timestamp).getTime()) ? format(new Date(selectedItem.timestamp), 'h:mm:ss a') : '-'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={{ color: colors.mutedForeground, fontSize: typographySizes.sm }}>
                        Provider
                      </Text>
                      <Text style={{ fontSize: typographySizes.sm, color: colors.foreground }}>
                        {selectedItem.type === 'email' ? 'SendGrid' : 'Twilio'}
                      </Text>
                    </View>
                  </View>
                  
                  {selectedItem.subject && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Subject</Text>
                      <Text style={styles.detailValue}>{selectedItem.subject}</Text>
                    </View>
                  )}
                  
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Message</Text>
                    <Text style={styles.detailValue}>{selectedItem.fullBody || selectedItem.body}</Text>
                  </View>
                  
                  {selectedItem.entityType && selectedItem.entityId && (
                    <PressableRow style={[styles.detailSection, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => handleViewEntity(selectedItem.entityType!, selectedItem.entityId!)} >
                      <View>
                        <Text style={styles.detailLabel}>Related Document</Text>
                        <Text style={styles.detailValue}>
                          {selectedItem.entityType} {selectedItem.entityNumber ? `#${selectedItem.entityNumber}` : ''}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={iconSizes.md} color={colors.primary} />
                    </PressableRow>
                  )}
                </View>
              </>
            )}
        </View>
      </AppBottomSheet>
    </View>
  );
}
