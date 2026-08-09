import { Platform } from 'react-native';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

// Navigation config - solid headers (no blur/glass effect)
export const getNavigationConfig = (colors: any, options?: { 
  enableLiquidGlass?: boolean;
  isDark?: boolean;
}) => {
  // Use solid headers on all platforms for better content visibility
  return {
    headerShown: true,
    animation: isIOS ? 'ios_from_right' as const : 'slide_from_right' as const,
    gestureEnabled: true,
    gestureDirection: 'horizontal' as const,
    headerShadowVisible: false,
    headerTransparent: false,
    headerStyle: {
      backgroundColor: colors.background,
    },
    headerTintColor: colors.foreground,
    headerPressColor: 'transparent' as const,
    headerPressOpacity: 1,
    headerRightContainerStyle: {
      backgroundColor: 'transparent',
    },
    headerLeftContainerStyle: {
      backgroundColor: 'transparent',
    },
  };
};

// Helper for screens that need solid (non-transparent) headers
export const getSolidHeaderConfig = (colors: any) => ({
  headerShown: true,
  animation: isIOS ? 'ios_from_right' : 'slide_from_right',
  gestureEnabled: true,
  gestureDirection: 'horizontal' as const,
  headerShadowVisible: false,
  headerStyle: {
    backgroundColor: colors.background,
  },
  headerTintColor: colors.foreground,
});
