/**
 * Activity log screen — full activity history for a single job.
 * Navigate here via:
 *   router.push({ pathname: '/job/activity', params: { jobId, jobTitle } })
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Platform,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import {
  spacing,
  radius,
  typography,
  fontWeights,
  shadows,
  pageShell,
} from '../../src/lib/design-tokens';
import { getNestedHeaderOptions } from '../../src/lib/nested-header';
import api from '../../src/lib/api';

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  /** API returns this field as `timestamp` */
  timestamp: string;
  userId?: string;
  userName?: string;
  title?: string;
}

const ICON_MAP: Record<string, string> = {
  job_created: 'plus-circle',
  job_scheduled: 'calendar',
  job_started: 'play-circle',
  job_completed: 'check-circle',
  status_change: 'arrow-right-circle',
  invoice_sent: 'send',
  invoice_paid: 'dollar-sign',
  quote_sent: 'mail',
  quote_accepted: 'thumbs-up',
  photo_added: 'camera',
  note_added: 'edit-3',
  sms_sent: 'message-square',
  email_sent: 'mail',
  timer_started: 'clock',
  timer_stopped: 'square',
};

export default function JobActivityScreen() {
  const { jobId, jobTitle } = useLocalSearchParams<{
    jobId: string;
    jobTitle?: string;
  }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadActivity = useCallback(async () => {
    if (!jobId) return;
    try {
      setError(null);
      // Request server maximum (50); the endpoint caps at 50 regardless.
      const response = await api.get<ActivityItem[]>(
        `/api/jobs/${jobId}/activity?limit=50`,
      );
      if (response.error) {
        setError(response.error);
        return;
      }
      setActivityLog(response.data ?? []);
    } catch {
      setError('Could not load activity. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadActivity();
  }, [loadActivity]);

  const getActivityColor = (type: string) => {
    if (
      type?.includes('completed') ||
      type?.includes('paid') ||
      type?.includes('accepted')
    ) {
      return colors.success;
    }
    if (type?.includes('started') || type?.includes('progress')) {
      return colors.inProgress;
    }
    return colors.mutedForeground;
  };

  const headerOptions = {
    ...getNestedHeaderOptions(),
    title: jobTitle ?? 'Activity Log',
    headerBackVisible: false,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.primary,
    headerTitleStyle: {
      fontSize: typography.subtitle.fontSize,
      fontWeight: fontWeights.semibold as any,
      color: colors.foreground,
    },
    headerLeft: () => (
      <Pressable
        onPress={() => router.back()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <Feather name="chevron-left" size={17} color={colors.primary} />
        <Text
          style={{
            fontSize: typography.subtitle.fontSize,
            color: colors.primary,
            marginLeft: -1,
          }}
        >
          Back
        </Text>
      </Pressable>
    ),
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={headerOptions} />

      {/* Android in-content back row — native header is suppressed on Android */}
      {Platform.OS === 'android' && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            backgroundColor: colors.background,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
          >
            <Feather name="chevron-left" size={20} color={colors.primary} />
            <Text
              style={{
                fontSize: typography.sizes.md,
                color: colors.primary,
                fontWeight: fontWeights.medium,
              }}
            >
              Back
            </Text>
          </TouchableOpacity>
          <Text
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: typography.subtitle.fontSize,
              fontWeight: fontWeights.semibold,
              color: colors.foreground,
              marginRight: 48, // offset so title is visually centred
            }}
            numberOfLines={1}
          >
            Activity Log
          </Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.centred}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centred}>
            <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
            <Text
              style={[
                styles.emptyText,
                { color: colors.mutedForeground, marginTop: spacing.md },
              ]}
            >
              {error}
            </Text>
            <TouchableOpacity
              onPress={() => { setLoading(true); loadActivity(); }}
              activeOpacity={0.8}
              style={{
                marginTop: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                backgroundColor: colors.primary,
                borderRadius: radius.md,
              }}
            >
              <Text
                style={{
                  color: colors.primaryForeground,
                  fontWeight: fontWeights.semibold,
                }}
              >
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : activityLog.length === 0 ? (
          <View style={styles.centred}>
            <Feather name="activity" size={36} color={colors.mutedForeground} />
            <Text
              style={[
                styles.emptyText,
                { color: colors.mutedForeground, marginTop: spacing.md },
              ]}
            >
              No activity recorded yet
            </Text>
            <Text
              style={[styles.emptySubtext, { color: colors.mutedForeground }]}
            >
              Actions taken on this job will appear here
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.cardBorder },
            ]}
          >
            {activityLog.map((item, index) => {
              const iconName = ICON_MAP[item.type] || 'circle';
              const actColor = getActivityColor(item.type);
              const dateStr = item.timestamp
                ? new Date(item.timestamp).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : '';
              return (
                <View
                  key={item.id || index}
                  style={[
                    styles.row,
                    index > 0 && {
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      { backgroundColor: `${actColor}12` },
                    ]}
                  >
                    <Feather name={iconName as any} size={13} color={actColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.itemTitle, { color: colors.foreground }]}
                      numberOfLines={2}
                    >
                      {item.title || item.description}
                    </Text>
                    {item.description && item.title && (
                      <Text
                        style={[
                          styles.itemDesc,
                          { color: colors.mutedForeground },
                        ]}
                        numberOfLines={2}
                      >
                        {item.description}
                      </Text>
                    )}
                    <Text
                      style={[styles.itemTime, { color: colors.mutedForeground }]}
                    >
                      {dateStr}
                      {item.userName ? ` · ${item.userName}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: pageShell.paddingBottom,
    flexGrow: 1,
  },
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.medium,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  itemTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
  },
  itemDesc: {
    fontSize: typography.captionSmall.fontSize,
    marginTop: 1,
  },
  itemTime: {
    fontSize: typography.sizes.xs,
    marginTop: 3,
  },
});
