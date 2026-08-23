/**
 * ProjectGanttMobile — horizontally scrollable Gantt timeline for project phases.
 * Receives already-loaded phases from the parent (shares state, no extra API call).
 * Tapping a bar opens the phase edit bottom sheet via onEditPhase.
 *
 * Polish additions:
 *  - "Today" jump button in header that appears when the view has scrolled away from today
 *  - Dashed placeholder bar for undated phases instead of plain text
 *  - Auto-scroll to today on first render (preserved)
 */
import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
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
const DAY_W      = 26;
const ROW_H      = 42;
const HEADER_H   = 28;
const LABEL_W    = 104;

// ── Helpers ─────────────────────────────────────────────────────────────────
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
  const [showTodayButton, setShowTodayButton] = useState(false);
  const scrollXRef = useRef(0);

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
  const todayScrollX = Math.max(0, todayOff * DAY_W - 80);

  // Scroll to show today on mount
  useEffect(() => {
    if (scrollRef.current && todayOff > 0) {
      setTimeout(() => scrollRef.current?.scrollTo({ x: todayScrollX, animated: false }), 150);
    }
  }, [todayOff]);

  const handleScroll = useCallback((e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    scrollXRef.current = x;
    // Show "Today" button if scrolled more than 60px away from today's position
    const delta = Math.abs(x - todayScrollX);
    setShowTodayButton(delta > 60);
  }, [todayScrollX]);

  const jumpToToday = () => {
    scrollRef.current?.scrollTo({ x: todayScrollX, animated: true });
  };

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
        {/* Today jump button — appears when scrolled away */}
        {showTodayButton && todayOff >= 0 && todayOff < totalDays && (
          <TouchableOpacity
            onPress={jumpToToday}
            style={[styles.todayBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Feather name="target" size={11} color="#fff" />
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Gantt body */}
      <View style={styles.ganttBody}>
        {/* Fixed label column */}
        <View style={[styles.labelCol, { width: LABEL_W, borderRightColor: colors.border }]}>
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
          onScroll={handleScroll}
          scrollEventThrottle={16}
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
                      {/* Hours-burn fill overlay */}
                      {(() => {
                        const budgeted = parseFloat((phase as any).budgetedHours ?? '0') || 0;
                        const actual = (phase as any).actualHours ?? 0;
                        if (budgeted <= 0 || actual <= 0) return null;
                        const pct = Math.min(actual / budgeted, 1);
                        const fillColor = actual >= budgeted ? '#DC2626' : actual >= budgeted * 0.8 ? '#D97706' : '#16A34A';
                        return (
                          <View
                            pointerEvents="none"
                            style={{
                              position: 'absolute',
                              top: 0,
                              bottom: 0,
                              left: 0,
                              width: `${Math.round(pct * 100)}%` as any,
                              backgroundColor: fillColor,
                              borderRadius: 5,
                            }}
                          />
                        );
                      })()}
                      {bar.width > 44 && (
                        <Text
                          style={[styles.barLabel, { color: colorCfg.text, paddingRight: phase.assignedUserName ? 18 : 0 }]}
                          numberOfLines={1}
                        >
                          {bar.width > 80 ? phase.name : phase.phaseCode}
                        </Text>
                      )}
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
                    /* Dashed placeholder bar for undated phases */
                    <View
                      style={[
                        styles.dashedBar,
                        { borderColor: colors.border, left: 4, right: 4 },
                      ]}
                    >
                      <Text style={[styles.dashedBarLabel, { color: colors.mutedForeground }]}>
                        {canEdit ? 'Tap to set dates' : 'No dates'}
                      </Text>
                    </View>
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
              {status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
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
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: spacing.xs,
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: fontWeights.semibold,
    color: '#fff',
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
  dashedBar: {
    position: 'absolute',
    top: 9,
    bottom: 9,
    borderRadius: 5,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  dashedBarLabel: {
    fontSize: 9,
    fontStyle: 'italic',
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
