/**
 * Task description payload utilities — shared between JobTasksSection and tests.
 * Pure functions: no React, no DOM dependencies.
 */

export interface TaskDescriptionTask {
  description?: string | null;
}

/**
 * Build the POST /api/tasks body for creating a new task.
 * description is omitted entirely (not sent as undefined or null) when the
 * editor is empty so the server treats a missing key as "no description".
 */
export function buildCreateTaskPayload(
  title: string,
  jobId: string,
  editorValue: string,
): { title: string; jobId: string; description?: string } {
  const description = editorValue.trim() || undefined;
  if (description !== undefined) {
    return { title, jobId, description };
  }
  return { title, jobId };
}

/**
 * Derive the description value for a PATCH /api/tasks/:id save.
 * Returns the trimmed content when non-empty, or null to signal removal.
 * Never returns an empty string — callers treat null as the deliberate clear.
 */
export function descriptionSaveValue(editorValue: string): string | null {
  return editorValue.trim() || null;
}

/**
 * The next status when toggling a task's completion state.
 * Only the status field should be sent in the PATCH body — description must
 * never be included alongside a status toggle.
 */
export function toggleNextStatus(currentStatus: string): 'done' | 'open' {
  return currentStatus === 'done' ? 'open' : 'done';
}

/**
 * Starting value for the edit-description textarea.
 * Falls back to "" so the textarea is never uncontrolled.
 */
export function descriptionInitialValue(task: TaskDescriptionTask): string {
  return task.description ?? '';
}
