import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../../src/components/ui/PressableRow';
import { Stack, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { getBottomNavHeight } from '../../../src/components/BottomNav';
import { useClientsStore, useJobsStore, useQuotesStore, useInvoicesStore } from '../../../src/lib/store';
import { useTheme, ThemeColors } from '../../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, sizes } from '../../../src/lib/design-tokens';
import api from '../../../src/lib/api';
import { TeamAvatar } from '../../../src/components/TeamAvatar';
import { useConfirmDialog } from '../../../src/components/ui/ConfirmDialog';

type TabKey = 'overview' | 'jobs' | 'quotes' | 'invoices';

interface ActivityItem {
  id: string;
  entityId: string;
  type: 'job' | 'quote' | 'invoice';
  title: string;
  date: Date;
  status?: string;
  amount?: number;
}

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getClient, deleteClient } = useClientsStore();
  const { jobs, fetchJobs } = useJobsStore();
  const { quotes, fetchQuotes } = useQuotesStore();
  const { invoices, fetchInvoices } = useInvoicesStore();
  const [client, setClient] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedSignature, setSavedSignature] = useState<{ signatureData: string | null; signatureDate: string | null } | null>(null);
  const [isLoadingSignature, setIsLoadingSignature] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const confirm = useConfirmDialog();

  useEffect(() => {
    loadData();
    fetchSavedSignature();
  }, [id]);

  const loadData = async () => {
    setIsLoading(true);
    const clientData = await getClient(id!);
    setClient(clientData);
    await Promise.all([fetchJobs(), fetchQuotes(), fetchInvoices()]);
    setIsLoading(false);
  };

  const fetchSavedSignature = async () => {
    if (!id) return;
    setIsLoadingSignature(true);
    try {
      const response = await api.get<{ signatureData: string | null; signatureDate: string | null }>(`/api/clients/${id}/saved-signature`);
      if (response.data) {
        setSavedSignature(response.data);
      }
    } catch (error) {
      console.error('Error fetching saved signature:', error);
    } finally {
      setIsLoadingSignature(false);
    }
  };

  const handleClearSignature = async () => {
    const ok = await confirm({ title: 'Clear Signature', message: 'Are you sure you want to clear the saved signature for this client?', confirmText: 'Clear', cancelText: 'Cancel', destructive: true });
    if (ok) {
      try {
        const response = await api.delete(`/api/clients/${id}/saved-signature`);
        if (response.data) {
          setSavedSignature(null);
          Alert.alert('Success', 'Signature cleared successfully');
        } else {
          Alert.alert('Error', 'Failed to clear signature');
        }
      } catch (error) {
        console.error('Error clearing signature:', error);
        Alert.alert('Error', 'An error occurred while clearing the signature');
      }
    }
  };

  const clientJobs = jobs.filter(j => j.clientId === id);
  const clientQuotes = quotes.filter(q => q.clientId === id);
  const clientInvoices = invoices.filter(i => i.clientId === id);

  const activeJobs = clientJobs.filter(j => j.status !== 'done' && j.status !== 'invoiced').length;
  const totalRevenue = clientInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0);
  const outstanding = clientInvoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.total || 0), 0);

  const activityTimeline = useMemo(() => {
    const activities: ActivityItem[] = [];
    
    clientJobs.forEach(job => {
      activities.push({
        id: `job-${job.id}`,
        entityId: job.id,
        type: 'job',
        title: job.title,
        date: new Date(job.scheduledAt || job.createdAt || Date.now()),
        status: job.status,
      });
    });
    
    clientQuotes.forEach(quote => {
      activities.push({
        id: `quote-${quote.id}`,
        entityId: quote.id,
        type: 'quote',
        title: `Quote #${quote.quoteNumber || quote.id.slice(0,6)}`,
        date: new Date(quote.createdAt || Date.now()),
        amount: quote.total,
      });
    });
    
    clientInvoices.forEach(invoice => {
      activities.push({
        id: `invoice-${invoice.id}`,
        entityId: invoice.id,
        type: 'invoice',
        title: `Invoice #${invoice.invoiceNumber || invoice.id.slice(0,6)}`,
        date: new Date(invoice.createdAt || Date.now()),
        amount: invoice.total,
      });
    });
    
    return activities.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
  }, [clientJobs, clientQuotes, clientInvoices]);

  const formatCurrency = (amount: number) => {
    const { formatCurrency: fmt } = require('../../../src/lib/format');
    return fmt(amount);
  };

  const getTimelineIcon = (type: 'job' | 'quote' | 'invoice') => {
    switch (type) {
      case 'job':
        return { name: 'briefcase' as const, color: colors.primary };
      case 'quote':
        return { name: 'file-text' as const, color: colors.info };
      case 'invoice':
        return { name: 'credit-card' as const, color: colors.success };
    }
  };

  const handleCall = () => {
    if (client?.phone) {
      Linking.openURL(`tel:${client.phone}`);
    }
  };

  const handleEmail = () => {
    if (client?.email) {
      Linking.openURL(`mailto:${client.email}`);
    }
  };

  const [isSendingSms, setIsSendingSms] = useState(false);

  const handleSms = async () => {
    if (client?.phone) {
      const message = `Hi${client.firstName ? ` ${client.firstName}` : ''}, just reaching out regarding your service.`;
      setIsSendingSms(true);
      try {
        const response = await api.post('/api/sms/send', {
          clientPhone: client.phone,
          message,
          clientId: client.id,
        });
        if (response.error) {
          Alert.alert(
            'Send via SMS App?',
            'Could not send directly. Would you like to open your messaging app instead?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open SMS App',
                onPress: () => {
                  const url = `sms:${client.phone}`;
                  Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open SMS app'));
                },
              },
            ]
          );
        } else {
          Alert.alert('SMS Sent', `Message sent to ${client.firstName || client.phone}`);
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
                const url = `sms:${client.phone}`;
                Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open SMS app'));
              },
            },
          ]
        );
      } finally {
        setIsSendingSms(false);
      }
    }
  };

  const handleCreateJob = () => {
    router.push(`/more/create-job?clientId=${id}`);
  };

  const handleEdit = () => {
    router.push(`/more/client/new?clientId=${id}`);
  };

  const handleDelete = async () => {
    const hasAssociatedData = clientJobs.length > 0 || clientQuotes.length > 0 || clientInvoices.length > 0;
    
    if (hasAssociatedData) {
      Alert.alert(
        'Delete Client',
        `This client has ${clientJobs.length} job(s), ${clientQuotes.length} quote(s), and ${clientInvoices.length} invoice(s). How would you like to proceed?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete Client Only', 
            onPress: async () => {
              const success = await deleteClient(id!, false);
              if (success) {
                router.back();
              } else {
                Alert.alert('Error', 'Failed to delete client');
              }
            }
          },
          { 
            text: 'Delete All Data', 
            style: 'destructive',
            onPress: async () => {
              const success = await deleteClient(id!, true);
              if (success) {
                router.back();
              } else {
                Alert.alert('Error', 'Failed to delete client and associated data');
              }
            }
          }
        ]
      );
    } else {
      const ok = await confirm({ title: 'Delete Client', message: 'Are you sure you want to delete this client? This cannot be undone.', confirmText: 'Delete', cancelText: 'Cancel', destructive: true });
      if (ok) {
        const success = await deleteClient(id!, false);
        if (success) {
          router.back();
        } else {
          Alert.alert('Error', 'Failed to delete client');
        }
      }
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Client' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  if (!client) {
    return (
      <>
        <Stack.Screen options={{ title: 'Client' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Client not found</Text>
        </View>
      </>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            {/* Client Type & Referral */}
            {(client.clientType || client.referralSource) && (
              <>
                <Text style={styles.sectionTitle}>Details</Text>
                <View style={styles.card}>
                  {client.clientType && (
                    <View style={styles.infoRow}>
                      <Feather name="layers" size={18} color={colors.mutedForeground} />
                      <Text style={styles.infoText}>{client.clientType}</Text>
                    </View>
                  )}
                  {client.referralSource && (
                    <View style={styles.infoRow}>
                      <Feather name="share-2" size={18} color={colors.mutedForeground} />
                      <Text style={styles.infoText}>{client.referralSource}</Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Tags */}
            {client.tags && client.tags.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Tags</Text>
                <View style={styles.tagsRow}>
                  {client.tags.map((tag: string, idx: number) => (
                    <View key={idx} style={styles.tagBadge}>
                      <Text style={styles.tagBadgeText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Contact Info */}
            <Text style={styles.sectionTitle}>Contact Info</Text>
            <View style={styles.card}>
              {client.phone || client.email || client.address ? (
                <>
                  {client.phone && (
                    <PressableRow style={styles.infoRow} onPress={handleCall}>
                      <Feather name="phone" size={18} color={colors.mutedForeground} />
                      <Text style={styles.infoText}>{client.phone}</Text>
                      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                    </PressableRow>
                  )}
                  {client.email && (
                    <PressableRow style={styles.infoRow} onPress={handleEmail}>
                      <Feather name="mail" size={18} color={colors.mutedForeground} />
                      <Text style={styles.infoText}>{client.email}</Text>
                      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                    </PressableRow>
                  )}
                  {client.address && (
                    <View style={styles.infoRow}>
                      <Feather name="map-pin" size={18} color={colors.mutedForeground} />
                      <Text style={styles.infoText}>{client.address}</Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.noInfoText}>No contact information</Text>
              )}
            </View>

            {/* Activity Timeline */}
            {activityTimeline.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <View style={styles.timelineCard}>
                  {activityTimeline.map((activity, index) => {
                    const icon = getTimelineIcon(activity.type);
                    const handleActivityPress = () => {
                      if (activity.type === 'job') {
                        router.push(`/job/${activity.entityId}`);
                      } else if (activity.type === 'quote') {
                        router.push(`/more/quote/${activity.entityId}`);
                      } else if (activity.type === 'invoice') {
                        router.push(`/more/invoice/${activity.entityId}`);
                      }
                    };
                    return (
                      <PressableRow key={activity.id} style={[ styles.timelineItem, index === activityTimeline.length - 1 && { borderBottomWidth: 0 } ]} onPress={handleActivityPress} >
                        <View style={[styles.timelineIcon, { backgroundColor: icon.color + '20' }]}>
                          <Feather name={icon.name} size={16} color={icon.color} />
                        </View>
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineTitle}>{activity.title}</Text>
                          <Text style={styles.timelineDate}>
                            {activity.date.toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </Text>
                        </View>
                        {activity.status && (
                          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(activity.status, colors).bg }]}>
                            <Text style={[styles.statusText, { color: getStatusColor(activity.status, colors).text }]}>
                              {activity.status.replace('_', ' ')}
                            </Text>
                          </View>
                        )}
                        {activity.amount !== undefined && (
                          <Text style={styles.timelineAmount}>{formatCurrency(activity.amount)}</Text>
                        )}
                        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                      </PressableRow>
                    );
                  })}
                </View>
              </>
            )}

            {/* Saved Signature */}
            <Text style={styles.sectionTitle}>Saved Signature</Text>
            <View style={styles.card}>
              {isLoadingSignature ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: spacing.md }} />
              ) : savedSignature?.signatureData ? (
                <View style={styles.signatureContainer}>
                  <Image 
                    source={{ uri: savedSignature.signatureData }} 
                    style={styles.signatureImage} 
                    resizeMode="contain"
                  />
                  <View style={styles.signatureFooter}>
                    <Text style={styles.signatureDate}>
                      Saved on {new Date(savedSignature.signatureDate!).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </Text>
                    <PressableRow style={styles.clearSignatureButton} onPress={handleClearSignature} >
                      <Feather name="x-circle" size={16} color={colors.destructive} />
                      <Text style={styles.clearSignatureText}>Clear</Text>
                    </PressableRow>
                  </View>
                </View>
              ) : (
                <Text style={styles.noInfoText}>No saved signature</Text>
              )}
            </View>

            {/* Notes */}
            {client.notes && (
              <>
                <Text style={styles.sectionTitle}>Notes</Text>
                <View style={styles.card}>
                  <Text style={styles.notesText}>{client.notes}</Text>
                </View>
              </>
            )}
          </>
        );

      case 'jobs':
        return (
          <>
            {clientJobs.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Feather name="briefcase" size={40} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyStateTitle}>No jobs yet</Text>
                <Text style={styles.emptyStateSubtitle}>Create your first job for this client</Text>
                <PressableRow style={styles.emptyStateButton} onPress={handleCreateJob}>
                  <Feather name="plus" size={16} color={colors.white} />
                  <Text style={styles.emptyStateButtonText}>Create Job</Text>
                </PressableRow>
              </View>
            ) : (
              clientJobs.map((job) => (
                <PressableRow key={job.id} style={styles.jobCard} onPress={() => router.push(`/job/${job.id}`)} data-testid={`card-job-${job.id}`} >
                  <View style={styles.jobCardContent}>
                    <View style={styles.jobCardHeader}>
                      <View style={styles.jobIconContainer}>
                        <Feather name="briefcase" size={18} color={colors.primary} />
                      </View>
                      <View style={styles.jobCardInfo}>
                        <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                        {job.scheduledAt && (
                          <Text style={styles.jobDate}>
                            {new Date(job.scheduledAt).toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status, colors).bg }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(job.status, colors).text }]}>
                        {job.status.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </PressableRow>
              ))
            )}
          </>
        );

      case 'quotes':
        return (
          <>
            {clientQuotes.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Feather name="file-text" size={40} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyStateTitle}>No quotes yet</Text>
                <Text style={styles.emptyStateSubtitle}>Create a quote for this client</Text>
                <PressableRow style={styles.emptyStateButton} onPress={() => router.push(`/more/quote/new?clientId=${id}`)} >
                  <Feather name="plus" size={16} color={colors.white} />
                  <Text style={styles.emptyStateButtonText}>Create Quote</Text>
                </PressableRow>
              </View>
            ) : (
              clientQuotes.map((quote: any) => (
                <PressableRow key={quote.id} style={styles.jobCard} onPress={() => router.push(`/more/quote/${quote.id}`)} data-testid={`card-quote-${quote.id}`} >
                  <View style={styles.jobCardContent}>
                    <View style={styles.jobCardHeader}>
                      <View style={[styles.jobIconContainer, { backgroundColor: colors.infoLight }]}>
                        <Feather name="file-text" size={18} color={colors.info} />
                      </View>
                      <View style={styles.jobCardInfo}>
                        <Text style={styles.jobTitle} numberOfLines={1}>
                          Quote #{quote.quoteNumber || quote.id.slice(0, 6)}
                        </Text>
                        <Text style={styles.jobDate}>{quote.title || 'Untitled'}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.quoteAmount}>{formatCurrency(quote.total || 0)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(quote.status, colors).bg }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(quote.status, colors).text }]}>
                          {quote.status?.replace('_', ' ') || 'draft'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </PressableRow>
              ))
            )}
          </>
        );

      case 'invoices':
        return (
          <>
            {outstanding > 0 && (
              <View style={styles.outstandingBanner}>
                <Feather name="alert-circle" size={16} color={colors.warning} />
                <Text style={styles.outstandingText}>
                  {formatCurrency(outstanding)} outstanding
                </Text>
              </View>
            )}
            {clientInvoices.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Feather name="file" size={40} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyStateTitle}>No invoices yet</Text>
                <Text style={styles.emptyStateSubtitle}>Invoices will appear here after converting quotes</Text>
              </View>
            ) : (
              clientInvoices.map((invoice: any) => (
                <PressableRow key={invoice.id} style={styles.jobCard} onPress={() => router.push(`/more/invoice/${invoice.id}`)} data-testid={`card-invoice-${invoice.id}`} >
                  <View style={styles.jobCardContent}>
                    <View style={styles.jobCardHeader}>
                      <View style={[styles.jobIconContainer, { backgroundColor: invoice.status === 'paid' ? colors.successLight : colors.warningLight }]}>
                        <Feather name="file" size={18} color={invoice.status === 'paid' ? colors.success : colors.warning} />
                      </View>
                      <View style={styles.jobCardInfo}>
                        <Text style={styles.jobTitle} numberOfLines={1}>
                          Invoice #{invoice.invoiceNumber || invoice.id.slice(0, 6)}
                        </Text>
                        <Text style={styles.jobDate}>{invoice.title || 'Untitled'}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.quoteAmount, invoice.status === 'paid' && { color: colors.success }]}>
                        {formatCurrency(invoice.total || 0)}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status, colors).bg }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(invoice.status, colors).text }]}>
                          {invoice.status?.replace('_', ' ') || 'draft'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </PressableRow>
              ))
            )}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: false,
          title: 'Client Details',
        }} 
      />
      <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: bottomNavHeight + 24 }}>
        <View style={styles.content}>
          {/* In-content header row — native stack header is hidden on this
              screen, so back/edit/delete live here. */}
          <View style={styles.topBar}>
            <PressableRow onPress={() => router.back()} style={styles.headerButton} data-testid="button-back">
              <Feather name="arrow-left" size={22} color={colors.foreground} />
            </PressableRow>
            <View style={{ flex: 1 }} />
            <PressableRow onPress={handleEdit} style={styles.headerButton} data-testid="button-edit-client">
              <Feather name="edit-2" size={20} color={colors.primary} />
            </PressableRow>
            <PressableRow onPress={handleDelete} style={styles.headerButton} data-testid="button-delete-client">
              <Feather name="trash-2" size={20} color={colors.destructive} />
            </PressableRow>
          </View>
          {/* Profile Header Card */}
          <View style={styles.profileCard}>
            <TeamAvatar
              name={client.name}
              userId={String(client.id)}
              size={52}
            />
            <Text style={styles.clientName}>{client.name}</Text>
            {(client.email || client.phone) && (
              <Text style={styles.clientSubtitle}>
                {client.email || client.phone}
              </Text>
            )}
            
            {/* Quick Actions inside profile card */}
            <View style={styles.actionsRow}>
              <PressableRow style={[styles.actionButton, !client.phone && styles.actionButtonDisabled]} onPress={handleCall} disabled={!client.phone} >
                <Feather name="phone" size={16} color={client.phone ? colors.primaryForeground : colors.mutedForeground} />
                <Text style={[styles.actionButtonText, !client.phone && styles.actionButtonTextDisabled]}>
                  Call
                </Text>
              </PressableRow>
              <PressableRow style={[styles.actionButton, !client.email && styles.actionButtonDisabled]} onPress={handleEmail} disabled={!client.email} >
                <Feather name="mail" size={16} color={client.email ? colors.primaryForeground : colors.mutedForeground} />
                <Text style={[styles.actionButtonText, !client.email && styles.actionButtonTextDisabled]}>
                  Email
                </Text>
              </PressableRow>
              <PressableRow style={[styles.actionButton, !client.phone && styles.actionButtonDisabled]} onPress={handleSms} disabled={!client.phone} >
                <Feather name="message-circle" size={16} color={client.phone ? colors.primaryForeground : colors.mutedForeground} />
                <Text style={[styles.actionButtonText, !client.phone && styles.actionButtonTextDisabled]}>
                  SMS
                </Text>
              </PressableRow>
            </View>

            {/* Secondary Actions */}
            <View style={styles.actionsRowSecondary}>
              <PressableRow style={styles.actionButtonSecondary} onPress={handleCreateJob} >
                <Feather name="briefcase" size={16} color={colors.primary} />
                <Text style={styles.actionButtonSecondaryText}>New Job</Text>
              </PressableRow>
              <PressableRow style={styles.actionButtonSecondary} onPress={() => router.push(`/more/quote/new?clientId=${id}`)} >
                <Feather name="file-text" size={16} color={colors.primary} />
                <Text style={styles.actionButtonSecondaryText}>Quote</Text>
              </PressableRow>
            </View>
          </View>

          {/* KPI Stats Row */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiValue}>{clientJobs.length}</Text>
              <Text style={styles.kpiLabel}>Total Jobs</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiValue, { color: colors.success }]}>{formatCurrency(totalRevenue)}</Text>
              <Text style={styles.kpiLabel}>Revenue</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiValue, outstanding > 0 && { color: colors.warning }]}>{formatCurrency(outstanding)}</Text>
              <Text style={styles.kpiLabel}>Outstanding</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiValue}>{activeJobs}</Text>
              <Text style={styles.kpiLabel}>Active</Text>
            </View>
          </View>

          {/* Tabs */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsContainer}
          >
            {(['overview', 'jobs', 'quotes', 'invoices'] as TabKey[]).map((tab) => (
              <PressableRow key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)} >
                <Feather 
                  name={tab === 'overview' ? 'activity' : tab === 'jobs' ? 'briefcase' : tab === 'quotes' ? 'file-text' : 'file'} 
                  size={16} 
                  color={activeTab === tab ? colors.primary : colors.mutedForeground} 
                />
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
                {tab === 'jobs' && clientJobs.length > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{clientJobs.length}</Text>
                  </View>
                )}
                {tab === 'quotes' && clientQuotes.length > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{clientQuotes.length}</Text>
                  </View>
                )}
                {tab === 'invoices' && clientInvoices.length > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{clientInvoices.length}</Text>
                  </View>
                )}
              </PressableRow>
            ))}
          </ScrollView>

          {/* Tab Content */}
          <View style={styles.tabContent}>
            {renderTabContent()}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const getStatusColor = (status: string, colors: ThemeColors) => {
  switch (status) {
    case 'pending':
      return { bg: colors.warningLight, text: colors.warning };
    case 'scheduled':
      return { bg: colors.infoLight, text: colors.info };
    case 'in_progress':
      return { bg: colors.primaryLight, text: colors.primary };
    case 'done':
      return { bg: colors.successLight, text: colors.success };
    case 'invoiced':
      return { bg: colors.successLight, text: colors.success };
    default:
      return { bg: colors.muted, text: colors.mutedForeground };
  }
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
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
    ...typography.body,
    color: colors.mutedForeground,
  },
  headerButton: {
    padding: spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  avatar: {
    width: sizes.avatarLg,
    height: sizes.avatarLg,
    borderRadius: sizes.avatarLg / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  clientName: {
    ...typography.largeTitle,
    color: colors.foreground,
    textAlign: 'center',
  },
  clientSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.lg,
    width: '100%',
  },
  actionsRowSecondary: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    minHeight: 52,
  },
  actionButtonDisabled: {
    backgroundColor: colors.muted,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  actionButtonTextDisabled: {
    color: colors.mutedForeground,
  },
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  actionButtonSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
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
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  kpiLabel: {
    fontSize: 9,
    color: colors.mutedForeground,
    marginTop: 2,
    textAlign: 'center',
  },

  tabsScroll: {
    marginBottom: spacing.md,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primaryLight,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 2,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  tabContent: {
    marginBottom: spacing.xl,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyStateIcon: {
    marginBottom: spacing.md,
    opacity: 0.5,
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
    fontWeight: '600',
    fontSize: 14,
  },

  quoteAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 4,
  },

  outstandingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  outstandingText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.warning,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  infoText: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
  },
  noInfoText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statItem: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statValue: {
    ...typography.largeTitle,
    color: colors.foreground,
    marginTop: spacing.sm,
  },
  statLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  notesText: {
    ...typography.body,
    color: colors.foreground,
    lineHeight: 22,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  tagBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  tagBadgeText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary,
  },
  jobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  jobCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  jobIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  jobCardInfo: {
    flex: 1,
  },
  jobTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  jobDate: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  photosSection: {
    marginBottom: spacing.xl,
  },
  photosScroll: {
    flexDirection: 'row',
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  noPhotosText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  signatureContainer: {
    alignItems: 'center',
    gap: spacing.md,
  },
  signatureImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signatureFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.xs,
  },
  signatureDate: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  clearSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  clearSignatureText: {
    ...typography.caption,
    color: colors.destructive,
    fontWeight: '600',
  },
  timelineCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  timelineDate: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  timelineAmount: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
});
