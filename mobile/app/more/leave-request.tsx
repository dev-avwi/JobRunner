import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, fontWeights } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { showToast } from '../../src/lib/toast';

interface TimeOff {
  id: string;
  teamMemberId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  notes: string | null;
  approverComment: string | null;
  createdAt: string;
}

const LEAVE_TYPES = [
  { value: 'annual_leave', label: 'Annual Leave', icon: 'sun' as const },
  { value: 'sick_leave', label: 'Sick Leave', icon: 'heart' as const },
  { value: 'personal', label: 'Personal Leave', icon: 'user' as const },
  { value: 'other', label: 'Other', icon: 'more-horizontal' as const },
] as const;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function diffDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function statusColor(status: string, colors: ThemeColors): string {
  if (status === 'approved') return colors.success;
  if (status === 'rejected') return colors.destructive;
  return '#F59E0B';
}

function statusLabel(status: string): string {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Declined';
  return 'Pending';
}

/** Returns YYYY-MM-DD string for a local Date (avoids UTC shift) */
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Normalize any date value from the API to a plain YYYY-MM-DD string.
 * The API may return full ISO timestamps ("2026-08-14T00:00:00.000Z") or
 * date-only strings — in either case the first 10 characters are the date.
 */
function normDate(dateStr: string): string {
  return dateStr.substring(0, 10);
}

/** Add `days` calendar days to a YYYY-MM-DD string, returning a new YYYY-MM-DD. */
function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  // Use UTC noon to sidestep all DST/timezone edge cases
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return (
    date.getUTCFullYear() +
    '-' +
    String(date.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getUTCDate()).padStart(2, '0')
  );
}

/** Map from YYYY-MM-DD → best status colour for that day (approved > pending > rejected) */
function buildDayStatusMap(requests: TimeOff[], colors: ThemeColors): Record<string, string> {
  const map: Record<string, string> = {};
  const priority: Record<string, number> = { approved: 2, pending: 1, rejected: 0 };

  for (const req of requests) {
    const start = normDate(req.startDate);
    const end = normDate(req.endDate);
    let current = start;
    while (current <= end) {
      const existing = map[current];
      const existingPriority = existing
        ? (priority[Object.keys(priority).find((s) => statusColor(s, colors) === existing) ?? 'rejected'] ?? -1)
        : -1;
      const newPriority = priority[req.status] ?? 1;
      if (!existing || newPriority > existingPriority) {
        map[current] = statusColor(req.status, colors);
      }
      current = addDays(current, 1);
    }
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Month Calendar Component — two-tap range picker
// ─────────────────────────────────────────────────────────────────────────────

interface LeaveCalendarProps {
  requests: TimeOff[];
  rangeStart: string;
  rangeEnd: string;
  onDayPress: (day: string) => void;
  colors: ThemeColors;
}

function LeaveCalendar({ requests, rangeStart, rangeEnd, onDayPress, colors }: LeaveCalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  const dayStatusMap = buildDayStatusMap(requests, colors);

  // First day of month, total days, starting weekday
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0=Sun

  const monthLabel = firstOfMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const todayYMD = toYMD(today);

  // Build grid cells: nulls for padding + day numbers
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const pickingEnd = rangeStart && !rangeEnd;

  return (
    <View style={[calStyles.card, { backgroundColor: colors.card, ...shadows.sm }]}>
      {/* Header */}
      <View style={calStyles.header}>
        <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="chevron-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[calStyles.monthLabel, { color: colors.foreground }]}>{monthLabel}</Text>
        <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="chevron-right" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Day-of-week labels */}
      <View style={calStyles.weekRow}>
        {DAY_LABELS.map((d) => (
          <Text key={d} style={[calStyles.dayLabel, { color: colors.mutedForeground }]}>{d}</Text>
        ))}
      </View>

      {/* Day grid */}
      <View style={calStyles.grid}>
        {cells.map((day, idx) => {
          if (day === null) {
            return <View key={`pad-${idx}`} style={calStyles.cell} />;
          }
          const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dotColor = dayStatusMap[ymd];
          const isToday = ymd === todayYMD;
          const isStart = ymd === rangeStart;
          const isEnd = ymd === rangeEnd;
          const isEndpoint = isStart || isEnd;
          const isInRange =
            rangeStart && rangeEnd && ymd > rangeStart && ymd < rangeEnd;

          // Background strip for in-range days
          const rangeStripColor = colors.primary + '22';

          return (
            <TouchableOpacity
              key={ymd}
              onPress={() => onDayPress(ymd)}
              activeOpacity={0.7}
              style={calStyles.cell}
            >
              {/* Range band — full-width behind the circle */}
              {(isInRange || isStart || isEnd) && (
                <View
                  style={[
                    calStyles.rangeBand,
                    {
                      backgroundColor: isEndpoint ? colors.primary + '22' : rangeStripColor,
                      // Square off the band on the start side for start cell, end side for end cell
                      borderTopLeftRadius: isStart ? 99 : 0,
                      borderBottomLeftRadius: isStart ? 99 : 0,
                      borderTopRightRadius: isEnd ? 99 : 0,
                      borderBottomRightRadius: isEnd ? 99 : 0,
                    },
                  ]}
                />
              )}

              {/* Circle for today / selected endpoints */}
              <View
                style={[
                  calStyles.circle,
                  isEndpoint && { backgroundColor: colors.primary },
                  isToday && !isEndpoint && {
                    borderWidth: 1.5,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    calStyles.dayNum,
                    {
                      color: isEndpoint
                        ? '#fff'
                        : isToday
                        ? colors.primary
                        : colors.foreground,
                    },
                  ]}
                >
                  {day}
                </Text>
                {dotColor && !isEndpoint && (
                  <View style={[calStyles.dot, { backgroundColor: dotColor }]} />
                )}
                {dotColor && isEndpoint && (
                  <View style={[calStyles.dot, { backgroundColor: '#ffffff99' }]} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Hint / status row */}
      <View style={[calStyles.hintRow, { borderTopColor: colors.border }]}>
        {pickingEnd ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 }}>
            <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: colors.primary }} />
            <Text style={[calStyles.hintText, { color: colors.primary }]}>
              Now tap your last day of leave
            </Text>
            <TouchableOpacity
              onPress={() => onDayPress('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginLeft: 'auto' as any }}
            >
              <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>Clear</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, flex: 1 }}>
            <View style={calStyles.legendItem}>
              <View style={[calStyles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={[calStyles.legendText, { color: colors.mutedForeground }]}>Approved</Text>
            </View>
            <View style={calStyles.legendItem}>
              <View style={[calStyles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={[calStyles.legendText, { color: colors.mutedForeground }]}>Pending</Text>
            </View>
            <View style={calStyles.legendItem}>
              <View style={[calStyles.legendDot, { backgroundColor: colors.destructive }]} />
              <Text style={[calStyles.legendText, { color: colors.mutedForeground }]}>Declined</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthLabel: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: fontWeights.medium,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeBand: {
    position: 'absolute',
    top: '15%',
    bottom: '15%',
    left: 0,
    right: 0,
  },
  circle: {
    width: '72%',
    aspectRatio: 1,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: {
    fontSize: 13,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 28,
  },
  hintText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.medium,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: typography.sizes.xs,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

interface TeamTimeOff extends TimeOff {
  memberName?: string;
}

export default function LeaveRequestScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [myRequests, setMyRequests] = useState<TimeOff[]>([]);
  const [teamRequests, setTeamRequests] = useState<TeamTimeOff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');

  // Form state
  const [leaveType, setLeaveType] = useState('annual_leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [dateError, setDateError] = useState('');

  const scrollRef = useRef<ScrollView>(null);
  const itemOffsets = useRef<Record<string, number>>({});

  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get<TimeOff[]>('/api/team/time-off/my-requests');
      setMyRequests(res.data || []);
    } catch (err) {
      if (__DEV__) console.log('Error fetching leave requests:', err);
    }
  }, []);

  const fetchTeamRequests = useCallback(async () => {
    setIsLoadingTeam(true);
    try {
      const [teamRes, membersRes] = await Promise.all([
        api.get<TimeOff[]>('/api/team/time-off'),
        api.get<{ id: string; userId: string; name?: string; email?: string }[]>('/api/team-members').catch(() => ({ data: [] as any[] })),
      ]);
      const memberMap: Record<string, string> = {};
      for (const m of (membersRes.data || [])) {
        if (m.id) memberMap[m.id] = m.name || m.email || 'Team member';
      }
      const team: TeamTimeOff[] = (teamRes.data || []).map(r => ({
        ...r,
        memberName: memberMap[r.teamMemberId] || undefined,
      }));
      setTeamRequests(team);
    } catch (err) {
      if (__DEV__) console.log('Error fetching team leave:', err);
    } finally {
      setIsLoadingTeam(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests().finally(() => setIsLoading(false));
    fetchTeamRequests();
  }, [fetchRequests, fetchTeamRequests]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchRequests(), fetchTeamRequests()]);
    setIsRefreshing(false);
  }, [fetchRequests, fetchTeamRequests]);

  function validateDates(): boolean {
    if (!startDate || !endDate) {
      setDateError('Please enter both start and end dates.');
      return false;
    }
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      setDateError('Please enter valid dates (YYYY-MM-DD).');
      return false;
    }
    if (e < s) {
      setDateError('End date must be on or after the start date.');
      return false;
    }
    setDateError('');
    return true;
  }

  async function handleSubmit() {
    if (!validateDates()) return;
    setIsSubmitting(true);
    try {
      await api.post('/api/team/time-off/self-request', {
        startDate,
        endDate,
        reason: leaveType,
        notes: notes.trim() || undefined,
      });
      showToast({ type: 'success', message: 'Leave request submitted', description: 'Your manager will be notified.' });
      setShowForm(false);
      setStartDate('');
      setEndDate('');
      setNotes('');
      setLeaveType('annual_leave');
      await fetchRequests();
    } catch (err: any) {
      showToast({ type: 'error', message: 'Failed to submit', description: err?.message || 'Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Returns true if a leave request overlaps the selected day (YYYY-MM-DD) */
  function requestMatchesDay(req: TimeOff, day: string): boolean {
    if (!day) return false;
    return normDate(req.startDate) <= day && normDate(req.endDate) >= day;
  }

  function handleDayPress(day: string) {
    // Empty string = clear selection (tap "Clear" in hint row)
    if (!day) {
      setRangeStart('');
      setRangeEnd('');
      return;
    }

    // Phase 1: no start yet — set start
    if (!rangeStart) {
      setRangeStart(day);
      setRangeEnd('');
      return;
    }

    // Tapping the start again — cancel selection
    if (day === rangeStart && !rangeEnd) {
      setRangeStart('');
      setRangeEnd('');
      return;
    }

    // Phase 2: start is set, now pick end — swap if needed
    const start = day < rangeStart ? day : rangeStart;
    const end = day < rangeStart ? rangeStart : day;
    setRangeStart(start);
    setRangeEnd(end);

    // If there's an existing approved/pending request in this range, scroll to it
    const match = myRequests.find((r) => requestMatchesDay(r, start));
    if (match) {
      const offset = itemOffsets.current[match.id];
      if (offset !== undefined) {
        scrollRef.current?.scrollTo({ y: offset, animated: true });
      }
    }

    // Pre-fill the form with the selected range and open it
    setStartDate(start);
    setEndDate(end);
    setDateError('');
    setShowForm(true);
    setActiveTab('my');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  const selectedLeaveType = LEAVE_TYPES.find((t) => t.value === leaveType) || LEAVE_TYPES[0];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Leave',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => {
                setShowForm((v) => !v);
                setActiveTab('my');
                if (showForm) { setRangeStart(''); setRangeEnd(''); }
              }}
              style={{ marginRight: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Feather name={showForm ? 'x' : 'plus'} size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: fontWeights.medium, fontSize: 15 }}>
                {showForm ? 'Cancel' : 'New'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          keyboardShouldPersistTaps="handled"
        >

          {/* New Request Form */}
          {showForm && (
            <View style={[styles.card, { borderColor: colors.primary + '40', borderWidth: 1.5 }]}>
              <Text style={styles.cardTitle}>New Leave Request</Text>

              {/* Leave Type */}
              <Text style={styles.label}>Leave Type</Text>
              <View style={styles.typeRow}>
                {LEAVE_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => setLeaveType(t.value)}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor:
                          leaveType === t.value ? colors.primary : colors.card,
                        borderColor:
                          leaveType === t.value ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Feather
                      name={t.icon}
                      size={13}
                      color={leaveType === t.value ? '#fff' : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.typeChipText,
                        { color: leaveType === t.value ? '#fff' : colors.foreground },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Dates */}
              <View style={styles.dateRow}>
                <View style={styles.dateField}>
                  <Text style={styles.label}>Start Date</Text>
                  <TextInput
                    style={[styles.input, { borderColor: dateError ? colors.destructive : colors.border }]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.mutedForeground}
                    value={startDate}
                    onChangeText={setStartDate}
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.dateField}>
                  <Text style={styles.label}>End Date</Text>
                  <TextInput
                    style={[styles.input, { borderColor: dateError ? colors.destructive : colors.border }]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.mutedForeground}
                    value={endDate}
                    onChangeText={setEndDate}
                    keyboardType="numbers-and-punctuation"
                    autoCapitalize="none"
                  />
                </View>
              </View>
              {dateError ? (
                <Text style={[styles.errorText, { color: colors.destructive }]}>{dateError}</Text>
              ) : null}

              {/* Notes */}
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Reason or additional details..."
                placeholderTextColor={colors.mutedForeground}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Summary */}
              {startDate && endDate && !dateError && new Date(endDate) >= new Date(startDate) && (
                <View style={[styles.summaryBanner, { backgroundColor: colors.primary + '15' }]}>
                  <Feather name="calendar" size={14} color={colors.primary} />
                  <Text style={[styles.summaryText, { color: colors.primary }]}>
                    {selectedLeaveType.label} · {diffDays(startDate, endDate)} day{diffDays(startDate, endDate) !== 1 ? 's' : ''} ·{' '}
                    {formatDate(startDate)} → {formatDate(endDate)}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { backgroundColor: isSubmitting ? colors.muted : colors.primary },
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="send" size={15} color="#fff" />
                    <Text style={styles.submitBtnText}>Submit Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Month Calendar */}
          <LeaveCalendar
            requests={activeTab === 'my' ? myRequests : teamRequests}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onDayPress={handleDayPress}
            colors={colors}
          />

          {/* Tab switcher */}
          <View style={{ flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radius.lg, padding: 3, gap: 3 }}>
            {(['my', 'team'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[
                  { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md },
                  activeTab === tab && { backgroundColor: colors.card, ...shadows.sm },
                ]}
                onPress={() => { setActiveTab(tab); setRangeStart(''); setRangeEnd(''); }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontWeight: activeTab === tab ? fontWeights.semibold : fontWeights.regular, color: activeTab === tab ? colors.foreground : colors.mutedForeground }}>
                  {tab === 'my' ? 'My Leave' : 'Team Schedule'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'my' ? (
            <>
              {isLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: spacing['3xl'] }} />
              ) : myRequests.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="calendar" size={40} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No leave requests yet</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                    Tap + New above or tap any date on the calendar to request leave
                  </Text>
                </View>
              ) : (
                myRequests.map((req) => {
                  const leaveTypeInfo = LEAVE_TYPES.find((t) => t.value === req.reason);
                  const days = diffDays(req.startDate, req.endDate);
                  const sc = statusColor(req.status, colors);
                  const isHighlighted = rangeStart ? requestMatchesDay(req, rangeStart) : false;
                  return (
                    <View
                      key={req.id}
                      onLayout={(e) => { itemOffsets.current[req.id] = e.nativeEvent.layout.y; }}
                      style={[styles.requestCard, isHighlighted && { borderWidth: 2, borderColor: colors.primary }]}
                    >
                      <View style={styles.requestHeader}>
                        <View style={[styles.leaveTypePill, { backgroundColor: colors.primary + '15' }]}>
                          <Feather name={leaveTypeInfo?.icon || 'calendar'} size={12} color={colors.primary} />
                          <Text style={[styles.leaveTypeText, { color: colors.primary }]}>
                            {leaveTypeInfo?.label || req.reason.replace(/_/g, ' ')}
                          </Text>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: sc + '20' }]}>
                          <View style={[styles.statusDot, { backgroundColor: sc }]} />
                          <Text style={[styles.statusText, { color: sc }]}>{statusLabel(req.status)}</Text>
                        </View>
                      </View>
                      <View style={styles.requestDates}>
                        <Feather name="calendar" size={13} color={colors.mutedForeground} />
                        <Text style={[styles.requestDateText, { color: colors.foreground }]}>
                          {formatDate(req.startDate)} → {formatDate(req.endDate)}
                        </Text>
                        <Text style={[styles.requestDays, { color: colors.mutedForeground }]}>
                          {days} day{days !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      {req.notes ? (
                        <Text style={[styles.requestNotes, { color: colors.mutedForeground }]}>"{req.notes}"</Text>
                      ) : null}
                      {req.approverComment ? (
                        <View style={[styles.approverComment, { backgroundColor: colors.muted + '60' }]}>
                          <Feather name="message-circle" size={12} color={colors.mutedForeground} />
                          <Text style={[styles.approverCommentText, { color: colors.mutedForeground }]}>{req.approverComment}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </>
          ) : (
            <>
              {isLoadingTeam ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: spacing['3xl'] }} />
              ) : teamRequests.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="users" size={40} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No team leave scheduled</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Team leave requests will appear here</Text>
                </View>
              ) : (
                teamRequests.map((req) => {
                  const leaveTypeInfo = LEAVE_TYPES.find((t) => t.value === req.reason);
                  const days = diffDays(req.startDate, req.endDate);
                  const sc = statusColor(req.status, colors);
                  return (
                    <View key={req.id} style={styles.requestCard}>
                      <View style={styles.requestHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 }}>
                          <Feather name="user" size={13} color={colors.mutedForeground} />
                          <Text style={{ fontSize: 13, fontWeight: fontWeights.medium, color: colors.foreground }} numberOfLines={1}>
                            {req.memberName || 'Team member'}
                          </Text>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: sc + '20' }]}>
                          <View style={[styles.statusDot, { backgroundColor: sc }]} />
                          <Text style={[styles.statusText, { color: sc }]}>{statusLabel(req.status)}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <View style={[styles.leaveTypePill, { backgroundColor: colors.muted }]}>
                          <Feather name={leaveTypeInfo?.icon || 'calendar'} size={11} color={colors.mutedForeground} />
                          <Text style={[styles.leaveTypeText, { color: colors.mutedForeground }]}>
                            {leaveTypeInfo?.label || req.reason.replace(/_/g, ' ')}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.requestDates}>
                        <Feather name="calendar" size={13} color={colors.mutedForeground} />
                        <Text style={[styles.requestDateText, { color: colors.foreground }]}>
                          {formatDate(req.startDate)} → {formatDate(req.endDate)}
                        </Text>
                        <Text style={[styles.requestDays, { color: colors.mutedForeground }]}>
                          {days} day{days !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      padding: spacing.lg,
      gap: spacing.md,
      paddingBottom: 64,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.xl,
      gap: spacing.md,
      ...shadows.sm,
    },
    cardTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
      marginBottom: spacing.xs,
    },
    label: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
      marginBottom: spacing.xs,
    },
    typeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    typeChipText: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium,
    },
    dateRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    dateField: {
      flex: 1,
      gap: spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: spacing.md,
      fontSize: typography.sizes.sm,
      color: colors.foreground,
      backgroundColor: colors.background,
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    errorText: {
      fontSize: typography.sizes.xs,
      marginTop: -spacing.xs,
    },
    summaryBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.lg,
    },
    summaryText: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium,
      flex: 1,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.xl,
      marginTop: spacing.xs,
    },
    submitBtnText: {
      color: '#fff',
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.semibold,
    },
    sectionHeader: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
      marginTop: spacing.sm,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 48,
      gap: spacing.md,
    },
    emptyTitle: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.medium,
    },
    emptySubtitle: {
      fontSize: typography.sizes.sm,
      textAlign: 'center',
    },
    requestCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.sm,
      ...shadows.sm,
    },
    requestHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    leaveTypePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
    },
    leaveTypeText: {
      fontSize: typography.sizes.xs,
      fontWeight: fontWeights.medium,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: typography.sizes.xs,
      fontWeight: fontWeights.medium,
    },
    requestDates: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    requestDateText: {
      fontSize: typography.sizes.sm,
      flex: 1,
    },
    requestDays: {
      fontSize: typography.sizes.xs,
    },
    requestNotes: {
      fontSize: typography.sizes.sm,
      fontStyle: 'italic',
    },
    approverComment: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.md,
    },
    approverCommentText: {
      fontSize: typography.sizes.xs,
      flex: 1,
    },
  });
}
