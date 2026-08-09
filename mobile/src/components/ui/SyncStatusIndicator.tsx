import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../lib/theme';
import { useOfflineStore } from '../../lib/offline-storage';
import { spacing, radius } from '../../lib/design-tokens';

interface SyncStatusIndicatorProps {
  compact?: boolean;
  showDetails?: boolean;
  onPress?: () => void;
}

export function SyncStatusIndicator({ 
  compact = false, 
  showDetails = true,
  onPress 
}: SyncStatusIndicatorProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { isOnline, isSyncing, pendingSyncCount, lastSyncTime, syncError, backgroundSyncRegistered, backgroundSyncError } = useOfflineStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (isSyncing) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSyncing]);

  const getStatusIcon = () => {
    if (!isOnline) return 'wifi-off';
    if (isSyncing) return 'refresh-cw';
    if (pendingSyncCount > 0) return 'upload-cloud';
    if (syncError) return 'alert-circle';
    return 'check-circle';
  };

  const getStatusColor = () => {
    if (!isOnline) return colors.destructive;
    if (syncError) return '#F59E0B';
    if (pendingSyncCount > 0) return '#3B82F6';
    return '#10B981';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (pendingSyncCount > 0) return `${pendingSyncCount} pending`;
    if (syncError) return 'Sync error';
    return 'Synced';
  };

  const getLastSyncText = () => {
    if (!lastSyncTime) return 'Never synced';
    const diff = Date.now() - lastSyncTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (showDetails) {
      setExpanded(!expanded);
    }
  };

  if (compact) {
    return (
      <TouchableOpacity onPress={handlePress} style={styles.compactContainer}>
        <Animated.View style={{ opacity: pulseAnim }}>
          <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        onPress={handlePress} 
        style={[styles.statusBar, { borderColor: getStatusColor() }]}
        activeOpacity={0.7}
      >
        <Animated.View style={{ opacity: isSyncing ? pulseAnim : 1 }}>
          <Feather 
            name={getStatusIcon()} 
            size={16} 
            color={getStatusColor()} 
          />
        </Animated.View>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
        {showDetails && (
          <Feather 
            name={expanded ? 'chevron-up' : 'chevron-down'} 
            size={14} 
            color={colors.mutedForeground} 
          />
        )}
      </TouchableOpacity>

      {expanded && showDetails && (
        <View style={styles.detailsPanel}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Connection</Text>
            <View style={styles.detailValue}>
              <View style={[styles.smallDot, { backgroundColor: isOnline ? '#10B981' : colors.destructive }]} />
              <Text style={styles.detailValueText}>{isOnline ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Last sync</Text>
            <Text style={styles.detailValueText}>{getLastSyncText()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Background sync</Text>
            <View style={styles.detailValue}>
              <View style={[styles.smallDot, { backgroundColor: backgroundSyncRegistered ? '#10B981' : '#F59E0B' }]} />
              <Text style={styles.detailValueText}>{backgroundSyncRegistered ? 'Active' : 'Unavailable'}</Text>
            </View>
          </View>
          {pendingSyncCount > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pending changes</Text>
              <Text style={[styles.detailValueText, { color: '#3B82F6' }]}>{pendingSyncCount}</Text>
            </View>
          )}
          {syncError && (
            <View style={styles.errorRow}>
              <Feather name="alert-triangle" size={12} color="#F59E0B" />
              <Text style={styles.errorText} numberOfLines={2}>{syncError}</Text>
            </View>
          )}
          {!backgroundSyncRegistered && backgroundSyncError && (
            <View style={styles.warningRow}>
              <Feather name="alert-circle" size={12} color="#F59E0B" />
              <Text style={styles.warningText} numberOfLines={2}>
                Background sync unavailable. Changes will only sync while the app is open.
              </Text>
            </View>
          )}
          {!isOnline && (
            <View style={styles.offlineNote}>
              <Text style={styles.offlineNoteText}>
                Changes will sync when you're back online
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export function OfflineBanner() {
  const { colors } = useTheme();
  const { isOnline, pendingSyncCount } = useOfflineStore();

  if (isOnline) return null;

  return (
    <View style={{
      backgroundColor: colors.destructive,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    }}>
      <Feather name="wifi-off" size={14} color={colors.white} />
      <Text style={{ color: colors.white, fontSize: 13, fontWeight: '500' }}>
        You're offline
        {pendingSyncCount > 0 && ` (${pendingSyncCount} changes pending)`}
      </Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  compactContainer: {
    padding: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  smallDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  detailsPanel: {
    backgroundColor: colors.card,
    marginTop: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  detailValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailValueText: {
    fontSize: 13,
    color: colors.foreground,
    fontWeight: '500',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#F59E0B',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#F59E0B',
  },
  offlineNote: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  offlineNoteText: {
    fontSize: 12,
    color: colors.destructive,
    textAlign: 'center',
  },
});

export default SyncStatusIndicator;
