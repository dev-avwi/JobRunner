import { Platform, Dimensions } from 'react-native';
import { useState, useEffect } from 'react';

const IPAD_WIDTH_THRESHOLD = 768;
// Tablet detection threshold (drives sidebar navigation, grid columns, etc.).
// 672 so that:
//  - iPad mini (min 744) and larger tablets qualify;
//  - an UNFOLDED foldable (Z Fold / Pixel Fold inner display) gets the sidebar,
//    including landscape where the live `window` min-dimension is the height and
//    is shaved by the status/nav bars to ~700pt (below the old 744 → it was
//    wrongly treated as a phone and never reverted to sidebar on unfold);
//  - the largest phones (min-dimension ~430-480pt) stay on phone navigation.
const TABLET_MIN_DIMENSION = 672;
// Wide-content threshold — purely for content-column centring on Android
// foldables. Lower than the tablet threshold so a Z Fold (unfolded ~600pt)
// gets a centred reading column without flipping to sidebar navigation.
export const WIDE_CONTENT_THRESHOLD = 600;
// Maximum reading width for primary content columns on wide screens.
export const OPTIMAL_CONTENT_MAX_WIDTH = 720;

// Accepts optional explicit window dimensions. The reactive hooks pass the
// fresh `window` payload from the Dimensions 'change' event so detection never
// races a stale global Dimensions.get() snapshot during a fold/unfold transition
// (Android emits intermediate change events while the posture settles).
export function isTablet(windowDims?: { width: number; height: number }): boolean {
  // Check Platform.isPad first (most reliable for iOS)
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  if (isPad) {
    return true;
  }

  const win = windowDims ?? Dimensions.get('window');

  if (Platform.OS === 'android') {
    // On Android foldables (Z Fold, Pixel Fold) the 'screen' dimension keeps
    // reporting the larger physical *inner* display even after you fold back to
    // the small outer/cover display. A Math.max(screen, window) check therefore
    // stays stuck on the tablet/sidebar layout when folding back to portrait.
    // The live 'window' dimensions track the currently active display, so use
    // those alone: unfolded → inner display (large) → tablet/sidebar; folded →
    // outer display (small) → phone layout.
    return Math.min(win.width, win.height) >= TABLET_MIN_DIMENSION;
  }

  // iOS (non-iPad): 'screen' is more reliable than 'window' for split view/zoom,
  // so use the larger of screen/window min-dimension.
  const { width: screenWidth, height: screenHeight } = Dimensions.get('screen');
  const effectiveWidth = Math.max(
    Math.min(screenWidth, screenHeight),
    Math.min(win.width, win.height)
  );

  return effectiveWidth >= TABLET_MIN_DIMENSION;
}

// Reactive version of isTablet() — subscribes to Dimensions changes so layouts
// update live when a foldable opens/closes (Z Fold, Pixel Fold, Surface Duo)
// or when the window is resized in split-screen mode on Android/iPad.
export function useIsTablet(): boolean {
  const [tablet, setTablet] = useState<boolean>(() => isTablet());
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setTablet(isTablet(window));
    });
    return () => sub.remove();
  }, []);
  return tablet;
}

export function isIPad(): boolean {
  return Platform.OS === 'ios' && Platform.isPad;
}

export function getOrientation(): 'portrait' | 'landscape' {
  const { width, height } = Dimensions.get('window');
  return width > height ? 'landscape' : 'portrait';
}

export function useOrientation(): 'portrait' | 'landscape' {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => getOrientation());
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      const newOrientation = window.width > window.height ? 'landscape' : 'portrait';
      setOrientation(newOrientation);
    });
    return () => subscription.remove();
  }, []);
  
  return orientation;
}

export function useDeviceType(): 'phone' | 'tablet' {
  return isTablet() ? 'tablet' : 'phone';
}

// Determines if we should use sidebar navigation
// iPad uses sidebar only in landscape mode
// Phones always use bottom nav
export function useShouldUseSidebar(): boolean {
  const [shouldUseSidebar, setShouldUseSidebar] = useState(() => {
    const isPad = isIPad();
    if (isPad) {
      return getOrientation() === 'landscape';
    }
    // Non-iPad tablets always use sidebar
    return isTablet();
  });
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      const isPad = isIPad();
      if (isPad) {
        const orientation = window.width > window.height ? 'landscape' : 'portrait';
        setShouldUseSidebar(orientation === 'landscape');
      } else {
        setShouldUseSidebar(isTablet(window));
      }
    });
    return () => subscription.remove();
  }, []);
  
  return shouldUseSidebar;
}

export const SIDEBAR_WIDTH = 280;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

// Get the actual content width accounting for sidebar presence
export function getContentWidth(hasSidebar: boolean = false): number {
  const { width } = Dimensions.get('window');
  if (hasSidebar) {
    return width - SIDEBAR_WIDTH;
  }
  return width;
}

// Hook that returns content width and updates when dimensions/sidebar change
export function useContentWidth(): number {
  const shouldUseSidebar = useShouldUseSidebar();
  const [contentWidth, setContentWidth] = useState(() => getContentWidth(shouldUseSidebar));
  
  useEffect(() => {
    setContentWidth(getContentWidth(shouldUseSidebar));
  }, [shouldUseSidebar]);
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      setContentWidth(getContentWidth(shouldUseSidebar));
    });
    return () => subscription.remove();
  }, [shouldUseSidebar]);
  
  return contentWidth;
}

// Hook for responsive layout values across phones, tablets, and foldables.
// Returns sizing/padding/grid hints that adapt live to dimension changes
// (orientation flip, Z Fold open/close, iPad split-view resize).
//
// Note on iPad parity: the wide-content reading column treatment
// (`optimalContentWidth`) only applies on Android wide displays. iPad layouts
// keep their full-canvas behaviour so dashboards/tables aren't constrained.
export function useResponsiveLayout() {
  const isPad = isIPad();
  const isTabletDevice = useIsTablet();
  const orientation = useOrientation();
  const contentWidth = useContentWidth();
  const isAndroid = Platform.OS === 'android';

  const isIPadPortrait = isPad && orientation === 'portrait';
  // Wide-content treatment is Android-only — covers Android tablets, unfolded
  // Samsung Z Fold inner display, Pixel Fold, and Surface Duo. iPad keeps the
  // edge-to-edge experience that shipped previously.
  const isWideScreen = isAndroid && contentWidth >= WIDE_CONTENT_THRESHOLD;
  const isLargeScreen = isPad || isTabletDevice;

  // Larger touch targets on tablet-class devices.
  const horizontalPadding = isLargeScreen ? 20 : 16;

  // Cap reading-line width on Android wide displays so primary content (text
  // columns, forms, chat threads, settings rows) stays comfortable rather
  // than spanning the full width of an unfolded Z Fold (~600pt).
  const optimalContentWidth = isWideScreen
    ? Math.min(contentWidth, OPTIMAL_CONTENT_MAX_WIDTH)
    : contentWidth;

  return {
    isPad,
    isIPadPortrait,
    isTablet: isTabletDevice,
    isLargeScreen,
    isWideScreen,
    orientation,
    contentWidth,
    optimalContentWidth,
    horizontalPadding,
    // Scale factor for larger touch targets on tablet-class devices.
    touchScale: isLargeScreen ? 1.15 : 1,
    // Font scale for better readability on tablet-class devices.
    fontScale: isLargeScreen ? 1.1 : 1,
    // Grid columns - tablets / foldables can show more columns.
    gridColumns: isLargeScreen
      ? (orientation === 'landscape' ? 3 : 2)
      : 2,
  };
}
