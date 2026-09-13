/**
 * Tests for buildPhaseTimerOptions (mobile/src/utils/timerPhaseSelection).
 *
 * The key guarantee: when a project job has zero phases, buildPhaseTimerOptions
 * returns an empty array so the caller skips the action sheet and invokes its
 * callback immediately with phaseId=undefined.
 *
 * Secondary guarantees:
 *  - Non-project jobs (service calls) also skip the picker.
 *  - Jobs that haven't loaded yet also skip the picker.
 *  - Project jobs WITH phases return one "No phase" entry followed by one entry
 *    per phase, each carrying the correct phaseId.
 */

import { buildPhaseTimerOptions, type PhaseOption } from '../timerPhaseSelection';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PHASE_A: PhaseOption = { id: 'phase-aaa', phaseCode: 'P01', name: 'Foundations' };
const PHASE_B: PhaseOption = { id: 'phase-bbb', phaseCode: 'P02', name: 'Framing' };

// ─── 1. Skip conditions (empty array → caller must start immediately) ──────────

describe('buildPhaseTimerOptions — skip conditions (returns [])', () => {
  it('returns [] when the project has zero phases', () => {
    const result = buildPhaseTimerOptions({
      hasJob: true,
      isProject: true,
      phases: [],
    });
    expect(result).toHaveLength(0);
  });

  it('returns [] when the job is a service call (isProject=false)', () => {
    const result = buildPhaseTimerOptions({
      hasJob: true,
      isProject: false,
      phases: [PHASE_A],
    });
    expect(result).toHaveLength(0);
  });

  it('returns [] when the job has not yet loaded (hasJob=false)', () => {
    const result = buildPhaseTimerOptions({
      hasJob: false,
      isProject: true,
      phases: [PHASE_A],
    });
    expect(result).toHaveLength(0);
  });

  it('returns [] for a service call with zero phases', () => {
    const result = buildPhaseTimerOptions({
      hasJob: true,
      isProject: false,
      phases: [],
    });
    expect(result).toHaveLength(0);
  });
});

// ─── 2. Callback must fire with phaseId=undefined on skip ─────────────────────
//
// The caller (startTimerWithOptionalPhase) checks `actions.length === 0` and
// calls callback(undefined) directly. Simulate that pattern here.

describe('startTimerWithOptionalPhase pattern — zero-phase project', () => {
  it('invokes callback with phaseId=undefined and never calls showActionSheet', () => {
    const showActionSheet = jest.fn();
    const callback = jest.fn();

    // Replicate the in-component logic
    const actions = buildPhaseTimerOptions({
      hasJob: true,
      isProject: true,
      phases: [],
    });

    if (actions.length === 0) {
      callback(undefined);
    } else {
      showActionSheet({ title: 'Assign to phase?', actions });
    }

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(undefined);
    expect(showActionSheet).not.toHaveBeenCalled();
  });

  it('invokes callback with phaseId=undefined for a service-call job (no picker)', () => {
    const showActionSheet = jest.fn();
    const callback = jest.fn();

    const actions = buildPhaseTimerOptions({
      hasJob: true,
      isProject: false,
      phases: [],
    });

    if (actions.length === 0) {
      callback(undefined);
    } else {
      showActionSheet({ title: 'Assign to phase?', actions });
    }

    expect(callback).toHaveBeenCalledWith(undefined);
    expect(showActionSheet).not.toHaveBeenCalled();
  });
});

// ─── 3. Many-phase ordering, label format, and phaseId mapping ───────────────
//
// Regression guard: the picker must include every phase even when the project
// has many phases (5, 20, etc.) and must preserve input order.

/** Build N synthetic phases numbered 01…N. */
function makePhases(count: number): PhaseOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `phase-${String(i + 1).padStart(3, '0')}`,
    phaseCode: `P${String(i + 1).padStart(2, '0')}`,
    name: `Phase ${i + 1}`,
  }));
}

describe('buildPhaseTimerOptions — many phases (ordering, labels, phaseIds)', () => {
  describe('1 phase', () => {
    const phases = makePhases(1);
    let actions: ReturnType<typeof buildPhaseTimerOptions>;

    beforeAll(() => {
      actions = buildPhaseTimerOptions({ hasJob: true, isProject: true, phases });
    });

    it('returns 2 actions (1 sentinel + 1 phase)', () => {
      expect(actions).toHaveLength(2);
    });

    it('"No phase" is first with phaseId=undefined', () => {
      expect(actions[0].label).toBe('No phase');
      expect(actions[0].phaseId).toBeUndefined();
    });

    it('phase entry has correct label and phaseId', () => {
      expect(actions[1].label).toBe('P01 — Phase 1');
      expect(actions[1].phaseId).toBe('phase-001');
    });
  });

  describe('5 phases', () => {
    const phases = makePhases(5);
    let actions: ReturnType<typeof buildPhaseTimerOptions>;

    beforeAll(() => {
      actions = buildPhaseTimerOptions({ hasJob: true, isProject: true, phases });
    });

    it('returns 6 actions (1 sentinel + 5 phases)', () => {
      expect(actions).toHaveLength(6);
    });

    it('"No phase" sentinel is always first', () => {
      expect(actions[0].label).toBe('No phase');
      expect(actions[0].phaseId).toBeUndefined();
    });

    it('preserves input order across all 5 phases', () => {
      const returnedIds = actions.slice(1).map((a) => a.phaseId);
      expect(returnedIds).toEqual(phases.map((p) => p.id));
    });

    it('formats every phase label as "<phaseCode> — <name>"', () => {
      const returnedLabels = actions.slice(1).map((a) => a.label);
      const expectedLabels = phases.map((p) => `${p.phaseCode} — ${p.name}`);
      expect(returnedLabels).toEqual(expectedLabels);
    });

    it('maps every phase to the correct phaseId', () => {
      actions.slice(1).forEach((action, i) => {
        expect(action.phaseId).toBe(phases[i].id);
      });
    });
  });

  describe('20 phases', () => {
    const phases = makePhases(20);
    let actions: ReturnType<typeof buildPhaseTimerOptions>;

    beforeAll(() => {
      actions = buildPhaseTimerOptions({ hasJob: true, isProject: true, phases });
    });

    it('returns 21 actions (1 sentinel + 20 phases)', () => {
      expect(actions).toHaveLength(21);
    });

    it('"No phase" sentinel is always first', () => {
      expect(actions[0].label).toBe('No phase');
      expect(actions[0].phaseId).toBeUndefined();
    });

    it('preserves input order across all 20 phases', () => {
      const returnedIds = actions.slice(1).map((a) => a.phaseId);
      expect(returnedIds).toEqual(phases.map((p) => p.id));
    });

    it('formats every phase label as "<phaseCode> — <name>"', () => {
      const returnedLabels = actions.slice(1).map((a) => a.label);
      const expectedLabels = phases.map((p) => `${p.phaseCode} — ${p.name}`);
      expect(returnedLabels).toEqual(expectedLabels);
    });

    it('maps every phase to the correct phaseId', () => {
      actions.slice(1).forEach((action, i) => {
        expect(action.phaseId).toBe(phases[i].id);
      });
    });

    it('no two phase entries share the same phaseId', () => {
      const ids = actions.slice(1).map((a) => a.phaseId);
      expect(new Set(ids).size).toBe(20);
    });
  });
});

// ─── 4. Phase picker actions when phases exist ────────────────────────────────

describe('buildPhaseTimerOptions — phase list returned when phases exist', () => {
  it('includes a "No phase" entry as the first action', () => {
    const actions = buildPhaseTimerOptions({
      hasJob: true,
      isProject: true,
      phases: [PHASE_A],
    });
    expect(actions[0].label).toBe('No phase');
    expect(actions[0].phaseId).toBeUndefined();
  });

  it('returns one action per phase in addition to the "No phase" entry', () => {
    const actions = buildPhaseTimerOptions({
      hasJob: true,
      isProject: true,
      phases: [PHASE_A, PHASE_B],
    });
    // 1 "No phase" + 2 phases = 3
    expect(actions).toHaveLength(3);
  });

  it('maps each phase to its correct phaseId', () => {
    const actions = buildPhaseTimerOptions({
      hasJob: true,
      isProject: true,
      phases: [PHASE_A, PHASE_B],
    });
    const phaseIds = actions.slice(1).map((a) => a.phaseId);
    expect(phaseIds).toEqual(['phase-aaa', 'phase-bbb']);
  });

  it('formats the phase label as "<phaseCode> — <name>"', () => {
    const actions = buildPhaseTimerOptions({
      hasJob: true,
      isProject: true,
      phases: [PHASE_A],
    });
    expect(actions[1].label).toBe('P01 — Foundations');
  });

  it('handles a null phaseCode gracefully', () => {
    const phase: PhaseOption = { id: 'phase-ccc', phaseCode: null, name: 'Landscaping' };
    const actions = buildPhaseTimerOptions({
      hasJob: true,
      isProject: true,
      phases: [phase],
    });
    expect(actions[1].label).toBe(' — Landscaping');
    expect(actions[1].phaseId).toBe('phase-ccc');
  });

  it('shows the action sheet (not a skip) when phases exist', () => {
    const showActionSheet = jest.fn();
    const callback = jest.fn();

    const actions = buildPhaseTimerOptions({
      hasJob: true,
      isProject: true,
      phases: [PHASE_A],
    });

    if (actions.length === 0) {
      callback(undefined);
    } else {
      showActionSheet({ title: 'Assign to phase?', actions });
    }

    expect(showActionSheet).toHaveBeenCalledTimes(1);
    expect(callback).not.toHaveBeenCalled();
  });
});
