// ResponsiveContainer - Wraps page content with adaptive padding and centering.
// On large displays (iPad, Android tablets, unfolded foldables like Z Fold,
// Pixel Fold, Surface Duo) it caps the reading width and centers the column
// so primary content (forms, chat threads, settings rows) stays comfortable.
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useMemo } from 'react';
import { useResponsiveLayout } from '../lib/device';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  // If true, content is centered with max width on any large/wide display.
  // Kept named "centerOnIPad" for backwards compatibility with existing call
  // sites — the behavior now also applies to Android tablets and foldables.
  centerOnIPad?: boolean;
  // Maximum content column width on wide displays (default: 720pt).
  maxWidth?: number;
}

export function ResponsiveContainer({
  children,
  style,
  centerOnIPad = true,
  maxWidth = 720,
}: ResponsiveContainerProps) {
  const { isWideScreen, horizontalPadding } = useResponsiveLayout();

  const innerStyle = useMemo(() => {
    if (isWideScreen && centerOnIPad) {
      return {
        width: '100%' as const,
        maxWidth,
        alignSelf: 'center' as const,
        paddingHorizontal: horizontalPadding,
      };
    }
    return {
      paddingHorizontal: horizontalPadding,
    };
  }, [isWideScreen, centerOnIPad, horizontalPadding, maxWidth]);

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.inner, innerStyle]}>
        {children}
      </View>
    </View>
  );
}

// For use in ScrollView contentContainerStyle. Returns padding + max-width
// hints so scrollable pages also respect the wide-screen reading column.
export function useResponsiveContainerStyle(customMaxWidth?: number) {
  const { isWideScreen, horizontalPadding } = useResponsiveLayout();
  const maxWidth = customMaxWidth ?? 720;

  return useMemo(() => {
    if (isWideScreen) {
      return {
        paddingHorizontal: horizontalPadding,
        maxWidth,
        width: '100%' as const,
        alignSelf: 'center' as const,
      };
    }
    return {
      paddingHorizontal: horizontalPadding,
    };
  }, [isWideScreen, horizontalPadding, maxWidth]);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    width: '100%',
  },
});
