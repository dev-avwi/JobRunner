/**
 * Tests for the auto-expand-in-progress-phase behaviour on the Tasks tab.
 *
 * Key invariant: navigating from Job A to Job B must still auto-expand Job
 * B's in-progress phase even when Job A's phases are still in state at the
 * start of the navigation (i.e. before Job B's loadPhases response arrives).
 *
 * The implementation uses two guards:
 *   - phasesOwnerJobIdRef  — set inside loadPhases; rejects any render cycle
 *     where `phases` still belongs to a previous job.
 *   - autoExpandedInProgressPhaseRef — keyed by job ID; prevents a second
 *     auto-expand firing on re-renders once it has run for the current job.
 */

import React, { useRef, useState, useEffect } from 'react';
import { act, create } from 'react-test-renderer';

interface Phase {
  id: string;
  status: string;
}

// Captures the latest state visible to each render so tests can inspect it.
let lastExpandedSet: Set<string> = new Set();
let lastAutoExpandedForJob: string | null = null;

interface Props {
  /** Current route job ID. */
  jobId: string | null;
  /** Phases currently in state (may still belong to a previous job). */
  phases: Phase[];
  /** Which job ID produced the current `phases` array (set by loadPhases). */
  phasesOwnerJobId: string | null;
  activeTab: string;
  isLoadingPhases: boolean;
}

/**
 * Minimal component that mirrors the corrected auto-expand logic from
 * job/[id].tsx so the behaviour can be verified without mounting the entire
 * job-detail screen.
 *
 * The two-ref guard pattern implemented here:
 *  1. phasesOwnerJobId prop ≡ phasesOwnerJobIdRef.current in production code
 *     (set by loadPhases after the async response resolves).
 *  2. autoExpandedInProgressPhaseRef stores the last job ID that was expanded.
 *
 * Auto-expand fires only when BOTH conditions hold:
 *  - phasesOwnerJobId === jobId  (phases are not stale)
 *  - autoExpandedInProgressPhaseRef.current !== jobId  (not already done)
 */
function AutoExpandHarness({
  jobId,
  phases,
  phasesOwnerJobId,
  activeTab,
  isLoadingPhases,
}: Props) {
  const autoExpandedInProgressPhaseRef = useRef<string | null>(null);
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());

  // Reset per-job expansion state when the job changes.
  useEffect(() => {
    setExpandedSet(new Set());
  }, [jobId]);

  // Auto-expand effect (mirrors the corrected one in job/[id].tsx).
  useEffect(() => {
    if (activeTab === 'tasks' && phases.length > 0 && !isLoadingPhases) {
      // Guard 1: only act when phases belong to the current job.
      // Guard 2: only act once per job (keyed ref prevents double-expand).
      if (phasesOwnerJobId === jobId && autoExpandedInProgressPhaseRef.current !== jobId) {
        const inProgress = phases.filter(p => p.status === 'in_progress');
        if (inProgress.length === 1) {
          autoExpandedInProgressPhaseRef.current = jobId;
          setExpandedSet(prev => {
            if (prev.has(inProgress[0].id)) return prev;
            const next = new Set(prev);
            next.add(inProgress[0].id);
            return next;
          });
        }
      }
    }
  }, [phases, phasesOwnerJobId, activeTab, isLoadingPhases, jobId]);

  lastExpandedSet = expandedSet;
  lastAutoExpandedForJob = autoExpandedInProgressPhaseRef.current;

  return null;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PHASE_A: Phase = { id: 'phase-a-1', status: 'in_progress' };
const PHASE_B: Phase = { id: 'phase-b-1', status: 'in_progress' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('autoExpandInProgressPhase', () => {
  beforeEach(() => {
    lastExpandedSet = new Set();
    lastAutoExpandedForJob = null;
  });

  it('auto-expands the single in-progress phase when phases first load', () => {
    act(() => {
      create(
        <AutoExpandHarness
          jobId="job-a"
          phases={[PHASE_A]}
          phasesOwnerJobId="job-a"
          activeTab="tasks"
          isLoadingPhases={false}
        />,
      );
    });

    expect(lastExpandedSet.has('phase-a-1')).toBe(true);
  });

  it('does not auto-expand when there are multiple in-progress phases', () => {
    const phases: Phase[] = [
      { id: 'p1', status: 'in_progress' },
      { id: 'p2', status: 'in_progress' },
    ];
    act(() => {
      create(
        <AutoExpandHarness
          jobId="job-a"
          phases={phases}
          phasesOwnerJobId="job-a"
          activeTab="tasks"
          isLoadingPhases={false}
        />,
      );
    });

    expect(lastExpandedSet.size).toBe(0);
  });

  it('does not auto-expand while phases are still loading', () => {
    act(() => {
      create(
        <AutoExpandHarness
          jobId="job-a"
          phases={[PHASE_A]}
          phasesOwnerJobId="job-a"
          activeTab="tasks"
          isLoadingPhases={true}
        />,
      );
    });

    expect(lastExpandedSet.size).toBe(0);
  });

  it('does not auto-expand when the Tasks tab is not active', () => {
    act(() => {
      create(
        <AutoExpandHarness
          jobId="job-a"
          phases={[PHASE_A]}
          phasesOwnerJobId="job-a"
          activeTab="overview"
          isLoadingPhases={false}
        />,
      );
    });

    expect(lastExpandedSet.size).toBe(0);
  });

  it('does not auto-expand when phases are stale (owner does not match current job)', () => {
    // This is the race condition: id has changed to job-b but phases in state
    // still belong to job-a (phasesOwnerJobId = 'job-a').
    act(() => {
      create(
        <AutoExpandHarness
          jobId="job-b"
          phases={[PHASE_A]}
          phasesOwnerJobId="job-a"
          activeTab="tasks"
          isLoadingPhases={false}
        />,
      );
    });

    // Must not expand any phase — neither job-a's nor job-b's.
    expect(lastExpandedSet.size).toBe(0);
    // Guard ref must not be consumed for job-b yet.
    expect(lastAutoExpandedForJob).toBeNull();
  });

  it('auto-expands the second job after the real async lifecycle: id changes first, then phases arrive', () => {
    // This test reproduces the exact race described in the code review:
    // 1. Job A is fully loaded and its phase is expanded.
    // 2. The user navigates to Job B: id = 'job-b', but phases in state still
    //    hold Job A's data and isLoadingPhases becomes true (load in flight).
    // 3. Job B's loadPhases response arrives: phases and phasesOwnerJobId
    //    both update to 'job-b', isLoadingPhases goes false.
    // Expected: only phase-b-1 is expanded.

    let renderer: ReturnType<typeof create>;

    // Step 1 — Job A fully loaded.
    act(() => {
      renderer = create(
        <AutoExpandHarness
          jobId="job-a"
          phases={[PHASE_A]}
          phasesOwnerJobId="job-a"
          activeTab="tasks"
          isLoadingPhases={false}
        />,
      );
    });
    expect(lastExpandedSet.has('phase-a-1')).toBe(true);

    // Step 2 — Navigate to Job B: id changes, phases still stale, loading.
    act(() => {
      renderer.update(
        <AutoExpandHarness
          jobId="job-b"
          phases={[PHASE_A]}        // stale — Job A's phase still in state
          phasesOwnerJobId="job-a"  // owner hasn't updated yet
          activeTab="tasks"
          isLoadingPhases={true}    // loadPhases in flight
        />,
      );
    });

    // The id-change reset effect cleared the set; stale phases must not expand.
    expect(lastExpandedSet.size).toBe(0);
    // The ref may still hold 'job-a' (the last job that was expanded) — that is
    // correct. What must NOT be true is that job-b has been recorded yet, which
    // would consume the guard before job-b's own phases arrive.
    expect(lastAutoExpandedForJob).not.toBe('job-b');

    // Step 3 — Job B's loadPhases response resolves: phases and owner updated.
    act(() => {
      renderer.update(
        <AutoExpandHarness
          jobId="job-b"
          phases={[PHASE_B]}
          phasesOwnerJobId="job-b"
          activeTab="tasks"
          isLoadingPhases={false}
        />,
      );
    });

    // Only Job B's phase should be expanded now.
    expect(lastExpandedSet.has('phase-b-1')).toBe(true);
    expect(lastExpandedSet.has('phase-a-1')).toBe(false);
    expect(lastAutoExpandedForJob).toBe('job-b');
  });

  it('does not re-trigger auto-expand on subsequent renders for the same job', () => {
    let renderer: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <AutoExpandHarness
          jobId="job-a"
          phases={[PHASE_A]}
          phasesOwnerJobId="job-a"
          activeTab="tasks"
          isLoadingPhases={false}
        />,
      );
    });

    expect(lastExpandedSet.has('phase-a-1')).toBe(true);
    expect(lastAutoExpandedForJob).toBe('job-a');

    // Re-render with identical props (e.g. a parent re-render). The ref check
    // must prevent a second auto-expand from firing.
    act(() => {
      renderer.update(
        <AutoExpandHarness
          jobId="job-a"
          phases={[PHASE_A]}
          phasesOwnerJobId="job-a"
          activeTab="tasks"
          isLoadingPhases={false}
        />,
      );
    });

    expect(lastAutoExpandedForJob).toBe('job-a');
    expect(lastExpandedSet.has('phase-a-1')).toBe(true);
  });

  it('auto-expands again after returning to a previously-visited job', () => {
    let renderer: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <AutoExpandHarness
          jobId="job-a"
          phases={[PHASE_A]}
          phasesOwnerJobId="job-a"
          activeTab="tasks"
          isLoadingPhases={false}
        />,
      );
    });
    expect(lastExpandedSet.has('phase-a-1')).toBe(true);

    // Navigate to Job B (fully loaded in one step for brevity).
    act(() => {
      renderer.update(
        <AutoExpandHarness
          jobId="job-b"
          phases={[PHASE_B]}
          phasesOwnerJobId="job-b"
          activeTab="tasks"
          isLoadingPhases={false}
        />,
      );
    });
    expect(lastExpandedSet.has('phase-b-1')).toBe(true);

    // Navigate back to Job A. The ref now holds 'job-b', so the guard fires
    // again for 'job-a' and re-expands its in-progress phase.
    act(() => {
      renderer.update(
        <AutoExpandHarness
          jobId="job-a"
          phases={[PHASE_A]}
          phasesOwnerJobId="job-a"
          activeTab="tasks"
          isLoadingPhases={false}
        />,
      );
    });

    expect(lastExpandedSet.has('phase-a-1')).toBe(true);
    expect(lastExpandedSet.has('phase-b-1')).toBe(false);
  });
});
