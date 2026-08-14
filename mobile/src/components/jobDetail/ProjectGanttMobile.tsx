/**
 * ProjectGanttMobile — horizontally scrollable Gantt timeline for project phases.
 * Receives already-loaded phases from the parent (shares state, no extra API call).
 * Tapping a bar opens the phase edit bottom sheet via onEditPhase.
 */
import { useMemo, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemeColors } from '../../lib/theme';
import { spacing, radius, typography, fontWeights } from '../../lib/design-tokens';
import type { JobPhase } from './PhasesSection';

// ── Status colours (match PhasesSection STATUS_CONFIG) ─────────────────────
const STATUS_COLORS: Record<string, { bar: string; text: string }> = {
  not_started: { bar: '#E5E7EB', text: '#6B7280' },
  in_progress:  { bar: '#3B82F6', text: '#FFFFFF' },
  complete:     { bar: '#10B981', text: '#FFFFFF' },
  invoiced:     { bar: '#8B5CF6', text: '#FFFFFF' },
};

// ── Layout constants ────────────────────────────────────────────────────────
const DAY_W      = 26;  // px per day
const ROW_H      = 42;  // px per phase row
const HEADER_H   = 28;  // px for tick header
const LABEL_W    = 104; // px for fixed label column

// ── Helpers ─────────────────────────────────────────────────────────────────
/**
 * Parse a schedule date string as a LOCAL calendar date.
 * Phase dates arrive as "YYYY-MM-DD" or ISO timestamps (UTC midnight).
 * `new Date("2024-04-10T00:00:00Z")` becomes Apr 9 in UTC-offset zones.
 * We extract the first 10 chars and build a local Date(y, m, d) instead.
 */
function parseScheduleDate(s: string): Date {
  const parts = s.substring(0, 10).split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
function dayFloor(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function diffDays(a: Date, b: Date): number {
  return Math.round((dayFloor(a).getTime() - dayFloor(b).getTime()) / 86400000);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function fmtShort(d: Date): string {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function getInitials(name?: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] ?? '').toUpperCase();
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

// ── Component ────────────────────────────────────────────────────────────────
export interface ProjectGanttMobileProps {
  colors: ThemeColors;
  phases: JobPhase[];
  isTradie?: boolean;
  onEditPhase?: (phase: JobPhase) => void;
}

export function ProjectGanttMobile({
  colors,
  phases,
  isTradie = false,
  onEditPhase,
}: ProjectGanttMobileProps) {
  const scrollRef = useRef<ScrollView>(null);

  const sorted = useMemo(
    () => [...phases].sort((a, b) => a.sortOrder - b.sortOrder),
    [phases],
  );

  const today = useMemo(() => dayFloor(new Date()), []);

  const { rangeStart, totalDays } = useMemo(() => {
    const allDates: Date[] = [];
    for (const p of sorted) {
      if (p.scheduledStart) allDates.push(parseScheduleDate(p.scheduledStart));
      if (p.scheduledEnd)   allDates.push(parseScheduleDate(p.scheduledEnd));
    }
    if (allDates.length === 0) {
      return { rangeStart: addDays(today, -7), totalDays: 42 };
    }
    const minMs = Math.min(...allDates.map(d => d.getTime()));
    const maxMs = Math.max(...allDates.map(d => d.getTime()));
    const start = dayFloor(addDays(new Date(minMs), -5));
    const end   = addDays(new Date(maxMs), 12);
    const effectiveStart = start > today ? addDays(today, -5) : start;
    const effectiveEnd   = end   < today ? addDays(today, 12) : end;
    return {
      rangeStart: effectiveStart,
      totalDays:  Math.max(diffDays(effectiveEnd, effectiveStart) + 1, 28),
    };
  }, [sorted, today]);

  const gridWidth = totalDays * DAY_W;
  const todayOff  = diffDays(today, rangeStart);

  // Scroll to show today on mount
  useEffect(() => {
    if (scrollRef.current && todayOff > 0) {
      const scrollX = Math.max(0, todayOff * DAY_W - 80);
      setTimeout(() => scrollRef.current?.scrollTo({ x: scrollX, animated: false }), 150);
    }
  }, [todayOff]);

  // Generate weekly ticks
  const ticks = useMemo(() => {
    const out: { label: string; offset: number }[] = [];
    for (let i = 0; i < totalDays; i += 7) {
      out.push({ label: fmtShort(addDays(rangeStart, i)), offset: i });
    }
    return out;
  }, [rangeStart, totalDays]);

  function getBar(phase: JobPhase) {
    const hasStart = !!phase.scheduledStart;
    const hasEnd   = !!phase.scheduledEnd;
    if (!hasStart && !hasEnd) return null;
    const s = hasStart ? Math.max(0, diffDays(parseScheduleDate(phase.scheduledStart!), rangeStart)) : 0;
    const e = hasEnd
      ? Math.min(totalDays, diffDays(parseScheduleDate(phase.scheduledEnd!), rangeStart) + 1)
      : s + 3;
    return { left: s * DAY_W, width: Math.max(e - Math.max(0, s), 1) * DAY_W };
  }

  if (sorted.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      {/* Header */}
      <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
        <Feather name="bar-chart-2" size={14} color={colors.primary} />
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Project Timeline</Text>
        <View style={[styles.phaseCountBadge, { backgroundColor: colors.muted }]}>
          <Text style={[styles.phaseCountText, { color: colors.mutedForeground }]}>
            {sorted.length} phases
          </Text>
        </View>
      </View>

      {/* Gantt body */}
      <View style={styles.ganttBody}>
        {/* Fixed label column */}
        <View style={[styles.labelCol, { width: LABEL_W, borderRightColor: colors.border }]}>
          {/* Header spacer */}
          <View style={[styles.labelHeader, { height: HEADER_H, backgroundColor: colors.muted + '40', borderBottomColor: colors.border }]} />

          {sorted.map((phase, idx) => (
            <View
              key={phase.id}
              style={[
                styles.labelRow,
                {
                  height: ROW_H,
                  borderBottomColor: colors.border,
                  borderBottomWidth: idx < sorted.length - 1 ? 1 : 0,
                },
              ]}
            >
              <Text style={[styles.phaseCodeText, { color: colors.primary }]} numberOfLines={1}>
                {phase.phaseCode}
              </Text>
              <Text style={[styles.phaseNameText, { color: colors.foreground }]} numberOfLines={2}>
                {phase.name}
              </Text>
            </View>
          ))}
        </View>

        {/* Scrollable grid */}
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          style={styles.gridScroll}
        >
          <View style={{ width: gridWidth }}>
            {/* Tick header */}
            <View
              style={[
                styles.tickHeader,
                { height: HEADER_H, backgroundColor: colors.muted + '40', borderBottomColor: colors.border },
              ]}
            >
              {ticks.map(t => (
                <View key={t.offset} style={[styles.tickItem, { left: t.offset * DAY_W }]}>
                  <Text style={[styles.tickLabel, { color: colors.mutedForeground }]}>
                    {t.label}
                  </Text>
                </View>
              ))}
              {/* Today indicator in header */}
              {todayOff >= 0 && todayOff < totalDays && (
                <View
                  style={[
                    styles.todayHeaderDot,
                    { left: todayOff * DAY_W + DAY_W / 2 - 3, backgroundColor: colors.primary },
                  ]}
                />
              )}
            </View>

            {/* Today vertical line */}
            {todayOff >= 0 && todayOff < totalDays && (
              <View
                pointerEvents="none"
                style={[
                  styles.todayLine,
                  {
                    left: todayOff * DAY_W + DAY_W / 2 - 1,
                    backgroundColor: colors.primary + '55',
                    top: HEADER_H,
                    height: sorted.length * ROW_H,
                  },
                ]}
              />
            )}

            {/* Phase rows */}
            {sorted.map((phase, idx) => {
              const bar = getBar(phase);
              const colorCfg = STATUS_COLORS[phase.status] ?? STATUS_COLORS.not_started;
              const canEdit = !isTradie && !!onEditPhase;

              return (
                <TouchableOpacity
                  key={phase.id}
                  style={[
                    styles.phaseRow,
                    {
                      height: ROW_H,
                      borderBottomColor: colors.border,
                      borderBottomWidth: idx < sorted.length - 1 ? 1 : 0,
                      backgroundColor: idx % 2 === 1 ? colors.muted + '18' : 'transparent',
                    },
                  ]}
                  onPress={() => canEdit && onEditPhase!(phase)}
                  activeOpacity={canEdit ? 0.7 : 1}
                  disabled={!canEdit}
                >
                  {/* Vertical grid lines */}
                  {ticks.map(t => (
                    <View
                      key={t.offset}
                      style={[styles.gridLine, { left: t.offset * DAY_W, borderColor: colors.border + '50' }]}
                    />
                  ))}

                  {bar ? (
                    <View
                      style={[
                        styles.bar,
                        {
                          left: bar.left + 2,
                          width: Math.max(bar.width - 4, 4),
                          backgroundColor: colorCfg.bar,
                        },
                      ]}
                    >
                      {bar.width > 44 && (
                        <Text
                          style={[styles.barLabel, { color: colorCfg.text, paddingRight: phase.assignedUserName ? 18 : 0 }]}
                          numberOfLines={1}
                        >
                          {bar.width > 80 ? phase.name : phase.phaseCode}
                        </Text>
                      )}
                      {/* Assignee initials badge — right end of bar */}
                      {phase.assignedUserName && bar.width > 20 && (
                        <View
                          style={[
                            styles.ganttAssigneeBadge,
                            { backgroundColor: 'rgba(255,255,255,0.30)' },
                          ]}
                        >
                          <Text style={[styles.ganttAssigneeBadgeText, { color: colorCfg.text }]}>
                            {getInitials(phase.assignedUserName)}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text
                      style={[styles.noDateLabel, { color: colors.mutedForeground }]}
                    >
                      {canEdit ? 'Tap to set dates' : 'No dates'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Legend strip */}
      <View style={[styles.legend, { borderTopColor: colors.border }]}>
        {Object.entries(STATUS_COLORS).map(([status, { bar }]) => (
          <View key={status} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: bar }]} />
            <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>
              {status.replace(/_/g, ' ')}
            </Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.legendTodayLine, { backgroundColor: '#3B82F6' + '88' }]} />
          <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>today</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  cardTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: fontWeights.semibold,
    marginLeft: 4,
    flex: 1,
  },
  phaseCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  phaseCountText: {
    fontSize: 10,
    fontWeight: fontWeights.medium,
  },
  ganttBody: {
    flexDirection: 'row',
  },
  labelCol: {
    borderRightWidth: 1,
  },
  labelHeader: {
    borderBottomWidth: 1,
  },
  labelRow: {
    flexDirection: 'column',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  phaseCodeText: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: fontWeights.bold,
    letterSpacing: 0.3,
  },
  phaseNameText: {
    fontSize: 11,
    fontWeight: fontWeights.medium,
    lineHeight: 14,
  },
  gridScroll: {
    flex: 1,
  },
  tickHeader: {
    position: 'relative',
    borderBottomWidth: 1,
  },
  tickItem: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingLeft: 3,
  },
  tickLabel: {
    fontSize: 9,
  },
  todayHeaderDot: {
    position: 'absolute',
    top: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  todayLine: {
    position: 'absolute',
    width: 2,
    zIndex: 5,
  },
  phaseRow: {
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
  },
  bar: {
    position: 'absolute',
    top: 7,
    bottom: 7,
    borderRadius: 5,
    justifyContent: 'center',
    paddingHorizontal: 5,
    overflow: 'hidden',
  },
  barLabel: {
    fontSize: 9,
    fontWeight: fontWeights.semibold,
  },
  noDateLabel: {
    fontSize: 10,
    fontStyle: 'italic',
    paddingLeft: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 6,
    borderRadius: 3,
  },
  legendTodayLine: {
    width: 2,
    height: 12,
    borderRadius: 1,
  },
  legendLabel: {
    fontSize: 10,
  },
  ganttAssigneeBadge: {
    position: 'absolute',
    right: 3,
    top: '50%' as any,
    marginTop: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ganttAssigneeBadgeText: {
    fontSize: 7,
    fontWeight: '700' as any,
    lineHeight: 8,
  },
});

export default ProjectGanttMobile;
