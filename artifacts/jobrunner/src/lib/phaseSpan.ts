/**
 * Utility: span position for a phase block in the Job-view 7-day timeline.
 *
 * Exported separately so it can be unit-tested without a browser environment.
 */
import { format } from "date-fns";

export interface PhaseSpanInput {
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
}

/**
 * Returns the position of a phase within a week-view grid column.
 *
 * - "single"  — phase fits entirely in one day cell (or has no dates at all)
 * - "start"   — first visible day of a multi-day phase
 * - "middle"  — interior day of a multi-day phase
 * - "end"     — last visible day of a multi-day phase
 *
 * When scheduledStart or scheduledEnd is missing the phase is treated as a
 * single-day block so the renderer never throws on null/undefined dates.
 */
export function getPhaseSpanPosition(
  phase: PhaseSpanInput,
  day: Date,
  weekDays: Date[],
): "single" | "start" | "middle" | "end" {
  if (!phase.scheduledStart || !phase.scheduledEnd) return "single";
  const phaseStart = phase.scheduledStart.slice(0, 10);
  const phaseEnd   = phase.scheduledEnd.slice(0, 10);
  if (phaseStart === phaseEnd) return "single";

  // Days in the current view that fall inside this phase
  const activeDays = weekDays.filter(d => {
    const ds = format(d, "yyyy-MM-dd");
    return ds >= phaseStart && ds <= phaseEnd;
  });
  if (activeDays.length <= 1) return "single";

  const dayStr    = format(day, "yyyy-MM-dd");
  const firstActive = format(activeDays[0], "yyyy-MM-dd");
  const lastActive  = format(activeDays[activeDays.length - 1], "yyyy-MM-dd");

  if (dayStr === firstActive) return "start";
  if (dayStr === lastActive)  return "end";
  return "middle";
}
