import { requireNativeModule } from 'expo-modules-core';

import type { LiveActivityNativeModule } from './index';

// Try to bind the native module. If the JS bundle is running on a build that
// doesn't include the LiveActivity native target yet (older simulator builds,
// EAS Update landing on an out-of-date binary, Android, etc.), fall back to a
// no-op shim so importing this file never throws at route-load time.
let nativeModule: LiveActivityNativeModule;
try {
  nativeModule = requireNativeModule<LiveActivityNativeModule>('LiveActivity');
} catch {
  nativeModule = {
    areActivitiesEnabled: async () => false,
    start: async () => '',
    update: async () => {},
    end: async () => {},
  };
}

export default nativeModule;
