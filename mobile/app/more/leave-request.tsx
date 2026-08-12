import { useState, useCallback, useEffect } from 'react';
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

export default function LeaveRequestScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [myRequests, setMyRequests] = useState<TimeOff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [leaveType, setLeaveType] = useState('annual_leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [dateError, setDateError] = useState('');

  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get<TimeOff[]>('/api/team/time-off/my-requests');
      setMyRequests(res.data || []);
    } catch (err) {
      if (__DEV__) console.log('Error fetching leave requests:', err);
    }
  }, []);

  useEffect(() => {
    fetchRequests().finally(() => setIsLoading(false));
  }, [fetchRequests]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchRequests();
    setIsRefreshing(false);
  }, [fetchRequests]);

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

  const selectedLeaveType = LEAVE_TYPES.find((t) => t.value === leaveType) || LEAVE_TYPES[0];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Leave Requests',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowForm((v) => !v)}
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

          {/* My Requests */}
          <Text style={styles.sectionHeader}>My Leave Requests</Text>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing['3xl'] }} />
          ) : myRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="calendar" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No leave requests yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Tap "New" to submit a leave request
              </Text>
            </View>
          ) : (
            myRequests.map((req) => {
              const leaveTypeInfo = LEAVE_TYPES.find((t) => t.value === req.reason);
              const days = diffDays(req.startDate, req.endDate);
              const sc = statusColor(req.status, colors);
              return (
                <View key={req.id} style={styles.requestCard}>
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
                    <Text style={[styles.requestNotes, { color: colors.mutedForeground }]}>
                      "{req.notes}"
                    </Text>
                  ) : null}

                  {req.approverComment ? (
                    <View style={[styles.approverComment, { backgroundColor: colors.muted + '60' }]}>
                      <Feather name="message-circle" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.approverCommentText, { color: colors.mutedForeground }]}>
                        {req.approverComment}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })
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
