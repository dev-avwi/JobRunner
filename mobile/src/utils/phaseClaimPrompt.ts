/**
 * Determines whether the "would you like to raise a progress claim?" prompt
 * should be shown after a phase status update.
 *
 * The prompt fires when ALL of the following are true:
 *  1. The phase was not already marked complete before this save (covers both
 *     fresh completions AND re-completions after a re-open).
 *  2. The status the user is saving is 'complete'.
 *  3. The current user is an owner or manager (workers skip the prompt).
 */
export function shouldShowPhaseClaimPrompt(opts: {
  previousStatus: string;
  newStatus: string;
  isOwner: boolean;
  isManager: boolean;
}): boolean {
  const { previousStatus, newStatus, isOwner, isManager } = opts;
  return (
    previousStatus !== 'complete' &&
    newStatus === 'complete' &&
    (isOwner || isManager)
  );
}
