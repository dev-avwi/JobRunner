/**
 * Location Tracking Store
 * 
 * Zustand store for managing location tracking state in the mobile app.
 * Integrates with the LocationTrackingService for background location updates.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import locationTracking, { 
  LocationUpdate, 
  GeofenceEvent, 
  TrackingStatus 
} from './location-tracking';

interface TrackingWindow {
  enabled: boolean;
  start: string;
  end: string;
  days: number[];
}

interface LocationState {
  isEnabled: boolean;
  gpsOptOut: boolean;
  status: TrackingStatus;
  lastLocation: LocationUpdate | null;
  lastGeofenceEvent: GeofenceEvent | null;
  batteryLevel: number | null;
  isMoving: boolean;
  permissionGranted: boolean;
  errorMessage: string | null;
  trackingWindow: TrackingWindow | null;
}

interface LocationActions {
  enableTracking: () => Promise<boolean>;
  disableTracking: () => Promise<void>;
  setGpsOptOut: (optOut: boolean) => Promise<void>;
  updateLocation: (location: LocationUpdate) => void;
  updateGeofenceEvent: (event: GeofenceEvent) => void;
  updateStatus: (status: TrackingStatus) => void;
  setPermissionGranted: (granted: boolean) => void;
  setError: (message: string | null) => void;
  setBatteryLevel: (level: number) => void;
  refreshCurrentLocation: () => Promise<LocationUpdate | null>;
  initializeTracking: () => Promise<void>;
  setTrackingWindow: (window: TrackingWindow | null) => void;
  setTrackingOverride: (active: boolean) => Promise<void>;
  applyTrackingSchedule: () => Promise<void>;
}

type LocationStore = LocationState & LocationActions;

// Module-level so the timer survives store re-creation and isn't part of state.
const SCHEDULE_INTERVAL_MS = 60000;
let scheduleInterval: ReturnType<typeof setInterval> | null = null;

export const useLocationStore = create<LocationStore>()(
  persist(
    (set, get) => ({
      isEnabled: false,
      gpsOptOut: false,
      status: 'stopped',
      lastLocation: null,
      lastGeofenceEvent: null,
      batteryLevel: null,
      isMoving: false,
      permissionGranted: false,
      errorMessage: null,
      trackingWindow: null,

      setGpsOptOut: async (optOut: boolean) => {
        set({ gpsOptOut: optOut });
        if (optOut) {
          await locationTracking.stopTracking();
          await locationTracking.stopAllGeofencing();
          set({ isEnabled: false, status: 'stopped', permissionGranted: false });
        }
      },

      initializeTracking: async () => {
        try {
          if (get().gpsOptOut) {
            if (__DEV__) console.log('[LocationStore] GPS opted out — skipping init');
            return;
          }

          const granted = await locationTracking.initialize();
          set({ permissionGranted: granted });

          if (granted) {
            locationTracking.onLocation((location) => {
              get().updateLocation(location);
            });

            locationTracking.onGeofence((event) => {
              get().updateGeofenceEvent(event);
            });

            locationTracking.onStatus((status) => {
              get().updateStatus(status);
            });

            const wasEnabled = get().isEnabled;
            if (wasEnabled) {
              if (locationTracking.shouldTrackNow()) {
                await locationTracking.startTracking();
              } else {
                set({ status: 'paused' });
              }
            }
          }

          // Periodic scheduler: re-evaluate the owner window so tracking starts
          // when work hours open and stops when they close, even if the app
          // stays in the foreground across the boundary. setInterval is
          // throttled in the background — the OS location task handles the
          // background self-stop (see handleLocationUpdate).
          if (!scheduleInterval) {
            scheduleInterval = setInterval(() => {
              void get().applyTrackingSchedule();
            }, SCHEDULE_INTERVAL_MS);
          }
        } catch (error: any) {
          if (__DEV__) console.log('[LocationStore] Initialization:', error?.message || 'Skipped');
          set({ errorMessage: error?.message || 'Location tracking unavailable' });
        }
      },

      enableTracking: async () => {
        if (get().gpsOptOut) {
          set({ errorMessage: 'GPS Privacy Mode is enabled. Disable it in Settings to use location features.' });
          return false;
        }

        const { permissionGranted } = get();

        if (!permissionGranted) {
          const granted = await locationTracking.requestForegroundPermission();
          set({ permissionGranted: granted });

          if (!granted) {
            set({ errorMessage: 'Location permission not granted' });
            return false;
          }
        }

        // After foreground is granted, request background so live team tracking
        // continues to work when the screen is off / app is in the background.
        // This is gated behind the prominent disclosure screen
        // (mobile/app/more/location-permission.tsx) which explains background
        // use to the user BEFORE this OS prompt fires (Google Play requirement).
        try {
          const bgGranted = await locationTracking.requestBackgroundPermission();
          if (!bgGranted && __DEV__) {
            console.log('[LocationStore] Background permission denied — running foreground only');
          }
        } catch (err: any) {
          if (__DEV__) console.log('[LocationStore] Background request error:', err?.message);
        }

        // Register callbacks BEFORE starting tracking so we receive status updates
        locationTracking.onLocation((location) => {
          get().updateLocation(location);
        });

        locationTracking.onGeofence((event) => {
          get().updateGeofenceEvent(event);
        });

        locationTracking.onStatus((status) => {
          get().updateStatus(status);
        });

        // Mark enabled (persisted user intent) immediately.
        set({ status: 'starting', isEnabled: true, errorMessage: null });

        // Respect the owner's tracking window: if we're outside work hours and
        // there's no active-work override, arm tracking but leave GPS paused —
        // the scheduler starts it once the window opens.
        if (!locationTracking.shouldTrackNow()) {
          set({ status: 'paused' });
          return true;
        }

        const success = await locationTracking.startTracking();
        
        if (!success) {
          set({ isEnabled: false, status: 'error', errorMessage: 'Failed to start location tracking' });
        }

        return success;
      },

      disableTracking: async () => {
        await locationTracking.stopTracking();
        set({ isEnabled: false, status: 'stopped' });
      },

      updateLocation: (location: LocationUpdate) => {
        const { lastLocation } = get();
        
        const isMoving = location.speed !== null && location.speed > 1;
        
        set({ 
          lastLocation: location,
          isMoving,
        });
      },

      updateGeofenceEvent: (event: GeofenceEvent) => {
        set({ lastGeofenceEvent: event });
      },

      updateStatus: (status: TrackingStatus) => {
        set({ status });
      },

      setPermissionGranted: (granted: boolean) => {
        set({ permissionGranted: granted });
      },

      setError: (message: string | null) => {
        set({ errorMessage: message });
      },

      setBatteryLevel: (level: number) => {
        set({ batteryLevel: level });
      },

      refreshCurrentLocation: async () => {
        const location = await locationTracking.getCurrentLocation();
        if (location) {
          set({ lastLocation: location });
        }
        return location;
      },

      setTrackingWindow: (window: TrackingWindow | null) => {
        set({ trackingWindow: window });
        locationTracking.setTrackingWindow(window);
        void get().applyTrackingSchedule();
      },

      setTrackingOverride: async (active: boolean) => {
        locationTracking.setTrackingOverride(active);
        // Clocking in eases sampling to on-site; clocking out returns to
        // balanced. Driving auto-bumps to high frequency regardless.
        await locationTracking.setCadenceMode(active ? 'onsite' : 'balanced');
        await get().applyTrackingSchedule();
      },

      applyTrackingSchedule: async () => {
        const { gpsOptOut, isEnabled, permissionGranted } = get();
        // Respect privacy opt-out and the user's own on/off intent.
        if (gpsOptOut || !isEnabled || !permissionGranted) return;

        const shouldTrack = locationTracking.shouldTrackNow();
        const tracking = await locationTracking.isCurrentlyTracking();

        if (shouldTrack && !tracking) {
          set({ status: 'starting' });
          const ok = await locationTracking.startTracking();
          if (!ok) set({ status: 'error' });
        } else if (!shouldTrack && tracking) {
          await locationTracking.stopTracking();
          set({ status: 'paused' });
        }
      },
    }),
    {
      name: 'jobrunner-location',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isEnabled: state.isEnabled,
        gpsOptOut: state.gpsOptOut,
      }),
    }
  )
);

export function getActivityStatus(store: LocationState): string {
  if (!store.isEnabled || (store.status !== 'tracking' && store.status !== 'foreground_only')) {
    return 'Offline';
  }
  
  if (store.isMoving && store.lastLocation?.speed && store.lastLocation.speed > 10) {
    return 'Driving';
  }
  
  if (store.isMoving) {
    return 'Moving';
  }
  
  return 'Online';
}

export function formatSpeed(speed: number | null): string {
  if (speed === null || speed < 0.5) return '';
  const kmh = speed * 3.6;
  return `${Math.round(kmh)} km/h`;
}

export function formatAccuracy(accuracy: number | null): string {
  if (accuracy === null) return 'Unknown';
  if (accuracy < 10) return 'Excellent';
  if (accuracy < 30) return 'Good';
  if (accuracy < 100) return 'Fair';
  return 'Poor';
}

export default useLocationStore;
