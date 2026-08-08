import { Platform } from 'react-native';

/**
 * Centralized header policy for screens that render a nested native-stack
 * header underneath the app's global custom <Header /> (e.g. the job detail
 * screen).
 *
 * Policy:
 * - iOS: show the nested native header (it plays nicely with the global
 *   header and gives native back-swipe affordances).
 * - Android: hide the nested native header entirely — the global <Header />
 *   already consumes the status-bar inset, so a nested native header would
 *   stack a second header AND reserve the inset again, producing a phantom
 *   gap that pushes content too far down. Screens render their own in-content
 *   back row on Android instead.
 *
 * `headerStatusBarHeight: 0` is kept as a belt-and-braces guard for any
 * Android case where the header is momentarily shown (it is a valid
 * native-stack option that expo-router's option type doesn't surface, hence
 * the cast).
 */
export function getNestedHeaderOptions(): Record<string, unknown> {
  return {
    headerShown: Platform.OS !== 'android',
    ...(Platform.OS === 'android' ? ({ headerStatusBarHeight: 0 } as any) : {}),
  };
}
