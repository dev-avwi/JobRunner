/**
 * Pure factory that builds the equipment-assign handler used by the JobView
 * drag-drop target in AdvancedDispatch.
 *
 * Kept in its own module so unit tests can import and exercise the real guard
 * without pulling in the full AdvancedDispatch React component tree.
 *
 * Guard: when selectedJobId is falsy the returned function is a no-op and
 * `mutate` is never called.
 */
export function makeEquipmentAssignHandler(
  selectedJobId: string | null | undefined,
  mutate: (args: { equipmentId: string; jobId: string }) => void,
): (equipmentId: string) => void {
  return (equipmentId: string) => {
    if (!selectedJobId) return;
    mutate({ equipmentId, jobId: selectedJobId });
  };
}
