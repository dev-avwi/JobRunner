import { describe, it, expect } from "vitest";

/**
 * Permission-gate logic for UnifiedWorkSection (web)
 *
 * These tests encode the rules that govern which actions are available to each
 * role in each job state, directly mirroring the canEditChecklist /
 * canEditTasks / canPromote derivation inside the component.
 *
 * Invariants:
 * - Any authenticated user can edit checklist items on an active job
 *   (only invoiced jobs lock the checklist).
 * - Only owners can add/delete/toggle tasks or promote a checklist item to a
 *   full task.
 * - Both capabilities are locked when the job is invoiced.
 */

interface PermissionInput {
  isInvoiced: boolean;
  isOwner: boolean;
}

/** Mirrors the component's derived permission flags. */
function derivePermissions(input: PermissionInput) {
  const readOnly = input.isInvoiced; // prop passed from JobDetailView
  const canEditChecklist = !readOnly;
  const canEditTasks = input.isOwner && !readOnly;
  const canPromote = canEditTasks; // promote creates a task → owner-only
  return { canEditChecklist, canEditTasks, canPromote };
}

// ─── Owner on active job ──────────────────────────────────────────────────────

describe("owner on active job", () => {
  const perms = derivePermissions({ isInvoiced: false, isOwner: true });

  it("can edit checklist items", () => expect(perms.canEditChecklist).toBe(true));
  it("can edit tasks", () => expect(perms.canEditTasks).toBe(true));
  it("can promote checklist item to full task", () => expect(perms.canPromote).toBe(true));
});

// ─── Non-owner (worker/manager) on active job ─────────────────────────────────

describe("non-owner on active job", () => {
  const perms = derivePermissions({ isInvoiced: false, isOwner: false });

  it("can edit checklist items", () => expect(perms.canEditChecklist).toBe(true));
  it("cannot add/delete/toggle tasks", () => expect(perms.canEditTasks).toBe(false));
  it("cannot promote a checklist item to a task", () => expect(perms.canPromote).toBe(false));
});

// ─── Owner on invoiced job ────────────────────────────────────────────────────

describe("owner on invoiced job", () => {
  const perms = derivePermissions({ isInvoiced: true, isOwner: true });

  it("cannot edit checklist items", () => expect(perms.canEditChecklist).toBe(false));
  it("cannot edit tasks", () => expect(perms.canEditTasks).toBe(false));
  it("cannot promote", () => expect(perms.canPromote).toBe(false));
});

// ─── Non-owner on invoiced job ────────────────────────────────────────────────

describe("non-owner on invoiced job", () => {
  const perms = derivePermissions({ isInvoiced: true, isOwner: false });

  it("cannot edit checklist items", () => expect(perms.canEditChecklist).toBe(false));
  it("cannot edit tasks", () => expect(perms.canEditTasks).toBe(false));
  it("cannot promote", () => expect(perms.canPromote).toBe(false));
});

// ─── Promote-to-task: sequential API contract ────────────────────────────────

/**
 * The promote flow must be sequential: create the task first, only delete the
 * checklist item after creation succeeds.  If deletion fails after a
 * successful creation, both lists must still be refreshed so the new task is
 * visible.
 */
describe("promote sequential contract", () => {
  async function runPromote(opts: {
    taskCreateThrows: boolean;
    deleteThrows: boolean;
  }) {
    const calls: string[] = [];

    const apiRequest = async (method: string, url: string) => {
      calls.push(`${method}:${url}`);
      if (method === "POST" && opts.taskCreateThrows) throw new Error("server error");
      if (method === "DELETE" && opts.deleteThrows) throw new Error("network error");
    };

    let invalidatedCL = false;
    let invalidatedTasks = false;
    const safeInvalidateQueries = (opts: { queryKey: string[] }) => {
      if (opts.queryKey.includes("checklist")) invalidatedCL = true;
      if (opts.queryKey.includes("tasks")) invalidatedTasks = true;
    };

    const clQueryKey = ["jobs", "job-1", "checklist"];
    const taskQueryKey = ["jobs", "job-1", "tasks"];

    // ── Replicate promoteToTask mutationFn ──────────────────────────────────
    let error: unknown = null;
    let deleteSucceeded = true;
    try {
      await apiRequest("POST", "/api/tasks");
      try {
        await apiRequest("DELETE", "/api/checklist/cl-1");
      } catch {
        deleteSucceeded = false;
      }
    } catch (e) {
      error = e;
    }

    // ── Replicate onSuccess / onError ───────────────────────────────────────
    if (!error) {
      safeInvalidateQueries({ queryKey: clQueryKey });
      safeInvalidateQueries({ queryKey: taskQueryKey });
    }

    return { calls, deleteSucceeded, error, invalidatedCL, invalidatedTasks };
  }

  it("calls POST before DELETE on success", async () => {
    const { calls } = await runPromote({ taskCreateThrows: false, deleteThrows: false });
    expect(calls).toEqual(["POST:/api/tasks", "DELETE:/api/checklist/cl-1"]);
  });

  it("skips DELETE when task creation fails", async () => {
    const { calls } = await runPromote({ taskCreateThrows: true, deleteThrows: false });
    expect(calls).toEqual(["POST:/api/tasks"]);
  });

  it("still invalidates both caches when DELETE fails after a successful create", async () => {
    const { invalidatedCL, invalidatedTasks, deleteSucceeded } = await runPromote({
      taskCreateThrows: false,
      deleteThrows: true,
    });
    expect(deleteSucceeded).toBe(false);
    expect(invalidatedCL).toBe(true);
    expect(invalidatedTasks).toBe(true);
  });

  it("does not invalidate caches when task creation fails", async () => {
    const { invalidatedCL, invalidatedTasks, error } = await runPromote({
      taskCreateThrows: true,
      deleteThrows: false,
    });
    expect(error).toBeTruthy();
    expect(invalidatedCL).toBe(false);
    expect(invalidatedTasks).toBe(false);
  });
});
