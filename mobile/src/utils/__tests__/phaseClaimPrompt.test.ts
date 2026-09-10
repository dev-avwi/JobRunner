/**
 * Tests for shouldShowPhaseClaimPrompt (mobile/src/utils/phaseClaimPrompt).
 *
 * Covers the three guarantees defined in the task:
 *  1. Saving a phase as complete (first time) shows the prompt for owners/managers.
 *  2. Re-completing a previously completed phase (re-opened then re-saved as
 *     complete) also shows the prompt for owners/managers.
 *  3. Workers (non-owner, non-manager) never see the prompt.
 */

import { shouldShowPhaseClaimPrompt } from '../phaseClaimPrompt';

// ─── Role fixtures ─────────────────────────────────────────────────────────────

const OWNER    = { isOwner: true,  isManager: false };
const MANAGER  = { isOwner: false, isManager: true  };
const BOTH     = { isOwner: true,  isManager: true  };
const WORKER   = { isOwner: false, isManager: false };

// ─── 1. Fresh completion ───────────────────────────────────────────────────────

describe('fresh completion (not_started → complete)', () => {
  it('shows the prompt for an owner', () => {
    expect(
      shouldShowPhaseClaimPrompt({ previousStatus: 'not_started', newStatus: 'complete', ...OWNER }),
    ).toBe(true);
  });

  it('shows the prompt for a manager', () => {
    expect(
      shouldShowPhaseClaimPrompt({ previousStatus: 'not_started', newStatus: 'complete', ...MANAGER }),
    ).toBe(true);
  });

  it('shows the prompt when the user is both owner and manager', () => {
    expect(
      shouldShowPhaseClaimPrompt({ previousStatus: 'not_started', newStatus: 'complete', ...BOTH }),
    ).toBe(true);
  });

  it('does NOT show the prompt for a worker', () => {
    expect(
      shouldShowPhaseClaimPrompt({ previousStatus: 'not_started', newStatus: 'complete', ...WORKER }),
    ).toBe(false);
  });
});

describe('fresh completion (in_progress → complete)', () => {
  it('shows the prompt for an owner', () => {
    expect(
      shouldShowPhaseClaimPrompt({ previousStatus: 'in_progress', newStatus: 'complete', ...OWNER }),
    ).toBe(true);
  });

  it('does NOT show the prompt for a worker', () => {
    expect(
      shouldShowPhaseClaimPrompt({ previousStatus: 'in_progress', newStatus: 'complete', ...WORKER }),
    ).toBe(false);
  });
});

// ─── 2. Re-completion (re-opened then re-saved as complete) ───────────────────

describe('re-completion after re-open (in_progress → complete, phase was previously complete)', () => {
  // After a phase is re-opened from 'complete', its status in the DB becomes
  // 'in_progress' (or 'not_started'). The prompt must fire again when the user
  // then saves it as complete a second time.

  it('shows the prompt for an owner on re-completion via in_progress', () => {
    expect(
      shouldShowPhaseClaimPrompt({ previousStatus: 'in_progress', newStatus: 'complete', ...OWNER }),
    ).toBe(true);
  });

  it('shows the prompt for a manager on re-completion via not_started', () => {
    expect(
      shouldShowPhaseClaimPrompt({ previousStatus: 'not_started', newStatus: 'complete', ...MANAGER }),
    ).toBe(true);
  });

  it('does NOT show the prompt for a worker on re-completion', () => {
    expect(
      shouldShowPhaseClaimPrompt({ previousStatus: 'in_progress', newStatus: 'complete', ...WORKER }),
    ).toBe(false);
  });
});

// ─── 3. No transition — already complete, saved as complete again ──────────────

describe('no-op save (complete → complete)', () => {
  // If the phase is already complete and the user saves it again without
  // changing the status, the prompt must NOT fire (avoid duplicate prompts).

  it('does NOT show the prompt for an owner when the phase is already complete', () => {
    expect(
      shouldShowPhaseClaimPrompt({ previousStatus: 'complete', newStatus: 'complete', ...OWNER }),
    ).toBe(false);
  });

  it('does NOT show the prompt for a manager when the phase is already complete', () => {
    expect(
      shouldShowPhaseClaimPrompt({ previousStatus: 'complete', newStatus: 'complete', ...MANAGER }),
    ).toBe(false);
  });
});

// ─── 4. Non-complete save ─────────────────────────────────────────────────────

describe('saving to a non-complete status', () => {
  it('does NOT show the prompt when saving as in_progress (owner)', () => {
    expect(
      shouldShowPhaseClaimPrompt({ previousStatus: 'not_started', newStatus: 'in_progress', ...OWNER }),
    ).toBe(false);
  });

  it('does NOT show the prompt when saving as invoiced (manager)', () => {
    expect(
      shouldShowPhaseClaimPrompt({ previousStatus: 'complete', newStatus: 'invoiced', ...MANAGER }),
    ).toBe(false);
  });
});
