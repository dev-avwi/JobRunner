import { View, Text, StyleSheet, ScrollView, Modal } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineStore } from '../lib/offline-storage';
import offlineStorage, { ConflictRecord } from '../lib/offline-storage';
import { useTheme } from '../lib/theme';
import { PressableRow } from './ui/PressableRow';

type Resolution = 'kept_server' | 'kept_local' | 'merged';
type FieldChoice = 'local' | 'server';

// Mergeable fields per entity, in canonical camelCase (what resolveConflict expects).
const MERGE_FIELDS: Record<string, { key: string; label: string }[]> = {
  job: [
    { key: 'title', label: 'Title' },
    { key: 'description', label: 'Description' },
    { key: 'address', label: 'Address' },
    { key: 'status', label: 'Status' },
    { key: 'scheduledAt', label: 'Scheduled' },
    { key: 'clientId', label: 'Client ID' },
    { key: 'clientName', label: 'Client' },
    { key: 'assignedTo', label: 'Assigned To' },
    { key: 'notes', label: 'Notes' },
  ],
  client: [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'notes', label: 'Notes' },
  ],
  quote: [
    { key: 'quoteNumber', label: 'Quote #' },
    { key: 'clientId', label: 'Client ID' },
    { key: 'clientName', label: 'Client' },
    { key: 'jobId', label: 'Job ID' },
    { key: 'status', label: 'Status' },
    { key: 'subtotal', label: 'Subtotal' },
    { key: 'gstAmount', label: 'GST' },
    { key: 'total', label: 'Total' },
    { key: 'validUntil', label: 'Valid Until' },
    { key: 'notes', label: 'Notes' },
  ],
  invoice: [
    { key: 'invoiceNumber', label: 'Invoice #' },
    { key: 'clientId', label: 'Client ID' },
    { key: 'clientName', label: 'Client' },
    { key: 'jobId', label: 'Job ID' },
    { key: 'quoteId', label: 'Quote ID' },
    { key: 'status', label: 'Status' },
    { key: 'subtotal', label: 'Subtotal' },
    { key: 'gstAmount', label: 'GST' },
    { key: 'total', label: 'Total' },
    { key: 'amountPaid', label: 'Amount Paid' },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'paidAt', label: 'Paid At' },
    { key: 'notes', label: 'Notes' },
  ],
  timeEntry: [
    { key: 'userId', label: 'User ID' },
    { key: 'jobId', label: 'Job ID' },
    { key: 'description', label: 'Description' },
    { key: 'startTime', label: 'Start' },
    { key: 'endTime', label: 'End' },
    { key: 'notes', label: 'Notes' },
  ],
};

const toSnake = (s: string) => s.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());

function readField(obj: any, camelKey: string): any {
  if (obj == null) return undefined;
  if (obj[camelKey] !== undefined) return obj[camelKey];
  return obj[toSnake(camelKey)];
}

function displayValue(v: any): string {
  if (v === null || v === undefined || v === '') return '\u2014';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

interface ConflictItemProps {
  conflict: ConflictRecord;
  onResolve: (resolution: Resolution, mergedData?: Record<string, any>) => void;
}

function ConflictItem({ conflict, onResolve }: ConflictItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { colors } = useTheme();

  const localData = JSON.parse(conflict.localData);
  const serverData = JSON.parse(conflict.serverData);

  const canMerge = !!MERGE_FIELDS[conflict.entityType];
  const fields = MERGE_FIELDS[conflict.entityType] || [];

  const changedKeys = fields
    .filter((f) => displayValue(readField(localData, f.key)) !== displayValue(readField(serverData, f.key)))
    .map((f) => f.key);

  const [fieldChoices, setFieldChoices] = useState<Record<string, FieldChoice>>(() => {
    const defaults: Record<string, FieldChoice> = {};
    changedKeys.forEach((k) => {
      defaults[k] = 'local';
    });
    return defaults;
  });

  const toggleFieldChoice = (key: string) => {
    setFieldChoices((prev) => ({
      ...prev,
      [key]: prev[key] === 'local' ? 'server' : 'local',
    }));
  };

  const allLocal = changedKeys.every((k) => fieldChoices[k] === 'local');
  const allServer = changedKeys.every((k) => fieldChoices[k] === 'server');
  const showMerge = canMerge && changedKeys.length > 1 && !allLocal && !allServer;

  const getEntityLabel = (type: string) => {
    const labels: Record<string, string> = {
      job: 'Job',
      client: 'Client',
      quote: 'Quote',
      invoice: 'Invoice',
      timeEntry: 'Time Entry',
    };
    return labels[type] || type;
  };

  const getEntityTitle = () => {
    const data = localData;
    if (data.name) return data.name;
    if (data.title) return data.title;
    if (data.quoteNumber || data.quote_number) return `Quote #${data.quoteNumber || data.quote_number}`;
    if (data.invoiceNumber || data.invoice_number) return `Invoice #${data.invoiceNumber || data.invoice_number}`;
    if (data.description) return data.description;
    return conflict.entityId.slice(0, 8);
  };

  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString();

  const buildMergedData = () => {
    const merged: Record<string, any> = {};
    for (const f of fields) {
      const localV = readField(localData, f.key);
      const serverV = readField(serverData, f.key);
      const choice = fieldChoices[f.key] || 'local';
      const chosen = choice === 'server' ? serverV : localV;
      // Never write undefined (would null the column) — fall back to the other source.
      merged[f.key] = chosen !== undefined ? chosen : choice === 'server' ? localV : serverV;
    }
    return merged;
  };

  return (
    <View style={[styles.conflictItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <PressableRow style={styles.conflictHeader} onPress={() => setExpanded(!expanded)}>
        <View style={styles.conflictInfo}>
          <View style={[styles.conflictBadge, { backgroundColor: colors.destructiveLight }]}>
            <Text style={[styles.conflictBadgeText, { color: colors.destructive }]}>{getEntityLabel(conflict.entityType)}</Text>
          </View>
          <Text style={[styles.conflictTitle, { color: colors.foreground }]} numberOfLines={1}>{getEntityTitle()}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.mutedForeground} />
      </PressableRow>

      {expanded && (
        <View style={[styles.conflictDetails, { borderTopColor: colors.border }]}>
          <Text style={[styles.conflictTime, { color: colors.mutedForeground }]}>
            Conflict detected: {formatTime(conflict.conflictedAt)}
          </Text>

          {changedKeys.length > 0 ? (
            <View style={styles.fieldTable}>
              <View style={styles.fieldRowHeader}>
                <Text style={[styles.fieldColLabel, { color: colors.mutedForeground }]}>Field</Text>
                <Text style={[styles.fieldColValue, { color: colors.mutedForeground }]}>Yours</Text>
                <Text style={[styles.fieldColValue, { color: colors.mutedForeground }]}>Server</Text>
                <Text style={[styles.fieldColUse, { color: colors.mutedForeground }]}>Use</Text>
              </View>
              {fields
                .filter((f) => changedKeys.includes(f.key))
                .map((f) => {
                  const choice = fieldChoices[f.key] || 'local';
                  return (
                    <View key={f.key} style={[styles.fieldRow, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.fieldColLabel, { color: colors.secondaryText }]} numberOfLines={2}>{f.label}</Text>
                      <Text style={[styles.fieldColValue, { color: choice === 'local' ? colors.foreground : colors.mutedForeground, fontWeight: choice === 'local' ? '600' : '400' }]} numberOfLines={2}>
                        {displayValue(readField(localData, f.key))}
                      </Text>
                      <Text style={[styles.fieldColValue, { color: choice === 'server' ? colors.foreground : colors.mutedForeground, fontWeight: choice === 'server' ? '600' : '400' }]} numberOfLines={2}>
                        {displayValue(readField(serverData, f.key))}
                      </Text>
                      <PressableRow
                        style={[styles.fieldToggle, { borderColor: colors.border }]}
                        onPress={() => toggleFieldChoice(f.key)}
                      >
                        <Text style={[styles.fieldToggleText, { color: colors.primary }]}>{choice === 'local' ? 'Mine' : 'Server'}</Text>
                      </PressableRow>
                    </View>
                  );
                })}
            </View>
          ) : (
            <Text style={[styles.conflictTime, { color: colors.mutedForeground }]}>No field differences detected.</Text>
          )}

          <View style={styles.resolutionButtons}>
            <PressableRow style={[styles.resolutionButton, { backgroundColor: colors.warning + '15' }]} onPress={() => onResolve('kept_local')}>
              <Ionicons name="phone-portrait-outline" size={16} color={colors.warning} />
              <Text style={[styles.resolutionButtonText, { color: colors.warning }]}>Keep Mine</Text>
            </PressableRow>
            {showMerge && (
              <PressableRow style={[styles.resolutionButton, { backgroundColor: colors.primary + '15' }]} onPress={() => onResolve('merged', buildMergedData())}>
                <Ionicons name="git-merge-outline" size={16} color={colors.primary} />
                <Text style={[styles.resolutionButtonText, { color: colors.primary }]}>Merge</Text>
              </PressableRow>
            )}
            <PressableRow style={[styles.resolutionButton, { backgroundColor: colors.primary + '15' }]} onPress={() => onResolve('kept_server')}>
              <Ionicons name="cloud-outline" size={16} color={colors.primary} />
              <Text style={[styles.resolutionButtonText, { color: colors.primary }]}>Use Server</Text>
            </PressableRow>
          </View>
        </View>
      )}
    </View>
  );
}

export function ConflictResolutionPanel() {
  const { unresolvedConflictCount, isOnline } = useOfflineStore();
  const { colors } = useTheme();
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadConflicts = async () => {
    setLoading(true);
    try {
      const unresolvedConflicts = await offlineStorage.getConflicts(false);
      setConflicts(unresolvedConflicts);
    } catch (error) {
      if (__DEV__) console.error('Failed to load conflicts:', error);
    } finally {
      setLoading(false);
    }
  };

  const openPanel = () => {
    setVisible(true);
    loadConflicts();
  };

  const handleResolve = async (conflictId: string, resolution: Resolution, mergedData?: Record<string, any>) => {
    try {
      await offlineStorage.resolveConflict(conflictId, resolution, mergedData);
      setConflicts((prev) => prev.filter((c) => c.id !== conflictId));

      if ((resolution === 'kept_local' || resolution === 'merged') && isOnline) {
        await offlineStorage.syncPendingChanges();
      }
    } catch (error) {
      if (__DEV__) console.error('Failed to resolve conflict:', error);
    }
  };

  if (unresolvedConflictCount === 0) {
    return null;
  }

  return (
    <>
      <PressableRow style={[styles.conflictBanner, { backgroundColor: colors.destructiveLight, borderBottomColor: colors.destructive + '30' }]} onPress={openPanel} data-testid="banner-sync-conflicts">
        <Ionicons name="alert-circle" size={18} color={colors.destructive} />
        <Text style={[styles.conflictBannerText, { color: colors.destructive }]}>
          {unresolvedConflictCount} sync conflict{unresolvedConflictCount !== 1 ? 's' : ''} need attention
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.destructive} />
      </PressableRow>

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Sync Conflicts</Text>
            <PressableRow onPress={() => setVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} data-testid="button-close-conflicts">
              <Ionicons name="close" size={24} color={colors.mutedForeground} />
            </PressableRow>
          </View>

          <Text style={[styles.modalDescription, { color: colors.secondaryText }]}>
            These items were changed on both your device and the server. For each field choose Mine or Server, then Merge — or keep one whole version.
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.secondaryText }]}>Loading conflicts...</Text>
            </View>
          ) : conflicts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
              <Text style={[styles.emptyText, { color: colors.success }]}>All conflicts resolved!</Text>
            </View>
          ) : (
            <ScrollView style={styles.conflictList}>
              {conflicts.map((conflict) => (
                <ConflictItem
                  key={conflict.id}
                  conflict={conflict}
                  onResolve={(resolution, mergedData) => handleResolve(conflict.id, resolution, mergedData)}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  conflictBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalDescription: {
    padding: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  conflictList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  conflictItem: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  conflictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  conflictInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  conflictBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  conflictBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  conflictTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  conflictDetails: {
    borderTopWidth: 1,
    padding: 16,
    gap: 12,
  },
  conflictTime: {
    fontSize: 12,
  },
  fieldTable: {
    gap: 6,
  },
  fieldRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 8,
    gap: 6,
  },
  fieldColLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  fieldColValue: {
    flex: 1.2,
    fontSize: 12,
  },
  fieldColUse: {
    width: 52,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  fieldToggle: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  fieldToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resolutionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  resolutionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  resolutionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
