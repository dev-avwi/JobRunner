import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../lib/theme';
import { radius, spacing } from '../lib/design-tokens';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = radius.sm, style }: SkeletonProps) {
  const { colors, isDark } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, []);
  
  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });
  
  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: isDark ? '#374151' : '#e5e7eb',
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonText({ lines = 3, lastLineWidth = '60%' }: { lines?: number; lastLineWidth?: string }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </View>
  );
}

export function SkeletonCard() {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Skeleton width={44} height={44} borderRadius={radius.md} />
        <View style={styles.cardHeaderText}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      <SkeletonText lines={2} lastLineWidth="80%" />
      <View style={styles.cardFooter}>
        <Skeleton width={80} height={24} borderRadius={12} />
        <Skeleton width={60} height={24} borderRadius={12} />
      </View>
    </View>
  );
}

export function SkeletonListItem() {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.listItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Skeleton width={40} height={40} borderRadius={20} />
      <View style={styles.listItemContent}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="50%" height={12} style={{ marginTop: 6 }} />
      </View>
      <Skeleton width={24} height={24} borderRadius={12} />
    </View>
  );
}

export function SkeletonJobCard() {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Skeleton width="70%" height={18} />
          <Skeleton width="40%" height={14} style={{ marginTop: 8 }} />
        </View>
        <Skeleton width={80} height={28} borderRadius={14} />
      </View>
      <View style={{ marginTop: spacing.md }}>
        <View style={styles.row}>
          <Skeleton width={16} height={16} borderRadius={8} />
          <Skeleton width="60%" height={14} style={{ marginLeft: 8 }} />
        </View>
        <View style={[styles.row, { marginTop: 8 }]}>
          <Skeleton width={16} height={16} borderRadius={8} />
          <Skeleton width="80%" height={14} style={{ marginLeft: 8 }} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonDocumentCard() {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Skeleton width={36} height={36} borderRadius={radius.md} />
        <View style={styles.cardHeaderText}>
          <Skeleton width="50%" height={16} />
          <Skeleton width="30%" height={12} style={{ marginTop: 6 }} />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Skeleton width={70} height={24} borderRadius={12} />
          <Skeleton width={50} height={20} borderRadius={10} style={{ marginTop: 6 }} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonStats() {
  const { colors } = useTheme();
  
  return (
    <View style={styles.statsRow}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Skeleton width={40} height={32} />
          <Skeleton width={50} height={12} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

export function SkeletonDashboard() {
  return (
    <View style={{ padding: spacing.md, gap: spacing.md }}>
      <SkeletonStats />
      <Skeleton width="40%" height={20} />
      <SkeletonJobCard />
      <SkeletonJobCard />
      <Skeleton width="40%" height={20} />
      <SkeletonListItem />
      <SkeletonListItem />
    </View>
  );
}

/** Generic section list skeleton — use inside any detail section that loads a list. */
export function SkeletonSection({ rows = 3 }: { rows?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <Skeleton width={36} height={36} borderRadius={radius.md} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={11} />
          </View>
          <Skeleton width={60} height={22} borderRadius={11} />
        </View>
      ))}
    </View>
  );
}

/** Full job-detail overview skeleton shown while the initial job record loads. */
export function SkeletonJobDetailOverview() {
  const { colors } = useTheme();
  return (
    <View style={{ padding: spacing.md, gap: spacing.md }}>
      {/* Status + action chips */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <Skeleton width={90} height={30} borderRadius={15} />
        <Skeleton width={120} height={30} borderRadius={15} />
        <View style={{ flex: 1 }} />
        <Skeleton width={44} height={44} borderRadius={22} />
      </View>

      {/* Main info card */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.md,
      }}>
        <Skeleton width="70%" height={18} />
        <Skeleton width="50%" height={14} />
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Skeleton width={16} height={16} borderRadius={8} />
          <Skeleton width="60%" height={14} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Skeleton width={16} height={16} borderRadius={8} />
          <Skeleton width="45%" height={14} />
        </View>
      </View>

      {/* Team row */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.md,
      }}>
        <Skeleton width="35%" height={16} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Skeleton width={40} height={40} borderRadius={20} />
          <Skeleton width={40} height={40} borderRadius={20} />
          <Skeleton width={40} height={40} borderRadius={20} />
        </View>
      </View>

      {/* Financial summary stats */}
      <SkeletonStats />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  listItemContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
});
