/**
 * TimerSheet — phase selection + mode toggle for time logging.
 *
 * Live mode:   pick a phase, tap Start Timer.
 * Manual mode: pick a phase, set a duration (h + m) and optional date offset,
 *              tap Save Entry.  The entry is stored as a completed record so it
 *              goes straight into the time-entry list without leaving a running
 *              timer open.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppBottomSheet, AppBottomSheetRef } from '../ui/AppBottomSheet';
import { spacing, radius, typography, fontWeights, iconSizes } from '../../lib/design-tokens';
import { ThemeColors } from '../../lib/theme';
import api from '../../lib/api';
import { showToast } from '../../lib/toast';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimerSheetPhase {
  id: string;
  name: string;
  phaseCode: string | null;
}

export interface TimerSheetProps {
  visible: boolean;
  onDismiss: () => void;
  colors: ThemeColors;
  jobId: string;
  phases: TimerSheetPhase[];
  /** Pre-select a phase when opening (e.g. from the per-phase Start button). */
  initialPhaseId?: string;
  /** Whether the user has an active live timer on THIS job. */
  hasActiveTimer: boolean;
  /** Called after the sheet successfully starts a live timer. */
  onStartLiveTimer: (phaseId: string | undefined) => void;
  /** Called after a manual entry is saved so the parent can reload entries. */
  onManualEntrySaved: () => void;
}

type Mode = 'live' | 'manual';

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Date offset labels shown in manual mode. */
const DATE_OFFSETS = [
  { label: 'Today', days: 0 },
  { label: 'Yesterday', days: 1 },
  { label: '2 days ago', days: 2 },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function TimerSheet({
  visible,
  onDismiss,
  colors,
  jobId,
  phases,
  initialPhaseId,
  hasActiveTimer,
  onStartLiveTimer,
  onManualEntrySaved,
}: TimerSheetProps) {
  const [mode, setMode] = useState<Mode>('live');
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | undefined>(initialPhaseId);
  // Manual-entry state
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [dateOffset, setDateOffset] = useState(0); // 0 = today, -1 = custom
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync pre-selected phase whenever the sheet opens with a new initialPhaseId.
  useEffect(() => {
    if (visible) {
      setSelectedPhaseId(initialPhaseId);
      setMode('live');
      setHours(1);
      setMinutes(0);
      setDateOffset(0);
      setCustomDate(new Date());
      setShowCustomDatePicker(false);
      setNote('');
      setIsSaving(false);
    }
  }, [visible, initialPhaseId]);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const selectedPhase = phases.find((p) => p.id === selectedPhaseId) ?? null;
  const totalMinutes = hours * 60 + minutes;
  const durationLabel = `${hours}h ${pad2(minutes)}m`;
  const canSaveLive = !hasActiveTimer || true; // handled downstream by SWMS gate
  const canSaveManual = totalMinutes > 0 && !isSaving;

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handleLiveStart = () => {
    onStartLiveTimer(selectedPhaseId);
    onDismiss();
  };

  const handleManualSave = async () => {
    if (totalMinutes === 0) {
      showToast({ type: 'error', message: 'Set a duration first' });
      return;
    }
    setIsSaving(true);
    try {
      // Compute end time (end of the working window = now, shifted back by dateOffset days,
      // or the custom date picked by the user when dateOffset === -1).
      const endTime = dateOffset === -1 ? new Date(customDate) : new Date();
      if (dateOffset !== -1) endTime.setDate(endTime.getDate() - dateOffset);
      // Start time = end time minus duration
      const startTime = new Date(endTime.getTime() - totalMinutes * 60 * 1000);

      const body: Record<string, any> = {
        jobId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: totalMinutes,
        description: note.trim() || 'Manual entry',
        isManualEntry: true,
      };
      if (selectedPhaseId) body.phaseId = selectedPhaseId;

      const res = await api.post('/api/time-entries/manual', body);
      if (res.error) {
        showToast({ type: 'error', message: 'Could not save entry', description: res.error });
      } else {
        showToast({ type: 'success', message: 'Time entry saved', description: `${durationLabel} logged${selectedPhase ? ` to ${selectedPhase.phaseCode ?? selectedPhase.name}` : ''}` });
        onManualEntrySaved();
        onDismiss();
      }
    } catch (e: any) {
      showToast({ type: 'error', message: 'Could not save entry', description: e?.message ?? 'Unknown error' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Stepper helpers ───────────────────────────────────────────────────────────

  const adjustHours = (delta: number) => setHours((h) => clamp(h + delta, 0, 23));
  const adjustMinutes = (delta: number) => {
    setMinutes((m) => {
      const next = m + delta;
      if (next < 0) { adjustHours(-1); return 45; }
      if (next >= 60) { adjustHours(1); return 0; }
      return next;
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const footer = (
    <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm }}>
      {mode === 'live' ? (
        <TouchableOpacity
          onPress={handleLiveStart}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: spacing.sm, paddingVertical: 14, borderRadius: radius.lg,
            backgroundColor: colors.primary,
          }}
          activeOpacity={0.85}
        >
          <Feather name="play" size={16} color={colors.primaryForeground} />
          <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.primaryForeground }}>
            Start Timer{selectedPhase ? ` — ${selectedPhase.phaseCode ?? selectedPhase.name}` : ''}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={handleManualSave}
          disabled={!canSaveManual}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: spacing.sm, paddingVertical: 14, borderRadius: radius.lg,
            backgroundColor: canSaveManual ? colors.primary : colors.muted,
            opacity: isSaving ? 0.7 : 1,
          }}
          activeOpacity={0.85}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Feather name="check" size={16} color={canSaveManual ? colors.primaryForeground : colors.mutedForeground} />
          )}
          <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: canSaveManual ? colors.primaryForeground : colors.mutedForeground }}>
            {isSaving ? 'Saving...' : `Save ${durationLabel}`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <AppBottomSheet
      visible={visible}
      onDismiss={onDismiss}
      autoHeight
      scrollable={false}
      footer={footer}
    >
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: fontWeights.bold, color: colors.foreground }}>
              Log Time
            </Text>
            <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, marginTop: 2 }}>
              {mode === 'live' ? 'Start a live timer for this job' : 'Record hours you already worked'}
            </Text>
          </View>
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* ── Mode toggle ─────────────────────────────────────────────────── */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: colors.muted,
          borderRadius: radius.md,
          padding: 3,
          marginBottom: spacing.lg,
        }}>
          {(['live', 'manual'] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => setMode(m)}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, paddingVertical: 9, borderRadius: radius.sm - 1,
                  backgroundColor: active ? colors.card : 'transparent',
                  ...(active ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 } : {}),
                }}
                activeOpacity={0.8}
              >
                <Feather
                  name={m === 'live' ? 'play-circle' : 'edit-3'}
                  size={14}
                  color={active ? colors.primary : colors.mutedForeground}
                />
                <Text style={{
                  fontSize: typography.sizes.sm,
                  fontWeight: active ? fontWeights.semibold : fontWeights.medium,
                  color: active ? colors.foreground : colors.mutedForeground,
                }}>
                  {m === 'live' ? 'Live Timer' : 'Manual Entry'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Manual: active timer warning ─────────────────────────────────── */}
        {mode === 'manual' && hasActiveTimer && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            backgroundColor: `${colors.warning}15`, borderRadius: radius.md,
            padding: spacing.md, marginBottom: spacing.md,
          }}>
            <Feather name="alert-circle" size={14} color={colors.warning} />
            <Text style={{ flex: 1, fontSize: typography.sizes.sm, color: colors.warning }}>
              Stop your active timer before saving a manual entry.
            </Text>
          </View>
        )}

        {/* ── Manual: duration stepper ─────────────────────────────────────── */}
        {mode === 'manual' && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ fontSize: 11, fontWeight: fontWeights.bold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm }}>
              Duration
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: spacing.lg, backgroundColor: colors.muted, borderRadius: radius.lg, padding: spacing.lg,
            }}>
              {/* Hours */}
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                <TouchableOpacity onPress={() => adjustHours(1)} style={stepBtn(colors)} activeOpacity={0.7}>
                  <Feather name="chevron-up" size={18} color={colors.foreground} />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 36, fontWeight: fontWeights.bold, color: colors.foreground, lineHeight: 40 }}>
                    {pad2(hours)}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.mutedForeground, fontWeight: fontWeights.medium }}>hours</Text>
                </View>
                <TouchableOpacity onPress={() => adjustHours(-1)} style={stepBtn(colors)} activeOpacity={0.7} disabled={hours === 0}>
                  <Feather name="chevron-down" size={18} color={hours === 0 ? colors.border : colors.foreground} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 28, fontWeight: fontWeights.bold, color: colors.mutedForeground, marginBottom: 20 }}>:</Text>

              {/* Minutes */}
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                <TouchableOpacity onPress={() => adjustMinutes(15)} style={stepBtn(colors)} activeOpacity={0.7}>
                  <Feather name="chevron-up" size={18} color={colors.foreground} />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 36, fontWeight: fontWeights.bold, color: colors.foreground, lineHeight: 40 }}>
                    {pad2(minutes)}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.mutedForeground, fontWeight: fontWeights.medium }}>minutes</Text>
                </View>
                <TouchableOpacity onPress={() => adjustMinutes(-15)} style={stepBtn(colors)} activeOpacity={0.7} disabled={minutes === 0 && hours === 0}>
                  <Feather name="chevron-down" size={18} color={minutes === 0 && hours === 0 ? colors.border : colors.foreground} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick-set chips */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
              {[
                { label: '30m', h: 0, m: 30 },
                { label: '1h', h: 1, m: 0 },
                { label: '1.5h', h: 1, m: 30 },
                { label: '2h', h: 2, m: 0 },
                { label: '4h', h: 4, m: 0 },
                { label: '8h', h: 8, m: 0 },
              ].map((q) => {
                const active = hours === q.h && minutes === q.m;
                return (
                  <TouchableOpacity
                    key={q.label}
                    onPress={() => { setHours(q.h); setMinutes(q.m); }}
                    style={{
                      paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full,
                      backgroundColor: active ? colors.primary : colors.card,
                      borderWidth: 1, borderColor: active ? colors.primary : colors.cardBorder,
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.medium, color: active ? colors.primaryForeground : colors.foreground }}>
                      {q.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Manual: date selector ─────────────────────────────────────────── */}
        {mode === 'manual' && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ fontSize: 11, fontWeight: fontWeights.bold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm }}>
              Date
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {DATE_OFFSETS.map((d) => {
                const active = dateOffset === d.days;
                return (
                  <TouchableOpacity
                    key={d.days}
                    onPress={() => { setDateOffset(d.days); setShowCustomDatePicker(false); }}
                    style={{
                      flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md,
                      backgroundColor: active ? colors.primary : colors.card,
                      borderWidth: 1, borderColor: active ? colors.primary : colors.cardBorder,
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: active ? colors.primaryForeground : colors.foreground }}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {/* Custom date chip */}
              <TouchableOpacity
                onPress={() => { setDateOffset(-1); setShowCustomDatePicker(true); }}
                style={{
                  flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md,
                  backgroundColor: dateOffset === -1 ? colors.primary : colors.card,
                  borderWidth: 1, borderColor: dateOffset === -1 ? colors.primary : colors.cardBorder,
                }}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: dateOffset === -1 ? colors.primaryForeground : colors.foreground }}>
                  {dateOffset === -1
                    ? customDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
                    : 'Pick date'}
                </Text>
              </TouchableOpacity>
            </View>
            {showCustomDatePicker && (
              <DateTimePicker
                value={customDate}
                mode="date"
                maximumDate={new Date()}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => {
                  setShowCustomDatePicker(Platform.OS === 'ios');
                  if (date) setCustomDate(date);
                }}
              />
            )}
          </View>
        )}

        {/* ── Phase selector ────────────────────────────────────────────────── */}
        {phases.length > 0 && (
          <View style={{ marginBottom: mode === 'manual' ? spacing.sm : spacing.md }}>
            <Text style={{ fontSize: 11, fontWeight: fontWeights.bold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm }}>
              Phase
            </Text>
            <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden' }}>
              {/* No phase row */}
              <PhaseRow
                phaseCode={null}
                name="No phase"
                selected={selectedPhaseId === undefined}
                onPress={() => setSelectedPhaseId(undefined)}
                colors={colors}
                last={false}
              />
              {phases.map((p, i) => (
                <PhaseRow
                  key={p.id}
                  phaseCode={p.phaseCode}
                  name={p.name}
                  selected={selectedPhaseId === p.id}
                  onPress={() => setSelectedPhaseId(p.id)}
                  colors={colors}
                  last={i === phases.length - 1}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Manual: note field ─────────────────────────────────────────────── */}
        {mode === 'manual' && (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={{ fontSize: 11, fontWeight: fontWeights.bold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm }}>
              Note (optional)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="What were you working on?"
              placeholderTextColor={colors.mutedForeground}
              style={{
                backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
                borderRadius: radius.md, padding: spacing.md,
                fontSize: typography.body.fontSize, color: colors.foreground,
                minHeight: 48,
              }}
              maxLength={200}
              returnKeyType="done"
            />
          </View>
        )}
      </View>
    </AppBottomSheet>
  );
}

// ── PhaseRow ──────────────────────────────────────────────────────────────────

function PhaseRow({
  phaseCode,
  name,
  selected,
  onPress,
  colors,
  last,
}: {
  phaseCode: string | null;
  name: string;
  selected: boolean;
  onPress: () => void;
  colors: ThemeColors;
  last: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        paddingVertical: 13, paddingHorizontal: spacing.md,
        backgroundColor: selected ? `${colors.primary}0D` : colors.card,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.cardBorder,
      }}
    >
      {/* Phase code badge */}
      {phaseCode ? (
        <View style={{
          paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.sm,
          backgroundColor: selected ? colors.primary : `${colors.primary}18`,
          minWidth: 52, alignItems: 'center',
        }}>
          <Text style={{
            fontSize: 11, fontWeight: fontWeights.bold,
            color: selected ? colors.primaryForeground : colors.primary,
          }}>
            {phaseCode}
          </Text>
        </View>
      ) : (
        <View style={{
          paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.sm,
          backgroundColor: colors.muted, minWidth: 52, alignItems: 'center',
        }}>
          <Text style={{ fontSize: 11, fontWeight: fontWeights.medium, color: colors.mutedForeground }}>
            No phase
          </Text>
        </View>
      )}

      <Text style={{
        flex: 1, fontSize: typography.body.fontSize,
        fontWeight: selected ? fontWeights.semibold : fontWeights.regular,
        color: colors.foreground,
      }}>
        {name}
      </Text>

      {selected && (
        <Feather name="check" size={16} color={colors.primary} />
      )}
    </TouchableOpacity>
  );
}

// ── Stepper button style ──────────────────────────────────────────────────────

function stepBtn(colors: ThemeColors) {
  return {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  };
}
