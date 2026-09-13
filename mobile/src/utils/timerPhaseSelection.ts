/**
 * Pure helpers for the "assign to phase" picker shown when a worker starts a
 * timer on a project job.
 *
 * Extracted from startTimerWithOptionalPhase in mobile/app/job/[id].tsx so the
 * skip-when-no-phases logic can be unit-tested without mounting the full screen.
 */

export interface PhaseOption {
  id: string;
  phaseCode: string | null;
  name: string;
}

export interface PhasePickerAction {
  /** Human-readable label shown in the action sheet. */
  label: string;
  /** undefined means "no phase / log against the job directly". */
  phaseId: string | undefined;
}

/**
 * Builds the ordered list of actions for the phase-picker action sheet.
 *
 * Returns an **empty array** when the picker should be skipped entirely:
 *  - the job hasn't loaded yet (`hasJob: false`)
 *  - the job is a service call, not a project (`isProject: false`)
 *  - the project has zero phases (`phases: []`)
 *
 * The caller must invoke its callback with `phaseId = undefined` immediately
 * when this function returns `[]`, matching the behaviour of
 * `startTimerWithOptionalPhase` in [id].tsx.
 */
export function buildPhaseTimerOptions(opts: {
  hasJob: boolean;
  isProject: boolean;
  phases: PhaseOption[];
}): PhasePickerAction[] {
  if (!opts.hasJob || !opts.isProject || opts.phases.length === 0) {
    return [];
  }

  return [
    { label: 'No phase', phaseId: undefined },
    ...opts.phases.map((p) => ({
      label: `${p.phaseCode ?? ''} — ${p.name}`,
      phaseId: p.id,
    })),
  ];
}
