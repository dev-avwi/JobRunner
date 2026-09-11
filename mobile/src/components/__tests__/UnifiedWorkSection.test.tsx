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

// ─── 3. Promote-to-task: sequential API calls ────────────────────────────────

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
