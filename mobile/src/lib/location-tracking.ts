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
  latitude?: number;
  longitude?: number;
  accuracy?: number | null;
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
const HEARTBEAT_INTERVAL_MS = 60000;

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
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _sendInFlight: boolean = false;
  // Owner-set, team-wide tracking window. When enabled, GPS only runs inside
  // these hours/days unless an override is active (clocked in / on the way) or
  // the worker is on an active subcontractor job.
  private _trackingWindow: { enabled: boolean; start: string; end: string; days: number[] } | null = null;
  private _overrideActive: boolean = false;
  // Adaptive GPS cadence. 'driving' = frequent/high accuracy (heading to a job),
  // 'onsite' = relaxed (clocked in, mostly stationary), 'balanced' = default.
  private _cadenceMode: 'driving' | 'onsite' | 'balanced' = 'balanced';
  private _cadenceSwitching: boolean = false;

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

  /**
   * Set the owner-defined, team-wide tracking window. Pass null to clear (no
   * restriction). Called when the worker's business settings load/refresh.
   */
  setTrackingWindow(window: { enabled: boolean; start: string; end: string; days: number[] } | null): void {
    this._trackingWindow = window;
  }

  /**
   * Override the window — keep tracking outside owner hours while the worker is
   * actively working (clocked in / on the way to a job).
   */
  setTrackingOverride(active: boolean): void {
    this._overrideActive = active;
  }

  /**
   * Whether GPS should be running right now. True when: no window configured or
   * disabled, an override is active, the worker is on a subcontractor job, or
   * the current local time is inside the window on a configured work day.
   */
  shouldTrackNow(): boolean {
    const w = this._trackingWindow;
    if (!w || !w.enabled) return true;
    if (this._overrideActive) return true;
    if (this._activeJobContext) return true;
    return this.isWithinWindow(w);
  }

  private isWithinWindow(w: { start: string; end: string; days: number[] }): boolean {
    try {
      const now = new Date();
      const days = Array.isArray(w.days) && w.days.length > 0 ? w.days : [1, 2, 3, 4, 5];
      const parse = (t: string): number | null => {
        const [h, m] = (t || '').split(':').map((n) => parseInt(n, 10));
        if (Number.isNaN(h)) return null;
        return h * 60 + (Number.isNaN(m) ? 0 : m);
      };
      const mins = now.getHours() * 60 + now.getMinutes();
      const start = parse(w.start) ?? 7 * 60;
      const end = parse(w.end) ?? 17 * 60;
      const today = now.getDay();
      const prevDay = (today + 6) % 7;
      // Overnight window (e.g. 22:00–06:00) wraps midnight. The evening portion
      // (mins >= start) belongs to TODAY's shift; the early-morning portion
      // (mins < end) belongs to the PREVIOUS day's shift, so it must check
      // whether that prior day is a configured work day.
      if (end <= start) {
        if (mins >= start) return days.includes(today);
        if (mins < end) return days.includes(prevDay);
        return false;
      }
      if (!days.includes(today)) return false;
      return mins >= start && mins < end;
    } catch {
      return true;
    }
  }

  /** True if the OS background task is running, or we're in foreground-only mode. */
  async isCurrentlyTracking(): Promise<boolean> {
    if (this.status === 'foreground_only') return true;
    try {
      return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch {
      return false;
    }
  }

  /** GPS options for a cadence mode — frequency/accuracy tuned per worker state. */
  private cadenceOptions(mode: 'driving' | 'onsite' | 'balanced'): {
    accuracy: Location.Accuracy;
    timeInterval: number;
    distanceInterval: number;
  } {
    switch (mode) {
      case 'driving':
        return { accuracy: Location.Accuracy.High, timeInterval: 15000, distanceInterval: 25 };
      case 'onsite':
        return { accuracy: Location.Accuracy.Balanced, timeInterval: 60000, distanceInterval: 100 };
      default:
        return { accuracy: Location.Accuracy.Balanced, timeInterval: 30000, distanceInterval: 50 };
    }
  }

  /**
   * Switch GPS cadence. If we're actively tracking via the OS task (and still
   * inside the window), restart updates so the new sampling rate takes effect.
   */
  async setCadenceMode(mode: 'driving' | 'onsite' | 'balanced'): Promise<void> {
    if (this._cadenceMode === mode || this._cadenceSwitching) return;
    this._cadenceSwitching = true;
    this._cadenceMode = mode;
    try {
      const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isTracking && this.shouldTrackNow()) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        await this.startTracking();
      }
    } catch (err: any) {
      if (__DEV__) console.log('[Location] Cadence switch failed:', err?.message);
    } finally {
      this._cadenceSwitching = false;
    }
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
   * Prompt for foreground location permission (if not already granted) and
   * return a fresh GPS fix. Used by the "On My Way" flow so the server can
   * compute a REAL road ETA instead of falling back to the static default.
   * Returns null if permission is denied or no fix is available.
   */
  async getFreshCoordsForEta(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const granted = await this.requestForegroundPermission();
      if (!granted) return null;
      const loc = await this.getCurrentLocation();
      if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
        return { latitude: loc.latitude, longitude: loc.longitude };
      }
    } catch {
      // ignore — caller falls back to no-coords behaviour
    }
    return null;
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
        // The OS task is still registered (common on app restart / re-login),
        // but the JS heartbeat is not — re-arm it and push a ping now, or a
        // stationary worker resuming a session would never re-post.
        this.startHeartbeat();
        await this.sendImmediateLocation();
        return true;
      }

      try {
        const notificationBody = this._isSubcontractor && this._activeJobContext
          ? `Sharing location with ${this._activeJobContext.businessName} for: ${this._activeJobContext.jobTitle}`
          : 'Location tracking active for team visibility';

        const cadence = this.cadenceOptions(this._cadenceMode);
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: cadence.accuracy,
          timeInterval: cadence.timeInterval,
          distanceInterval: cadence.distanceInterval,
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
        this.startHeartbeat();
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
          this.startHeartbeat();
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
    // Clear the heartbeat first so a throw below can't leave the timer running.
    this.stopHeartbeat();
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
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (__DEV__) console.log('[Location] Skipping getCurrentLocation — permission not granted');
        return null;
      }

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
      if (__DEV__) console.warn('[Location] Failed to get current location:', error);
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

      // Dedupe: drop any existing region for this job before re-adding, so a
      // toggle on/off (or a sync that already registered it) can't stack
      // duplicate regions toward the OS geofence cap (~20 on iOS).
      this.geofences = this.geofences.filter(g => g.identifier !== region.identifier);
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

    // Reentrancy guard: a slow network could let a heartbeat tick (or auth hook)
    // fire while a previous send/flush is still running, causing overlapping
    // flushes and out-of-order writes. If one is in flight, buffer this payload
    // and let the in-progress cycle (or the next tick) pick it up.
    if (this._sendInFlight) {
      this.bufferPayload(payload);
      return;
    }
    this._sendInFlight = true;
    try {
      // Flush older buffered pings FIRST so this fresh ping is the last write —
      // the server derives lastSeenAt from the payload timestamp, so flushing
      // stale entries afterwards would drag the worker's "last seen" backwards.
      await this.flushLocationBuffer();

      if (!(await this.postLocation(payload))) {
        this.bufferPayload(payload);
        if (__DEV__) console.warn(`[Location] Send failed; buffered (${this._locationBuffer.length} pending)`);
      }
    } finally {
      this._sendInFlight = false;
    }
  }

  /**
   * POST one location payload. Returns true only on a real success. api.post
   * resolves with `{ error }` on HTTP failures (e.g. a 401 sent before the auth
   * token is ready) instead of throwing, so we must inspect the result — not
   * just rely on catch — or auth failures get silently treated as success.
   */
  private async postLocation(payload: Record<string, any>): Promise<boolean> {
    try {
      const res = await api.post('/api/team-locations', payload);
      return !(res && (res as any).error);
    } catch {
      return false;
    }
  }

  private bufferPayload(payload: Record<string, any>): void {
    if (this._locationBuffer.length >= LOCATION_BUFFER_MAX) {
      this._locationBuffer.shift();
    }
    this._locationBuffer.push({ payload });
  }

  private async flushLocationBuffer(): Promise<void> {
    if (this._locationBuffer.length === 0) return;
    const buffered = [...this._locationBuffer];
    this._locationBuffer = [];
    for (let i = 0; i < buffered.length; i++) {
      if (!(await this.postLocation(buffered[i].payload))) {
        // Keep the unsent remainder (oldest first), ahead of anything buffered
        // since we snapshotted, and stop — retry on the next call.
        this._locationBuffer = buffered.slice(i).concat(this._locationBuffer);
        break;
      }
    }
  }

  /**
   * Call right after a (re)login sets a fresh auth token. Immediately retries
   * buffered pings and re-sends the current location, so a worker whose first
   * ping 401'd before the token was ready reappears on the map without waiting
   * for the next heartbeat or 50m of movement.
   */
  async onAuthChanged(): Promise<void> {
    if (this.status !== 'tracking' && this.status !== 'foreground_only') return;
    await this.heartbeatTick();
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
   * Heartbeat: while sharing is active, re-send the last known location on a
   * fixed interval. This solves two real failure modes:
   *  1. A ping sent before the auth token was ready returns 401 and gets
   *     buffered. The buffer otherwise only flushes when the OS delivers a NEW
   *     location, which needs ~50m of movement — so a worker who turns sharing
   *     on, hits a 401, then re-logs in but stands still never re-sends and
   *     never appears on the team map.
   *  2. The server marks a worker inactive after 15 min of silence, so a
   *     stationary worker greys out / drops off even when still sharing.
   * setInterval is throttled while backgrounded, so this mainly helps in the
   * foreground (exactly the "turned it on while standing still" case);
   * background movement is still covered by the OS location task.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      void this.heartbeatTick();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  private async heartbeatTick(): Promise<void> {
    if (this.status !== 'tracking' && this.status !== 'foreground_only') return;
    if (this.currentLocation) {
      // Stamp a fresh timestamp so the server's lastSeenAt advances and the
      // worker stays "active" even when standing still. A successful send also
      // flushes any earlier buffered (e.g. 401'd) pings.
      await this.sendLocationToServer({ ...this.currentLocation, timestamp: Date.now() });
    } else {
      await this.flushLocationBuffer();
    }
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
    // Owner-set tracking window: if we're outside the allowed hours/days (and
    // not overridden by an active job/timer), stop background GPS entirely to
    // save battery. The foreground scheduler restarts it when hours reopen.
    if (!this.shouldTrackNow()) {
      void this.stopTracking();
      this.updateStatus('paused');
      return;
    }

    this.currentLocation = location;

    if (this.onLocationUpdate) {
      this.onLocationUpdate(location);
    }

    const speed = location.speed ?? 0;
    // Adaptive cadence: ramp up sampling while driving, ease off once stopped.
    const driving = speed >= 3; // ~10.8 km/h
    if (driving && this._cadenceMode !== 'driving') {
      void this.setCadenceMode('driving');
    } else if (!driving && this._cadenceMode === 'driving') {
      void this.setCadenceMode(this._overrideActive ? 'onsite' : 'balanced');
    }

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
          latitude: event.latitude,
          longitude: event.longitude,
          accuracy: event.accuracy ?? undefined,
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
    // iOS reports kCLErrorDomain Code 0 (kCLErrorLocationUnknown) as a
    // transient, self-recovering error — the OS just couldn't get a fix this
    // tick. Don't surface it as a console.error (which trips the red dev
    // overlay); log it quietly so real errors are still visible.
    if (__DEV__) console.warn('[Location Task] Transient location error (ignored):', error);
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

    // Attach coordinates to the event. The OS geofence callback carries only
    // identifier/action — but the server gates auto clock-in/out on valid
    // coordinates, so an event with no coords is silently dropped. We prefer the
    // worker's real last-known position (fast, cached) and fall back to the
    // region centre (= job site coords, always present and within radius).
    const r = region as any;
    let latitude: number | undefined =
      typeof r?.latitude === 'number' ? r.latitude : undefined;
    let longitude: number | undefined =
      typeof r?.longitude === 'number' ? r.longitude : undefined;
    let accuracy: number | null = null;
    try {
      const last = await Location.getLastKnownPositionAsync({ maxAge: 60000 });
      if (last?.coords && typeof last.coords.latitude === 'number' && typeof last.coords.longitude === 'number') {
        latitude = last.coords.latitude;
        longitude = last.coords.longitude;
        accuracy = last.coords.accuracy ?? null;
      }
    } catch {
      // last-known position unavailable → keep region-centre coords
    }

    const event: GeofenceEvent = {
      identifier: region.identifier ?? 'unknown',
      action: eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit',
      timestamp: Date.now(),
      latitude,
      longitude,
      accuracy,
    };
    
    locationTracking.handleGeofenceEvent(event);
  }
});

export const locationTracking = new LocationTrackingService();
export default locationTracking;
