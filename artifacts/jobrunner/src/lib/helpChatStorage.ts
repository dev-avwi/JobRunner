/**
 * Shared constant and helpers for Help Center chat history stored in
 * sessionStorage. Kept in its own module so it can be imported both from
 * HelpCenter.tsx (read/write) and from the logout handler (clear) without
 * creating a React-component dependency chain.
 */

export const HELP_CHAT_SESSION_KEY = "help_chat_history";

/**
 * Monotonically-increasing counter that is bumped every time
 * `clearChatHistory` is called (i.e. on logout).
 *
 * Chat mutation callbacks capture this value before the network request
 * fires and compare it on settlement. If the value changed (because the
 * user logged out while the request was in flight) the callback skips
 * persisting the response, preventing a previous user's conversation from
 * leaking back into sessionStorage after the logout clear.
 */
let _sessionGen = 0;

export function getSessionGeneration(): number {
  return _sessionGen;
}

/**
 * Erase the Help Center chat history from sessionStorage and bump the
 * session generation so any in-flight chat requests cannot restore it.
 * Called on explicit logout so that a subsequent user on the same device
 * cannot see the previous user's conversation.
 */
export function clearChatHistory(): void {
  _sessionGen++;
  try {
    sessionStorage.removeItem(HELP_CHAT_SESSION_KEY);
  } catch {
    // sessionStorage may be unavailable in some environments (e.g. private
    // browsing on certain browsers) — silently ignore.
  }
}
