let Haptics: any = null;
let Platform: any = { OS: 'ios' };

try {
  Haptics = require('expo-haptics');
  Platform = require('react-native').Platform;
} catch (e) {
  // expo-haptics not available - provide mock
  Haptics = {
    impactAsync: async () => {},
    selectionAsync: async () => {},
    notificationAsync: async () => {},
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  };
}

const safeHaptic = async (fn: () => Promise<void>) => {
  try {
    await fn();
  } catch (error) {
    // Silently fail - haptics not available on all devices
  }
};

export const hapticFeedback = {
  light: () => {
    safeHaptic(() => 
      Platform.OS === 'ios' 
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        : Haptics.selectionAsync()
    );
  },
  
  medium: () => {
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  
  heavy: () => {
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },
  
  success: () => {
    safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  
  warning: () => {
    safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  
  error: () => {
    safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
  
  selection: () => {
    safeHaptic(() => Haptics.selectionAsync());
  },
  
  buttonPress: () => {
    safeHaptic(() => 
      Platform.OS === 'ios' 
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        : Haptics.selectionAsync()
    );
  },
  
  tabSwitch: () => {
    safeHaptic(() => Haptics.selectionAsync());
  },
  
  pullToRefresh: () => {
    safeHaptic(() => 
      Platform.OS === 'ios' 
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        : Haptics.selectionAsync()
    );
  },
  
  swipeAction: () => {
    safeHaptic(() => 
      Platform.OS === 'ios' 
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        : Haptics.selectionAsync()
    );
  },
  
  longPress: () => {
    safeHaptic(() => 
      Platform.OS === 'ios' 
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    );
  },
  
  toggle: (enabled: boolean) => {
    safeHaptic(() => 
      enabled 
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        : Haptics.selectionAsync()
    );
  },
  
  // Alias for common patterns
  tap: () => hapticFeedback.light(),
  press: () => hapticFeedback.buttonPress(),
};

// Shared haptic helper used by AnimatedPressable / PressableRow.
// Mirrors the previous inline implementation in AnimatedPressable.tsx so the
// two primitives stay in sync.
export type HapticType = 'light' | 'medium' | 'selection' | 'success' | 'none';

export const triggerHaptic = async (type: HapticType): Promise<void> => {
  if (type === 'none') return;
  try {
    switch (type) {
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'selection':
        await Haptics.selectionAsync();
        break;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
    }
  } catch {
    // Haptics unavailable
  }
};

export default hapticFeedback;
