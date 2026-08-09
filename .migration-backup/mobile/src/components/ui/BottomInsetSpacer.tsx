import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface BottomInsetSpacerProps {
  extra?: number;
  minHeight?: number;
}

/**
 * Renders an empty View whose height equals the device's bottom safe-area inset
 * (Android nav bar / iOS home indicator) plus an optional `extra` value. Drop
 * this at the bottom of any screen with a sticky bottom CTA so content is not
 * hidden behind system chrome.
 */
export function BottomInsetSpacer({ extra = 0, minHeight = 0 }: BottomInsetSpacerProps) {
  const insets = useSafeAreaInsets();
  const height = Math.max(insets.bottom + extra, minHeight);
  return <View style={{ height }} pointerEvents="none" />;
}

/**
 * Hook variant — returns the numeric bottom inset (+ optional extra) for cases
 * that need to set padding on an existing element.
 */
export function useBottomInset(extra: number = 0): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + extra;
}

export default BottomInsetSpacer;
