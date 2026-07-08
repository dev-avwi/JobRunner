import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineStore } from '../lib/offline-storage';
import offlineStorage from '../lib/offline-storage';
import { colors as staticColors } from '../lib/colors';

export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingSyncCount, lastSyncTime } = useOfflineStore();
  const [showSyncMessage, setShowSyncMessage] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Fetch detailed pending message when pending count changes
  const fetchPendingMessage = useCallback(async () => {
    if (pendingSyncCount > 0) {
      const message = await offlineStorage.getPendingUploadsMessage();
      setPendingMessage(message);
    } else {
      setPendingMessage(null);
    }
  }, [pendingSyncCount]);
  
  useEffect(() => {
    fetchPendingMessage();
  }, [fetchPendingMessage]);
  
  // Pulse animation when syncing
  useEffect(() => {
    if (isSyncing) {
      Animated.loop(
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
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSyncing]);
  
  // Show sync success message briefly
  useEffect(() => {
    if (lastSyncTime && pendingSyncCount === 0) {
      setShowSyncMessage(true);
      const timer = setTimeout(() => setShowSyncMessage(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSyncTime, pendingSyncCount]);
  
  const handleManualSync = async () => {
    if (!isSyncing && isOnline) {
      await offlineStorage.syncPendingChanges();
    }
  };
  
  // Don't show anything if online with no pending changes
  if (isOnline && pendingSyncCount === 0 && !showSyncMessage) {
    return null;
  }

  // Offline is handled by the single slim OfflineBanner pill — don't stack a
  // second "Offline mode" indicator underneath it.
  if (!isOnline) {
    return null;
  }
  
  // Show sync success message
  if (showSyncMessage && isOnline && pendingSyncCount === 0) {
    return (
      <View style={[styles.container, styles.successContainer]}>
        <Ionicons name="checkmark-circle" size={16} color="#10b981" />
        <Text style={styles.successText}>All changes synced</Text>
      </View>
    );
  }
  
  // Show offline or pending sync indicator
  return (
    <TouchableOpacity 
      style={[
        styles.container,
        isOnline ? styles.pendingContainer : styles.offlineContainer
      ]}
      onPress={handleManualSync}
      disabled={!isOnline || isSyncing}
      activeOpacity={0.7}
    >
      <Animated.View style={{ opacity: pulseAnim, flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons 
          name={isOnline ? (isSyncing ? 'sync' : 'cloud-upload-outline') : 'cloud-offline-outline'} 
          size={16} 
          color={isOnline ? '#f59e0b' : '#6b7280'}
        />
        <Text style={[styles.text, isOnline ? styles.pendingText : styles.offlineText]} numberOfLines={2}>
          {!isOnline 
            ? 'Offline mode' 
            : isSyncing 
              ? 'Syncing...' 
              : pendingMessage || `${pendingSyncCount} pending`
          }
        </Text>
        {isOnline && !isSyncing && pendingSyncCount > 0 && (
          <Text style={styles.tapHint}>(tap to sync)</Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

export function OfflineBanner() {
  const { isOnline, pendingSyncCount } = useOfflineStore();

  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={14} color={staticColors.white} />
      <Text style={styles.bannerTitle}>
        Offline{pendingSyncCount > 0 ? ` \u00B7 ${pendingSyncCount} pending` : ''}
      </Text>
    </View>
  );
}

export function SyncStatus() {
  const { isOnline, isSyncing, pendingSyncCount, lastSyncTime, syncError } = useOfflineStore();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchMessage = async () => {
      if (pendingSyncCount > 0) {
        const message = await offlineStorage.getPendingUploadsMessage();
        setPendingMessage(message);
      } else {
        setPendingMessage(null);
      }
    };
    fetchMessage();
  }, [pendingSyncCount]);
  
  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    const diff = Date.now() - lastSyncTime;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(lastSyncTime).toLocaleDateString();
  };
  
  return (
    <View style={styles.syncStatus}>
      <View style={styles.syncStatusRow}>
        <Text style={styles.syncLabel}>Connection</Text>
        <View style={styles.syncValueRow}>
          <View style={[styles.statusDot, isOnline ? styles.onlineDot : styles.offlineDot]} />
          <Text style={styles.syncValue}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
      </View>
      
      <View style={styles.syncStatusRow}>
        <Text style={styles.syncLabel}>Last sync</Text>
        <Text style={styles.syncValue}>{formatLastSync()}</Text>
      </View>
      
      {pendingSyncCount > 0 && (
        <View style={styles.pendingDetailsRow}>
          <Text style={styles.syncLabel}>Pending uploads</Text>
          <Text style={[styles.syncValue, styles.pendingValue]} numberOfLines={2}>
            {pendingMessage || `${pendingSyncCount} items`}
          </Text>
        </View>
      )}
      
      {syncError && (
        <View style={styles.errorRow}>
          <Ionicons name="warning" size={14} color="#ef4444" />
          <Text style={styles.errorText}>{syncError}</Text>
        </View>
      )}
      
      <TouchableOpacity 
        style={[
          styles.syncButton,
          (!isOnline || isSyncing) && styles.syncButtonDisabled
        ]}
        onPress={() => offlineStorage.fullSync()}
        disabled={!isOnline || isSyncing}
      >
        <Ionicons 
          name={isSyncing ? 'sync' : 'refresh'} 
          size={18} 
          color={(!isOnline || isSyncing) ? '#9ca3af' : '#3b82f6'}
        />
        <Text style={[
          styles.syncButtonText,
          (!isOnline || isSyncing) && styles.syncButtonTextDisabled
        ]}>
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  offlineContainer: {
    backgroundColor: '#f3f4f6',
  },
  pendingContainer: {
    backgroundColor: '#fef3c7',
  },
  successContainer: {
    backgroundColor: '#d1fae5',
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
  },
  offlineText: {
    color: '#6b7280',
  },
  pendingText: {
    color: '#92400e',
  },
  successText: {
    color: '#065f46',
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '500',
  },
  tapHint: {
    fontSize: 11,
    color: '#b45309',
    marginLeft: 4,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(55, 65, 81, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  bannerTitle: {
    color: staticColors.white,
    fontSize: 12,
    fontWeight: '500',
  },
  syncStatus: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  syncStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingDetailsRow: {
    flexDirection: 'column',
    gap: 4,
  },
  syncLabel: {
    color: '#6b7280',
    fontSize: 14,
  },
  syncValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
  },
  syncValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  onlineDot: {
    backgroundColor: '#10b981',
  },
  offlineDot: {
    backgroundColor: '#6b7280',
  },
  pendingValue: {
    color: '#f59e0b',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    flex: 1,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    marginTop: 4,
  },
  syncButtonDisabled: {
    backgroundColor: '#f3f4f6',
  },
  syncButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  syncButtonTextDisabled: {
    color: '#9ca3af',
  },
});
