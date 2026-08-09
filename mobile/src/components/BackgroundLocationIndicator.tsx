import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLocationStore, getActivityStatus } from '../lib/location-store';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, typography } from '../lib/design-tokens';

interface BackgroundLocationIndicatorProps {
  compact?: boolean;
  showLabel?: boolean;
  onPress?: () => void;
}

const createStyles = (colors: ThemeColors, isActive: boolean) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: isActive ? colors.infoLight : colors.muted,
    borderWidth: 1,
    borderColor: isActive ? colors.info : colors.border,
  },
  compactContainer: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  iconContainer: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsingDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.info,
  },
  label: {
    ...typography.caption,
    color: isActive ? colors.info : colors.mutedForeground,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    marginLeft: spacing.xs,
  },
  statusLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginLeft: spacing.xs,
  },
});

export function BackgroundLocationIndicator({ 
  compact = false, 
  showLabel = true,
  onPress 
}: BackgroundLocationIndicatorProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { isEnabled, status, isMoving } = useLocationStore();
  
  const isActive = isEnabled && (status === 'tracking' || status === 'starting' || status === 'foreground_only');
  const activityStatus = getActivityStatus(useLocationStore.getState());
  
  const styles = useMemo(() => createStyles(colors, isActive), [colors, isActive]);
  
  if (!isEnabled) {
    return null;
  }
  
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/more/app-settings');
    }
  };
  
  const getStatusIcon = (): keyof typeof Feather.glyphMap => {
    if (status === 'starting') return 'loader';
    if (status === 'error') return 'alert-circle';
    if (isMoving) return 'navigation';
    return 'map-pin';
  };
  
  const getStatusColor = () => {
    if (status === 'error') return colors.destructive;
    if (status === 'starting') return colors.warning;
    return colors.info;
  };

  return (
    <TouchableOpacity
      style={[styles.container, compact && styles.compactContainer]}
      onPress={handlePress}
      activeOpacity={0.7}
      testID="indicator-background-location"
      accessibilityLabel={`Background location ${isActive ? 'active' : 'inactive'}. ${activityStatus}`}
      accessibilityRole="button"
    >
      <View style={styles.iconContainer}>
        <Feather 
          name={getStatusIcon()} 
          size={compact ? 12 : 14} 
          color={getStatusColor()} 
        />
      </View>
      {showLabel && !compact && (
        <>
          <Text style={styles.label}>Location</Text>
          <Text style={styles.statusLabel}>{activityStatus}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const bannerStyles = (colors: ThemeColors) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.info,
  },
  bannerIcon: {
    marginRight: spacing.sm,
  },
  bannerText: {
    ...typography.caption,
    color: colors.info,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  bannerStatus: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
});

export function BackgroundLocationBanner() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isEnabled, status } = useLocationStore();
  const styles = useMemo(() => bannerStyles(colors), [colors]);
  
  const isActive = isEnabled && (status === 'tracking' || status === 'starting' || status === 'foreground_only');
  
  if (!isActive) {
    return null;
  }
  
  const handlePress = () => {
    router.push('/more/app-settings');
  };
  
  const statusText = status === 'starting' ? 'Starting...' : status === 'foreground_only' ? 'Foreground Only' : 'Active';

  return (
    <TouchableOpacity 
      style={styles.banner} 
      onPress={handlePress}
      activeOpacity={0.8}
      testID="banner-background-location"
    >
      <Feather 
        name="map-pin" 
        size={14} 
        color={colors.info} 
        style={styles.bannerIcon} 
      />
      <Text style={styles.bannerText}>
        Background location tracking is enabled
      </Text>
      <Text style={styles.bannerStatus}>{statusText}</Text>
    </TouchableOpacity>
  );
}

export default BackgroundLocationIndicator;
