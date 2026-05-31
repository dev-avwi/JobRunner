/**
 * Background Location Tracking Module
 * 
 * Provides Life360-style real-time location tracking for team members.
 * Sends location updates to the server for team visibility on the map.
 * 
 * Features:
 * - Background location updates
 * - Battery-efficient tracking
 * - Geofence alerts for job site arrivals/departures
 * - Speed and heading tracking
 * - Privacy-aware job-scoped tracking for subcontractors
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform, Alert, Linking } from 'react-native';
import api from './api';

const LOCATION_TASK_NAME = 'jobrunner-location-tracking';
const GEOFENCE_TASK_NAME = 'jobrunner-geofence-monitoring';

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface GeofenceRegion {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
}

export interface GeofenceEvent {
  identifier: string;
  action: 'enter' | 'exit';
  timestamp: number;
}

export type TrackingStatus = 
  | 'stopped'
  | 'starting'
  | 'tracking'
  | 'foreground_only'
  | 'paused'
  | 'error';

export interface SubcontractorJobContext {
  jobId: string;
  jobTitle: string;
  businessName: string;
}

const LOCATION_BUFFER_MAX = 20;
const STATIONARY_SPEED_THRESHOLD = 0.5;
const STATIONARY_SKIP_COUNT = 3;

class LocationTrackingService {
  private status: TrackingStatus = 'stopped';
  private currentLocation: LocationUpdate | null = null;
  private geofences: GeofenceRegion[] = [];
  private onLocationUpdate?: (location: LocationUpdate) => void;
  private onGeofenceEvent?: (event: GeofenceEvent) => void;
  private onStatusChange?: (status: TrackingStatus) => void;
  private _isSubcontractor: boolean = false;
  private _activeJobContext: SubcontractorJobContext | null = null;
  private _onJobContextChange?: (context: SubcontractorJobContext | null) => void;
  private _locationBuffer: { payload: Record<string, any> }[] = [];
  private _stationaryCount: number = 0;

  /**
   * Silently check current permission state WITHOUT triggering any OS prompts.
   * Use this on app startup to resume tracking if already granted.
   */
  async checkPermissions(): Promise<{ foreground: boolean; background: boolean }> {
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      const bg = await Location.getBackgroundPermissionsAsync();
      return {
        foreground: fg.status === 'granted',
        background: bg.status === 'granted',
      };
    } catch (error: any) {
      if (__DEV__) console.log('[Location] Permission check failed:', error?.message);
      return { foreground: false, background: false };
    }
  }

  /**
   * Request foreground permission only. Called when user first needs GPS
   * (e.g. starting a timer, opening the map). Does NOT request background.
   */
  async requestForegroundPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        if (__DEV__) console.log('[Location] Foreground permission granted');
        return true;
      }
      if (__DEV__) console.log('[Location] Foreground permission denied');
      return false;
    } catch (error: any) {
      if (__DEV__) console.log('[Location] Foreground request failed:', error?.message);
      return false;
    }
  }

  /**
   * Request background permission. Called only when user explicitly enables
   * background features like team tracking or geofencing in settings.
   */
  async requestBackgroundPermission(): Promise<boolean> {
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      if (fg.status !== 'granted') {
        const fgResult = await this.requestForegroundPermission();
        if (!fgResult) return false;
      }
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status === 'granted') {
        if (__DEV__) console.log('[Location] Background permission granted');
        return true;
      }
      if (__DEV__) console.log('[Location] Background permission denied');
      return false;
    } catch (error: any) {
      if (__DEV__) console.log('[Location] Background request failed:', error?.message);
      return false;
    }
  }

  /**
   * Initialize location tracking.
   * Now uses a lazy approach: silently checks permissions without prompting.
   * Only resumes tracking if permissions were previously granted.
   * Use requestForegroundPermission() / requestBackgroundPermission() to prompt.
   */
  async initialize(): Promise<boolean> {
    try {
      const perms = await this.checkPermissions();

      if (!perms.foreground) {
        if (__DEV__) console.log('[Location] No foreground permission — skipping init (will prompt when needed)');
        return false;
      }

      if (__DEV__) console.log('[Location] Initialized successfully (foreground=' + perms.foreground + ', background=' + perms.background + ')');
      return true;
    } catch (error: any) {
      if (error?.message?.includes('NSLocation') || error?.message?.includes('Info.plist')) {
        if (__DEV__) console.log('[Location] Running in Expo Go - location tracking requires native build');
      } else {
        if (__DEV__) console.log('[Location] Initialization skipped:', error?.message || 'Unknown error');
      }
      return false;
    }
  }

  setSubcontractorMode(isSubcontractor: boolean): void {
    this._isSubcontractor = isSubcontractor;
    if (__DEV__) console.log(`[Location] Subcontractor mode: ${isSubcontractor}`);
  }

  getIsSubcontractor(): boolean {
    return this._isSubcontractor;
  }

  getActiveJobContext(): SubcontractorJobContext | null {
    return this._activeJobContext;
  }

  onJobContextChange(callback: (context: SubcontractorJobContext | null) => void): void {
    this._onJobContextChange = callback;
  }

  async startJobTracking(jobId: string, jobTitle: string, businessName: string): Promise<boolean> {
    this._activeJobContext = { jobId, jobTitle, businessName };
    if (this._onJobContextChange) {
      this._onJobContextChange(this._activeJobContext);
    }
    if (__DEV__) console.log(`[Location] Subcontractor job tracking started for job ${jobId} (${businessName})`);
    const result = await this.startTracking();
    return result;
  }

  async stopJobTracking(): Promise<void> {
    const previousContext = this._activeJobContext;
    this._activeJobContext = null;
    if (this._onJobContextChange) {
      this._onJobContextChange(null);
    }
    if (previousContext) {
      await this.stopTracking();
      if (__DEV__) console.log(`[Location] Subcontractor job tracking stopped for job ${previousContext.jobId}`);
    }
  }

  async stopJobTrackingForJob(jobId: string): Promise<void> {
    if (this._activeJobContext?.jobId === jobId) {
      await this.stopJobTracking();
    }
  }

  isTrackingJob(jobId: string): boolean {
    return this._activeJobContext?.jobId === jobId;
  }

  /**
   * Start background location tracking
   */
  async startTracking(): Promise<boolean> {
    try {
      this.updateStatus('starting');

      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isTracking) {
        if (__DEV__) console.log('[Location] Already tracking');
        this.updateStatus('tracking');
        return true;
      }

      try {
        const notificationBody = this._isSubcontractor && this._activeJobContext
          ? `Sharing location with ${this._activeJobContext.businessName} for: ${this._activeJobContext.jobTitle}`
          : 'Location tracking active for team visibility';

        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000,
          distanceInterval: 50,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'JobRunner',
            notificationBody,
            notificationColor: '#E8862E',
          },
          pausesUpdatesAutomatically: true,
          activityType: Location.ActivityType.AutomotiveNavigation,
        });

        if (__DEV__) console.log('[Location] Background tracking started');
        this.updateStatus('tracking');
        await this.sendImmediateLocation();
        return true;
      } catch (bgError: any) {
        // Background updates can fail for several reasons — most commonly on iOS
        // when the user grants only "While Using" (not "Always"), but also when
        // UIBackgroundModes isn't configured. In EVERY case we can still put the
        // worker on the team map by sending the current foreground location.
        // (Previously this fallback only ran for a specific error-message string,
        // so a "While Using" grant silently sent nothing and the worker never
        // appeared on the map.)
        if (__DEV__) console.warn('[Location] Background tracking unavailable, falling back to foreground send:', bgError?.message);
        const location = await this.getCurrentLocation();
        if (location) {
          this.updateStatus('foreground_only');
          this._stationaryCount = 0;
          if (this.onLocationUpdate) this.onLocationUpdate(location);
          await this.sendLocationToServer(location);
          return true;
        }
        throw bgError;
      }
    } catch (error) {
      if (__DEV__) console.error('[Location] Failed to start tracking:', error);
      this.updateStatus('error');
      return false;
    }
  }

  /**
   * Stop background location tracking
   */
  async stopTracking(): Promise<void> {
    try {
      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isTracking) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
      
      if (__DEV__) console.log('[Location] Tracking stopped');
      this.updateStatus('stopped');
    } catch (error) {
      if (__DEV__) console.error('[Location] Failed to stop tracking:', error);
    }
  }

  /**
   * Get current location (one-time)
   */
  async getCurrentLocation(): Promise<LocationUpdate | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const update: LocationUpdate = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: location.timestamp,
      };

      this.currentLocation = update;
      return update;
    } catch (error) {
      if (__DEV__) console.error('[Location] Failed to get current location:', error);
      return null;
    }
  }

  /**
   * Add a geofence for a job site
   */
  async addJobGeofence(
    jobId: string,
    latitude: number,
    longitude: number,
    radius: number = 100 // 100 meter radius
  ): Promise<boolean> {
    try {
      const region: GeofenceRegion = {
        identifier: `job_${jobId}`,
        latitude,
        longitude,
        radius,
        notifyOnEnter: true,
        notifyOnExit: true,
      };

      const isMonitoring = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
      
      if (isMonitoring) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
      }

      this.geofences.push(region);

      await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, this.geofences);
      
      if (__DEV__) console.log(`[Location] Added geofence for job ${jobId}`);
      return true;
    } catch (error) {
      if (__DEV__) console.error('[Location] Failed to add geofence:', error);
      return false;
    }
  }

  /**
   * Stop all geofencing and clear all registered regions.
   * Used when GPS Privacy Mode is enabled.
   */
  async stopAllGeofencing(): Promise<void> {
    try {
      const isMonitoring = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
      if (isMonitoring) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
      }
      this.geofences = [];
      if (__DEV__) console.log('[Location] All geofencing stopped');
    } catch (error) {
      if (__DEV__) console.log('[Location] Stop all geofencing error:', (error as any)?.message);
    }
  }

  /**
   * Remove a job geofence
   */
  async removeJobGeofence(jobId: string): Promise<void> {
    try {
      this.geofences = this.geofences.filter(g => g.identifier !== `job_${jobId}`);
      
      if (this.geofences.length > 0) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
        await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, this.geofences);
      } else {
        const isMonitoring = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
        if (isMonitoring) {
          await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
        }
      }
      
      if (__DEV__) console.log(`[Location] Removed geofence for job ${jobId}`);
    } catch (error) {
      if (__DEV__) console.error('[Location] Failed to remove geofence:', error);
    }
  }

  /**
   * Send location update to the server
   */
  async sendLocationToServer(location: LocationUpdate): Promise<void> {
    const payload = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      heading: location.heading,
      speed: location.speed,
      timestamp: new Date(location.timestamp).toISOString(),
      activeJobId: this._activeJobContext?.jobId || undefined,
    };

    try {
      await api.post('/api/team-locations', payload);
      await this.flushLocationBuffer();
    } catch (error) {
      const entry = { payload };
      if (this._locationBuffer.length < LOCATION_BUFFER_MAX) {
        this._locationBuffer.push(entry);
      } else {
        this._locationBuffer.shift();
        this._locationBuffer.push(entry);
      }
      if (__DEV__) console.warn(`[Location] Buffered update (${this._locationBuffer.length} pending)`);
    }
  }

  private async flushLocationBuffer(): Promise<void> {
    if (this._locationBuffer.length === 0) return;
    const buffered = [...this._locationBuffer];
    this._locationBuffer = [];
    for (let i = 0; i < buffered.length; i++) {
      const entry = buffered[i];
      try {
        await api.post('/api/team-locations', entry.payload);
      } catch {
        this._locationBuffer = buffered.slice(i).concat(this._locationBuffer);
        break;
      }
    }
  }

  /**
   * Set callback for location updates
   */
  onLocation(callback: (location: LocationUpdate) => void): void {
    this.onLocationUpdate = callback;
  }

  /**
   * Set callback for geofence events
   */
  onGeofence(callback: (event: GeofenceEvent) => void): void {
    this.onGeofenceEvent = callback;
  }

  /**
   * Set callback for status changes
   */
  onStatus(callback: (status: TrackingStatus) => void): void {
    this.onStatusChange = callback;
  }

  private updateStatus(status: TrackingStatus): void {
    this.status = status;
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  /**
   * Sync geofences for all assigned jobs that have geofencing enabled.
   * Call on app startup after location is initialized.
   */
  async syncJobGeofences(): Promise<void> {
    try {
      const response = await api.get('/api/jobs?status=pending,scheduled,in_progress');
      const jobs = response.data || response || [];
      
      if (!Array.isArray(jobs)) return;
      
      const geofenceJobs = jobs.filter((j: any) => 
        j.geofenceEnabled && j.latitude && j.longitude
      );

      if (geofenceJobs.length === 0) return;

      this.geofences = [];
      
      for (const job of geofenceJobs) {
        this.geofences.push({
          identifier: `job_${job.id}`,
          latitude: Number(job.latitude),
          longitude: Number(job.longitude),
          radius: job.geofenceRadius || 100,
          notifyOnEnter: true,
          notifyOnExit: true,
        });
      }

      if (this.geofences.length > 0) {
        const isMonitoring = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
        if (isMonitoring) {
          await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
        }
        await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, this.geofences);
        if (__DEV__) console.log(`[Location] Synced ${this.geofences.length} job geofences`);
      }
    } catch (error) {
      if (__DEV__) console.log('[Location] Geofence sync skipped:', (error as any)?.message || 'Not available');
    }
  }

  getStatus(): TrackingStatus {
    return this.status;
  }

  getLastLocation(): LocationUpdate | null {
    return this.currentLocation;
  }

  /**
   * Push one location to the server immediately when tracking (re)starts, so the
   * worker shows up on the team map right away. Without this, the first ping only
   * arrives after the OS delivers a background update — which needs ~50m of
   * movement and is paused while stationary, so a worker who turns sharing on
   * while standing still never appears.
   */
  private async sendImmediateLocation(): Promise<void> {
    try {
      const location = await this.getCurrentLocation();
      if (!location) return;
      this._stationaryCount = 0;
      if (this.onLocationUpdate) this.onLocationUpdate(location);
      await this.sendLocationToServer(location);
    } catch (err: any) {
      if (__DEV__) console.log('[Location] Immediate location send failed:', err?.message);
    }
  }

  /**
   * Handle location update from background task
   */
  handleLocationUpdate(location: LocationUpdate): void {
    this.currentLocation = location;

    if (this.onLocationUpdate) {
      this.onLocationUpdate(location);
    }

    const speed = location.speed ?? 0;
    if (speed < STATIONARY_SPEED_THRESHOLD) {
      this._stationaryCount++;
      if (this._stationaryCount > 1 && this._stationaryCount % STATIONARY_SKIP_COUNT !== 0) {
        return;
      }
    } else {
      this._stationaryCount = 0;
    }

    this.sendLocationToServer(location);
  }

  /**
   * Handle geofence event from background task.
   * G1: When the device is offline (or the POST fails), queue the event locally with
   * an idempotency key so it syncs once on reconnect — no lost arrivals/departures.
   */
  handleGeofenceEvent(event: GeofenceEvent): void {
    if (this.onGeofenceEvent) {
      this.onGeofenceEvent(event);
    }

    const jobId = event.identifier?.startsWith('job_') ? event.identifier.substring(4) : null;

    const queueOffline = async () => {
      if (!jobId) return;
      try {
        const { default: offlineStorage } = await import('./offline-storage');
        await offlineStorage.queueGeofenceEvent({
          jobId,
          identifier: event.identifier,
          action: event.action,
          latitude: (event as any).latitude,
          longitude: (event as any).longitude,
          accuracy: (event as any).accuracy,
          timestamp: event.timestamp,
        });
      } catch (err) {
        if (__DEV__) console.error('[LocationTracking] Failed to queue geofence event:', err);
      }
    };

    (async () => {
      // Decide online/offline up front; if offline, queue immediately and return.
      try {
        const NetInfo = (await import('@react-native-community/netinfo')).default;
        const net = await NetInfo.fetch();
        const online = net.isConnected !== false && net.isInternetReachable !== false;
        if (!online) {
          await queueOffline();
          return;
        }
      } catch {
        // NetInfo unavailable → fall through and try POST, queue on failure
      }

      // Online: try direct POST; on any failure (transport or non-2xx) queue for retry.
      try {
        const idempotencyKey = jobId
          ? `geo_${jobId}_${event.action}_${Math.floor((event.timestamp || Date.now()) / 1000)}`
          : undefined;
        const res = await api.post('/api/geofence-events', { ...event, idempotencyKey });
        if (res.error) {
          await queueOffline();
        }
      } catch {
        await queueOffline();
      }
    })();
  }
}

// Define the background task for location updates
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    if (__DEV__) console.error('[Location Task] Error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    
    if (location) {
      const update: LocationUpdate = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: location.timestamp,
      };
      
      locationTracking.handleLocationUpdate(update);
    }
  }
});

// Define the background task for geofence events
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) {
    if (__DEV__) console.error('[Geofence Task] Error:', error);
    return;
  }
  
  if (data) {
    const { eventType, region } = data as { 
      eventType: Location.GeofencingEventType;
      region: Location.LocationRegion;
    };
    
    const event: GeofenceEvent = {
      identifier: region.identifier ?? 'unknown',
      action: eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit',
      timestamp: Date.now(),
    };
    
    locationTracking.handleGeofenceEvent(event);
  }
});

export const locationTracking = new LocationTrackingService();
export default locationTracking;
