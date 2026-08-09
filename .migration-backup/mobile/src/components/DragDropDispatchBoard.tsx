import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  LayoutChangeEvent,
  Platform,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from './ui/PressableRow';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, shadows, statusColors } from '../lib/design-tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TIME_COLUMN_WIDTH = 50;
const HOUR_HEIGHT = 70;
const WORK_HOURS = Array.from({ length: 13 }, (_, i) => i + 6); // 6 AM to 6 PM

interface Job {
  id: string;
  title: string;
  status: string;
  scheduledAt?: string;
  scheduledTime?: string;
  estimatedDuration?: number;
  address?: string;
  clientId: string;
  clientName?: string;
  assignedTo?: string;
}

interface TeamMember {
  id: string;
  userId: string;
  name: string;
}

interface DragDropDispatchBoardProps {
  jobs: Job[];
  teamMembers: TeamMember[];
  currentDate: Date;
  onJobSchedule: (jobId: string, time: string, assignedTo?: string) => Promise<void>;
  onJobPress: (jobId: string) => void;
  isScheduling: boolean;
}

interface DragState {
  jobId: string | null;
  startX: number;
  startY: number;
}

export function DragDropDispatchBoard({
  jobs,
  teamMembers,
  currentDate,
  onJobSchedule,
  onJobPress,
  isScheduling,
}: DragDropDispatchBoardProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const [containerLayout, setContainerLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const [draggedJob, setDraggedJob] = useState<Job | null>(null);
  const [highlightedSlot, setHighlightedSlot] = useState<{ hour: number; time: string; memberId?: string } | null>(null);
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const dateStr = currentDate.toISOString().split('T')[0];

  const scheduledJobs = useMemo(() => {
    return jobs.filter(job => {
      if (!job.scheduledAt) return false;
      const jobDate = job.scheduledAt.split('T')[0];
      return jobDate === dateStr;
    });
  }, [jobs, dateStr]);

  const unscheduledJobs = useMemo(() => {
    return jobs.filter(job => 
      !job.scheduledAt && 
      ['pending', 'scheduled'].includes(job.status)
    );
  }, [jobs]);

  const columnWidth = useMemo(() => {
    const availableWidth = SCREEN_WIDTH - TIME_COLUMN_WIDTH - spacing.md * 2;
    const memberCount = Math.max(1, teamMembers.length + 1); // +1 for unassigned
    return Math.max(100, availableWidth / memberCount);
  }, [teamMembers.length]);

  const getTimeFromY = (y: number): string => {
    const hourIndex = Math.floor(y / HOUR_HEIGHT);
    const minuteOffset = ((y % HOUR_HEIGHT) / HOUR_HEIGHT) * 60;
    const hour = Math.min(Math.max(WORK_HOURS[0], WORK_HOURS[0] + hourIndex), WORK_HOURS[WORK_HOURS.length - 1]);
    const minute = minuteOffset >= 30 ? 30 : 0;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const getHourFromY = (y: number): number => {
    const hourIndex = Math.floor(y / HOUR_HEIGHT);
    return Math.min(Math.max(WORK_HOURS[0], WORK_HOURS[0] + hourIndex), WORK_HOURS[WORK_HOURS.length - 1]);
  };

  const getMemberFromX = (x: number): string | undefined => {
    if (x < TIME_COLUMN_WIDTH) return undefined;
    const adjustedX = x - TIME_COLUMN_WIDTH;
    const memberIndex = Math.floor(adjustedX / columnWidth);
    
    if (memberIndex === 0) return undefined; // Unassigned column
    if (memberIndex > 0 && memberIndex <= teamMembers.length) {
      return teamMembers[memberIndex - 1]?.userId;
    }
    return undefined;
  };

  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'success') => {
    if (Platform.OS === 'ios') {
      if (type === 'light') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (type === 'medium') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, []);

  const handleDragStart = useCallback((job: Job) => {
    setDraggedJob(job);
    scale.value = withSpring(1.05);
    opacity.value = 0.9;
    triggerHaptic('medium');
  }, [scale, opacity, triggerHaptic]);

  const lastHighlightedTime = useRef<string | null>(null);
  
  const handleDragUpdate = useCallback((x: number, y: number) => {
    if (!draggedJob) return;
    
    const hour = getHourFromY(y);
    const time = getTimeFromY(y);
    const memberId = getMemberFromX(x);
    
    // Trigger light haptic when crossing into a new time slot (includes half-hours)
    if (time !== lastHighlightedTime.current) {
      lastHighlightedTime.current = time;
      triggerHaptic('light');
    }
    
    setHighlightedSlot({ hour, time, memberId });
  }, [draggedJob, columnWidth, teamMembers, triggerHaptic]);

  const handleDragEnd = useCallback(async (x: number, y: number) => {
    if (!draggedJob) return;

    const time = getTimeFromY(y);
    const memberId = getMemberFromX(x);

    scale.value = withSpring(1);
    opacity.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);

    try {
      await onJobSchedule(draggedJob.id, time, memberId);
      triggerHaptic('success');
    } catch (error) {
      Alert.alert('Error', 'Failed to schedule job');
    }

    lastHighlightedTime.current = null;
    setDraggedJob(null);
    setHighlightedSlot(null);
  }, [draggedJob, onJobSchedule, scale, opacity, translateX, translateY, columnWidth, teamMembers, triggerHaptic]);

  const formatHour = (hour: number): string => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${h}${ampm}`;
  };

  const formatTimeString = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return statusColors.pending;
      case 'scheduled': return statusColors.scheduled;
      case 'in_progress': return statusColors.in_progress;
      case 'done': return statusColors.done;
      case 'invoiced': return statusColors.invoiced;
      default: return statusColors.pending;
    }
  };

  const getJobPosition = (job: Job) => {
    if (!job.scheduledTime) return null;
    const [hour, minute] = job.scheduledTime.split(':').map(Number);
    const topOffset = (hour - WORK_HOURS[0]) * HOUR_HEIGHT + (minute / 60) * HOUR_HEIGHT;
    return { top: topOffset, height: HOUR_HEIGHT - 4 };
  };

  const onContainerLayout = (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setContainerLayout({ x, y, width, height });
  };

  const DraggableJobCard = ({ job }: { job: Job }) => {
    const cardTranslateX = useSharedValue(0);
    const cardTranslateY = useSharedValue(0);
    const cardScale = useSharedValue(1);
    const isDragging = useSharedValue(false);

    const panGesture = Gesture.Pan()
      .onStart(() => {
        isDragging.value = true;
        cardScale.value = withSpring(1.05);
        runOnJS(handleDragStart)(job);
      })
      .onUpdate((event) => {
        cardTranslateX.value = event.translationX;
        cardTranslateY.value = event.translationY;
        runOnJS(handleDragUpdate)(event.absoluteX, event.absoluteY);
      })
      .onEnd((event) => {
        isDragging.value = false;
        cardScale.value = withSpring(1);
        cardTranslateX.value = withSpring(0);
        cardTranslateY.value = withSpring(0);
        runOnJS(handleDragEnd)(event.absoluteX, event.absoluteY);
      });

    const tapGesture = Gesture.Tap()
      .onEnd(() => {
        runOnJS(onJobPress)(job.id);
      });

    const composedGesture = Gesture.Race(panGesture, tapGesture);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: cardTranslateX.value },
        { translateY: cardTranslateY.value },
        { scale: cardScale.value },
      ],
      zIndex: isDragging.value ? 1000 : 1,
      // Shadow parity: Android lifts the card via elevation, iOS via the
      // paired shadow props (the base style's shadows.md only applies iOS
      // shadow props through Platform.select, so both branches are needed).
      ...(Platform.OS === 'android'
        ? { elevation: isDragging.value ? 10 : 2 }
        : {
            shadowOpacity: isDragging.value ? 0.3 : 0.08,
            shadowRadius: isDragging.value ? 12 : 4,
          }),
    }));

    const statusColor = getStatusColor(job.status);

    return (
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.unscheduledJobCard, animatedStyle]}>
          <View style={[styles.jobCardBorder, { backgroundColor: statusColor.bg }]} />
          <View style={styles.jobCardContent}>
            <View style={styles.jobCardHeader}>
              <Feather name="move" size={14} color={colors.mutedForeground} />
              <Text style={styles.jobCardTitle} numberOfLines={1}>{job.title}</Text>
            </View>
            <Text style={styles.jobCardClient} numberOfLines={1}>
              {job.clientName || 'No client'}
            </Text>
            {job.address && (
              <Text style={styles.jobCardAddress} numberOfLines={1}>
                {job.address}
              </Text>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    );
  };

  const TimelineJobCard = ({ job, position }: { job: Job; position: { top: number; height: number } }) => {
    const statusColor = getStatusColor(job.status);
    
    // Find which column this job belongs to
    let columnIndex = 0; // Default to unassigned
    if (job.assignedTo) {
      const memberIdx = teamMembers.findIndex(m => m.userId === job.assignedTo);
      if (memberIdx >= 0) columnIndex = memberIdx + 1;
    }
    
    const left = TIME_COLUMN_WIDTH + columnIndex * columnWidth + 2;

    return (
      <PressableRow style={[ styles.timelineJobCard, { top: position.top, height: position.height, left, width: columnWidth - 4, backgroundColor: statusColor.bg, borderLeftColor: statusColor.text, }, ]} onPress={() => onJobPress(job.id)} >
        <Text style={[styles.timelineJobTitle, { color: statusColor.text }]} numberOfLines={1}>
          {job.title}
        </Text>
        <Text style={styles.timelineJobTime}>
          {job.scheduledTime}
        </Text>
      </PressableRow>
    );
  };

  return (
    <View style={styles.container} onLayout={onContainerLayout}>
      {/* Unscheduled Jobs Section */}
      <View style={styles.unscheduledSection}>
        <View style={styles.sectionHeader}>
          <Feather name="inbox" size={16} color={colors.foreground} />
          <Text style={styles.sectionTitle}>Unscheduled Jobs</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unscheduledJobs.length}</Text>
          </View>
        </View>
        <Text style={styles.dragHint}>
          Drag jobs to the timeline below to schedule
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.unscheduledList}
        >
          <GestureHandlerRootView>
            {unscheduledJobs.map(job => (
              <DraggableJobCard key={job.id} job={job} />
            ))}
          </GestureHandlerRootView>
          {unscheduledJobs.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="check-circle" size={20} color={colors.success} />
              <Text style={styles.emptyStateText}>All jobs scheduled!</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Timeline Header - Team Members */}
      <View style={styles.timelineHeader}>
        <View style={[styles.timeColumnHeader, { width: TIME_COLUMN_WIDTH }]}>
          <Feather name="clock" size={14} color={colors.mutedForeground} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[styles.memberColumn, { width: columnWidth }]}>
            <Feather name="user" size={14} color={colors.mutedForeground} />
            <Text style={styles.memberName} numberOfLines={1}>Unassigned</Text>
          </View>
          {teamMembers.map(member => (
            <View key={member.id} style={[styles.memberColumn, { width: columnWidth }]}>
              <Feather name="user" size={14} color={colors.primary} />
              <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Timeline Grid */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.timelineContainer}
        contentContainerStyle={[styles.timelineContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <GestureHandlerRootView style={styles.timelineGrid}>
          {/* Time Labels */}
          <View style={[styles.timeColumn, { width: TIME_COLUMN_WIDTH }]}>
            {WORK_HOURS.map(hour => (
              <View key={hour} style={[styles.timeSlot, { height: HOUR_HEIGHT }]}>
                <Text style={styles.timeLabel}>{formatHour(hour)}</Text>
              </View>
            ))}
          </View>

          {/* Grid Lines and Drop Zones */}
          <View style={styles.gridArea}>
            {WORK_HOURS.map(hour => (
              <View 
                key={hour} 
                style={[
                  styles.hourRow, 
                  { height: HOUR_HEIGHT },
                  highlightedSlot?.hour === hour && styles.highlightedRow,
                ]}
              >
                <View style={styles.halfHourLine} />
              </View>
            ))}

            {/* Scheduled Jobs */}
            {scheduledJobs.map(job => {
              const position = getJobPosition(job);
              if (!position) return null;
              return <TimelineJobCard key={job.id} job={job} position={position} />;
            })}
          </View>
        </GestureHandlerRootView>
      </ScrollView>

      {/* Drag Indicator */}
      {draggedJob && (
        <View style={styles.dragIndicator}>
          <Feather name="move" size={16} color={colors.primaryForeground} />
          <Text style={styles.dragIndicatorText}>
            {highlightedSlot 
              ? `Drop to schedule at ${formatTimeString(highlightedSlot.time)}`
              : 'Drag to timeline to schedule'}
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  unscheduledSection: {
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.foreground,
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeText: {
    fontSize: 11,
    color: colors.primaryForeground,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
  },
  dragHint: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  unscheduledList: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  unscheduledJobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    width: 160,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  jobCardBorder: {
    height: 4,
    width: '100%',
  },
  jobCardContent: {
    padding: spacing.sm,
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  jobCardTitle: {
    fontSize: 13,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.foreground,
    flex: 1,
  },
  jobCardClient: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  jobCardAddress: {
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  emptyStateText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  timelineHeader: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    height: 44,
  },
  timeColumnHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  memberColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  memberName: {
    fontSize: 12,
    fontWeight: '500', fontFamily: 'Inter_500Medium',
    color: colors.foreground,
  },
  timelineContainer: {
    flex: 1,
  },
  timelineContent: {
    minHeight: WORK_HOURS.length * HOUR_HEIGHT,
  },
  timelineGrid: {
    flexDirection: 'row',
  },
  timeColumn: {
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  timeSlot: {
    justifyContent: 'flex-start',
    paddingTop: 4,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timeLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
    fontWeight: '500', fontFamily: 'Inter_500Medium',
  },
  gridArea: {
    flex: 1,
    position: 'relative',
  },
  hourRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    position: 'relative',
  },
  highlightedRow: {
    backgroundColor: `${colors.primary}25`,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  halfHourLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  timelineJobCard: {
    position: 'absolute',
    borderRadius: radius.md,
    borderLeftWidth: 3,
    padding: spacing.xs,
    overflow: 'hidden',
  },
  timelineJobTitle: {
    fontSize: 11,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
  },
  timelineJobTime: {
    fontSize: 10,
    color: 'rgba(0,0,0,0.6)',
    marginTop: 2,
  },
  dragIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.lg,
  },
  dragIndicatorText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
  },
});

export default DragDropDispatchBoard;
