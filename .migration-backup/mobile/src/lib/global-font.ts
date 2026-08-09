import React from 'react';
import { Text as RNText, TextInput as RNTextInput, StyleSheet } from 'react-native';

// === GLOBAL INTER FONT MAPPING ===
// The Inter font family is loaded globally in app/_layout.tsx, but each weight
// is registered as a SEPARATE font family (Inter_400Regular, Inter_700Bold...).
// React Native on Android does NOT map a numeric `fontWeight` to a loaded custom
// font variant the way iOS does — so with no fontFamily pinned, iOS falls back to
// San Francisco (crisp, true-weight bold) while Android falls back to Roboto
// (lighter, and it caps heavy weights at ~700). That is the iOS-looks-premium /
// Android-looks-flat gap.
//
// Fix: intercept every <Text>/<TextInput> render and inject the correct Inter
// family for whatever fontWeight the style asks for. Mapped PER WEIGHT (not a
// single global family) so bold stays bold — the single-family approach is what
// made an earlier attempt render everything thin.

const WEIGHT_TO_INTER: Record<string, string> = {
  '100': 'Inter_400Regular',
  '200': 'Inter_400Regular',
  '300': 'Inter_400Regular',
  '400': 'Inter_400Regular',
  normal: 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  bold: 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_900Black',
};

function interFamilyFor(style: any): string | null {
  const flat = StyleSheet.flatten(style) as any;
  if (!flat) return 'Inter_400Regular';
  // Respect any explicitly-set family (monospace codes, already-pinned Inter, etc.)
  if (flat.fontFamily) return null;
  const weight = flat.fontWeight != null ? String(flat.fontWeight) : '400';
  return WEIGHT_TO_INTER[weight] || 'Inter_400Regular';
}

function patchComponent(Component: any, name: string) {
  if (!Component || Component.__interPatched) return;
  const originalRender = Component.render;
  if (typeof originalRender !== 'function') {
    if (__DEV__) {
      console.warn(
        `[global-font] Could not apply Inter font mapping to ${name} — RN internals changed. Typography parity may regress.`,
      );
    }
    return;
  }
  Component.__interPatched = true;
  Component.render = function patchedRender(...args: any[]) {
    const element = originalRender.apply(this, args);
    if (!element || !element.props) return element;
    const family = interFamilyFor(element.props.style);
    if (!family) return element;
    return React.cloneElement(element, {
      style: [element.props.style, { fontFamily: family }],
    });
  };
}

let applied = false;

/**
 * Routes every Text/TextInput fontWeight to the matching loaded Inter family so
 * Android and iOS render identical, premium typography. Safe to call once at the
 * app root; subsequent calls are no-ops.
 */
export function applyGlobalInterFont() {
  if (applied) return;
  applied = true;
  patchComponent(RNText, 'Text');
  patchComponent(RNTextInput, 'TextInput');
}
