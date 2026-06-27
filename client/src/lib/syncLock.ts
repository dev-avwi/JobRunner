/**
 * Cross-engine serialization for offline sync.
 *
 * The web app has two sync engines that both drain the SAME IndexedDB
 * `syncQueue` store: `syncManager.triggerSync` (used by the offline
 * time-tracking / payments hooks and the online/offline listeners) and
 * `syncService.processSyncQueue` (used by NetworkContext and useOfflineData).
 *
 * Without coordination they can run concurrently on reconnect and POST the
 * same `create` operation twice before either removes it from the queue,
 * producing duplicate records on the server.
 *
 * `withSyncLock` chains every sync run through a single promise so only one
 * run drains the queue at a time. The second caller waits for the first to
 * finish, then re-reads the (now usually empty) queue and does nothing.
 */

let tail: Promise<unknown> = Promise.resolve();

export function withSyncLock<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(() => task());
  // Keep the chain alive regardless of success/failure so one failed run
  // never permanently blocks subsequent runs.
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
