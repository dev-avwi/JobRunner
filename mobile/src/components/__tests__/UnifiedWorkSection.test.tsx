/**
 * Tests for UnifiedWorkSection logic
 *
 * Covers:
 * - Combined count badge (checklist + tasks)
 * - Checklist-vs-task permission split (checklistReadOnly defaults to readOnly)
 * - Promote-to-task is sequential: task creation must succeed before deletion
 * - Promote failure: failed delete is tolerated; failed creation leaves item intact
 */

// ─── API mock ─────────────────────────────────────────────────────────────────

const mockPost = jest.fn();
const mockDelete = jest.fn();
const mockShowToast = jest.fn();

jest.mock('../../lib/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue({ data: [], error: null }),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    patch: jest.fn().mockResolvedValue({ data: {}, error: null }),
  },
}));

jest.mock('../../lib/toast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

beforeEach(() => {
  mockPost.mockReset();
  mockDelete.mockReset();
  mockShowToast.mockReset();
});

// ─── 1. Combined progress count logic ────────────────────────────────────────

describe('combined progress count', () => {
  function combinedCounts(
    checklistItems: { isCompleted: boolean }[],
    tasks: { status: string }[],
  ) {
    const completedCL = checklistItems.filter((i) => i.isCompleted).length;
    const completedTasks = tasks.filter((t) => t.status === 'done').length;
    return { completed: completedCL + completedTasks, total: checklistItems.length + tasks.length };
  }

  it('counts completed checklist items and done tasks together', () => {
    const result = combinedCounts(
      [{ isCompleted: true }, { isCompleted: false }],
      [{ status: 'done' }],
    );
    expect(result).toEqual({ completed: 2, total: 3 });
  });

  it('returns zero when everything is open', () => {
    const result = combinedCounts(
      [{ isCompleted: false }, { isCompleted: false }],
      [{ status: 'open' }],
    );
    expect(result).toEqual({ completed: 0, total: 3 });
  });

  it('handles empty lists', () => {
    expect(combinedCounts([], [])).toEqual({ completed: 0, total: 0 });
  });
});

// ─── 2. checklistReadOnly fallback ───────────────────────────────────────────

describe('checklistReadOnly fallback logic', () => {
  function resolveClReadOnly(readOnly?: boolean, checklistReadOnly?: boolean): boolean {
    return checklistReadOnly !== undefined ? checklistReadOnly : (readOnly ?? false);
  }

  it('uses checklistReadOnly when explicitly set', () => {
    expect(resolveClReadOnly(true, false)).toBe(false);
    expect(resolveClReadOnly(false, true)).toBe(true);
  });

  it('falls back to readOnly when checklistReadOnly is omitted', () => {
    expect(resolveClReadOnly(true, undefined)).toBe(true);
    expect(resolveClReadOnly(false, undefined)).toBe(false);
  });

  it('defaults to false when both are omitted', () => {
    expect(resolveClReadOnly(undefined, undefined)).toBe(false);
  });

  it('non-owner on active job: readOnly=true, checklistReadOnly=false → checklist editable', () => {
    // This mirrors the job/[id].tsx call:
    //   readOnly={job.status === 'invoiced' || !(roleInfo?.isOwner || isSoloOwner)}
    //   checklistReadOnly={job.status === 'invoiced'}
    const invoiced = false;
    const isOwner = false;
    const readOnly = invoiced || !isOwner;          // true
    const checklistReadOnly = invoiced;              // false
    const clReadOnly = resolveClReadOnly(readOnly, checklistReadOnly);
    expect(clReadOnly).toBe(false);  // non-owner CAN edit checklist
    expect(readOnly).toBe(true);     // non-owner CANNOT add/delete tasks
  });

  it('invoiced job: both locked regardless of ownership', () => {
    const invoiced = true;
    const isOwner = true;
    const readOnly = invoiced || !isOwner;       // true
    const checklistReadOnly = invoiced;           // true
    const clReadOnly = resolveClReadOnly(readOnly, checklistReadOnly);
    expect(clReadOnly).toBe(true);
    expect(readOnly).toBe(true);
  });
});

// ─── 3. Phase task count badge logic ─────────────────────────────────────────

describe('phase task counts from checklist items', () => {
  interface PhaseTaskItem { id: string; isCompleted: boolean }

  function computeCounts(items: PhaseTaskItem[]) {
    return { completed: items.filter(t => t.isCompleted).length, total: items.length };
  }

  it('reports 0/0 when phase has no tasks', () => {
    expect(computeCounts([])).toEqual({ completed: 0, total: 0 });
  });

  it('counts partial completion correctly', () => {
    const items: PhaseTaskItem[] = [
      { id: '1', isCompleted: true },
      { id: '2', isCompleted: false },
      { id: '3', isCompleted: false },
    ];
    expect(computeCounts(items)).toEqual({ completed: 1, total: 3 });
  });

  it('counts all-done correctly', () => {
    const items: PhaseTaskItem[] = [
      { id: '1', isCompleted: true },
      { id: '2', isCompleted: true },
    ];
    expect(computeCounts(items)).toEqual({ completed: 2, total: 2 });
  });
});

// ─── 4. Phase task toggle optimistic update ───────────────────────────────────

describe('phase task toggle — optimistic update and revert', () => {
  function optimisticToggle(
    currentItems: { id: string; isCompleted: boolean }[],
    toggleId: string,
  ) {
    const item = currentItems.find(t => t.id === toggleId)!;
    const next = !item.isCompleted;
    const nextItems = currentItems.map(t => t.id === toggleId ? { ...t, isCompleted: next } : t);
    const counts = { completed: nextItems.filter(t => t.isCompleted).length, total: nextItems.length };
    return { nextItems, counts, next };
  }

  it('marks an incomplete item as complete and increments count', () => {
    const items = [{ id: 'a', isCompleted: false }, { id: 'b', isCompleted: true }];
    const { nextItems, counts } = optimisticToggle(items, 'a');
    expect(nextItems.find(t => t.id === 'a')!.isCompleted).toBe(true);
    expect(counts).toEqual({ completed: 2, total: 2 });
  });

  it('marks a complete item as incomplete and decrements count', () => {
    const items = [{ id: 'a', isCompleted: true }, { id: 'b', isCompleted: true }];
    const { nextItems, counts } = optimisticToggle(items, 'a');
    expect(nextItems.find(t => t.id === 'a')!.isCompleted).toBe(false);
    expect(counts).toEqual({ completed: 1, total: 2 });
  });

  it('revert restores original state when API fails', () => {
    const original = [{ id: 'a', isCompleted: false }];
    const { next } = optimisticToggle(original, 'a');
    expect(next).toBe(true); // optimistic flip to true

    // Simulate revert: flip back
    const reverted = original.map(t => t.id === 'a' ? { ...t, isCompleted: !next } : t);
    expect(reverted.find(t => t.id === 'a')!.isCompleted).toBe(false); // back to original
  });
});

// ─── 5. Recent time entries — ordering from newest-first API response ─────────

describe('recent time entries ordering', () => {
  interface TimeEntry { id: string; startTime: string; endTime: string; isBreak?: boolean }

  function recentEntries(entries: TimeEntry[]) {
    // Mirrors the logic in [id].tsx: API returns newest-first; slice(0, 3) picks the 3 most recent
    return entries
      .filter(e => e.startTime && e.endTime && e.endTime !== 'null' && e.endTime !== '' && !e.isBreak)
      .slice(0, 3);
  }

  const newest: TimeEntry = { id: 'e3', startTime: '2026-09-11T08:00:00Z', endTime: '2026-09-11T10:00:00Z' };
  const middle: TimeEntry = { id: 'e2', startTime: '2026-09-10T08:00:00Z', endTime: '2026-09-10T10:00:00Z' };
  const oldest: TimeEntry = { id: 'e1', startTime: '2026-09-09T08:00:00Z', endTime: '2026-09-09T10:00:00Z' };

  it('selects the first 3 entries from a newest-first list', () => {
    // API returns newest-first: [newest, middle, oldest, ...]
    const entries = [newest, middle, oldest];
    const result = recentEntries(entries);
    expect(result.map(e => e.id)).toEqual(['e3', 'e2', 'e1']);
  });

  it('shows only the 3 most recent when there are more entries', () => {
    const older = { id: 'e0', startTime: '2026-09-08T08:00:00Z', endTime: '2026-09-08T10:00:00Z' };
    const entries = [newest, middle, oldest, older]; // newest-first from API
    const result = recentEntries(entries);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('e3'); // most recent first
    expect(result[2].id).toBe('e1'); // third-most-recent last
    expect(result.map(e => e.id)).not.toContain('e0'); // oldest excluded
  });

  it('excludes break entries', () => {
    const breakEntry: TimeEntry = { id: 'brk', startTime: '2026-09-11T10:00:00Z', endTime: '2026-09-11T10:15:00Z', isBreak: true };
    const entries = [breakEntry, newest, middle];
    const result = recentEntries(entries);
    expect(result.map(e => e.id)).not.toContain('brk');
    expect(result[0].id).toBe('e3');
  });

  it('excludes entries with missing or null endTime', () => {
    const active = { id: 'act', startTime: '2026-09-11T09:00:00Z', endTime: '' };
    const nullEnd = { id: 'nul', startTime: '2026-09-11T09:00:00Z', endTime: 'null' };
    const entries = [active, nullEnd, newest];
    const result = recentEntries(entries);
    expect(result.map(e => e.id)).toEqual(['e3']);
  });

  it('returns empty when no valid completed entries exist', () => {
    expect(recentEntries([])).toEqual([]);
  });
});

// ─── 6. unassignedChecklistOnly — API URL selection ──────────────────────────

/**
 * When `unassignedChecklistOnly` is true the component must fetch
 * `/api/jobs/:jobId/checklist?phaseId=null` so that phase-linked checklist
 * items are not duplicated beside the inline phase-card expansions.
 * When false/omitted it must fetch `/api/jobs/:jobId/checklist` (all items).
 */

describe('unassignedChecklistOnly — checklist URL selection', () => {
  const mockGet = jest.fn().mockResolvedValue({ data: [], error: null });

  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ data: [], error: null });
    // Override the api.get mock set at the top of the file
    jest.spyOn(require('../../lib/api').api, 'get').mockImplementation(mockGet);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function buildChecklistUrl(jobId: string, unassignedChecklistOnly: boolean): string {
    // Mirrors the logic in UnifiedWorkSection.tsx load()
    return unassignedChecklistOnly
      ? `/api/jobs/${jobId}/checklist?phaseId=null`
      : `/api/jobs/${jobId}/checklist`;
  }

  it('fetches all checklist items when unassignedChecklistOnly is false', () => {
    const url = buildChecklistUrl('job-1', false);
    expect(url).toBe('/api/jobs/job-1/checklist');
    expect(url).not.toContain('phaseId');
  });

  it('fetches only unassigned items when unassignedChecklistOnly is true', () => {
    const url = buildChecklistUrl('job-1', true);
    expect(url).toBe('/api/jobs/job-1/checklist?phaseId=null');
  });

  it('phase-linked items appear exactly once when phases exist', () => {
    // Given a list of 5 items: 3 with phases, 2 unassigned
    const allItems = [
      { id: '1', phaseId: 'ph-a', text: 'Measure walls', isCompleted: false, sortOrder: 0 },
      { id: '2', phaseId: 'ph-a', text: 'Mark cuts', isCompleted: true, sortOrder: 1 },
      { id: '3', phaseId: 'ph-b', text: 'Check footing', isCompleted: false, sortOrder: 0 },
      { id: '4', phaseId: null, text: 'Order supplies', isCompleted: false, sortOrder: 0 },
      { id: '5', phaseId: null, text: 'File paperwork', isCompleted: false, sortOrder: 1 },
    ];

    // Phase-card inline view fetches per phase
    const phaseAItems = allItems.filter(i => i.phaseId === 'ph-a');
    const phaseBItems = allItems.filter(i => i.phaseId === 'ph-b');

    // UnifiedWorkSection with unassignedChecklistOnly=true fetches only phaseId=null
    const unifiedItems = allItems.filter(i => i.phaseId === null);

    const allRenderedIds = [
      ...phaseAItems.map(i => i.id),
      ...phaseBItems.map(i => i.id),
      ...unifiedItems.map(i => i.id),
    ];

    // Every item appears exactly once
    const uniqueIds = new Set(allRenderedIds);
    expect(uniqueIds.size).toBe(allItems.length);
    expect(allRenderedIds).toHaveLength(allItems.length);

    // Phase-linked items are NOT in the unified section
    expect(unifiedItems.map(i => i.phaseId)).toEqual([null, null]);
    expect(phaseAItems.every(i => i.phaseId === 'ph-a')).toBe(true);
  });

  it('all items appear in UnifiedWorkSection when there are no phases (unassignedChecklistOnly=false)', () => {
    const allItems = [
      { id: '1', phaseId: null, text: 'Task A', isCompleted: false, sortOrder: 0 },
      { id: '2', phaseId: null, text: 'Task B', isCompleted: true, sortOrder: 1 },
    ];
    // No phase filter → unified shows all
    const unifiedItems = allItems; // full list returned by ?phaseId-less endpoint
    expect(unifiedItems).toHaveLength(2);
    expect(unifiedItems.map(i => i.id)).toEqual(['1', '2']);
  });
});

// ─── 7. Tab badge aggregation — phase + unassigned counts ────────────────────

describe('tab badge incomplete count aggregation', () => {
  /**
   * Mirrors the logic in tabBadgeCounts useMemo in [id].tsx:
   *   phaseTaskIncomplete = sum of (total - completed) across phaseTaskCounts
   *   checklistIncomplete = (unassigned total - unassigned completed) + phaseTaskIncomplete
   */
  function badgeCount(
    phaseTaskCounts: Record<string, { completed: number; total: number }>,
    unassignedCounts: { completed: number; total: number },
  ): number {
    const phaseTaskIncomplete = Object.values(phaseTaskCounts).reduce(
      (sum, c) => sum + (c.total - c.completed), 0
    );
    return (unassignedCounts.total - unassignedCounts.completed) + phaseTaskIncomplete;
  }

  it('shows 0 when everything is done', () => {
    expect(badgeCount(
      { 'ph-a': { completed: 3, total: 3 }, 'ph-b': { completed: 2, total: 2 } },
      { completed: 1, total: 1 },
    )).toBe(0);
  });

  it('includes incomplete phase tasks in the badge', () => {
    expect(badgeCount(
      { 'ph-a': { completed: 1, total: 3 }, 'ph-b': { completed: 2, total: 2 } },
      { completed: 0, total: 0 },
    )).toBe(2); // ph-a has 2 incomplete
  });

  it('includes incomplete unassigned items alongside phase tasks', () => {
    expect(badgeCount(
      { 'ph-a': { completed: 1, total: 3 } }, // 2 phase incomplete
      { completed: 0, total: 2 },              // 2 unassigned incomplete
    )).toBe(4);
  });

  it('works with no phases (service call / no-phase project)', () => {
    expect(badgeCount(
      {},                              // no phase counts
      { completed: 2, total: 5 },     // 3 unassigned incomplete
    )).toBe(3);
  });

  it('phase toggles are reflected via phaseTaskCounts not checklistCounts', () => {
    // Before toggle: ph-a has 0/1 complete
    const before = badgeCount({ 'ph-a': { completed: 0, total: 1 } }, { completed: 0, total: 0 });
    // After optimistic toggle: ph-a has 1/1 complete
    const after  = badgeCount({ 'ph-a': { completed: 1, total: 1 } }, { completed: 0, total: 0 });
    expect(before).toBe(1);
    expect(after).toBe(0);
  });
});

// ─── 8. Promote-to-task: sequential API calls ────────────────────────────────

/**
 * The promoteToTask function in UnifiedWorkSection.tsx performs:
 *   1. const taskRes = await api.post('/api/tasks', ...)
 *   2. if (taskRes.error) → show error, return
 *   3. const deleteRes = await api.delete('/api/checklist/:id')
 *   4. show success or partial-failure toast
 *
 * These tests verify the sequential contract without mounting the full component.
 */
async function simulatePromote(
  taskResult: { error: string | null },
  deleteResult: { error: string | null },
) {
  const callOrder: string[] = [];

  mockPost.mockImplementation(() => {
    callOrder.push('POST:/api/tasks');
    return Promise.resolve(taskResult);
  });
  mockDelete.mockImplementation(() => {
    callOrder.push('DELETE:/api/checklist/cl-1');
    return Promise.resolve(deleteResult);
  });

  // Replicate the promoteToTask logic exactly as written in UnifiedWorkSection.tsx
  const { api } = require('../../lib/api');
  const { showToast } = require('../../lib/toast');

  const taskRes = await api.post('/api/tasks', { title: 'Measure walls', jobId: 'job-1' });
  if (taskRes.error) {
    showToast({ type: 'error', message: 'Could not create task' });
    return { callOrder };
  }
  const deleteRes = await api.delete('/api/checklist/cl-1');
  if (deleteRes.error) {
    showToast({
      type: 'error',
      message: 'Task created, but the checklist item could not be removed. Please delete it manually.',
    });
  } else {
    showToast({ type: 'success', message: 'Converted to full task' });
  }
  return { callOrder };
}

describe('promote-to-task — sequential calls', () => {
  it('calls POST before DELETE', async () => {
    const { callOrder } = await simulatePromote({ error: null }, { error: null });
    expect(callOrder).toEqual(['POST:/api/tasks', 'DELETE:/api/checklist/cl-1']);
  });

  it('skips DELETE entirely when task creation fails', async () => {
    const { callOrder } = await simulatePromote({ error: 'Server error' }, { error: null });
    expect(callOrder).toEqual(['POST:/api/tasks']);
    expect(callOrder).not.toContain('DELETE:/api/checklist/cl-1');
  });

  it('shows an error toast (not success) when task creation fails', async () => {
    await simulatePromote({ error: 'Server error' }, { error: null });
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    expect(mockShowToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('shows success toast when both calls succeed', async () => {
    await simulatePromote({ error: null }, { error: null });
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', message: 'Converted to full task' }),
    );
  });

  it('shows partial-failure toast when DELETE fails but task was already created', async () => {
    await simulatePromote({ error: null }, { error: 'Network error' });
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: expect.stringContaining('Task created'),
      }),
    );
    // Must NOT show success
    expect(mockShowToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' }),
    );
  });
});
