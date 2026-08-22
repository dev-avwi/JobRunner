import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Platform,
  AppState,
  AppStateStatus,
  TextInput,
  Modal,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '@/components/ui/PressableRow';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { asHref } from '../../src/lib/nav';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { locationTracking } from '../../src/lib/location-tracking';
import { useAuthStore, useJobsStore, useDashboardStore, useClientsStore, useTimeTrackingStore } from '../../src/lib/store';
import offlineStorage, { useOfflineStore } from '../../src/lib/offline-storage';
import { api } from '../../src/lib/api';
import { handleDedicatedNumberError, showSmsLockedAlert, useSmsLocked } from '../../src/lib/smsGate';
import { formatCurrency as formatCurrencyUtil } from '../../src/lib/format';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { XeroBadge } from '../../src/components/ui/XeroBadge';
import { useTheme, ThemeColors, colorWithOpacity } from '../../src/lib/theme';
import { fontWeights, spacing, radius, shadows, typography, iconSizes, sizes, pageShell, usePageShell } from '../../src/lib/design-tokens';
import { NotificationBell, NotificationsPanel } from '../../src/components/NotificationsPanel';
import { getAvatarColor } from '../../src/lib/avatar-colors';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { OnboardingReminderBanner } from '../../src/components/ui/OnboardingReminderBanner';
import { OnboardingSetupFailedBanner } from '../../src/components/ui/OnboardingSetupFailedBanner';
import { useScrollToTop } from '../../src/contexts/ScrollContext';
import { usePreserveScrollOnFold } from '../../src/hooks/usePreserveScrollOnFold';
import UsageLimitBanner from '../../src/components/UsageLimitBanner';
import { SubcontractorDashboard } from '../../src/components/SubcontractorDashboard';
import { showToast } from '../../src/lib/toast';
import { Button } from '../../src/components/ui/Button';
import { SheetButton } from '../../src/components/ui/SheetButton';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import LiveActivity from '../../modules/LiveActivity/src';
import { SkeletonDashboard, Skeleton } from '../../src/components/Skeleton';
import { FirstRunWelcomeModal } from '../../src/components/FirstRunWelcomeModal';

interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  isDay: boolean;
  daily?: {
    temperatureMax: number[];
    temperatureMin: number[];
    weatherCode: number[];
    precipitationProbability: number[];
  };
}

// Round a numeric value, or show a dash when the value is missing/non-numeric.
// Guards against a stale backend returning an undefined field → "NaN" on screen.
const roundOrDash = (n: any): string => {
  const v = Number(n);
  return Number.isFinite(v) ? String(Math.round(v)) : '--';
};

const WEATHER_CODES: Record<number, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  0: { label: "Clear", icon: "sun" },
  1: { label: "Mainly Clear", icon: "sun" },
  2: { label: "Partly Cloudy", icon: "cloud" },
  3: { label: "Overcast", icon: "cloud" },
  45: { label: "Foggy", icon: "cloud" },
  48: { label: "Foggy", icon: "cloud" },
  51: { label: "Light Drizzle", icon: "cloud-drizzle" },
  53: { label: "Drizzle", icon: "cloud-drizzle" },
  55: { label: "Heavy Drizzle", icon: "cloud-drizzle" },
  56: { label: "Freezing Drizzle", icon: "cloud-drizzle" },
  57: { label: "Freezing Drizzle", icon: "cloud-drizzle" },
  61: { label: "Light Rain", icon: "cloud-rain" },
  63: { label: "Rain", icon: "cloud-rain" },
  65: { label: "Heavy Rain", icon: "cloud-rain" },
  66: { label: "Freezing Rain", icon: "cloud-rain" },
  67: { label: "Freezing Rain", icon: "cloud-rain" },
  71: { label: "Light Snow", icon: "cloud-snow" },
  73: { label: "Snow", icon: "cloud-snow" },
  75: { label: "Heavy Snow", icon: "cloud-snow" },
  77: { label: "Snow Grains", icon: "cloud-snow" },
  80: { label: "Light Showers", icon: "cloud-rain" },
  81: { label: "Showers", icon: "cloud-rain" },
  82: { label: "Heavy Showers", icon: "cloud-rain" },
  85: { label: "Snow Showers", icon: "cloud-snow" },
  86: { label: "Heavy Snow Showers", icon: "cloud-snow" },
  95: { label: "Thunderstorm", icon: "cloud-lightning" },
  96: { label: "Thunderstorm", icon: "cloud-lightning" },
  99: { label: "Severe Thunderstorm", icon: "cloud-lightning" },
};

function getWeatherInfo(code: number) {
  return WEATHER_CODES[code] || { label: "Unknown", icon: "cloud" as keyof typeof Feather.glyphMap };
}

const WEATHER_STORAGE_KEY = 'weather_settings';
const AUSTRALIAN_CITIES = [
  { name: 'Sydney, NSW', lat: -33.8688, lon: 151.2093 },
  { name: 'Melbourne, VIC', lat: -37.8136, lon: 144.9631 },
  { name: 'Brisbane, QLD', lat: -27.4698, lon: 153.0251 },
  { name: 'Perth, WA', lat: -31.9505, lon: 115.8605 },
  { name: 'Adelaide, SA', lat: -34.9285, lon: 138.6007 },
  { name: 'Gold Coast, QLD', lat: -28.0167, lon: 153.4000 },
  { name: 'Canberra, ACT', lat: -35.2809, lon: 149.1300 },
  { name: 'Hobart, TAS', lat: -42.8821, lon: 147.3272 },
  { name: 'Darwin, NT', lat: -12.4634, lon: 130.8456 },
  { name: 'Cairns, QLD', lat: -16.9186, lon: 145.7781 },
  { name: 'Townsville, QLD', lat: -19.2590, lon: 146.8169 },
  { name: 'Newcastle, NSW', lat: -32.9283, lon: 151.7817 },
  { name: 'Wollongong, NSW', lat: -34.4248, lon: 150.8931 },
  { name: 'Geelong, VIC', lat: -38.1499, lon: 144.3617 },
  { name: 'Sunshine Coast, QLD', lat: -26.6500, lon: 153.0667 },
];

interface WeatherSettings {
  mode: 'live' | 'manual' | 'hidden';
  manualCity?: string;
  manualLat?: number;
  manualLon?: number;
}

function WeatherWidget() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<WeatherSettings>({ mode: 'live' });
  const [citySearch, setCitySearch] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(WEATHER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as WeatherSettings;
        setSettings(parsed);
        loadWeather(parsed);
      } else {
        loadWeather({ mode: 'live' });
      }
    } catch {
      loadWeather({ mode: 'live' });
    }
  };

  const saveSettings = async (newSettings: WeatherSettings) => {
    setSettings(newSettings);
    await AsyncStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(newSettings));
    setShowSettings(false);
    setIsLoading(true);
    loadWeather(newSettings);
  };

  const loadWeather = async (ws: WeatherSettings) => {
    if (ws.mode === 'hidden') {
      setIsLoading(false);
      setWeather(null);
      return;
    }
    try {
      let params = '';
      if (ws.mode === 'manual' && ws.manualLat && ws.manualLon) {
        params = `?lat=${ws.manualLat}&lon=${ws.manualLon}`;
      } else {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getLastKnownPositionAsync();
            if (loc) {
              params = `?lat=${loc.coords.latitude}&lon=${loc.coords.longitude}`;
            }
          }
        } catch (locErr) {}
      }
      const response = await api.get<WeatherData>(`/api/weather${params}`);
      // Only accept a usable payload. A stale/older backend can return a
      // different shape, leaving the numeric fields undefined → NaN on screen.
      // On a bad/stale response keep the last known good weather (no flicker);
      // on first load it stays null so the card simply doesn't render.
      if (response.data && Number.isFinite(Number(response.data.temperature))) {
        setWeather(response.data);
      }
    } catch (error) {
      if (__DEV__) console.log('Error loading weather:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCities = citySearch.length > 0
    ? AUSTRALIAN_CITIES.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase()))
    : AUSTRALIAN_CITIES;

  if (settings.mode === 'hidden') {
    return (
      <TouchableOpacity
        style={[styles.weatherWidget, { alignItems: 'center', paddingVertical: spacing.md }]}
        onPress={() => setShowSettings(true)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Feather name="cloud-off" size={16} color={colors.mutedForeground} />
          <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>Weather hidden</Text>
          <Feather name="settings" size={14} color={colors.mutedForeground} />
        </View>
        {renderSettingsModal()}
      </TouchableOpacity>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.weatherWidget}>
        <ActivityIndicator size="small" color={colors.mutedForeground} />
      </View>
    );
  }

  if (!weather) return null;

  const info = getWeatherInfo(weather.weatherCode);
  const rainChance = weather.daily?.precipitationProbability?.[0] ?? 0;
  const showRainWarning = weather.precipitation > 0 || weather.weatherCode >= 51 || rainChance > 50;

  function renderSettingsModal() {
    return (
      <AppBottomSheet
        visible={showSettings}
        onDismiss={() => setShowSettings(false)}
        title="Weather Settings"
        showCloseButton
        snapPoints={['70%']}>
        <View>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.lg, backgroundColor: settings.mode === 'live' ? colorWithOpacity(colors.primary, 0.1) : 'transparent', borderWidth: 1, borderColor: settings.mode === 'live' ? colors.primary : colors.border, marginBottom: spacing.sm }}
              onPress={() => saveSettings({ mode: 'live' })}
              activeOpacity={0.7}
            >
              <Feather name="navigation" size={18} color={settings.mode === 'live' ? colors.primary : colors.mutedForeground} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={{ fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.foreground }}>Use Live Location</Text>
                <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>Weather based on your GPS</Text>
              </View>
              {settings.mode === 'live' && <Feather name="check" size={18} color={colors.primary} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.lg, backgroundColor: settings.mode === 'hidden' ? colorWithOpacity(colors.primary, 0.1) : 'transparent', borderWidth: 1, borderColor: settings.mode === 'hidden' ? colors.primary : colors.border, marginBottom: spacing.lg }}
              onPress={() => saveSettings({ mode: 'hidden' })}
              activeOpacity={0.7}
            >
              <Feather name="eye-off" size={18} color={settings.mode === 'hidden' ? colors.primary : colors.mutedForeground} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={{ fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.foreground }}>Hide Weather</Text>
                <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>Remove from dashboard</Text>
              </View>
              {settings.mode === 'hidden' && <Feather name="check" size={18} color={colors.primary} />}
            </TouchableOpacity>

            <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.mutedForeground, marginBottom: spacing.sm }}>Or choose a city:</Text>
            <TextInput
              style={{ backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.md, fontSize: typography.sizes.md, color: colors.foreground, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm }}
              placeholder="Search cities..."
              placeholderTextColor={colors.mutedForeground}
              value={citySearch}
              onChangeText={setCitySearch}
            />
            <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
              {filteredCities.map((city) => (
                <TouchableOpacity
                  key={city.name}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, backgroundColor: settings.manualCity === city.name ? colorWithOpacity(colors.primary, 0.1) : 'transparent' }}
                  onPress={() => {
                    setCitySearch('');
                    saveSettings({ mode: 'manual', manualCity: city.name, manualLat: city.lat, manualLon: city.lon });
                  }}
                  activeOpacity={0.7}
                >
                  <Feather name="map-pin" size={16} color={settings.manualCity === city.name ? colors.primary : colors.mutedForeground} />
                  <Text style={{ fontSize: typography.sizes.md, color: settings.manualCity === city.name ? colors.primary : colors.foreground, marginLeft: spacing.sm, fontWeight: settings.manualCity === city.name ? fontWeights.semibold : fontWeights.regular }}>{city.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
        </View>
      </AppBottomSheet>
    );
  }

  return (
    <View style={styles.weatherWidget}>
      <View style={styles.weatherMainRow}>
        <View style={[styles.weatherIconContainer, { backgroundColor: weather.isDay ? colorWithOpacity(colors.warning, 0.12) : colorWithOpacity(colors.info, 0.12) }]}>
          <Feather
            name={info.icon}
            size={24}
            color={weather.isDay ? colors.warning : colors.info}
          />
        </View>
        <View style={[styles.weatherTextContent, { flex: 1 }]}>
          <View style={styles.weatherTempRow}>
            <Text style={styles.weatherTemp}>{roundOrDash(weather.temperature)}</Text>
            <Text style={styles.weatherDegree}>°C</Text>
            <Text style={styles.weatherLabel}>{info.label}</Text>
          </View>
          <View style={styles.weatherDetailsRow}>
            <View style={styles.weatherDetailItem}>
              <Feather name="thermometer" size={12} color={colors.mutedForeground} />
              <Text style={styles.weatherDetailText}>Feels {roundOrDash(weather.apparentTemperature)}°</Text>
            </View>
            <View style={styles.weatherDetailItem}>
              <Feather name="droplet" size={12} color={colors.mutedForeground} />
              <Text style={styles.weatherDetailText}>{Number.isFinite(Number(weather.humidity)) ? weather.humidity : '--'}%</Text>
            </View>
            <View style={styles.weatherDetailItem}>
              <Feather name="wind" size={12} color={colors.mutedForeground} />
              <Text style={styles.weatherDetailText}>{roundOrDash(weather.windSpeed)} km/h</Text>
            </View>
          </View>
        </View>
        <Button
          size="icon"
          variant="ghost"
          onPress={() => setShowSettings(true)}
          icon={<Feather name="settings" size={16} color={colors.mutedForeground} />}
        >{null}</Button>
      </View>
      {settings.mode === 'manual' && settings.manualCity && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs }}>
          <Feather name="map-pin" size={11} color={colors.mutedForeground} />
          <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>{settings.manualCity}</Text>
        </View>
      )}
      {showRainWarning && (
        <View style={[styles.weatherRainWarning, { backgroundColor: colorWithOpacity(colors.info, 0.08) }]}>
          <Feather name="cloud-rain" size={14} color={colors.info} />
          <Text style={[styles.weatherRainText, { color: colors.info }]}>
            {weather.precipitation > 0
              ? `Rain expected (${weather.precipitation}mm)`
              : `${rainChance}% chance of rain today`}
          </Text>
        </View>
      )}
      {renderSettingsModal()}
    </View>
  );
}

// Activity Feed Component - matches web Recent Activity section
function ActivityFeed({ 
  activities, 
  onActivityPress,
  isLoading 
}: { 
  activities: any[]; 
  onActivityPress?: (activity: any) => void;
  isLoading?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const getActivityIcon = (type: string): keyof typeof Feather.glyphMap => {
    switch (type) {
      case 'job_created':
      case 'job_status_change':
      case 'job_scheduled':
      case 'job_started':
      case 'job_completed':
      case 'job':
        return 'briefcase';
      case 'quote_created':
      case 'quote_sent':
      case 'quote':
        return 'file-text';
      case 'invoice_created':
      case 'invoice_sent':
      case 'invoice':
        return 'dollar-sign';
      case 'invoice_paid':
      case 'payment_received':
      case 'payment':
        return 'credit-card';
      case 'client':
        return 'user';
      default:
        return 'activity';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'job_created':
      case 'job_scheduled':
      case 'job':
        return colors.primary;
      case 'job_started':
      case 'job_status_change':
        return colors.warning;
      case 'job_completed':
        return colors.success;
      case 'quote_created':
      case 'quote_sent':
      case 'quote':
        return colors.info;
      case 'invoice_created':
      case 'invoice_sent':
      case 'invoice':
        return colors.warning;
      case 'invoice_paid':
      case 'payment_received':
      case 'payment':
        return colors.success;
      case 'client':
        return colors.mutedForeground;
      default:
        return colors.mutedForeground;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  };
  
  if (isLoading) {
    return (
      <View style={[styles.activityEmpty, { paddingVertical: spacing.xl }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  // Belt-and-braces: never trust the prop is an array. If a caller passes an
  // error object or null, treat as empty instead of crashing the dashboard.
  const safeActivities = Array.isArray(activities) ? activities : [];

  if (safeActivities.length === 0) {
    return (
      <View style={styles.activityEmpty}>
        <Feather name="activity" size={sizes.emptyIconSm} color={colors.mutedForeground} />
        <Text style={styles.activityEmptyText}>No recent activity</Text>
      </View>
    );
  }

  return (
    <View style={styles.activityList}>
      {safeActivities.slice(0, 5).map((activity, index) => {
        const isClickable = activity.navigationPath || activity.entityId;
        
        return (
          <PressableRow 
            key={activity.id || index} 
            style={styles.activityItem}
            onPress={() => isClickable && onActivityPress?.(activity)}

            disabled={!isClickable}
          >
            <View style={[styles.activityIcon, { backgroundColor: colors.muted }]}>
              <Feather 
                name={getActivityIcon(activity.type)} 
                size={iconSizes.md} 
                color={getActivityColor(activity.type)} 
              />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle} numberOfLines={1}>{activity.title}</Text>
              <Text style={styles.activityDescription} numberOfLines={1}>{activity.description}</Text>
              <Text style={styles.activityTime}>{formatTimeAgo(activity.timestamp || activity.createdAt)}</Text>
            </View>
            {isClickable && (
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            )}
          </PressableRow>
        );
      })}
    </View>
  );
}

// Time Tracking Widget - Enhanced with job info and manual controls
// Uses global useTimeTrackingStore for unified state with Time Tracking page
function TimeTrackingWidget({ showTeam = false }: { showTeam?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const confirm = useConfirmDialog();
  const [teamTimers, setTeamTimers] = useState<any[]>([]);
  
  // Use global store for activeTimer - synced with Time Tracking page
  const { 
    activeTimer, 
    fetchActiveTimer, 
    startTimer: storeStartTimer, 
    stopTimer: storeStopTimer,
    pauseTimer: storePauseTimer,
    resumeTimer: storeResumeTimer,
  } = useTimeTrackingStore();
  
  // Local state only for UI concerns
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [totalMinutesToday, setTotalMinutesToday] = useState(0);
  const [todayEntries, setTodayEntries] = useState<any[]>([]);
  const [todaysJobs, setTodaysJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStopping, setIsStopping] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isStartingTimer, setIsStartingTimer] = useState<string | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // Fetch active timer when screen gains focus - keeps dashboard and time tracking page in sync
  useFocusEffect(
    useCallback(() => {
      fetchActiveTimer();
      loadDashboardData();
      loadTodaysJobs();
    }, [])
  );

  // Who's clocked in across the whole business (owners/managers only).
  const loadTeamTimers = useCallback(async () => {
    if (!showTeam) return;
    try {
      const res = await api.get('/api/time-entries/active/team');
      if (Array.isArray(res.data)) setTeamTimers(res.data);
    } catch {
      // Non-critical — leave the last known list in place.
    }
  }, [showTeam]);

  useFocusEffect(
    useCallback(() => {
      if (!showTeam) return;
      loadTeamTimers();
      const iv = setInterval(loadTeamTimers, 30000);
      return () => clearInterval(iv);
    }, [showTeam, loadTeamTimers])
  );

  useEffect(() => {
    loadDashboardData();
    loadTodaysJobs();
    // Refresh dashboard data every 12 seconds so newly-assigned jobs appear on
    // the worker's phone within seconds of the owner assigning them — push
    // notifications can't be relied on in dev builds. On-focus refresh and
    // foreground AppState refresh below cover the rest.
    const interval = setInterval(() => {
      loadDashboardData();
      loadTodaysJobs();
    }, 12000);

    // Auto-refresh when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground - refresh data
        fetchActiveTimer();
        loadDashboardData();
        loadTodaysJobs();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  const loadTodaysJobs = async () => {
    try {
      const { default: api } = await import('../../src/lib/api');
      const response = await api.get('/api/jobs/today');
      if (response.data) {
        // Filter to scheduled and in_progress jobs only
        const activeJobs = (response.data as any[]).filter(
          (job: any) => job.status === 'scheduled' || job.status === 'in_progress' || job.status === 'pending'
        );
        setTodaysJobs(activeJobs);
      }
    } catch (error) {
      if (__DEV__) console.log('Error loading todays jobs for timer:', error);
      setTodaysJobs([]);
    }
  };

  const proceedWithStartJob = async (job: any) => {
    try {
      const { default: api } = await import('../../src/lib/api');
      if (job.status === 'scheduled' || job.status === 'pending') {
        await api.patch(`/api/jobs/${job.id}/status`, { status: 'in_progress' });
      }
      const success = await storeStartTimer(job.id, job.title);
      if (success) {
        showToast({ type: 'info', message: 'Job Started', description: `Now tracking time for "${job.title}"` });
        loadDashboardData();
        loadTodaysJobs();
      } else {
        showToast({ type: 'error', message: 'Failed to start timer' });
      }
    } catch (error: any) {
      showToast({ type: 'error', message: 'Failed to start job' });
    } finally {
      setIsStartingTimer(null);
    }
  };

  const handleStartTimerForJob = async (job: any) => {
    setIsStartingTimer(job.id);
    try {
      const { isOnline } = useOfflineStore.getState();

      // Offline path: start timer locally and queue for sync. No safety/status checks.
      if (!isOnline) {
        const success = await storeStartTimer(job.id, job.title);
        if (success) {
          showToast({ type: 'info', message: 'Timer Started Offline', description: `Tracking time for "${job.title}". Will sync when back online.` });
          loadDashboardData();
        } else {
          showToast({ type: 'error', message: 'Failed to start timer' });
        }
        setIsStartingTimer(null);
        return;
      }

      if (job.status === 'in_progress') {
        const success = await storeStartTimer(job.id, job.title);
        if (success) {
          showToast({ type: 'info', message: 'Timer Started', description: `Tracking time for "${job.title}"` });
          loadDashboardData();
        } else {
          showToast({ type: 'error', message: 'Failed to start timer' });
        }
        setIsStartingTimer(null);
        return;
      }

      try {
        const { default: api } = await import('../../src/lib/api');
        const safetyRes = await api.get(`/api/jobs/${job.id}/safety-status`);
        const safety = safetyRes.data as any;
        const hasSafetyIssues = safety && (
          (safety.pendingForms && safety.pendingForms > 0) ||
          (safety.draftSwms && safety.draftSwms > 0) ||
          (safety.unsignedSwms && safety.unsignedSwms > 0)
        );

        if (hasSafetyIssues) {
          const warnings: string[] = [];
          if (safety.pendingForms > 0) warnings.push('Safety forms not completed');
          if (safety.draftSwms > 0) warnings.push(`${safety.draftSwms} SWMS in draft`);
          if (safety.unsignedSwms > 0) warnings.push(`${safety.unsignedSwms} SWMS unsigned`);

          Alert.alert(
            'Safety Check Required',
            `${warnings.join(', ')}. Complete safety documentation before starting work.\n\nWHS Compliance: SWMS documents are legally required for high-risk construction work.`,
            [
              { text: 'View Job', onPress: () => { setIsStartingTimer(null); router.push(`/job/${job.id}`); } },
              { text: 'Start Anyway', style: 'destructive', onPress: () => proceedWithStartJob(job) },
              { text: 'Cancel', style: 'cancel', onPress: () => setIsStartingTimer(null) }
            ]
          );
          return;
        }
      } catch (e) {
      }

      Alert.alert(
        'Start Job',
        `Start "${job.title}"?\n\nThe job timer will begin automatically.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setIsStartingTimer(null) },
          { text: 'Start Job', onPress: () => proceedWithStartJob(job) }
        ]
      );
    } catch (error: any) {
      showToast({ type: 'error', message: 'Failed to start job' });
      setIsStartingTimer(null);
    }
  };

  const activeTimerRef = useRef(activeTimer);
  activeTimerRef.current = activeTimer;

  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (activeTimer && !activeTimer.isPaused) {
      const updateElapsed = () => {
        const current = activeTimerRef.current;
        if (!current || current.isPaused) {
          setElapsedTime('00:00:00');
          return;
        }
        const startTime = new Date(current.startTime).getTime();
        if (isNaN(startTime)) {
          setElapsedTime('00:00:00');
          return;
        }
        const pausedDuration = parseFloat(String(current.pausedDuration || 0));
        const elapsed = Math.max(0, Date.now() - startTime - (pausedDuration * 60000));
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        setElapsedTime(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      };
      updateElapsed();
      timerIntervalRef.current = setInterval(updateElapsed, 1000) as unknown as ReturnType<typeof setInterval>;
    } else if (!activeTimer) {
      setElapsedTime('00:00:00');
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [activeTimer?.id, activeTimer?.isPaused, activeTimer?.startTime]);

  // Load dashboard data (today's entries and stats) - activeTimer comes from the store
  const loadDashboardData = async () => {
    try {
      const { default: api } = await import('../../src/lib/api');
      const dashboardResponse = await api.get('/api/time-tracking/dashboard');
      
      if (dashboardResponse.data) {
        const entries = (dashboardResponse.data as any).recentEntries || [];
        // Store completed entries for display
        const completedEntries = entries.filter((e: any) => e.endTime);
        setTodayEntries(completedEntries.slice(0, 5)); // Show last 5 entries
        
        const total = entries.reduce((sum: number, e: any) => {
          if (e.duration) return sum + e.duration;
          if (e.endTime) {
            const start = new Date(e.startTime).getTime();
            const end = new Date(e.endTime).getTime();
            return sum + Math.floor((end - start) / 60000);
          }
          return sum;
        }, 0);
        setTotalMinutesToday(total);
      }
    } catch (error) {
      if (__DEV__) console.log('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakeBreak = async () => {
    if (!activeTimer) return;
    setIsPausing(true);
    try {
      const success = await storePauseTimer();
      if (!success) {
        showToast({ type: 'error', message: 'Failed to start break' });
      }
    } catch (error: any) {
      showToast({ type: 'error', message: 'Failed to start break' });
    } finally {
      setIsPausing(false);
    }
  };

  const handleResumeWork = async () => {
    if (!activeTimer) return;
    setIsPausing(true);
    try {
      
      const success = await storeResumeTimer();
      if (!success) {
        showToast({ type: 'error', message: 'Failed to resume work' });
      }
    } catch (error: any) {
      showToast({ type: 'error', message: 'Failed to resume work' });
    } finally {
      setIsPausing(false);
    }
  };

  const handleCancelTimer = async () => {
    if (!activeTimer) return;
    
    const ok = await confirm({ title: 'Cancel Timer', message: 'Are you sure you want to cancel this timer? Time will not be saved.', confirmText: 'Cancel Timer', cancelText: 'Keep Tracking', destructive: true });
    if (ok) {
      setIsCancelling(true);
      try {
        const { isOnline } = useOfflineStore.getState();

        // Local-only timer (never synced) — discard locally so it never reaches the server
        if (typeof activeTimer.id === 'string' && activeTimer.id.startsWith('local_')) {
          await offlineStorage.discardLocalTimeEntry(activeTimer.id);
          useTimeTrackingStore.setState({ activeTimer: null });
          fetchActiveTimer();
          LiveActivity.end().catch(() => {});
          showToast({ type: 'success', message: 'Timer Cancelled', description: 'Time was not recorded' });
          loadDashboardData();
          setIsCancelling(false);
          return;
        }

        if (!isOnline) {
          showToast({ type: 'info', message: 'Offline', description: 'Cannot cancel a synced timer while offline. Stop it instead — you can edit or delete the entry once back online.' });
          setIsCancelling(false);
          return;
        }

        const { default: api } = await import('../../src/lib/api');
        await api.delete(`/api/time-entries/${activeTimer.id}`);

        // Refresh from store to clear activeTimer
        fetchActiveTimer();
        LiveActivity.end().catch(() => {});
        showToast({ type: 'success', message: 'Timer Cancelled', description: 'Time was not recorded' });
        loadDashboardData();
      } catch (error: any) {
        showToast({ type: 'error', message: 'Error', description: 'Failed to cancel timer' });
      } finally {
        setIsCancelling(false);
      }
    }
  };

  const handleStopTimer = async () => {
    if (!activeTimer) return;
    setIsStopping(true);
    try {
      const { isOnline } = useOfflineStore.getState();
      
      if (!isOnline) {
        await offlineStorage.stopTimeEntryOffline(activeTimer.id);
        // Refresh from store to update state
        fetchActiveTimer();
        showToast({ type: 'info', message: 'Saved Offline', description: 'Time entry will sync when online' });
        loadDashboardData();
        return;
      }
      
      // Use the store's stopTimer - it will update activeTimer globally
      const success = await storeStopTimer();
      
      if (success) {
        showToast({ type: 'info', message: 'Timer Stopped', description: 'Time has been recorded' });
        loadDashboardData();
      } else {
        showToast({ type: 'error', message: 'Failed to stop timer' });
      }
    } catch (error: any) {
      if (error.message?.includes('Network')) {
        await offlineStorage.stopTimeEntryOffline(activeTimer.id);
        fetchActiveTimer();
        showToast({ type: 'info', message: 'Saved Offline', description: 'Changes will sync when connection restored' });
        loadDashboardData();
      } else {
        showToast({ type: 'error', message: 'Failed to stop timer' });
      }
    } finally {
      setIsStopping(false);
    }
  };

  const handleViewJob = () => {
    if (activeTimer?.jobId) {
      router.push(`/job/${activeTimer.jobId}`);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.timeTrackingWidget, { padding: spacing.md, gap: spacing.sm }]}>
        <Skeleton width="50%" height={14} />
        <Skeleton width="70%" height={28} />
        <Skeleton width="40%" height={12} />
      </View>
    );
  }

  const hours = Math.floor(totalMinutesToday / 60);
  const mins = totalMinutesToday % 60;
  const isOnBreak = activeTimer?.isBreak === true;

  // Helper to format duration for entries
  const formatEntryDuration = (entry: any) => {
    let mins = 0;
    if (entry.duration) {
      mins = entry.duration;
    } else if (entry.endTime) {
      const start = new Date(entry.startTime).getTime();
      const end = new Date(entry.endTime).getTime();
      mins = Math.floor((end - start) / 60000);
    }
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Today's entries list component - shows active timer first if running
  const renderTodayEntries = () => {
    // Show section if there's an active timer or completed entries
    if (!activeTimer && todayEntries.length === 0) return null;
    
    return (
      <View style={styles.todayEntriesContainer}>
        <Text style={styles.todayEntriesTitle}>Today's Work</Text>
        
        {/* Show active timer at the top with tracking indicator */}
        {activeTimer && (
          <TouchableOpacity
            style={styles.todayEntryRow}
            onPress={() => activeTimer.jobId && router.push(`/job/${activeTimer.jobId}`)}
            disabled={!activeTimer.jobId}
            activeOpacity={0.7}
          >
            <View style={[styles.todayEntryDot, { backgroundColor: activeTimer.isBreak ? colors.warning : colors.success }]} />
            <Text style={[styles.todayEntryJobTitle, { color: activeTimer.isBreak ? colors.warning : colors.success }]} numberOfLines={1}>
              {activeTimer.isBreak ? 'On Break' : (activeTimer.description || activeTimer.jobTitle || 'General time')}
            </Text>
            <Text style={[styles.todayEntryDuration, { color: activeTimer.isBreak ? colors.warning : colors.success }]}>
              {activeTimer.isBreak ? 'break' : 'tracking'}
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Show completed entries */}
        {todayEntries.map((entry, index) => (
          <TouchableOpacity
            key={entry.id || index}
            style={styles.todayEntryRow}
            onPress={() => entry.jobId && router.push(`/job/${entry.jobId}`)}
            disabled={!entry.jobId}
            activeOpacity={0.7}
          >
            <View style={styles.todayEntryDot} />
            <Text style={styles.todayEntryJobTitle} numberOfLines={1}>
              {entry.description || entry.jobTitle || 'General time'}
            </Text>
            <Text style={styles.todayEntryDuration}>{formatEntryDuration(entry)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Team on the clock - shows other workers currently tracking time across all jobs.
  const otherActiveTimers = teamTimers.filter((t: any) => !t.isCurrentUser);
  const renderTeamOnClock = () => {
    if (!showTeam || otherActiveTimers.length === 0) return null;
    return (
      <View style={styles.teamOnClockContainer}>
        <View style={styles.teamOnClockHeader}>
          <View style={styles.teamOnClockIcon}>
            <Feather name="users" size={18} color={colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.teamOnClockTitle}>Team on the clock</Text>
            <Text style={styles.teamOnClockSubtitle}>
              {otherActiveTimers.length} working now
            </Text>
          </View>
        </View>
        {otherActiveTimers.map((t: any, idx: number) => {
          const hrs = Math.floor(t.elapsedMinutes / 60);
          const m = t.elapsedMinutes % 60;
          const timeStr = hrs > 0 ? `${hrs}h ${m}m` : `${m}m`;
          const active = !(t.isPaused || t.isBreak);
          const statusColor = active ? colors.success : colors.warning;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.teamOnClockRow, idx > 0 && styles.teamOnClockRowBorder]}
              onPress={() => t.jobId && router.push(`/job/${t.jobId}`)}
              disabled={!t.jobId}
              activeOpacity={0.7}
            >
              <TeamAvatar
                name={t.workerName}
                userId={t.userId ? String(t.userId) : undefined}
                themeColor={t.themeColor}
                size={36}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.teamOnClockName} numberOfLines={1}>{t.workerName}</Text>
                <Text style={styles.teamOnClockJob} numberOfLines={1}>{t.jobTitle || 'No job'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.teamOnClockTime, { color: statusColor }]}>{timeStr}</Text>
                <View style={[styles.teamOnClockBadge, { backgroundColor: colorWithOpacity(statusColor, 0.12) }]}>
                  <View style={[styles.teamOnClockDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.teamOnClockBadgeText, { color: statusColor }]}>
                    {t.isPaused ? 'Paused' : t.isBreak ? 'On Break' : 'Working'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const availableJobs = todaysJobs.filter((job: any) => !activeTimer || activeTimer.jobId !== job.id);

  if (!activeTimer) {
    return (
      <View style={styles.timerWidgetContainer}>
        <View style={styles.timeTrackingWidget}>
          <View style={styles.timeTrackingContent}>
            <View style={styles.timerIconContainer}>
              <Feather name="clock" size={24} color={colors.mutedForeground} />
            </View>
            <View style={styles.timerTextContent}>
              <Text style={styles.totalTimeToday}>{hours}h {mins}m today</Text>
              <Text style={styles.timerSubtext}>No active timer</Text>
            </View>
          </View>
        </View>
        
        {/* Job list to start timer */}
        {availableJobs.length > 0 && (
          <View style={styles.timerJobListContainer}>
            <Text style={styles.timerJobListLabel}>Start Job</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timerJobListScroll}
            >
              {availableJobs.map((job: any) => (
                <TouchableOpacity
                  key={job.id}
                  style={styles.timerJobItem}
                  onPress={() => handleStartTimerForJob(job)}
                  disabled={isStartingTimer !== null}
                  activeOpacity={0.8}
                  data-testid={`button-start-timer-${job.id}`}
                >
                  {isStartingTimer === job.id ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <View style={styles.timerJobItemHeader}>
                        <View style={[
                          styles.timerJobStatusDot, 
                          { backgroundColor: job.status === 'in_progress' ? colors.warning : colors.info }
                        ]} />
                        <Text style={styles.timerJobItemTitle} numberOfLines={1}>{job.title}</Text>
                      </View>
                      {job.clientName && (
                        <Text style={styles.timerJobItemMeta} numberOfLines={1}>{job.clientName}</Text>
                      )}
                      <View style={styles.timerJobItemAction}>
                        <Feather name="play-circle" size={14} color={colors.primary} />
                        <Text style={styles.timerJobItemActionText}>{job.status === 'in_progress' ? 'Resume' : 'Start Job'}</Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        
        {renderTeamOnClock()}
        {renderTodayEntries()}
      </View>
    );
  }

  return (
    <View style={[styles.timerActiveContainer]}>
      <View style={[styles.timeTrackingWidget, styles.timeTrackingWidgetActive, isOnBreak && styles.timeTrackingWidgetBreak]}>
        <View style={styles.timeTrackingContent}>
          <View style={[styles.timerIconContainer, styles.timerIconContainerActive, isOnBreak && styles.timerIconContainerBreak]}>
            {isOnBreak ? (
              <Feather name="coffee" size={24} color={colors.warning} />
            ) : (
              <View style={styles.pulsingDot} />
            )}
          </View>
          <View style={styles.timerTextContent}>
            <View style={styles.timerTimeRow}>
              <Text
                style={[styles.elapsedTime, isOnBreak && styles.elapsedTimeBreak]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >{elapsedTime}</Text>
              {isOnBreak && (
                <View style={styles.breakBadge}>
                  <Text style={styles.breakBadgeText}>BREAK</Text>
                </View>
              )}
            </View>
            <TouchableOpacity 
              onPress={handleViewJob}
              disabled={!activeTimer.jobId}
              activeOpacity={0.7}
            >
              <Text style={[styles.timerJobTitle, activeTimer.jobId && styles.timerJobTitleLink]} numberOfLines={1}>
                {isOnBreak ? 'On Break' : (activeTimer.description || activeTimer.jobTitle || 'General time')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      <View style={styles.timerControlsRow}>
        {isOnBreak ? (
          <TouchableOpacity
            style={[styles.timerControlButton, styles.resumeButton]}
            onPress={handleResumeWork}
            disabled={isPausing}
            activeOpacity={0.8}
            data-testid="button-resume-timer"
          >
            {isPausing ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Feather name="play" size={16} color={colors.white} />
                <Text style={styles.resumeButtonText}>Resume</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.timerControlButton, styles.breakButton]}
            onPress={handleTakeBreak}
            disabled={isPausing}
            activeOpacity={0.8}
            data-testid="button-break-timer"
          >
            {isPausing ? (
              <ActivityIndicator size="small" color={colors.warning} />
            ) : (
              <>
                <Feather name="coffee" size={16} color={colors.warning} />
                <Text style={styles.breakButtonText}>Break</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.timerControlButton, styles.saveButton]}
          onPress={handleStopTimer}
          disabled={isStopping}
          activeOpacity={0.8}
          data-testid="button-save-timer"
        >
          {isStopping ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Feather name="check-circle" size={16} color={colors.primary} />
              <Text style={styles.saveButtonText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.timerControlButton, styles.cancelButton]}
          onPress={handleCancelTimer}
          disabled={isCancelling}
          activeOpacity={0.8}
          data-testid="button-cancel-timer"
        >
          {isCancelling ? (
            <ActivityIndicator size="small" color={colors.destructive} />
          ) : (
            <Feather name="x" size={18} color={colors.destructive} />
          )}
        </TouchableOpacity>
      </View>
      {renderTeamOnClock()}
      {renderTodayEntries()}
    </View>
  );
}

// This Week Jobs Component - matches web Staff Dashboard
function ThisWeekSection({ jobs, onViewJob }: { jobs: any[]; onViewJob: (id: string) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    return date.toLocaleDateString('en-AU', { 
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  if (jobs.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionTitleIcon}>
            <Feather name="calendar" size={iconSizes.md} color={colors.primary} />
          </View>
          <Text style={styles.sectionTitle}>This Week</Text>
        </View>
        <View style={styles.weekBadge}>
          <Text style={styles.weekBadgeText}>{jobs.length} jobs</Text>
        </View>
      </View>

      <View style={styles.thisWeekCard}>
        {jobs.slice(0, 5).map((job, index) => (
          <TouchableOpacity
            key={job.id}
            style={[styles.weekJobItem, index < Math.min(jobs.length, 5) - 1 && styles.weekJobItemBorder]}
            onPress={() => onViewJob(job.id)}
            activeOpacity={0.7}
          >
            <View style={styles.weekJobContent}>
              <Text style={styles.weekJobTitle} numberOfLines={1}>{job.title}</Text>
              <Text style={styles.weekJobMeta}>
                {job.scheduledAt && formatDate(job.scheduledAt)}
                {job.clientName && ` • ${job.clientName}`}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}
        {jobs.length > 5 && (
          <TouchableOpacity
            style={styles.viewAllWeekButton}
            onPress={() => router.push('/(tabs)/jobs')}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllWeekText}>View all {jobs.length} jobs this week</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// KPI Stat Card Component - matches web feed-card styling
interface MobileOperationalAlert {
  id: string;
  type: string;
  severity: "urgent" | "important" | "info";
  title: string;
  message: string;
  actionType: string;
  actionLabel: string;
  relatedJobId?: string;
  relatedUserId?: string;
  relatedInvoiceId?: string;
  timeInfo?: string;
}

function OperationalAlertsCard() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [alerts, setAlerts] = useState<MobileOperationalAlert[]>([]);
  const [summary, setSummary] = useState({ total: 0, urgent: 0, important: 0, info: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await api.get<{ alerts: MobileOperationalAlert[]; summary: typeof summary }>('/api/operational-alerts');
      if (response.data) {
        setAlerts(Array.isArray(response.data.alerts) ? response.data.alerts : []);
        setSummary(response.data.summary || { total: 0, urgent: 0, important: 0, info: 0 });
      }
    } catch (err) {
      if (__DEV__) console.log('Error fetching operational alerts:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleAlertAction = useCallback((alert: MobileOperationalAlert) => {
    if (alert.type === 'subcontractor_invoice') {
      router.push((alert.relatedInvoiceId
        ? `/more/team-management?invoice=${alert.relatedInvoiceId}`
        : '/more/team-management') as any);
      return;
    }
    if (alert.actionType === 'navigate' || alert.actionType === 'nudge') {
      if (alert.relatedJobId) {
        router.push(`/job/${alert.relatedJobId}` as any);
      } else {
        router.push('/more/dispatch-board' as any);
      }
    } else if (alert.relatedJobId) {
      if (alert.type === 'unassigned_upcoming') {
        router.push(`/job/${alert.relatedJobId}?action=assign`);
      } else if (alert.type === 'uninvoiced_job') {
        router.push(`/job/${alert.relatedJobId}?action=invoice`);
      } else {
        router.push(`/job/${alert.relatedJobId}`);
      }
    }
  }, []);

  const dismissAlert = useCallback((alertId: string) => {
    setDismissedIds(prev => new Set([...prev, alertId]));
  }, []);

  const dismissAll = useCallback(() => {
    setDismissed(true);
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.card, { padding: spacing.md }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (dismissed) return null;

  const visibleAlerts = alerts.filter(a => !dismissedIds.has(a.id));
  if (visibleAlerts.length === 0) return null;

  const displayAlerts = expanded ? visibleAlerts : visibleAlerts.slice(0, 3);
  const visibleUrgent = visibleAlerts.filter(a => a.severity === 'urgent').length;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'urgent': return colors.destructive;
      case 'important': return colors.warning;
      default: return colors.info;
    }
  };

  const getSeverityIcon = (type: string): keyof typeof Feather.glyphMap => {
    switch (type) {
      case 'schedule_risk': return 'clock';
      case 'unassigned_upcoming': return 'user-plus';
      case 'job_overrun': return 'alert-circle';
      case 'worker_idle': return 'users';
      case 'schedule_conflict': return 'git-branch';
      case 'uninvoiced_job': return 'dollar-sign';
      case 'subcontractor_invoice': return 'file-text';
      default: return 'alert-triangle';
    }
  };

  return (
    <View style={{ marginBottom: spacing['3xl'] + 4 }}>
      <View style={{ padding: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 28, height: 28, borderRadius: radius.md, backgroundColor: colorWithOpacity(colors.destructive, 0.12), alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="radio" size={14} color={colors.destructive} />
            </View>
            <Text style={{ ...typography.bodySemibold, color: colors.foreground, fontWeight: fontWeights.bold }}>Attention Needed</Text>
            {visibleUrgent > 0 && (
              <View style={{ backgroundColor: colorWithOpacity(colors.destructive, 0.15), paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm }}>
                <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: colors.destructive }}>{visibleUrgent} urgent</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ backgroundColor: colorWithOpacity(colors.primary, 0.1), paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full }}>
              <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.primary }}>{visibleAlerts.length}</Text>
            </View>
            <TouchableOpacity onPress={dismissAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {displayAlerts.map((alert, index) => {
          const severityColor = getSeverityColor(alert.severity);
          const iconName = getSeverityIcon(alert.type);

          return (
            <View
              key={alert.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingVertical: spacing.sm,
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: colors.border,
              }}
            >
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 }}
                onPress={() => handleAlertAction(alert)}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 3,
                  height: 32,
                  borderRadius: 2,
                  backgroundColor: severityColor,
                }} />
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: radius.md,
                  backgroundColor: colorWithOpacity(severityColor, 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Feather name={iconName} size={14} color={severityColor} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground, flexShrink: 1, minWidth: 0 }} numberOfLines={1}>{alert.title}</Text>
                    {alert.timeInfo && (
                      <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, flexShrink: 1, minWidth: 0 }} numberOfLines={1} ellipsizeMode="clip">{alert.timeInfo}</Text>
                    )}
                  </View>
                  <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 1 }} numberOfLines={1}>{alert.message}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleAlertAction(alert)}
                activeOpacity={0.7}
                style={{
                  flexShrink: 0,
                  minWidth: 76,
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: radius.md,
                  backgroundColor: alert.severity === 'urgent' ? colors.primary : colorWithOpacity(colors.primary, 0.1),
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: typography.sizes.xs,
                    fontWeight: fontWeights.semibold,
                    color: alert.severity === 'urgent' ? colors.primaryForeground : colors.primary,
                  }}
                >{alert.actionLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => dismissAlert(alert.id)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                style={{ paddingLeft: 2 }}
              >
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          );
        })}

        {visibleAlerts.length > 3 && (
          <TouchableOpacity
            style={{ alignItems: 'center', paddingTop: spacing.sm, flexDirection: 'row', justifyContent: 'center', gap: 4 }}
            onPress={() => setExpanded(!expanded)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.medium, color: colors.primary }}>
              {expanded ? 'Show less' : `View all ${visibleAlerts.length} alerts`}
            </Text>
            <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function KPICard({ 
  title, 
  value, 
  icon,
  iconBg,
  iconColor,
  onPress,
}: { 
  title: string; 
  value: string | number; 
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  iconColor: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <PressableRow
      style={styles.kpiCard}
      onPress={onPress}

    >
      <View style={styles.kpiCardContent}>
        <View style={[styles.kpiIconContainer, { backgroundColor: iconBg }]}>
          <Feather name={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.kpiTextContainer}>
          <Text style={styles.kpiValue}>{value}</Text>
          <Text style={styles.kpiTitle}>{title}</Text>
        </View>
      </View>
    </PressableRow>
  );
}

// Job Card Component - matches web Today's Schedule cards
function TodayJobCard({ 
  job, 
  clients,
  isFirst,
  onPress,
  onStartJob,
  onCompleteJob,
  onOnMyWay,
  isUpdating,
  onGetDirections,
  orderNumber,
  distanceInfo,
  smsLocked,
}: { 
  job: any;
  clients: any[];
  isFirst: boolean;
  onPress: () => void;
  onStartJob: (id: string) => void;
  onCompleteJob: (id: string) => void;
  onOnMyWay: (id: string, clientId?: string) => void;
  isUpdating: boolean;
  onGetDirections?: (job: any) => void;
  orderNumber?: number;
  distanceInfo?: { distanceKm: number; driveMinutes: number };
  smsLocked?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return { hour: '', period: '' };
    const date = new Date(dateStr);
    const time = date.toLocaleTimeString('en-AU', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    const parts = time.split(' ');
    return { hour: parts[0], period: parts[1]?.toUpperCase() || '' };
  };

  const getClient = (clientId?: string) => {
    if (!clientId) return null;
    return clients.find(c => c.id === clientId);
  };

  const client = getClient(job.clientId);
  const time = formatTime(job.scheduledAt);

  const handleCall = () => {
    if (client?.phone) {
      Linking.openURL(`tel:${client.phone}`);
    }
  };

  const [isSendingSms, setIsSendingSms] = useState(false);

  const handleSMS = async () => {
    if (!client?.phone) return;
    if (smsLocked) {
      showSmsLockedAlert({
        label: 'Call Instead',
        onPress: () => Linking.openURL(`tel:${client.phone}`),
      });
      return;
    }
    const message = `Hi${client.name ? ` ${client.name.split(' ')[0]}` : ''}, just reaching out about ${job.title || 'your job'}.`;
    setIsSendingSms(true);
    try {
      const response = await api.post('/api/sms/send', {
        clientPhone: client.phone,
        message,
        clientId: client.id,
        jobId: job.id,
      });
      if (response.error) {
        if (handleDedicatedNumberError(response)) return;
        Alert.alert(
          'Send via SMS App?',
          'Could not send directly. Would you like to open your messaging app instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open SMS App',
              onPress: () => {
                const url = `sms:${client.phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
                Linking.openURL(url).catch(() => showToast({ type: 'error', message: 'Error', description: 'Could not open SMS app' }));
              },
            },
          ]
        );
      } else {
        showToast({ type: 'success', message: 'SMS Sent', description: `Message sent to ${client.name || client.phone}` });
      }
    } catch {
      Alert.alert(
        'Send via SMS App?',
        'Could not send directly. Would you like to open your messaging app instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open SMS App',
            onPress: () => {
              const url = `sms:${client.phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
              Linking.openURL(url).catch(() => showToast({ type: 'error', message: 'Error', description: 'Could not open SMS app' }));
            },
          },
        ]
      );
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleNavigate = () => {
    if (job.latitude && job.longitude) {
      const { openMapsWithPreference } = require('../../src/lib/maps-store');
      openMapsWithPreference(job.latitude, job.longitude, job.address);
    } else if (job.address) {
      const { openMapsWithAddress } = require('../../src/lib/maps-store');
      openMapsWithAddress(job.address);
    }
  };

  const getStatusBadge = () => {
    if (job.status === 'done') {
      return (
        <View style={[styles.statusBadge, styles.statusBadgeComplete]}>
          <Text style={[styles.statusBadgeText, styles.statusBadgeTextComplete]}>Complete</Text>
        </View>
      );
    } else if (job.status === 'in_progress') {
      return (
        <View style={[styles.statusBadge, styles.statusBadgeProgress]}>
          <View style={styles.pulseDot} />
          <Text style={[styles.statusBadgeText, styles.statusBadgeTextProgress]}>In Progress</Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusBadge, styles.statusBadgeScheduled]}>
        <Text style={styles.statusBadgeText}>Scheduled</Text>
      </View>
    );
  };

  const getActionButton = () => {
    if (job.status === 'scheduled') {
      return (
        <View style={styles.actionButtonsRow}>
          <PressableRow 
            style={[styles.secondaryActionButton, { backgroundColor: colors.info }]}
            onPress={() => onOnMyWay(job.id, job.clientId)}
            disabled={isUpdating}

          >
            <Feather name="navigation" size={iconSizes.sm} color={colors.white} />
            <Text style={styles.secondaryActionButtonText}>On My Way</Text>
          </PressableRow>
          <PressableRow 
            style={styles.primaryActionButton}
            onPress={() => onStartJob(job.id)}
            disabled={isUpdating}

          >
            <Feather name="play" size={iconSizes.sm} color={colors.white} />
            <Text style={styles.primaryActionButtonText}>Start Job</Text>
          </PressableRow>
        </View>
      );
    } else if (job.status === 'pending') {
      return (
        <PressableRow 
          style={styles.primaryActionButton}
          onPress={() => onStartJob(job.id)}
          disabled={isUpdating}

        >
          <Feather name="play" size={iconSizes.lg} color={colors.white} />
          <Text style={styles.primaryActionButtonText}>Start Job</Text>
        </PressableRow>
      );
    } else if (job.status === 'in_progress') {
      return (
        <PressableRow 
          style={[styles.primaryActionButton, styles.completeActionButton]}
          onPress={() => onCompleteJob(job.id)}
          disabled={isUpdating}

        >
          <Feather name="check-circle" size={iconSizes.lg} color={colors.primaryForeground} />
          <Text style={styles.primaryActionButtonText}>Complete Job</Text>
        </PressableRow>
      );
    }
    return (
      <TouchableOpacity 
        style={styles.outlineActionButton}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={styles.outlineActionButtonText}>View Details</Text>
      </TouchableOpacity>
    );
  };

  const getAccentColor = () => {
    switch (job.status) {
      case 'pending': return colors.pending;
      case 'scheduled': return colors.scheduled;
      case 'in_progress': return colors.inProgress;
      case 'done': return colors.done;
      case 'invoiced': return colors.invoiced;
      default: return colors.primary;
    }
  };

  return (
    <PressableRow
      onPress={onPress}

      style={[styles.jobCard, job.isXeroImport && { overflow: 'visible' }]}
    >
      {job.isXeroImport && <XeroBadge size="sm" />}
      {/* Left Accent Bar */}
      <View style={[styles.jobCardAccent, { backgroundColor: getAccentColor() }]} />
      
      {/* Card Content */}
      <View style={styles.jobCardContent}>
        {/* Job Header */}
        <View style={styles.jobCardHeader}>
          <View style={styles.jobCardHeaderLeft}>
            {orderNumber ? (
              <View style={styles.orderBadge}>
                <Text style={styles.orderBadgeText}>{orderNumber}</Text>
              </View>
            ) : (
              <View style={styles.timeBox}>
                <Text style={styles.timeBoxText}>{time.hour}</Text>
              </View>
            )}
            <View style={styles.jobCardTitleArea}>
              <View style={styles.jobCardMetaRow}>
                <Text style={styles.timePeriod}>{time.period}</Text>
                {getStatusBadge()}
              </View>
              <Text style={styles.jobCardTitle} numberOfLines={1}>{job.title}</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
        </View>

        {/* Client & Address */}
        <View style={styles.jobCardDetails}>
          {client?.name && (
            <View style={styles.jobDetailRow}>
              <Feather name="user" size={iconSizes.md} color={colors.mutedForeground} />
              <Text style={styles.jobDetailText} numberOfLines={1}>{client.name}</Text>
            </View>
          )}
          {job.address && (
            <View style={styles.jobDetailRow}>
              <Feather name="map-pin" size={iconSizes.md} color={colors.mutedForeground} />
              <Text style={styles.jobDetailText} numberOfLines={1}>{job.address}</Text>
            </View>
          )}
          {distanceInfo && (
            <View style={styles.jobDetailRow}>
              <Feather name="navigation" size={iconSizes.md} color={colors.info} />
              <Text style={[styles.jobDetailText, { color: colors.info, fontWeight: fontWeights.medium }]}>
                {distanceInfo.distanceKm < 1 
                  ? `${Math.round(distanceInfo.distanceKm * 1000)}m away`
                  : `${distanceInfo.distanceKm} km away`}
                {' \u00b7 ~'}
                {distanceInfo.driveMinutes < 60 
                  ? `${distanceInfo.driveMinutes} min drive`
                  : `${Math.floor(distanceInfo.driveMinutes / 60)}h ${distanceInfo.driveMinutes % 60}m drive`}
              </Text>
            </View>
          )}
        </View>

        {/* Quick Contact Buttons */}
        {(client?.phone || job.address) && (
          <View style={styles.quickContactRow}>
            {client?.phone && (
              <>
                <TouchableOpacity 
                  style={styles.quickContactButton}
                  onPress={handleCall}
                  activeOpacity={0.7}
                  data-testid={`button-call-${job.id}`}
                >
                  <Feather name="phone" size={iconSizes.md} color={colors.foreground} />
                  <Text style={styles.quickContactText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.quickContactButton, smsLocked && { opacity: 0.65 }]}
                  onPress={handleSMS}
                  activeOpacity={0.7}
                  data-testid={`button-sms-${job.id}`}
                >
                  <Feather name={smsLocked ? 'lock' : 'message-square'} size={iconSizes.md} color={colors.foreground} />
                  <Text style={styles.quickContactText}>SMS</Text>
                </TouchableOpacity>
              </>
            )}
            {job.address && (
              <TouchableOpacity 
                style={[styles.quickContactButton, styles.directionsButton]}
                onPress={() => onGetDirections?.(job)}
                activeOpacity={0.7}
                data-testid={`button-directions-${job.id}`}
              >
                <Feather name="navigation" size={iconSizes.md} color={colors.primary} />
                <Text style={[styles.quickContactText, { color: colors.primary }]}>Directions</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Primary Action Button */}
        {getActionButton()}
      </View>
    </PressableRow>
  );
}

function RevenueChart({ isOwner }: { isOwner: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [revenueData, setRevenueData] = useState<{ month: string; amount: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRevenueData();
  }, []);

  const loadRevenueData = async () => {
    try {
      const response = await api.get<any[]>('/api/invoices');
      if (response.data) {
        const invoices = response.data;
        const now = new Date();
        const months: { month: string; shortMonth: string; amount: number }[] = [];

        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
          const monthRevenue = invoices
            .filter((inv: any) => {
              if (inv.status !== 'paid' || !inv.paidAt) return false;
              const paidDate = new Date(inv.paidAt);
              return paidDate >= d && paidDate <= endOfMonth;
            })
            .reduce((sum: number, inv: any) => sum + (parseFloat(inv.total) || 0), 0);

          months.push({
            month: d.toLocaleDateString('en-AU', { month: 'short' }),
            shortMonth: d.toLocaleDateString('en-AU', { month: 'short' }),
            amount: monthRevenue,
          });
        }
        setRevenueData(months);
      }
    } catch (error) {
      if (__DEV__) console.log('Error loading revenue data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOwner) return null;

  const maxAmount = Math.max(...revenueData.map(d => d.amount), 1);
  const totalRevenue = revenueData.reduce((sum, d) => sum + d.amount, 0);
  const maxBarHeight = 100;

  const formatAmount = (amount: number) => {
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
    return `$${amount.toFixed(0)}`;
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionTitleIcon, { backgroundColor: colorWithOpacity(colors.success, 0.12) }]}>
            <Feather name="trending-up" size={iconSizes.md} color={colors.success} />
          </View>
          <Text style={styles.sectionTitle}>Revenue</Text>
        </View>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => router.push('/more/payment-hub')}
          activeOpacity={0.7}
        >
          <Text style={styles.viewAllText}>Details</Text>
          <Feather name="chevron-right" size={iconSizes.sm} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <View style={styles.revenueChartCard}>
        {isLoading ? (
          <View style={styles.revenueChartLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.revenueChartHeader}>
              <Text style={styles.revenueChartTotal}>{formatAmount(totalRevenue)}</Text>
              <Text style={styles.revenueChartSubtitle}>Last 6 months</Text>
            </View>
            <View style={styles.revenueChartBars}>
              {revenueData.map((item, index) => {
                const barHeight = maxAmount > 0
                  ? Math.max((item.amount / maxAmount) * maxBarHeight, 4)
                  : 4;
                const isCurrentMonth = index === revenueData.length - 1;
                return (
                  <View key={item.month} style={styles.revenueBarColumn}>
                    <Text style={styles.revenueBarValue}>
                      {item.amount > 0 ? formatAmount(item.amount) : ''}
                    </Text>
                    <View style={styles.revenueBarTrack}>
                      <View
                        style={[
                          styles.revenueBar,
                          {
                            height: barHeight,
                            backgroundColor: isCurrentMonth ? colors.success : colorWithOpacity(colors.success, 0.4),
                          },
                        ]}
                      />
                    </View>
                    <Text style={[
                      styles.revenueBarLabel,
                      isCurrentMonth && { color: colors.foreground, fontWeight: fontWeights.semibold },
                    ]}>
                      {item.month}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function ComplianceAlerts({ isOwner }: { isOwner: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadComplianceData();
  }, []);

  const loadComplianceData = async () => {
    try {
      const response = await api.get<any[]>('/api/compliance-documents');
      if (response.data) {
        const docs = response.data;
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const expiringOrExpired = docs.filter((doc: any) => {
          if (!doc.expiryDate) return false;
          const expiry = new Date(doc.expiryDate);
          return expiry <= thirtyDaysFromNow;
        }).map((doc: any) => {
          const expiry = new Date(doc.expiryDate);
          const isExpired = expiry < now;
          const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          return { ...doc, isExpired, daysUntil };
        }).sort((a: any, b: any) => a.daysUntil - b.daysUntil);

        setAlerts(expiringOrExpired);
      }
    } catch (error) {
      if (__DEV__) console.log('Error loading compliance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOwner || isLoading || alerts.length === 0) return null;

  const expiredCount = alerts.filter(a => a.isExpired).length;
  const expiringCount = alerts.filter(a => !a.isExpired).length;

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={[
          styles.complianceAlertCard,
          expiredCount > 0
            ? { backgroundColor: colorWithOpacity(colors.destructive, 0.08), borderColor: colorWithOpacity(colors.destructive, 0.2) }
            : { backgroundColor: colorWithOpacity(colors.warning, 0.08), borderColor: colorWithOpacity(colors.warning, 0.2) },
        ]}
        onPress={() => router.push('/more/documents?tab=compliance')}
        activeOpacity={0.7}
      >
        <View style={styles.complianceAlertRow}>
          <View style={[
            styles.complianceAlertIconContainer,
            { backgroundColor: expiredCount > 0 ? colorWithOpacity(colors.destructive, 0.15) : colorWithOpacity(colors.warning, 0.15) },
          ]}>
            <Feather
              name="alert-triangle"
              size={iconSizes.xl}
              color={expiredCount > 0 ? colors.destructive : colors.warning}
            />
          </View>
          <View style={styles.complianceAlertContent}>
            <Text style={[
              styles.complianceAlertTitle,
              { color: expiredCount > 0 ? colors.destructive : colors.warning },
            ]}>
              {expiredCount > 0
                ? `${expiredCount} document${expiredCount > 1 ? 's' : ''} expired`
                : `${expiringCount} document${expiringCount > 1 ? 's' : ''} expiring soon`}
            </Text>
            <Text style={styles.complianceAlertDescription}>
              {alerts.slice(0, 2).map((a: any) => {
                if (a.isExpired) return `${a.documentName || a.name} - expired ${Math.abs(a.daysUntil)}d ago`;
                return `${a.documentName || a.name} - ${a.daysUntil}d left`;
              }).join(', ')}
            </Text>
          </View>
          <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

// Empty State Component
function EmptyTodayState({ onCreateJob }: { onCreateJob: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyStateIcon, { backgroundColor: colorWithOpacity(colors.primary, 0.1) }]}>
        <Feather name="calendar" size={sizes.emptyIcon} color={colors.primary} />
      </View>
      <Text style={[styles.emptyStateTitle, { fontWeight: fontWeights.semibold }]}>Nothing scheduled today</Text>
      <Text style={[styles.emptyStateTitle, { fontSize: typography.sizes.sm, marginBottom: 0, marginTop: -spacing.sm }]}>
        Create a job or check your upcoming work
      </Text>
      <TouchableOpacity 
        style={styles.scheduleJobButton}
        onPress={onCreateJob}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground} />
        <Text style={styles.scheduleJobButtonText}>Create Job</Text>
      </TouchableOpacity>
    </View>
  );
}

// v2 key — permanent dismiss (no TTL expiry). Old v1 key is simply ignored.
const CHECKLIST_DISMISS_PREFIX = 'jobrunner_setup_dismissed_v2_';

function GettingStartedChecklist() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, businessSettings } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);
  const [checklistStatus, setChecklistStatus] = useState<{
    businessDetails: boolean;
    firstClient: boolean;
    firstQuote: boolean;
    invoicingSetup: boolean;
    teamMember: boolean;
    hasSampleData: boolean;
  } | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSeedingData, setIsSeedingData] = useState(false);

  const dismissKey = `${CHECKLIST_DISMISS_PREFIX}${user?.id || 'default'}`;

  useEffect(() => {
    checkDismissed();
    fetchChecklistData();
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchChecklistData();
    }, [])
  );

  const checkDismissed = async () => {
    try {
      const val = await AsyncStorage.getItem(dismissKey);
      if (val === 'true') setDismissed(true);
    } catch {}
  };

  const handleDismiss = async () => {
    setDismissed(true);
    try {
      await AsyncStorage.setItem(dismissKey, 'true');
    } catch {}
  };

  const fetchChecklistData = async () => {
    try {
      const res = await api.get<{
        businessDetails: boolean;
        firstClient: boolean;
        firstQuote: boolean;
        invoicingSetup: boolean;
        teamMember: boolean;
        hasSampleData: boolean;
      }>('/api/onboarding/checklist-status');
      if (res.data) setChecklistStatus(res.data);
    } catch {} finally {
      setDataLoaded(true);
    }
  };

  const handleSeedSampleData = async () => {
    setIsSeedingData(true);
    try {
      const tradeType = businessSettings?.tradeType || 'general';
      const res = await api.post('/api/onboarding/seed-sample-data', { tradeType });
      if (res.error) {
        showToast({ type: 'error', message: 'Could not load sample data', description: String(res.error) });
      } else {
        showToast({ type: 'success', message: 'Sample data loaded', description: 'Explore with demo clients, jobs and quotes' });
        fetchChecklistData();
      }
    } catch {
      showToast({ type: 'error', message: 'Could not load sample data' });
    } finally {
      setIsSeedingData(false);
    }
  };

  if (dismissed || !dataLoaded || !checklistStatus) return null;

  const checklistSteps = [
    { id: 'business', title: 'Add your business details', desc: 'Name, phone and contact info', completed: checklistStatus.businessDetails, icon: 'briefcase' as const, iconColor: colors.primary, route: '/more/business-settings' },
    { id: 'client', title: 'Create your first client', desc: 'Save client details for quoting', completed: checklistStatus.firstClient, icon: 'users' as const, iconColor: colors.info, route: '/more/client/new' },
    { id: 'quote', title: 'Send your first quote', desc: 'Win work with professional quotes', completed: checklistStatus.firstQuote, icon: 'file-text' as const, iconColor: colors.warning, route: '/more/create-quote' },
    { id: 'invoicing', title: 'Set up invoicing', desc: 'Add payment terms or bank details', completed: checklistStatus.invoicingSetup, icon: 'dollar-sign' as const, iconColor: colors.success, route: '/more/business-settings' },
    { id: 'team', title: 'Invite a team member', desc: 'Add staff or subcontractors', completed: checklistStatus.teamMember, icon: 'user-plus' as const, iconColor: colors.mutedForeground, route: '/more/team-management' },
  ];

  const completedCount = checklistSteps.filter(s => s.completed).length;
  const allComplete = completedCount === checklistSteps.length;

  if (allComplete) return null;

  const progressPercent = (completedCount / checklistSteps.length) * 100;

  return (
    <View style={styles.section}>
      <View style={[styles.gettingStartedCard]}>
        <View style={styles.gettingStartedHeader}>
          <View style={[styles.gettingStartedIcon, { backgroundColor: colorWithOpacity(colors.primary, 0.12) }]}>
            <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.bold, color: colors.primary }}>{completedCount}/{checklistSteps.length}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.gettingStartedTitle}>Get Set Up</Text>
            <Text style={styles.gettingStartedSubtitle}>
              {completedCount === 0 ? 'Complete these steps to get started' : `${checklistSteps.length - completedCount} step${checklistSteps.length - completedCount > 1 ? 's' : ''} left`}
            </Text>
          </View>
          <TouchableOpacity onPress={handleDismiss} style={{ padding: spacing.xs }} activeOpacity={0.7}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        <View style={{ height: 4, backgroundColor: colorWithOpacity(colors.primary, 0.12), borderRadius: 2, marginBottom: spacing.md }}>
          <View style={{ height: 4, backgroundColor: colors.primary, borderRadius: 2, width: `${progressPercent}%` }} />
        </View>
        <View style={styles.gettingStartedSteps}>
          {checklistSteps.map((step, idx) => (
            <TouchableOpacity
              key={step.id}
              style={[styles.gettingStartedStep, idx === checklistSteps.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => router.push(asHref(step.route))}
              activeOpacity={0.7}
            >
              <View style={[styles.gettingStartedStepIcon, {
                backgroundColor: step.completed
                  ? colorWithOpacity(colors.success, 0.12)
                  : colorWithOpacity(step.iconColor, 0.12),
              }]}>
                {step.completed ? (
                  <Feather name="check" size={16} color={colors.success} />
                ) : (
                  <Feather name={step.icon} size={16} color={step.iconColor} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.gettingStartedStepTitle, step.completed && { color: colors.success }]}>{step.title}</Text>
                <Text style={styles.gettingStartedStepDesc}>{step.desc}</Text>
              </View>
              {step.completed ? (
                <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: colorWithOpacity(colors.success, 0.12) }}>
                  <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: colors.success }}>Done</Text>
                </View>
              ) : (
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Load sample data — only offered when none has been seeded yet */}
        {!checklistStatus.hasSampleData && (
          <View style={{
            borderTopWidth: 1,
            borderTopColor: colors.cardBorder,
            marginHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          }}>
            <Feather name="database" size={16} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground }}>Load sample data</Text>
              <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 2 }}>
                Explore with demo clients, jobs and quotes
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleSeedSampleData}
              disabled={isSeedingData}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: colorWithOpacity(colors.primary, 0.1),
                borderWidth: 1,
                borderColor: colorWithOpacity(colors.primary, 0.25),
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                minWidth: 60,
                justifyContent: 'center',
              }}
              activeOpacity={0.7}
            >
              {isSeedingData ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.primary }}>Load</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

interface PendingInvite {
  id: string;
  businessOwnerId: string;
  businessName: string;
  roleName: string;
  inviterName?: string;
  invitedAt?: string;
}

function PendingInvitesBanner() {
  const { colors } = useTheme();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  const [accepting, setAccepting] = useState<string | null>(null);
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('invite_banner_dismissed');
        if (raw) {
          const parsed = JSON.parse(raw);
          const now = Date.now();
          const fresh: Record<string, number> = {};
          for (const [k, v] of Object.entries(parsed || {})) {
            if (typeof v === 'number' && now - v < 7 * 24 * 60 * 60 * 1000) fresh[k] = v;
          }
          if (!cancelled) setDismissed(fresh);
        }
      } catch {}
      try {
        const res = await api.get<{ invites: PendingInvite[] }>('/api/auth/pending-invites');
        if (!cancelled && res.data?.invites) setInvites(res.data.invites);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const visible = invites.filter((i) => !dismissed[i.id]);
  if (visible.length === 0) return null;

  const handleAccept = async (invite: PendingInvite) => {
    setAccepting(invite.id);
    try {
      const res = await api.post('/api/auth/accept-invite', { teamMemberId: invite.id });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
      } else {
        showToast({ type: 'success', message: `Joined ${invite.businessName}` });
        setInvites((prev) => prev.filter((p) => p.id !== invite.id));
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Could not accept invite' });
    } finally {
      setAccepting(null);
    }
  };

  const handleDismiss = async (invite: PendingInvite) => {
    const next = { ...dismissed, [invite.id]: Date.now() };
    setDismissed(next);
    try { await AsyncStorage.setItem('invite_banner_dismissed', JSON.stringify(next)); } catch {}
    try { await api.post('/api/auth/dismiss-invite-banner', { teamMemberId: invite.id }); } catch {}
  };

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }}>
      {visible.map((invite) => (
        <View
          key={invite.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colorWithOpacity(colors.primary, 0.10),
            borderColor: colorWithOpacity(colors.primary, 0.30),
            borderWidth: 1,
            borderRadius: radius.lg,
            padding: spacing.md,
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: colorWithOpacity(colors.primary, 0.18),
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Feather name="users" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.body, color: colors.foreground, fontWeight: fontWeights.semibold }} numberOfLines={1}>
              Join {invite.businessName}
            </Text>
            <Text style={{ ...typography.caption, color: colors.mutedForeground }} numberOfLines={1}>
              {invite.inviterName ? `${invite.inviterName} • ` : ''}{invite.roleName}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleAccept(invite)}
            disabled={accepting === invite.id}
            style={{
              backgroundColor: colors.primary,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: radius.md,
            }}
            testID={`button-accept-invite-${invite.id}`}
          >
            {accepting === invite.id ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold, fontSize: typography.sizes.sm }}>Accept</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDismiss(invite)}
            style={{ padding: 6 }}
            testID={`button-dismiss-invite-${invite.id}`}
          >
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

export default function DashboardScreen() {
  const { roleInfo, user } = useAuthStore();
  const { colors } = useTheme();
  // Authoritative owner signal from /api/auth/me — true for a genuine owner,
  // false for a freshly-joined subcontractor.
  const serverSaysOwner = (user as any)?.isOwner === true;

  // Wait for the role to resolve before committing to a dashboard variant, so a
  // joined subcontractor never flashes the owner dashboard first. Genuine
  // owners are known immediately (serverSaysOwner / checkAuth sets roleInfo
  // right after /api/auth/me), so they don't hit this spinner.
  if (!roleInfo && !serverSaysOwner) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SkeletonDashboard />
      </View>
    );
  }

  const isSubcontractorRole = roleInfo?.roleName?.toLowerCase() === 'subcontractor' || roleInfo?.roleName?.toLowerCase() === 'sub_contractor';
  if (isSubcontractorRole) {
    return <SubcontractorDashboard />;
  }
  
  return <OwnerDashboardScreen />;
}

function OwnerDashboardScreen() {
  const { colors } = useTheme();
  const responsiveShell = usePageShell();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const confirm = useConfirmDialog();
  const insets = useSafeAreaInsets();
  const { activeTimer, pauseTimer, resumeTimer, startTimer, stopTimer } = useTimeTrackingStore();
  const scrollRef = useRef<ScrollView | null>(null);
  const { scrollToTopTrigger } = useScrollToTop();
  const { onScroll: preserveOnScroll, scrollEventThrottle } = usePreserveScrollOnFold(scrollRef);
  
  useEffect(() => {
    if (scrollToTopTrigger > 0) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [scrollToTopTrigger]);
  
  const { user, businessSettings, roleInfo, isOwner, isStaff, teamState, fetchTeamState, hasActiveTeam: storeHasActiveTeam, refreshUser, setDashboardReady } = useAuthStore();
  const { todaysJobs, fetchTodaysJobs, fetchJobs, isLoading: jobsLoading, updateJobStatus } = useJobsStore();
  const { stats, fetchStats, isLoading: statsLoading } = useDashboardStore();
  const { clients, fetchClients } = useClientsStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isClearingDemo, setIsClearingDemo] = useState(false);
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const welcomeModalChecked = useRef(false);
  const smsLocked = useSmsLocked();

  // Show the first-run welcome modal exactly once — when businessSettings first
  // loads for an owner who has completed onboarding but hasn't seen the walkthrough.
  useEffect(() => {
    if (welcomeModalChecked.current) return;
    if (!businessSettings) return;
    welcomeModalChecked.current = true;
    if (businessSettings.onboardingCompleted && !businessSettings.hasSeenWalkthrough) {
      setShowWelcomeModal(true);
    }
  }, [businessSettings]);

  // Signal that the dashboard has finished its initial load so deferred UI
  // (e.g. the "What you missed" popup) only appears once content is visible.
  useEffect(() => {
    if (initialLoadComplete) {
      setDashboardReady(true);
    }
  }, [initialLoadComplete, setDashboardReady]);
  
  // Job Scheduler state for team owners
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isTeamDataLoading, setIsTeamDataLoading] = useState(true);
  const [unassignedJobs, setUnassignedJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [myAllJobs, setMyAllJobs] = useState<any[]>([]);
  const [myPhasesThisWeek, setMyPhasesThisWeek] = useState<any[]>([]);
  const [schedulerY, setSchedulerY] = useState(0);
  const [schedulerSearch, setSchedulerSearch] = useState('');
  const [schedulerExpanded, setSchedulerExpanded] = useState(false);
  const SCHEDULER_COLLAPSED_COUNT = 4;
  
  // Scroll to job scheduler section
  const scrollToScheduler = useCallback(() => {
    if (schedulerY > 0) {
      scrollRef.current?.scrollTo({ y: schedulerY - 20, animated: true });
    }
  }, [schedulerY]);
  
  // Route optimization state
  const [optimizedJobs, setOptimizedJobs] = useState<any[]>([]);
  const [isRouteOptimized, setIsRouteOptimized] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  
  // Smart distance/ETA state for job cards
  const [jobDistances, setJobDistances] = useState<Record<string, { distanceKm: number; driveMinutes: number }>>({});
  const [totalDriveTime, setTotalDriveTime] = useState<number | null>(null);
  
  // To Invoice count - jobs with status 'done' but no linked invoice
  const [toInvoiceCount, setToInvoiceCount] = useState(0);

  // AI receptionist calls taken today (shown on the AI Phone overview card)
  const [aiCallsToday, setAiCallsToday] = useState(0);
  
  // Worker state
  const [workerState, setWorkerState] = useState<{ state: string; note: string | null }>({ state: 'available', note: null });

  const fetchWorkerState = useCallback(async () => {
    try {
      const response = await api.get<any>('/api/worker/state');
      if (response.data) {
        setWorkerState({ state: response.data.state || 'available', note: response.data.note || null });
      }
    } catch (error) {
      if (__DEV__) console.log('Error fetching worker state:', error);
    }
  }, []);

  const [statusBusy, setStatusBusy] = useState<string | null>(null);

  const setWorkerStateRemote = useCallback(async (state: string, note: string | null = null) => {
    try {
      await api.post('/api/worker/state', { state, note });
      setWorkerState({ state, note });
      return true;
    } catch {
      showToast({ type: 'error', message: 'Failed to update status' });
      return false;
    }
  }, []);

  // MY STATUS pills set the worker's availability the boss sees (basic presence)
  const handleStatusPress = useCallback(async (target: string) => {
    if (statusBusy) return;
    setStatusBusy(target);
    try {
      await setWorkerStateRemote(target);
    } finally {
      setStatusBusy(null);
    }
  }, [statusBusy, setWorkerStateRemote]);

  // Activity feed state
  const [activities, setActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  
  const [tomorrowActiveIndex, setTomorrowActiveIndex] = useState(0);
  
  // Day Summary state
  const [dailySummary, setDailySummary] = useState<{
    totalHoursTracked: number;
    jobsCompletedToday: number;
    totalJobsToday: number;
    invoicesCreatedToday: number;
    moneyCollectedToday: number;
    tomorrowFirstJob: {
      id: string;
      title: string;
      address: string | null;
      scheduledAt: string;
      clientName: string | null;
      latitude: number | null;
      longitude: number | null;
    } | null;
    tomorrowJobs?: Array<{
      id: string;
      title: string;
      address: string | null;
      scheduledAt: string;
      clientName: string | null;
      latitude: number | null;
      longitude: number | null;
    }> | null;
    tomorrowJobCount: number;
    allJobsDone: boolean;
  } | null>(null);
  
  const fetchToInvoiceCount = useCallback(async () => {
    try {
      const response = await api.get<any[]>('/api/jobs');
      if (response.data) {
        const doneJobs = response.data.filter((job: any) => job.status === 'done');
        const invoicesRes = await api.get<any[]>('/api/invoices');
        const invoices = invoicesRes.data || [];
        const jobIdsWithInvoice = new Set(invoices.map((inv: any) => inv.jobId).filter(Boolean));
        const uninvoicedCount = doneJobs.filter((job: any) => !jobIdsWithInvoice.has(job.id)).length;
        setToInvoiceCount(uninvoicedCount);
      }
    } catch (error) {
      if (__DEV__) console.log('Error fetching to-invoice count:', error);
    }
  }, []);

  const fetchActivities = useCallback(async () => {
    setActivitiesLoading(true);
    try {
      const { default: api } = await import('../../src/lib/api');
      const response = await api.get<any[]>('/api/activity/recent/5');
      // Guard: api wrapper sets `data` even on errors (line 161 of api.ts) so we
      // must verify it's an array before storing — otherwise ActivityFeed crashes
      // calling .slice() on a {error: "..."} object. Sentry: 847b667a67774bef.
      if (Array.isArray(response.data)) {
        setActivities(response.data);
      } else {
        setActivities([]);
      }
    } catch (error) {
      if (__DEV__) console.log('Error fetching activities:', error);
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

  const fetchDailySummary = useCallback(async () => {
    try {
      const response = await api.get('/api/dashboard/daily-summary');
      if (response.data) {
        setDailySummary(response.data as any);
      }
    } catch (error) {
      if (__DEV__) console.log('Error fetching daily summary:', error);
    }
  }, []);

  const fetchAiCallsToday = useCallback(async () => {
    if (!businessSettings?.aiReceptionistEnabled) return;
    try {
      const response = await api.get<any[]>('/api/ai-receptionist/calls?limit=200');
      if (!response.error && Array.isArray(response.data)) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const count = response.data.filter((c: any) => {
          const created = c?.createdAt ? new Date(c.createdAt) : null;
          return created && created >= start;
        }).length;
        setAiCallsToday(count);
      } else {
        setAiCallsToday(0);
      }
    } catch (error) {
      if (__DEV__) console.log('Error fetching AI calls:', error);
    }
  }, [businessSettings?.aiReceptionistEnabled]);

  // Fetch user location and compute distances to today's jobs
  const computeJobDistances = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        if (newStatus !== 'granted') return;
      }
      
      const location = await Location.getLastKnownPositionAsync() || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!location) return;
      
      const userLat = location.coords.latitude;
      const userLon = location.coords.longitude;
      setUserLocation({ latitude: userLat, longitude: userLon });
      
      const distances: Record<string, { distanceKm: number; driveMinutes: number }> = {};
      
      for (const job of todaysJobs) {
        if (job.latitude && job.longitude) {
          const dist = haversineDistanceCalc(userLat, userLon, job.latitude, job.longitude);
          const estimatedMinutes = Math.max(1, Math.round((dist / 40) * 60));
          distances[job.id] = {
            distanceKm: Math.round(dist * 10) / 10,
            driveMinutes: estimatedMinutes,
          };
        }
      }
      
      setJobDistances(distances);
      
      // Calculate total drive time for all jobs in sequence
      if (todaysJobs.filter((j: any) => j.latitude && j.longitude).length >= 2) {
        const orderedJobs = isRouteOptimized ? optimizedJobs : todaysJobs;
        const validJobs = orderedJobs.filter((j: any) => j.latitude && j.longitude);
        let totalMinutes = 0;
        
        // From user to first job
        if (validJobs.length > 0) {
          const firstDist = haversineDistanceCalc(userLat, userLon, validJobs[0].latitude, validJobs[0].longitude);
          totalMinutes += Math.max(1, Math.round((firstDist / 40) * 60));
        }
        
        // Between consecutive jobs
        for (let i = 0; i < validJobs.length - 1; i++) {
          const d = haversineDistanceCalc(
            validJobs[i].latitude, validJobs[i].longitude,
            validJobs[i + 1].latitude, validJobs[i + 1].longitude
          );
          totalMinutes += Math.max(1, Math.round((d / 40) * 60));
        }
        
        setTotalDriveTime(totalMinutes);
      }
    } catch (error) {
      if (__DEV__) console.log('Error computing job distances:', error);
    }
  }, [todaysJobs, isRouteOptimized, optimizedJobs]);

  useEffect(() => {
    if (todaysJobs.length > 0) {
      computeJobDistances();
    }
  }, [computeJobDistances]);

  // Find nearest job suggestion (non-completed, non-in_progress)
  const nextJobSuggestion = useMemo(() => {
    if (!userLocation || Object.keys(jobDistances).length === 0) return null;
    
    const eligibleJobs = todaysJobs.filter((job: any) => 
      (job.status === 'scheduled' || job.status === 'pending') && 
      jobDistances[job.id]
    );
    
    if (eligibleJobs.length === 0) return null;
    
    let nearest = eligibleJobs[0];
    for (const job of eligibleJobs) {
      if (jobDistances[job.id].distanceKm < jobDistances[nearest.id].distanceKm) {
        nearest = job;
      }
    }
    
    return nearest;
  }, [userLocation, jobDistances, todaysJobs]);

  // Haversine calc helper (non-hook, used by computeJobDistances)
  const haversineDistanceCalc = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Haversine formula to calculate distance between two coordinates in km
  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Jobs with valid coordinates for route optimization
  const jobsWithCoords = useMemo(() => {
    return todaysJobs.filter((job: any) => 
      job.latitude && job.longitude && job.address
    );
  }, [todaysJobs]);

  // Nearest-neighbor route optimization
  const optimizeRoute = async () => {
    if (jobsWithCoords.length < 2) {
      showToast({ type: 'info', message: 'Not Enough Jobs', description: 'You need at least 2 jobs with addresses to optimize the route.' });
      return;
    }

    setIsOptimizing(true);
    
    try {
      // Get current location as starting point
      const { status } = await Location.requestForegroundPermissionsAsync();
      let startLat: number, startLon: number;
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        startLat = location.coords.latitude;
        startLon = location.coords.longitude;
        setUserLocation({ latitude: startLat, longitude: startLon });
      } else {
        // Use first job as starting point
        startLat = jobsWithCoords[0].latitude!;
        startLon = jobsWithCoords[0].longitude!;
      }

      // Nearest-neighbor algorithm
      const unvisited = [...jobsWithCoords];
      const route: any[] = [];
      let currentLat = startLat;
      let currentLon = startLon;

      while (unvisited.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
          const dist = haversineDistance(
            currentLat, currentLon,
            unvisited[i].latitude!, unvisited[i].longitude!
          );
          if (dist < nearestDistance) {
            nearestDistance = dist;
            nearestIndex = i;
          }
        }

        const nearest = unvisited.splice(nearestIndex, 1)[0];
        route.push(nearest);
        currentLat = nearest.latitude!;
        currentLon = nearest.longitude!;
      }

      // Add jobs without coordinates at the end (maintain original order)
      const jobsWithoutCoords = todaysJobs.filter((job: any) => !job.latitude || !job.longitude);
      setOptimizedJobs([...route, ...jobsWithoutCoords]);
      setIsRouteOptimized(true);
      showToast({ type: 'info', message: 'Route Optimized', description: `Your ${route.length} jobs have been reordered for the most efficient route.` });
    } catch (error) {
      if (__DEV__) console.log('Error optimizing route:', error);
      showToast({ type: 'error', message: 'Failed to optimize route. Please try again.' });
    } finally {
      setIsOptimizing(false);
    }
  };

  // Reset to original order
  const resetRouteOrder = () => {
    setOptimizedJobs([]);
    setIsRouteOptimized(false);
  };

  // Open directions to a single job
  const openDirections = (job: any) => {
    if (!job.latitude || !job.longitude) {
      if (job.address) {
        const { openMapsWithAddress } = require('../../src/lib/maps-store');
        openMapsWithAddress(job.address);
      } else {
        showToast({ type: 'info', message: 'No Address', description: 'This job has no address to navigate to.' });
      }
      return;
    }

    const { openMapsWithPreference } = require('../../src/lib/maps-store');
    openMapsWithPreference(job.latitude, job.longitude, job.address);
  };

  // Start multi-stop route
  const startRoute = () => {
    const jobs = isRouteOptimized ? optimizedJobs : todaysJobs;
    const validJobs = jobs.filter((job: any) => job.latitude && job.longitude);
    
    if (validJobs.length === 0) {
      showToast({ type: 'info', message: 'No Valid Jobs', description: 'No jobs with valid coordinates to create a route.' });
      return;
    }

    // Build Google Maps multi-stop URL
    let waypoints: string[] = [];
    
    // Start with user location if available
    if (userLocation) {
      waypoints.push(`${userLocation.latitude},${userLocation.longitude}`);
    }
    
    // Add all job coordinates
    validJobs.forEach((job: any) => {
      waypoints.push(`${job.latitude},${job.longitude}`);
    });

    if (waypoints.length < 2) {
      openDirections(validJobs[0]);
      return;
    }

    const routeUrl = `https://www.google.com/maps/dir/${waypoints.join('/')}`;
    Linking.openURL(routeUrl);
  };

  // Get display jobs (optimized or original)
  const displayJobs = isRouteOptimized ? optimizedJobs : todaysJobs;
  
  const roleResolved = roleInfo !== null;
  // Authoritative owner signal from /api/auth/me (the `user` payload). Unlike
  // the role hook's transient 404/loading fallback, this is never overwritten
  // by a momentary placeholder role. Used to stop a freshly-signed-up owner
  // from briefly rendering the worker dashboard while /api/team/my-role settles.
  const serverSaysOwner = (user as any)?.isOwner === true;
  // Narrow guard for the placeholder role the role hook writes on a transient
  // 404 before the real role resolves: it is the EXACT shape roleId 'staff' +
  // roleName 'STAFF' (uppercase). Real Staff users carry roleName 'Staff', so
  // this never misclassifies a genuine staff member.
  const isPlaceholderRole = roleInfo?.roleId === 'staff' && roleInfo?.roleName === 'STAFF';
  const isStaffUser = !serverSaysOwner && !isPlaceholderRole && isStaff();
  const isOwnerUser = isOwner();
  const isSubcontractorUser = roleInfo?.roleName?.toLowerCase() === 'subcontractor' || roleInfo?.roleName?.toLowerCase() === 'sub_contractor';
  const isManager = roleInfo?.roleName?.toLowerCase() === 'manager';
  const canViewMap = isOwnerUser || isManager;
  // Use store's hasActiveTeam OR local teamMembers for the check (store may be ready before local fetch)
  const hasActiveTeam = storeHasActiveTeam() || teamMembers.length > 0 || teamState.hasActiveTeam;
  
  
  const handleNavigateToItem = (type: string, id: string) => {
    switch (type) {
      case 'job':
        router.push(`/job/${id}`);
        break;
      case 'quote':
        router.push(`/more/quote/${id}`);
        break;
      case 'invoice':
        router.push(`/more/invoice/${id}`);
        break;
      case 'client':
        router.push(`/more/client/${id}`);
        break;
      default:
        break;
    }
  };

  // Fetch all assigned jobs for staff users (for My Stats)
  const fetchMyAllJobs = useCallback(async () => {
    if (!isStaffUser) return;
    try {
      const { default: api } = await import('../../src/lib/api');
      const response = await api.get<any[]>('/api/jobs/my-jobs');
      if (Array.isArray(response.data)) {
        setMyAllJobs(response.data);
      }
    } catch (error) {
      if (__DEV__) console.log('Error fetching my jobs:', error);
    }
  }, [isStaffUser]);

  // Fetch phases assigned to this worker that start this week
  const fetchMyPhasesThisWeek = useCallback(async () => {
    if (!isStaffUser) return;
    try {
      const { default: api } = await import('../../src/lib/api');
      const response = await api.get<any[]>('/api/jobs/my-phases');
      if (Array.isArray(response.data)) {
        setMyPhasesThisWeek(response.data);
      }
    } catch (error) {
      if (__DEV__) console.log('Error fetching my phases:', error);
    }
  }, [isStaffUser]);

  // Use refs to maintain stable function references and prevent re-render loops
  const fetchTodaysJobsRef = useRef(fetchTodaysJobs);
  const fetchStatsRef = useRef(fetchStats);
  const fetchClientsRef = useRef(fetchClients);
  const fetchActivitiesRef = useRef(fetchActivities);
  const fetchTeamStateRef = useRef(fetchTeamState);
  const fetchMyAllJobsRef = useRef(fetchMyAllJobs);
  const fetchMyPhasesThisWeekRef = useRef(fetchMyPhasesThisWeek);
  const fetchToInvoiceCountRef = useRef(fetchToInvoiceCount);
  const fetchDailySummaryRef = useRef(fetchDailySummary);
  const fetchWorkerStateRef = useRef(fetchWorkerState);
  const fetchAiCallsTodayRef = useRef(fetchAiCallsToday);
  
  // Keep refs updated
  fetchTodaysJobsRef.current = fetchTodaysJobs;
  fetchStatsRef.current = fetchStats;
  fetchClientsRef.current = fetchClients;
  fetchActivitiesRef.current = fetchActivities;
  fetchTeamStateRef.current = fetchTeamState;
  fetchMyAllJobsRef.current = fetchMyAllJobs;
  fetchMyPhasesThisWeekRef.current = fetchMyPhasesThisWeek;
  fetchToInvoiceCountRef.current = fetchToInvoiceCount;
  fetchDailySummaryRef.current = fetchDailySummary;
  fetchWorkerStateRef.current = fetchWorkerState;
  fetchAiCallsTodayRef.current = fetchAiCallsToday;

  const refreshData = useCallback(async () => {
    try {
      await Promise.all([
        fetchTodaysJobsRef.current(),
        fetchStatsRef.current(),
        fetchClientsRef.current(),
        fetchActivitiesRef.current(),
        fetchMyAllJobsRef.current(),
        fetchMyPhasesThisWeekRef.current(),
        fetchToInvoiceCountRef.current(),
        fetchDailySummaryRef.current(),
        fetchWorkerStateRef.current(),
        fetchAiCallsTodayRef.current(),
      ]);
    } finally {
      // Mark initial load complete even if a fetch rejected — the dashboard
      // shell is still shown, and deferred UI (WhatYouMissedPopup, gated on
      // dashboardReady) must never be permanently suppressed by a failed fetch.
      setInitialLoadComplete(true);
    }
  }, []); // Empty deps - uses refs

  // Initial load only once on mount
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      if (!jobsLoading && !statsLoading && todaysJobs && todaysJobs.length >= 0) {
        setInitialLoadComplete(true);
        refreshData();
      } else {
        refreshData();
      }
    }
  }, [refreshData]);

  // Refresh data when screen gains focus (syncs with web app)
  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, []) // Empty dependency - refreshData uses refs internally
  );

  // Fetch team data for job scheduler (owners only)
  const fetchTeamData = useCallback(async () => {
    if (!isOwnerUser) {
      setIsTeamDataLoading(false);
      return;
    }
    setIsTeamDataLoading(true);
    try {
      const { default: api } = await import('../../src/lib/api');
      const [teamRes, jobsRes, unassignedRes] = await Promise.all([
        api.get<any[]>('/api/team/members'),
        api.get<any[]>('/api/jobs'),
        api.get<any[]>('/api/jobs?unassigned=true'),
        fetchTeamStateRef.current(),
      ]);
      if (teamRes.data) {
        setTeamMembers((teamRes.data as any[]).filter((m: any) => m.inviteStatus === 'accepted'));
      }
      if (jobsRes.data) {
        setAllJobs(jobsRes.data);
      }
      if (unassignedRes.data) {
        setUnassignedJobs(unassignedRes.data);
      }
    } catch (error) {
      if (__DEV__) console.log('Error fetching team data:', error);
    } finally {
      setIsTeamDataLoading(false);
    }
  }, [isOwnerUser]); // Only depends on isOwnerUser

  // Fetch team data once on mount and when owner status changes
  const teamDataFetchedRef = useRef(false);
  useEffect(() => {
    if (!teamDataFetchedRef.current || isOwnerUser) {
      teamDataFetchedRef.current = true;
      fetchTeamData();
    }
  }, [isOwnerUser]);

  const handleAssignJob = async (jobId: string, userId: string) => {
    setIsAssigning(true);
    try {
      const { isOnline } = useOfflineStore.getState();
      
      if (!isOnline) {
        await offlineStorage.updateJobOffline(jobId, { assignedTo: userId });
        showToast({ type: 'info', message: 'Saved Offline', description: 'Assignment will sync when online' });
        setSelectedJob(null);
        await Promise.all([
          fetchTeamData(),
          fetchTodaysJobs(),
          fetchJobs(),
        ]);
        return;
      }
      
      const { default: api } = await import('../../src/lib/api');
      await api.post(`/api/jobs/${jobId}/assign`, { assignedTo: userId });
      showToast({ type: 'success', message: 'Job assigned successfully' });
      setSelectedJob(null);
      // Refresh all job data across screens for proper sync
      await Promise.all([
        fetchTeamData(),
        fetchTodaysJobs(),
        fetchJobs(), // Sync with Jobs tab
      ]);
    } catch (error: any) {
      if (error.message?.includes('Network')) {
        await offlineStorage.updateJobOffline(jobId, { assignedTo: userId });
        showToast({ type: 'info', message: 'Saved Offline', description: 'Changes will sync when connection restored' });
        setSelectedJob(null);
        await Promise.all([
          fetchTeamData(),
          fetchTodaysJobs(),
          fetchJobs(),
        ]);
      } else {
        showToast({ type: 'error', message: 'Failed to assign job' });
      }
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassignJob = async (job: any) => {
    const ok = await confirm({ title: 'Unassign Job', message: `Remove "${job.title}" from this team member?`, confirmText: 'Unassign', cancelText: 'Cancel', destructive: true });
    if (ok) {
      setIsAssigning(true);
      try {
        const { isOnline } = useOfflineStore.getState();
        
        if (!isOnline) {
          await offlineStorage.updateJobOffline(job.id, { assignedTo: undefined });
          showToast({ type: 'success', message: 'Saved Offline', description: 'Unassignment will sync when online' });
          await Promise.all([
            fetchTeamData(),
            fetchTodaysJobs(),
            fetchJobs(),
          ]);
          return;
        }
        
        const { default: api } = await import('../../src/lib/api');
        await api.post(`/api/jobs/${job.id}/assign`, { assignedTo: null });
        showToast({ type: 'success', message: 'Success', description: 'Job unassigned' });
        await Promise.all([
          fetchTeamData(),
          fetchTodaysJobs(),
          fetchJobs(),
        ]);
      } catch (error: any) {
        if (error.message?.includes('Network')) {
          await offlineStorage.updateJobOffline(job.id, { assignedTo: undefined });
          showToast({ type: 'success', message: 'Saved Offline', description: 'Changes will sync when connection restored' });
          await Promise.all([
            fetchTeamData(),
            fetchTodaysJobs(),
            fetchJobs(),
          ]);
        } else {
          showToast({ type: 'error', message: 'Error', description: 'Failed to unassign job' });
        }
      } finally {
        setIsAssigning(false);
      }
    }
  };

  const getJobsForMember = (memberId: string) => {
    return allJobs.filter((job: any) => 
      job.assignedTo === memberId && job.status !== 'done' && job.status !== 'invoiced'
    );
  };

  const getMemberName = (member: any) => {
    if (member.firstName || member.lastName) {
      return `${member.firstName || ''} ${member.lastName || ''}`.trim();
    }
    return member.email?.split('@')[0] || 'Team Member';
  };

  const getMemberInitials = (member: any) => {
    const first = member.firstName?.charAt(0) || '';
    const last = member.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || member.email?.charAt(0).toUpperCase() || 'T';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatCurrency = (amount: number | undefined | null) => {
    return formatCurrencyUtil(amount, { compact: true });
  };

  const doStartJob = async (jobId: string) => {
    setIsUpdating(true);
    try {
      const ok = await updateJobStatus(jobId, 'in_progress');
      if (ok === false) {
        const serverError = useJobsStore.getState().error;
        showToast({ type: 'error', message: 'Could not start job', description: serverError || 'Failed to start job' });
        return;
      }
      router.push(`/job/${jobId}`);
    } catch (error) {
      showToast({ type: 'error', message: 'Error', description: 'Failed to start job' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStartJob = async (jobId: string) => {
    // Same WHS safety gate as the job detail screen: warn about unsigned/draft
    // SWMS or pending safety forms before starting (skipped when offline).
    try {
      const { isOnline } = useOfflineStore.getState();
      if (isOnline) {
        const safetyRes = await api.get(`/api/jobs/${jobId}/safety-status`);
        const safety = safetyRes.data as any;
        const hasSafetyIssues = !safetyRes.error && safety && (
          (safety.pendingForms && safety.pendingForms > 0) ||
          (safety.draftSwms && safety.draftSwms > 0) ||
          (safety.unsignedSwms && safety.unsignedSwms > 0)
        );
        if (hasSafetyIssues) {
          const warnings: string[] = [];
          if (safety.pendingForms > 0) warnings.push('Safety forms not completed');
          if (safety.draftSwms > 0) warnings.push(`${safety.draftSwms} SWMS in draft`);
          if (safety.unsignedSwms > 0) warnings.push(`${safety.unsignedSwms} SWMS unsigned`);
          Alert.alert(
            'Safety Check Required',
            `${warnings.join(', ')}. Complete safety documentation before starting work.\n\nWHS Compliance: SWMS documents are legally required for high-risk construction work.`,
            [
              { text: 'View Job', onPress: () => router.push(`/job/${jobId}`) },
              { text: 'Start Anyway', style: 'destructive', onPress: () => doStartJob(jobId) },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
          return;
        }
      }
    } catch (e) {
      // Safety check is best-effort; fall through to the normal confirm.
    }

    Alert.alert(
      'Start Job?',
      'This will mark the job as in progress and start the time tracker.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Job', onPress: () => doStartJob(jobId) },
      ]
    );
  };

  const handleOnMyWay = async (jobId: string, clientId?: string) => {
    Alert.alert(
      'On My Way',
      'Send the client an SMS notification with your ETA and start location tracking?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Just View Job', 
          onPress: () => router.push(`/job/${jobId}`),
          style: 'default',
        },
        {
          text: 'Send SMS & Go',
          onPress: async () => {
            setIsUpdating(true);
            try {
              const { isOnline } = useOfflineStore.getState();
              
              if (!isOnline) {
                if (clientId) {
                  await offlineStorage.queueOnMyWayNotification(jobId);
                  showToast({ type: 'success', message: 'Saved Offline', description: 'On my way notification will be sent when online' });
                }
                router.push(`/job/${jobId}`);
                return;
              }
              
              if (clientId) {
                const coords = await locationTracking.getFreshCoordsForEta();
                const response = await api.post(`/api/jobs/${jobId}/on-my-way`, {
                  latitude: coords?.latitude,
                  longitude: coords?.longitude,
                });
                if (response.error && handleDedicatedNumberError(response)) {
                  router.push(`/job/${jobId}`);
                  return;
                }
                if ((response.data as any)?.demoMode) {
                  showToast({ type: 'info', message: 'SMS Not Configured', description: 'Twilio SMS is not set up. The "On My Way" action was logged but no message was sent to the client.\n\nSet up Twilio in Settings > Integrations to enable real SMS notifications.' });
                  router.push(`/job/${jobId}`);
                } else {
                  const eta = (response.data as any)?.estimatedMinutes;
                  const dist = (response.data as any)?.distanceKm;
                  const etaSource = (response.data as any)?.etaSource;
                  const etaInfo = (eta && etaSource !== 'default') ? `\nETA: ~${eta} min${dist ? ` (${dist.toFixed(1)} km)` : ''}` : '';
                  showToast({ type: 'success', message: 'En Route', description: `Client has been notified you're on your way.${etaInfo}` });
                  router.push(`/job/${jobId}`);
                }
              } else {
                router.push(`/job/${jobId}`);
              }
            } catch (error: any) {
              if (error.message?.includes('Network') && clientId) {
                await offlineStorage.queueOnMyWayNotification(jobId);
                showToast({ type: 'success', message: 'Saved Offline', description: 'Notification will be sent when connection restored' });
              }
              router.push(`/job/${jobId}`);
            } finally {
              setIsUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleCompleteJob = async (jobId: string) => {
    // Open the job detail page with the completion sheet auto-opened so the
    // user can review photos/notes/signature before the status flips to done.
    Alert.alert(
      'Complete Job?',
      'This will open the wrap-up sheet so you can add final notes or photos before completing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Review & Complete',
          onPress: () => {
            router.push(`/job/${jobId}?action=complete`);
          }
        }
      ]
    );
  };

  const userName = user?.firstName || 'there';
  const jobsToday = stats.jobsToday || todaysJobs.length;
  const overdueCount = stats.overdueJobs || 0;
  const monthRevenue = formatCurrency(stats.thisMonthRevenue || 0);
  const outstandingAmount = formatCurrency(stats.outstandingAmount || 0);
  const paidLast30Days = formatCurrency(stats.paidLast30Days || 0);

  // Calculate this week's jobs (next 7 days, excluding today) for staff
  const thisWeeksJobs = useMemo(() => {
    const activeJobs = todaysJobs.filter((job: any) => 
      job.status !== 'done' && job.status !== 'invoiced'
    );
    return activeJobs.filter((job: any) => {
      if (!job.scheduledAt) return false;
      const jobDate = new Date(job.scheduledAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(today);
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      return jobDate > today && jobDate <= endOfWeek && jobDate.toDateString() !== today.toDateString();
    });
  }, [todaysJobs]);

  const showDaySummary = useMemo(() => {
    if (!dailySummary) return false;
    const currentHour = new Date().getHours();
    return currentHour >= 16 || dailySummary.allJobsDone;
  }, [dailySummary]);

  const isLoading = jobsLoading || statsLoading;

  // Dynamic content container style for iPad-responsive padding
  const responsiveContentStyle = useMemo(() => ({
    paddingHorizontal: responsiveShell.paddingHorizontal,
    paddingTop: responsiveShell.paddingTop,
    paddingBottom: responsiveShell.paddingBottom,
  }), [responsiveShell]);

  return (
  <>
    <ScrollView 
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={responsiveContentStyle}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refreshData}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
      onScroll={preserveOnScroll}
      scrollEventThrottle={scrollEventThrottle}
    >
      {/* iOS-Style Header with Notification Bell */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Text style={styles.headerTitle}>{getGreeting()}, {userName}</Text>
              {roleResolved && (
                <View style={[styles.roleBadge, { backgroundColor: colorWithOpacity(colors.primary, 0.1) }]}>
                  <Text style={[styles.roleBadgeText, { color: colors.primary }]}>
                    {isSubcontractorUser
                      ? 'Subcontractor'
                      : isStaffUser
                        ? ((roleInfo?.roleName && roleInfo.roleName !== 'STAFF') ? roleInfo.roleName : 'Team member')
                        : 'Owner'}
                  </Text>
                </View>
              )}
              {workerState.state !== 'available' && !(workerState.state === 'on_job' && !activeTimer) && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 2,
                  borderRadius: radius.full,
                  backgroundColor: colorWithOpacity(
                    workerState.state === 'on_job' ? colors.pending :
                    workerState.state === 'travelling' ? colors.info :
                    workerState.state === 'break' ? colors.mutedForeground :
                    workerState.state === 'delayed' ? colors.warningDark :
                    workerState.state === 'needs_help' ? colors.destructive :
                    workerState.state === 'busy' ? colors.warning :
                    workerState.state === 'unavailable' ? colors.mutedForeground : colors.success,
                    0.15
                  ),
                }}>
                  <View style={{
                    width: 6, height: 6, borderRadius: 3,
                    backgroundColor:
                      workerState.state === 'on_job' ? colors.pending :
                      workerState.state === 'travelling' ? colors.info :
                      workerState.state === 'break' ? colors.mutedForeground :
                      workerState.state === 'delayed' ? colors.warningDark :
                      workerState.state === 'needs_help' ? colors.destructive :
                      workerState.state === 'busy' ? colors.warning :
                      workerState.state === 'unavailable' ? colors.mutedForeground : colors.success,
                  }} />
                  <Text style={{
                    fontSize: typography.sizes.xs,
                    fontWeight: fontWeights.semibold,
                    color:
                      workerState.state === 'on_job' ? colors.pending :
                      workerState.state === 'travelling' ? colors.info :
                      workerState.state === 'break' ? colors.mutedForeground :
                      workerState.state === 'delayed' ? colors.warningDark :
                      workerState.state === 'needs_help' ? colors.destructive :
                      workerState.state === 'busy' ? colors.warning :
                      workerState.state === 'unavailable' ? colors.mutedForeground : colors.success,
                  }}>
                    {workerState.state === 'on_job' ? 'On Job' :
                     workerState.state === 'travelling' ? 'Travelling' :
                     workerState.state === 'break' ? 'Break' :
                     workerState.state === 'delayed' ? 'Delayed' :
                     workerState.state === 'needs_help' ? 'Needs Help' :
                     workerState.state.charAt(0).toUpperCase() + workerState.state.slice(1)}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.headerSubtitle}>
              {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
              {todaysJobs.length > 0
                ? ` \u00b7 ${todaysJobs.length} job${todaysJobs.length > 1 ? 's' : ''} today`
                : isStaffUser
                  ? ' \u00b7 Your day is clear'
                  : ''}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {/* Map and Notifications are now in the global Header component */}
          </View>
        </View>
      </View>
      
      {/* Notifications Panel */}
      <NotificationsPanel
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        onNavigateToItem={handleNavigateToItem}
      />

      {/* Worker State Quick Set — matches the subcontractor "Your Status" widget */}
      {isStaffUser && (
        <View style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
          <View style={styles.workerStatusCard}>
            <Text style={styles.workerStatusLabel}>Your Status</Text>
            <View style={styles.workerStatusRow}>
              {[
                { state: 'available', label: 'Available', icon: 'check-circle' as keyof typeof Feather.glyphMap, color: colors.success },
                { state: 'busy', label: 'Busy', icon: 'clock' as keyof typeof Feather.glyphMap, color: colors.warning },
                { state: 'unavailable', label: 'Unavailable', icon: 'x-circle' as keyof typeof Feather.glyphMap, color: colors.mutedForeground },
              ].map((btn) => {
                const isActive = workerState.state === btn.state;
                const isBusy = statusBusy === btn.state;
                return (
                  <TouchableOpacity
                    key={btn.state}
                    activeOpacity={0.7}
                    disabled={!!statusBusy}
                    style={[
                      styles.workerStatusBtn,
                      {
                        backgroundColor: isActive ? colorWithOpacity(btn.color, 0.12) : colors.muted,
                        borderColor: isActive ? btn.color : colors.border,
                      },
                    ]}
                    onPress={() => handleStatusPress(btn.state)}
                  >
                    {isBusy ? (
                      <ActivityIndicator size="small" color={btn.color} />
                    ) : (
                      <Feather name={btn.icon} size={16} color={isActive ? btn.color : colors.mutedForeground} />
                    )}
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.workerStatusBtnText,
                        { color: isActive ? btn.color : colors.mutedForeground, fontWeight: isActive ? fontWeights.bold : fontWeights.medium },
                      ]}
                    >
                      {btn.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* Pending team invites — surfaced as a dashboard banner for one-tap accept */}
      <PendingInvitesBanner />

      {/* Onboarding skip reminder - shown until owner finishes business profile */}
      <OnboardingReminderBanner />

      {/* Background setup failure - retryable if the magic-screen seed/complete failed */}
      <OnboardingSetupFailedBanner />

      {/* Usage Limit Warning - Free Plan Users */}
      <UsageLimitBanner />

      {/* Demo Data Banner */}
      {user?.hasDemoData && !demoBannerDismissed && (
        <View style={[styles.section, { paddingBottom: 0 }]}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colorWithOpacity(colors.info, 0.08),
            borderRadius: radius.lg,
            paddingVertical: spacing.sm,
            paddingLeft: spacing.md,
            paddingRight: spacing.xs,
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: colorWithOpacity(colors.info, 0.15),
          }}>
            <Feather name="box" size={16} color={colors.info} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                Sample data loaded
              </Text>
              <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 1 }}>
                Explore the app with demo jobs, clients & invoices.
              </Text>
            </View>
            <TouchableOpacity
              onPress={async () => {
                const ok = await confirm({ title: 'Clear Sample Data?', message: 'This will remove all sample clients, jobs, quotes, and invoices. This can\'t be undone.', confirmText: 'Clear Data', cancelText: 'Keep It', destructive: true });
                if (ok) {
                  setIsClearingDemo(true);
                  try {
                    const response = await api.post('/api/onboarding/clear-demo-data');
                    if (response.error) {
                      showToast({ type: 'error', message: 'Error', description: response.error });
                    } else {
                      await refreshUser();
                      refreshData();
                    }
                  } catch (error: any) {
                    showToast({ type: 'error', message: 'Error', description: error.message || 'Failed to clear sample data' });
                  } finally {
                    setIsClearingDemo(false);
                  }
                }
              }}
              disabled={isClearingDemo}
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.md,
                backgroundColor: colorWithOpacity(colors.info, 0.12),
              }}
              activeOpacity={0.7}
            >
              {isClearingDemo ? (
                <ActivityIndicator size="small" color={colors.info} />
              ) : (
                <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.info }}>Clear</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDemoBannerDismissed(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ padding: spacing.xs }}
              activeOpacity={0.7}
            >
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Getting Started Checklist - Show for new owners */}
      {roleResolved && !isStaffUser && !isLoading && (
        <GettingStartedChecklist />
      )}

      {/* Operational Alerts - Managers */}
      {roleResolved && !isStaffUser && (
        <OperationalAlertsCard />
      )}

      {/* Time Tracking Widget - All Users */}
      {roleResolved && (
        <View style={styles.section}>
          <TimeTrackingWidget showTeam={isOwnerUser || isManager} />
        </View>
      )}

      {/* Weather Widget - Quick glance before jumping into the day */}
      <View style={styles.section}>
        <WeatherWidget />
      </View>

      {/* Quick Stats - Compact KPI overview */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          {isStaffUser ? 'My Stats' : 'Overview'}
        </Text>
        <View style={styles.kpiGrid}>
          {isStaffUser ? (
            <>
              <View style={styles.kpiRow}>
                <KPICard
                  title="My Jobs"
                  value={jobsToday}
                  icon="briefcase"
                  iconBg={colors.muted}
                  iconColor={colors.primary}
                  onPress={() => router.push({ pathname: '/(tabs)/jobs', params: { filter: 'scheduled' } })}
                />
                <KPICard
                  title="In Progress"
                  value={myAllJobs.filter(j => j.status === 'in_progress').length}
                  icon="clock"
                  iconBg={colors.muted}
                  iconColor={colors.warning}
                  onPress={() => router.push({ pathname: '/(tabs)/jobs', params: { filter: 'in_progress' } })}
                />
              </View>
              <View style={styles.kpiRow}>
                <KPICard
                  title="Completed"
                  value={myAllJobs.filter(j => j.status === 'done' || j.status === 'invoiced').length}
                  icon="check-circle"
                  iconBg={colors.muted}
                  iconColor={colors.success}
                  onPress={() => router.push({ pathname: '/(tabs)/jobs', params: { filter: 'done' } })}
                />
                <KPICard
                  title="Assigned"
                  value={myAllJobs.filter(j => j.status === 'scheduled' || j.status === 'pending').length}
                  icon="clipboard"
                  iconBg={colors.muted}
                  iconColor={colors.mutedForeground}
                  onPress={() => router.push({ pathname: '/(tabs)/jobs', params: { filter: 'scheduled' } })}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.kpiRow}>
                <KPICard
                  title="Jobs Today"
                  value={jobsToday}
                  icon="briefcase"
                  iconBg={colors.muted}
                  iconColor={colors.primary}
                  onPress={() => router.push({ pathname: '/(tabs)/jobs', params: { filter: 'scheduled' } })}
                />
                {businessSettings?.aiReceptionistEnabled ? (
                  <KPICard
                    title={aiCallsToday === 1 ? 'Call Today' : 'Calls Today'}
                    value={aiCallsToday}
                    icon="phone"
                    iconBg={colors.muted}
                    iconColor={colors.success}
                    onPress={() => router.push(asHref('/more/ai-receptionist'))}
                  />
                ) : (
                  <KPICard
                    title="Overdue"
                    value={overdueCount}
                    icon="alert-circle"
                    iconBg={colors.muted}
                    iconColor={overdueCount > 0 ? colors.destructive : colors.mutedForeground}
                    onPress={() => router.push('/more/documents?tab=invoices&filter=overdue')}
                  />
                )}
              </View>
              <View style={styles.kpiRow}>
                <KPICard
                  title="To Invoice"
                  value={toInvoiceCount}
                  icon="file-plus"
                  iconBg={colors.muted}
                  iconColor={toInvoiceCount > 0 ? colors.warning : colors.mutedForeground}
                  onPress={() => router.push({ pathname: '/(tabs)/jobs', params: { filter: 'done' } })}
                />
                <KPICard
                  title="Assigned"
                  value={allJobs.filter((j: any) => j.status === 'scheduled' || j.status === 'in_progress').length}
                  icon="users"
                  iconBg={colors.muted}
                  iconColor={colors.primary}
                  onPress={() => router.push({ pathname: '/(tabs)/jobs', params: { filter: 'scheduled' } })}
                />
              </View>
            </>
          )}
        </View>
      </View>

      {/* Today's Schedule */}
      {<View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleIcon}>
              <Feather name="calendar" size={iconSizes.md} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Today</Text>
            {isRouteOptimized && (
              <View style={styles.optimizedBadge}>
                <Feather name="check" size={12} color={colors.success} />
                <Text style={styles.optimizedBadgeText}>Optimized</Text>
              </View>
            )}
          </View>
          <View style={styles.headerActions}>
            {jobsWithCoords.length >= 2 && (
              <TouchableOpacity 
                style={[
                  styles.optimizeButton,
                  isRouteOptimized && styles.optimizeButtonActive
                ]}
                onPress={isRouteOptimized ? resetRouteOrder : optimizeRoute}
                activeOpacity={0.7}
                disabled={isOptimizing}
                data-testid="button-optimize-route"
              >
                {isOptimizing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Feather 
                      name={isRouteOptimized ? "x" : "navigation"} 
                      size={iconSizes.sm} 
                      color={isRouteOptimized ? colors.mutedForeground : colors.primary} 
                    />
                    <Text style={[
                      styles.optimizeButtonText,
                      isRouteOptimized && styles.optimizeButtonTextActive
                    ]}>
                      {isRouteOptimized ? 'Reset' : 'Optimize'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {todaysJobs.length > 0 && (
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={() => router.push('/(tabs)/jobs')}
                activeOpacity={0.7}
              >
                <Text style={styles.viewAllText}>View All</Text>
                <Feather name="chevron-right" size={iconSizes.sm} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Start Route Button - shown when jobs exist */}
        {jobsWithCoords.length >= 1 && (
          <TouchableOpacity 
            style={styles.startRouteButton}
            onPress={startRoute}
            activeOpacity={0.8}
            data-testid="button-start-route"
          >
            <View style={styles.startRouteIcon}>
              <Feather name="map" size={18} color={colors.white} />
            </View>
            <Text style={styles.startRouteText}>
              Start Route ({jobsWithCoords.length} stop{jobsWithCoords.length !== 1 ? 's' : ''})
              {totalDriveTime !== null ? ` \u00b7 ~${totalDriveTime < 60 ? `${totalDriveTime} min` : `${Math.floor(totalDriveTime / 60)}h ${totalDriveTime % 60}m`}` : ''}
            </Text>
            <Feather name="chevron-right" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        )}

        {/* Smart Next Job Suggestion */}
        {nextJobSuggestion && jobDistances[nextJobSuggestion.id] && (
          <TouchableOpacity 
            style={styles.nextJobSuggestion}
            onPress={() => router.push(`/job/${nextJobSuggestion.id}`)}
            activeOpacity={0.8}
          >
            <View style={styles.nextJobSuggestionIcon}>
              <Feather name="zap" size={16} color={colors.warning} />
            </View>
            <View style={styles.nextJobSuggestionContent}>
              <Text style={styles.nextJobSuggestionLabel}>Nearest Job</Text>
              <Text style={styles.nextJobSuggestionTitle} numberOfLines={1}>{nextJobSuggestion.title}</Text>
              <Text style={styles.nextJobSuggestionMeta}>
                {jobDistances[nextJobSuggestion.id].distanceKm < 1 
                  ? `${Math.round(jobDistances[nextJobSuggestion.id].distanceKm * 1000)}m`
                  : `${jobDistances[nextJobSuggestion.id].distanceKm} km`}
                {' away \u00b7 ~'}
                {jobDistances[nextJobSuggestion.id].driveMinutes} min drive
              </Text>
            </View>
            <TouchableOpacity
              style={styles.nextJobGoButton}
              onPress={() => openDirections(nextJobSuggestion)}
              activeOpacity={0.7}
            >
              <Feather name="navigation" size={14} color={colors.primaryForeground} />
              <Text style={styles.nextJobGoButtonText}>Go</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {todaysJobs.length === 0 ? (
          <EmptyTodayState onCreateJob={() => router.push('/more/create-job')} />
        ) : (
          <View style={styles.jobsList}>
            {displayJobs.map((job: any, index: number) => (
              <TodayJobCard
                key={job.id}
                job={job}
                clients={clients}
                isFirst={index === 0}
                onPress={() => router.push(`/job/${job.id}`)}
                onStartJob={handleStartJob}
                onCompleteJob={handleCompleteJob}
                onOnMyWay={handleOnMyWay}
                isUpdating={isUpdating}
                onGetDirections={openDirections}
                orderNumber={isRouteOptimized ? index + 1 : undefined}
                distanceInfo={jobDistances[job.id]}
                smsLocked={smsLocked}
              />
            ))}
          </View>
        )}
      </View>}

      {/* This Week Section - Staff Only (right after today) */}
      {isStaffUser && thisWeeksJobs.length > 0 && (
        <ThisWeekSection 
          jobs={thisWeeksJobs} 
          onViewJob={(id) => router.push(`/job/${id}`)} 
        />
      )}

      {/* My Phases This Week — phases where this worker is the assignee */}
      {isStaffUser && myPhasesThisWeek.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleIcon}>
                <Feather name="layers" size={iconSizes.md} color={colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>My Phases This Week</Text>
            </View>
          </View>
          {myPhasesThisWeek.map((phase: any) => {
            const statusColors: Record<string, { bg: string; text: string }> = {
              not_started: { bg: '#F3F4F6', text: '#374151' },
              in_progress:  { bg: '#DBEAFE', text: '#1E40AF' },
              complete:     { bg: '#D1FAE5', text: '#065F46' },
              invoiced:     { bg: '#EDE9FE', text: '#6D28D9' },
            };
            const sc = statusColors[phase.status] ?? statusColors.not_started;
            return (
              <TouchableOpacity
                key={phase.id}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  padding: spacing.sm,
                  marginBottom: spacing.xs,
                }}
                onPress={() => router.push(`/job/${phase.jobId}`)}
                activeOpacity={0.75}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Text style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: '700', color: colors.primary }}>
                    {phase.phaseCode}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: colors.foreground, flex: 1 }} numberOfLines={1}>
                    {phase.name}
                  </Text>
                  <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: sc.bg }}>
                    <Text style={{ fontSize: 10, color: sc.text, fontWeight: '500' }}>
                      {phase.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }} numberOfLines={1}>
                  {phase.jobTitle}
                  {phase.scheduledStart
                    ? ` · ${new Date(phase.scheduledStart).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
                    : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Day Summary Card - shows after 4pm or when all jobs done */}
      {showDaySummary && dailySummary && (
        <View style={styles.section}>
          <View style={styles.daySummaryCard}>
            <View style={styles.daySummaryHeader}>
              <View style={styles.daySummaryTitleRow}>
                <View style={[styles.daySummaryIconContainer, { backgroundColor: colorWithOpacity(colors.primary, 0.12) }]}>
                  <Feather name="sunset" size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.daySummaryTitle}>Day Summary</Text>
                  <Text style={styles.daySummarySubtitle}>
                    {dailySummary.allJobsDone ? 'All jobs complete' : 'Your day so far'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.daySummaryStatsGrid}>
              <View style={styles.daySummaryStat}>
                <View style={[styles.daySummaryStatIcon, { backgroundColor: colorWithOpacity(colors.info, 0.1) }]}>
                  <Feather name="clock" size={16} color={colors.info} />
                </View>
                <Text style={styles.daySummaryStatValue}>{dailySummary.totalHoursTracked ?? 0}h</Text>
                <Text style={styles.daySummaryStatLabel}>Hours</Text>
              </View>
              <View style={styles.daySummaryStat}>
                <View style={[styles.daySummaryStatIcon, { backgroundColor: colorWithOpacity(colors.success, 0.1) }]}>
                  <Feather name="check-circle" size={16} color={colors.success} />
                </View>
                <Text style={styles.daySummaryStatValue}>
                  {dailySummary.jobsCompletedToday ?? 0}/{dailySummary.totalJobsToday ?? 0}
                </Text>
                <Text style={styles.daySummaryStatLabel}>Jobs Done</Text>
              </View>
              {!isSubcontractorUser && (
              <View style={styles.daySummaryStat}>
                <View style={[styles.daySummaryStatIcon, { backgroundColor: colorWithOpacity(colors.warning, 0.1) }]}>
                  <Feather name="file-text" size={16} color={colors.warning} />
                </View>
                <Text style={styles.daySummaryStatValue}>{dailySummary.invoicesCreatedToday ?? 0}</Text>
                <Text style={styles.daySummaryStatLabel}>Invoices</Text>
              </View>
              )}
              {!isSubcontractorUser && (
              <View style={styles.daySummaryStat}>
                <View style={[styles.daySummaryStatIcon, { backgroundColor: colorWithOpacity(colors.success, 0.1) }]}>
                  <Feather name="dollar-sign" size={16} color={colors.success} />
                </View>
                <Text style={styles.daySummaryStatValue}>
                  ${(dailySummary.moneyCollectedToday ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </Text>
                <Text style={styles.daySummaryStatLabel}>Collected</Text>
              </View>
              )}
            </View>

            {((dailySummary.tomorrowJobs && dailySummary.tomorrowJobs.length > 0) || dailySummary.tomorrowFirstJob) && (
              <View style={{ marginTop: spacing.lg }}>
                <View style={styles.daySummaryTomorrowHeader}>
                  <Feather name="sunrise" size={14} color={colors.primary} />
                  <Text style={styles.daySummaryTomorrowLabel}>
                    Tomorrow{(dailySummary.tomorrowJobCount || (dailySummary.tomorrowJobs?.length ?? 0)) > 1 ? ` (${dailySummary.tomorrowJobCount || dailySummary.tomorrowJobs?.length} jobs)` : ''}
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  pagingEnabled={false}
                  snapToInterval={256}
                  decelerationRate="fast"
                  scrollEventThrottle={16}
                  onScroll={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / 256);
                    setTomorrowActiveIndex(idx);
                  }}
                  contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.sm }}
                >
                  {(dailySummary.tomorrowJobs || [dailySummary.tomorrowFirstJob]).map((job: any, idx: number) => (
                    <TouchableOpacity
                      key={job.id || idx}
                      style={[styles.daySummaryTomorrow, { 
                        marginTop: 0, 
                        width: (dailySummary.tomorrowJobs?.length ?? 0) > 1 ? 248 : undefined,
                        minWidth: (dailySummary.tomorrowJobs?.length ?? 0) > 1 ? 248 : undefined,
                      }]}
                      onPress={() => router.push(`/job/${job.id}`)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.daySummaryTomorrowTitle} numberOfLines={1}>
                        {job.title}
                      </Text>
                      <View style={styles.daySummaryTomorrowMeta}>
                        {job.scheduledAt && (
                          <View style={styles.daySummaryTomorrowMetaItem}>
                            <Feather name="clock" size={12} color={colors.mutedForeground} />
                            <Text style={styles.daySummaryTomorrowMetaText}>
                              {new Date(job.scheduledAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </Text>
                          </View>
                        )}
                        {job.address && (
                          <View style={styles.daySummaryTomorrowMetaItem}>
                            <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                            <Text style={styles.daySummaryTomorrowMetaText} numberOfLines={1}>
                              {job.address}
                            </Text>
                          </View>
                        )}
                        {job.clientName && (
                          <View style={styles.daySummaryTomorrowMetaItem}>
                            <Feather name="user" size={12} color={colors.mutedForeground} />
                            <Text style={styles.daySummaryTomorrowMetaText}>
                              {job.clientName}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {(dailySummary.tomorrowJobs?.length ?? 0) > 1 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.sm }}>
                    {dailySummary.tomorrowJobs!.map((_: any, i: number) => (
                      <View
                        key={i}
                        style={{
                          width: tomorrowActiveIndex === i ? 16 : 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: tomorrowActiveIndex === i ? colors.primary : colors.border,
                        }}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Revenue Chart - Owner Only */}
      {isOwnerUser && (
        <RevenueChart isOwner={isOwnerUser} />
      )}

      {/* Compliance Alerts - Owner Only */}
      {isOwnerUser && (
        <ComplianceAlerts isOwner={isOwnerUser} />
      )}

      {/* Job Scheduler - Team Owners Only (show loading state or content) */}
      {isOwnerUser && (hasActiveTeam || isTeamDataLoading) && (
        <View 
          style={styles.section}
          onLayout={(event) => setSchedulerY(event.nativeEvent.layout.y)}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleIcon}>
                <Feather name="users" size={iconSizes.md} color={colors.info} />
              </View>
              <Text style={styles.sectionTitle}>Job Scheduler</Text>
            </View>
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => router.push('/more/team-operations')}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllText}>Manage Team</Text>
              <Feather name="chevron-right" size={iconSizes.sm} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={styles.schedulerCaption}>
            Tap a job, then tap a team member to assign
          </Text>

          {/* Selected Job Banner */}
          {selectedJob && (
            <View style={styles.selectionBanner}>
              <View style={styles.selectionBannerContent}>
                {isAssigning ? (
                  <>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.selectionBannerText}>
                      Assigning "{selectedJob.title}"...
                    </Text>
                  </>
                ) : (
                  <>
                    <Feather name="briefcase" size={iconSizes.md} color={colors.primary} />
                    <Text style={styles.selectionBannerText}>
                      Tap a team member to assign "{selectedJob.title}"
                    </Text>
                  </>
                )}
              </View>
              <TouchableOpacity
                style={styles.cancelSelectionButton}
                onPress={() => setSelectedJob(null)}
                disabled={isAssigning}
              >
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}

          {/* Unassigned Jobs */}
          {unassignedJobs.length > 0 && (
            <View style={styles.unassignedJobsCard}>
              <View style={styles.unassignedJobsHeader}>
                <View style={styles.unassignedBadge}>
                  <Text style={styles.unassignedBadgeText}>{unassignedJobs.length}</Text>
                </View>
                <Text style={styles.unassignedLabel}>Unassigned Jobs</Text>
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.unassignedJobsScroll}
              >
                {unassignedJobs.slice(0, 5).map((job: any) => (
                  <TouchableOpacity
                    key={job.id}
                    style={[
                      styles.unassignedJobItem,
                      selectedJob?.id === job.id && styles.unassignedJobItemSelected
                    ]}
                    onPress={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.unassignedJobTitle} numberOfLines={1}>{job.title}</Text>
                    {job.scheduledAt && (
                      <Text style={styles.unassignedJobMeta}>
                        {new Date(job.scheduledAt).toLocaleDateString('en-AU', { 
                          weekday: 'short', day: 'numeric', month: 'short' 
                        })}
                      </Text>
                    )}
                    {job.clientName && (
                      <Text style={styles.unassignedJobMeta} numberOfLines={1}>{job.clientName}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Team Members Search */}
          {teamMembers.length > SCHEDULER_COLLAPSED_COUNT && (
            <View style={styles.schedulerSearchWrap}>
              <Feather name="search" size={14} color={colors.mutedForeground} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.schedulerSearchInput}
                placeholder="Search team members..."
                placeholderTextColor={colors.mutedForeground}
                value={schedulerSearch}
                onChangeText={setSchedulerSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {schedulerSearch.length > 0 && (
                <TouchableOpacity onPress={() => setSchedulerSearch('')} activeOpacity={0.7}>
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Team Members */}
          <View style={styles.teamMembersList}>
            {(() => {
              const filtered = schedulerSearch.trim()
                ? teamMembers.filter((m: any) => {
                    const name = getMemberName(m).toLowerCase();
                    return name.includes(schedulerSearch.trim().toLowerCase());
                  })
                : teamMembers;
              const showAll = schedulerExpanded || schedulerSearch.trim().length > 0;
              const visible = showAll ? filtered : filtered.slice(0, SCHEDULER_COLLAPSED_COUNT);
              const hiddenCount = filtered.length - SCHEDULER_COLLAPSED_COUNT;

              return (
                <>
                  {visible.map((member: any) => {
                    const memberJobs = getJobsForMember(member.memberId);
                    const isClickable = !!selectedJob && !isAssigning;

                    return (
                      <TouchableOpacity
                        key={member.id}
                        style={[
                          styles.teamMemberCard,
                          isClickable && styles.teamMemberCardClickable
                        ]}
                        onPress={() => {
                          if (isClickable && member.memberId) {
                            handleAssignJob(selectedJob.id, member.memberId);
                          }
                        }}
                        activeOpacity={isClickable ? 0.7 : 1}
                        disabled={!isClickable}
                      >
                        <View style={styles.teamMemberHeader}>
                          <TeamAvatar
                            firstName={member.firstName}
                            lastName={member.lastName}
                            email={member.email}
                            userId={String(member.userId || member.id)}
                            themeColor={member.themeColor}
                            size={36}
                          />
                          <View style={styles.teamMemberInfo}>
                            <Text style={styles.teamMemberName}>{getMemberName(member)}</Text>
                            <Text style={styles.teamMemberJobCount}>
                              {memberJobs.length} active job{memberJobs.length !== 1 ? 's' : ''}
                            </Text>
                          </View>
                          {isClickable && (
                            <View style={styles.tapToAssignBadge}>
                              <Text style={styles.tapToAssignText}>Tap to assign</Text>
                            </View>
                          )}
                        </View>
                        {memberJobs.length > 0 && (
                          <View style={styles.memberJobsList}>
                            {memberJobs.slice(0, 2).map((job: any) => (
                              <TouchableOpacity
                                key={job.id}
                                style={styles.memberJobItem}
                                onPress={() => handleUnassignJob(job)}
                                activeOpacity={0.7}
                                disabled={isAssigning}
                              >
                                <Text style={styles.memberJobTitle} numberOfLines={1}>{job.title}</Text>
                                <View style={styles.memberJobActions}>
                                  <StatusBadge status={job.status} size="sm" />
                                  <Feather name="x-circle" size={iconSizes.md} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  {schedulerSearch.trim().length === 0 && filtered.length > SCHEDULER_COLLAPSED_COUNT && (
                    <TouchableOpacity
                      style={styles.schedulerToggle}
                      onPress={() => setSchedulerExpanded(!schedulerExpanded)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.schedulerToggleText}>
                        {schedulerExpanded ? 'Show Less' : `View All (${hiddenCount} more)`}
                      </Text>
                      <Feather
                        name={schedulerExpanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  )}

                  {schedulerSearch.trim().length > 0 && filtered.length === 0 && (
                    <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                      <Text style={{ color: colors.mutedForeground, fontSize: typography.button.fontSize }}>
                        No team members match "{schedulerSearch.trim()}"
                      </Text>
                    </View>
                  )}
                </>
              );
            })()}
          </View>
        </View>
      )}

      {/* Recent Activity */}
      {(() => {
        const hasAnyWork =
          (Array.isArray(activities) && activities.length > 0) ||
          (todaysJobs && todaysJobs.length > 0) ||
          (stats.pendingQuotes || 0) > 0 ||
          (stats.unpaidInvoices || 0) > 0 ||
          (stats.thisMonthJobsCompleted || 0) > 0 ||
          (stats.lastMonthJobsCompleted || 0) > 0 ||
          (stats.thisMonthQuotesSent || 0) > 0 ||
          (stats.lastMonthQuotesSent || 0) > 0;
        const showFirstQuoteCta = !activitiesLoading && !hasAnyWork;
        return (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionTitleIcon}>
                  <Feather name="activity" size={iconSizes.md} color={colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
              </View>
            </View>
            {showFirstQuoteCta ? (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.lg,
                  alignItems: 'center',
                }}
                testID="card-first-quote-cta"
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: colorWithOpacity(colors.primary, 0.12),
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing.sm,
                  }}
                >
                  <Feather name="file-plus" size={24} color={colors.primary} />
                </View>
                <Text
                  style={{
                    fontSize: typography.subtitle.fontSize,
                    fontWeight: fontWeights.semibold,
                    color: colors.foreground,
                    marginBottom: 4,
                    textAlign: 'center',
                  }}
                >
                  Create your first quote
                </Text>
                <Text
                  style={{
                    fontSize: typography.sizes.sm,
                    color: colors.mutedForeground,
                    textAlign: 'center',
                    marginBottom: spacing.md,
                  }}
                >
                  Send a polished quote to a client in under a minute.
                </Text>
                <SheetButton
                  onPress={() => router.push(asHref('/more/quote/new'))}
                  icon={<Feather name="plus" size={16} color={colors.primaryForeground} />}
                  label="New Quote"
                />
              </View>
            ) : (
              <ActivityFeed
                activities={activities}
                isLoading={activitiesLoading}
                onActivityPress={(activity) => {
                  if (activity.entityType && activity.entityId) {
                    handleNavigateToItem(activity.entityType, activity.entityId);
                  }
                }}
              />
            )}
          </View>
        );
      })()}

      {/* Bottom Spacing */}
      <View style={{ height: spacing.md }} />
    </ScrollView>

    {/* First-run welcome modal — trade type + team size, shown once per new account */}
    <FirstRunWelcomeModal
      visible={showWelcomeModal}
      onDone={() => setShowWelcomeModal(false)}
    />
  </>
  );
}

// hint: Logic changed on both sides. Requires understanding intent of each change.
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  contentContainer: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: pageShell.paddingBottom,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },

  gettingStartedCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadows.sm,
  },
  gettingStartedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  gettingStartedIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gettingStartedTitle: {
    ...typography.subtitle,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  gettingStartedSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  gettingStartedSteps: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  gettingStartedStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  gettingStartedStepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gettingStartedStepTitle: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  gettingStartedStepDesc: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 1,
  },

  header: {
    marginBottom: spacing.xl,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
    fontSize: typography.sizes.xxl,
    fontWeight: fontWeights.extrabold,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    fontSize: typography.button.fontSize,
  },
  roleBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  roleBadgeText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerMapButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Activity Feed - compact
  activityList: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    ...typography.body,
    color: colors.foreground,
  },
  activityDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  activityTime: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  activityEmpty: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  activityEmptyText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },

  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    ...shadows.sm,
  },
  workerStatusCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  workerStatusLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  workerStatusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  workerStatusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  workerStatusBtnText: {
    fontSize: typography.sizes.sm,
  },
  statusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 10,
  },
  statusCardLabel: {
    ...typography.label,
    color: colors.mutedForeground,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentActive: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionTitleIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    minHeight: 44,
  },
  viewAllText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },

  kpiGrid: {
    gap: spacing.md,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  kpiCard: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.md,
  },
  kpiCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  kpiIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiTextContainer: {
    flex: 1,
  },
  kpiValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: fontWeights.extrabold,
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  kpiTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 1,
  },

  // Job Scheduler styles
  schedulerCaption: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  schedulerSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  schedulerSearchInput: {
    flex: 1,
    fontSize: typography.button.fontSize,
    color: colors.foreground,
    paddingVertical: spacing.xs,
  },
  schedulerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  schedulerToggleText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  selectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${colors.primary}15`,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  selectionBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  selectionBannerText: {
    ...typography.bodySmall,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    flex: 1,
  },
  cancelSelectionButton: {
    padding: spacing.xs,
  },
  unassignedJobsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderStyle: 'dashed',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  unassignedJobsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  unassignedBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  unassignedBadgeText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
  },
  unassignedLabel: {
    ...typography.bodySmall,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  unassignedJobsScroll: {
    gap: spacing.sm,
  },
  unassignedJobItem: {
    width: 160,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  unassignedJobItemSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: `${colors.primary}08`,
  },
  unassignedJobTitle: {
    ...typography.bodySmall,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  unassignedJobMeta: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  teamMembersList: {
    gap: spacing.sm,
  },
  teamMemberCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  teamMemberCardClickable: {
    borderColor: `${colors.primary}40`,
  },
  teamMemberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  teamMemberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamMemberAvatarText: {
    ...typography.bodySmall,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  teamMemberInfo: {
    flex: 1,
  },
  teamMemberName: {
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  teamMemberJobCount: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  tapToAssignBadge: {
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tapToAssignText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.medium,
    color: colors.primary,
  },
  memberJobsList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  memberJobItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  memberJobTitle: {
    ...typography.captionSmall,
    color: colors.foreground,
    flex: 1,
    marginRight: spacing.sm,
  },
  memberJobActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  jobsList: {
    gap: spacing.md,
  },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.md,
  },
  jobCardAccent: {
    width: 4,
    backgroundColor: colors.primary,
  },
  jobCardContent: {
    flex: 1,
    padding: spacing.lg,
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  jobCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  timeBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBoxText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  jobCardTitleArea: {
    flex: 1,
  },
  jobCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  timePeriod: {
    ...typography.label,
    color: colors.mutedForeground,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  statusBadgeComplete: {
    backgroundColor: `${colors.success}15`,
    borderColor: `${colors.success}30`,
  },
  statusBadgeProgress: {
    backgroundColor: `${colors.warning}15`,
    borderColor: `${colors.warning}30`,
  },
  statusBadgeScheduled: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  statusBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  statusBadgeTextComplete: {
    color: colors.success,
  },
  statusBadgeTextProgress: {
    color: colors.warning,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warning,
  },
  jobCardTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginTop: 2,
  },
  jobCardDetails: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  jobDetailText: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  quickContactRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickContactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.muted,
    minHeight: 44,
  },
  quickContactButtonFull: {
    flex: 1,
  },
  quickContactText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  directionsButton: {
    borderColor: `${colors.primary}30`,
    backgroundColor: `${colors.primary}10`,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: `${colors.primary}10`,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  optimizeButtonActive: {
    backgroundColor: colors.muted,
    borderColor: colors.cardBorder,
  },
  optimizeButtonText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  optimizeButtonTextActive: {
    color: colors.mutedForeground,
  },
  optimizedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: `${colors.success}15`,
  },
  optimizedBadgeText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.medium,
    color: colors.success,
  },
  nextJobSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    marginBottom: spacing.md,
  },
  nextJobSuggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextJobSuggestionContent: {
    flex: 1,
  },
  nextJobSuggestionLabel: {
    ...typography.captionSmall,
    fontWeight: fontWeights.semibold,
    color: colors.warning,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  nextJobSuggestionTitle: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginTop: 1,
  },
  nextJobSuggestionMeta: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  nextJobGoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  nextJobGoButtonText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  startRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
    minHeight: 52,
    ...shadows.md,
  },
  startRouteIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startRouteText: {
    ...typography.body,
    fontWeight: fontWeights.bold,
    color: colors.primaryForeground,
    flex: 1,
  },
  orderBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.bold,
    color: colors.primaryForeground,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.success,
    minHeight: 44,
    ...shadows.xs,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.info,
    minHeight: 44,
    ...shadows.xs,
  },
  secondaryActionButtonText: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  completeActionButton: {
    backgroundColor: colors.primary,
  },
  primaryActionButtonText: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  outlineActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 44,
  },
  outlineActionButtonText: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  emptyStateIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyStateTitle: {
    ...typography.body,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  scheduleJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    minHeight: 48,
    ...shadows.sm,
  },
  scheduleJobButtonText: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },

  timeTrackingWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    ...shadows.sm,
  },
  timeTrackingWidgetActive: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  timeTrackingWidgetBreak: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  timeTrackingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  timerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerIconContainerActive: {
    backgroundColor: colors.muted,
  },
  timerIconContainerBreak: {
    backgroundColor: colors.muted,
  },
  timerTextContent: {
    flex: 1,
  },
  timerTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  elapsedTime: {
    fontSize: typography.sizes.xxl,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    color: colors.primary,
  },
  elapsedTimeBreak: {
    color: colors.warning,
  },
  totalTimeToday: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  timerSubtext: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  timerJobTitle: {
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    marginTop: 2,
  },
  timerJobTitleLink: {
    color: colors.primary,
  },
  breakBadge: {
    backgroundColor: colorWithOpacity(colors.warning, 0.13),
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  breakBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.warning,
    letterSpacing: 0.5,
  },
  pulsingDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  timerWidgetContainer: {
    gap: spacing.sm,
  },
  timerActiveContainer: {
    gap: spacing.sm,
  },
  timerJobListContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    ...shadows.sm,
  },
  timerJobListLabel: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timerJobListScroll: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  timerJobItem: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    minWidth: 170,
    maxWidth: 210,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerJobItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  timerJobStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timerJobItemTitle: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    flex: 1,
  },
  timerJobItemMeta: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  timerJobItemAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  timerJobItemActionText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  teamOnClockContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    ...shadows.sm,
  },
  teamOnClockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  teamOnClockIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colorWithOpacity(colors.info, 0.12),
  },
  teamOnClockTitle: {
    ...typography.body,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  teamOnClockSubtitle: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  teamOnClockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  teamOnClockRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  teamOnClockName: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  teamOnClockJob: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  teamOnClockTime: {
    ...typography.caption,
    fontWeight: fontWeights.bold,
    fontVariant: ['tabular-nums'],
  },
  teamOnClockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: 2,
  },
  teamOnClockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  teamOnClockBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
  },
  todayEntriesContainer: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  todayEntriesTitle: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  todayEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  todayEntryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  todayEntryJobTitle: {
    ...typography.caption,
    flex: 1,
    color: colors.foreground,
  },
  todayEntryDuration: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
  },
  timerControlsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timerControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    minHeight: 44,
  },
  timerControlText: {
    ...typography.button,
    color: colors.foreground,
  },
  breakButton: {
    flex: 1,
    backgroundColor: colorWithOpacity(colors.warning, 0.08),
    borderWidth: 1,
    borderColor: colorWithOpacity(colors.warning, 0.25),
  },
  breakButtonText: {
    ...typography.button,
    color: colors.warning,
    fontWeight: fontWeights.semibold,
  },
  resumeButton: {
    flex: 1,
    backgroundColor: colors.success,
    borderWidth: 1,
    borderColor: colors.success,
  },
  resumeButtonText: {
    ...typography.button,
    color: colors.white,
    fontWeight: fontWeights.semibold,
  },
  stopButton: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  stopButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  saveButton: {
    flex: 1,
    backgroundColor: `${colors.primary}15`,
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  cancelButton: {
    backgroundColor: `${colors.destructive}10`,
    borderWidth: 1,
    borderColor: `${colors.destructive}30`,
    paddingHorizontal: spacing.md,
  },
  stopTimerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.destructive,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    minHeight: 44,
  },
  stopTimerText: {
    ...typography.button,
    color: colors.white,
  },

  // This Week Section
  weekBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  weekBadgeText: {
    ...typography.label,
    color: colors.mutedForeground,
  },
  thisWeekCard: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  weekJobItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: 'transparent',
    minHeight: 44,
  },
  weekJobItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekJobContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  weekJobTitle: {
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  weekJobMeta: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  viewAllWeekButton: {
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.background,
    minHeight: 44,
  },
  viewAllWeekText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },

  revenueChartCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    ...shadows.md,
  },
  revenueChartLoading: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  revenueChartHeader: {
    marginBottom: spacing.lg,
  },
  revenueChartTotal: {
    ...typography.sectionTitle,
    color: colors.foreground,
  },
  revenueChartSubtitle: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  revenueChartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  revenueBarColumn: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  revenueBarValue: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontSize: typography.sizes.xs,
  },
  revenueBarTrack: {
    width: '100%',
    height: 100,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  revenueBar: {
    width: '80%',
    borderRadius: radius.xs,
    minHeight: 4,
  },
  revenueBarLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontSize: typography.sizes.xs,
  },

  complianceAlertCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
  },
  complianceAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  complianceAlertIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  complianceAlertContent: {
    flex: 1,
  },
  complianceAlertTitle: {
    ...typography.bodySemibold,
    marginBottom: 2,
  },
  complianceAlertDescription: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },

  weatherWidget: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    ...shadows.md,
  },
  weatherMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  weatherIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherTextContent: {
    flex: 1,
  },
  weatherTempRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  weatherTemp: {
    fontSize: typography.sizes['3xl'],
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  weatherDegree: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  weatherLabel: {
    ...typography.bodySmall,
    color: colors.mutedForeground,
    marginLeft: spacing.xs,
  },
  weatherDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  weatherDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weatherDetailText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  weatherRainWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  weatherRainText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.medium,
  },

  daySummaryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    ...shadows.md,
  },
  daySummaryHeader: {
    marginBottom: spacing.lg,
  },
  daySummaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  daySummaryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySummaryTitle: {
    ...typography.bodySemibold,
    color: colors.foreground,
  },
  daySummarySubtitle: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  daySummaryStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  daySummaryStat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  daySummaryStatIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  daySummaryStatValue: {
    ...typography.bodySemibold,
    color: colors.foreground,
    fontSize: typography.subtitle.fontSize,
  },
  daySummaryStatLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  daySummaryTomorrow: {
    marginTop: spacing.lg,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  daySummaryTomorrowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  daySummaryTomorrowLabel: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  daySummaryTomorrowTitle: {
    ...typography.bodySemibold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  daySummaryTomorrowMeta: {
    gap: spacing.xs,
  },
  daySummaryTomorrowMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  daySummaryTomorrowMetaText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    flex: 1,
  },

});
