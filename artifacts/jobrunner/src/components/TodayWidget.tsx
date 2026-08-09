import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { 
  Sun, 
  Cloud, 
  CloudRain, 
  CloudSnow,
  CloudLightning,
  Wind,
  Thermometer,
  Droplets,
  Calendar,
  Clock,
  Briefcase,
  MapPin,
  ChevronRight,
  AlertTriangle
} from "lucide-react";

interface TodayWidgetProps {
  userName?: string;
  onViewSchedule?: () => void;
  onViewJob?: (jobId: string) => void;
}

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

const WEATHER_CODES: Record<number, { label: string; icon: typeof Sun }> = {
  0: { label: "Clear", icon: Sun },
  1: { label: "Mainly Clear", icon: Sun },
  2: { label: "Partly Cloudy", icon: Cloud },
  3: { label: "Overcast", icon: Cloud },
  45: { label: "Foggy", icon: Cloud },
  48: { label: "Foggy", icon: Cloud },
  51: { label: "Light Drizzle", icon: CloudRain },
  53: { label: "Drizzle", icon: CloudRain },
  55: { label: "Heavy Drizzle", icon: CloudRain },
  56: { label: "Freezing Drizzle", icon: CloudRain },
  57: { label: "Freezing Drizzle", icon: CloudRain },
  61: { label: "Light Rain", icon: CloudRain },
  63: { label: "Rain", icon: CloudRain },
  65: { label: "Heavy Rain", icon: CloudRain },
  66: { label: "Freezing Rain", icon: CloudRain },
  67: { label: "Freezing Rain", icon: CloudRain },
  71: { label: "Light Snow", icon: CloudSnow },
  73: { label: "Snow", icon: CloudSnow },
  75: { label: "Heavy Snow", icon: CloudSnow },
  77: { label: "Snow Grains", icon: CloudSnow },
  80: { label: "Light Showers", icon: CloudRain },
  81: { label: "Showers", icon: CloudRain },
  82: { label: "Heavy Showers", icon: CloudRain },
  85: { label: "Snow Showers", icon: CloudSnow },
  86: { label: "Heavy Snow Showers", icon: CloudSnow },
  95: { label: "Thunderstorm", icon: CloudLightning },
  96: { label: "Thunderstorm", icon: CloudLightning },
  99: { label: "Severe Thunderstorm", icon: CloudLightning },
};

function getWeatherInfo(code: number) {
  return WEATHER_CODES[code] || { label: "Unknown", icon: Cloud };
}

function isOutdoorTrade(tradeType?: string): boolean {
  const outdoorTrades = [
    'roofing', 'building', 'painting', 'landscaping', 'concreting',
    'fencing', 'plumbing', 'electrical', 'solar', 'guttering'
  ];
  return tradeType ? outdoorTrades.includes(tradeType.toLowerCase()) : true;
}

export default function TodayWidget({ 
  userName = "there",
  onViewSchedule,
  onViewJob 
}: TodayWidgetProps) {
  const { data: todaysJobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs/today"],
    staleTime: 2 * 60 * 1000,
  });

  const { data: businessSettings } = useQuery<any>({
    queryKey: ["/api/business-settings"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: weather, isLoading: weatherLoading } = useQuery<WeatherData>({
    queryKey: ["/api/weather"],
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const { data: timeData } = useQuery<any>({
    queryKey: ["/api/time-tracking/dashboard"],
    staleTime: 60000,
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  const pendingJobs = todaysJobs.filter((j: any) => j.status === 'scheduled' || j.status === 'pending');
  const inProgressJobs = todaysJobs.filter((j: any) => j.status === 'in_progress');
  const completedJobs = todaysJobs.filter((j: any) => j.status === 'done' || j.status === 'completed');

  const totalMinutesToday = timeData?.recentEntries?.reduce((total: number, entry: any) => {
    if (entry.duration) return total + entry.duration;
    if (entry.endTime) {
      const start = new Date(entry.startTime).getTime();
      const end = new Date(entry.endTime).getTime();
      return total + Math.floor((end - start) / 60000);
    }
    return total;
  }, 0) || 0;

  const weatherInfo = weather ? getWeatherInfo(weather.weatherCode) : null;
  const WeatherIcon = weatherInfo?.icon || Cloud;
  
  const showRainWarning = weather && (
    weather.precipitation > 0 || 
    weather.weatherCode >= 51 ||
    (weather.daily?.precipitationProbability?.[0] ?? 0) > 50
  );

  const tradeType = businessSettings?.tradeType;
  const isOutdoor = isOutdoorTrade(tradeType);

  return (
    <Card className="overflow-hidden" data-testid="today-widget">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          <div 
            className="flex-1 p-4 md:p-5"
            style={{ 
              background: weather?.isDay !== false 
                ? 'linear-gradient(135deg, hsl(210, 100%, 95%) 0%, hsl(200, 80%, 90%) 100%)'
                : 'linear-gradient(135deg, hsl(220, 40%, 25%) 0%, hsl(230, 35%, 20%) 100%)'
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-lg font-semibold" style={{ color: weather?.isDay !== false ? 'hsl(220, 15%, 25%)' : 'hsl(0, 0%, 95%)' }}>
                  {getGreeting()}, {userName}
                </p>
                <p className="text-sm" style={{ color: weather?.isDay !== false ? 'hsl(220, 10%, 45%)' : 'hsl(0, 0%, 75%)' }}>
                  {formatDate()}
                </p>
              </div>
              {weather && (
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <WeatherIcon 
                      className="h-8 w-8" 
                      style={{ color: weather.isDay !== false ? 'hsl(35, 95%, 55%)' : 'hsl(220, 50%, 70%)' }}
                    />
                    <span 
                      className="text-3xl font-bold"
                      style={{ color: weather.isDay !== false ? 'hsl(220, 15%, 25%)' : 'hsl(0, 0%, 95%)' }}
                    >
                      {Math.round(weather.temperature)}°
                    </span>
                  </div>
                  <p 
                    className="text-xs mt-1"
                    style={{ color: weather.isDay !== false ? 'hsl(220, 10%, 45%)' : 'hsl(0, 0%, 75%)' }}
                  >
                    {weatherInfo?.label}
                  </p>
                </div>
              )}
            </div>

            {weather && (
              <div className="flex items-center gap-4 text-xs" style={{ color: weather.isDay !== false ? 'hsl(220, 10%, 45%)' : 'hsl(0, 0%, 75%)' }}>
                <div className="flex items-center gap-1">
                  <Thermometer className="h-3 w-3" />
                  <span>Feels {Math.round(weather.apparentTemperature)}°</span>
                </div>
                <div className="flex items-center gap-1">
                  <Droplets className="h-3 w-3" />
                  <span>{weather.humidity}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <Wind className="h-3 w-3" />
                  <span>{Math.round(weather.windSpeed)} km/h</span>
                </div>
              </div>
            )}

            {showRainWarning && isOutdoor && (
              <div 
                className="flex items-center gap-2 mt-3 p-2 rounded-md text-sm"
                style={{ 
                  backgroundColor: 'hsl(35, 95%, 90%)',
                  color: 'hsl(35, 80%, 30%)'
                }}
              >
                <AlertTriangle className="h-4 w-4" />
                <span>
                  {weather?.precipitation && weather.precipitation > 0 
                    ? `Rain expected (${weather.precipitation}mm)`
                    : `${weather?.daily?.precipitationProbability?.[0] ?? 0}% chance of rain today`
                  }
                </span>
              </div>
            )}

            {weatherLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Cloud className="h-4 w-4 animate-pulse" />
                <span>Loading weather...</span>
              </div>
            )}
          </div>

          <div className="flex-1 p-4 md:p-5 bg-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Today's Schedule</span>
              </div>
              {todaysJobs.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={onViewSchedule}
                  className="h-7 text-xs"
                >
                  View all
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-2xl font-bold" style={{ color: 'hsl(var(--trade))' }}>
                  {pendingJobs.length}
                </p>
                <p className="text-xs text-muted-foreground">Scheduled</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-2xl font-bold text-blue-600">
                  {inProgressJobs.length}
                </p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-2xl font-bold text-green-600">
                  {completedJobs.length}
                </p>
                <p className="text-xs text-muted-foreground">Done</p>
              </div>
            </div>

            {todaysJobs.length > 0 ? (
              <div className="space-y-2">
                {todaysJobs.slice(0, 2).map((job: any) => (
                  <div 
                    key={job.id}
                    className="flex items-center gap-3 p-2 rounded-md bg-muted/30 hover-elevate cursor-pointer"
                    onClick={() => onViewJob?.(job.id)}
                  >
                    <div 
                      className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ 
                        backgroundColor: job.status === 'in_progress' 
                          ? 'hsl(210, 100%, 95%)'
                          : 'hsl(var(--muted))'
                      }}
                    >
                      <Briefcase 
                        className="h-4 w-4" 
                        style={{ 
                          color: job.status === 'in_progress' 
                            ? 'hsl(210, 100%, 50%)'
                            : 'hsl(var(--muted-foreground))'
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{job.title}</p>
                      {job.address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{job.address.split(',')[0]}</span>
                        </p>
                      )}
                    </div>
                    <Badge 
                      variant={job.status === 'in_progress' ? 'default' : 'secondary'}
                      className="flex-shrink-0 text-xs"
                    >
                      {job.status === 'in_progress' ? 'Active' : job.scheduledTime || 'Today'}
                    </Badge>
                  </div>
                ))}
                {todaysJobs.length > 2 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{todaysJobs.length - 2} more jobs today
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No jobs scheduled today</p>
              </div>
            )}

            {totalMinutesToday > 0 && (
              <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Time logged today:
                </span>
                <span className="text-sm font-medium">
                  {Math.floor(totalMinutesToday / 60)}h {totalMinutesToday % 60}m
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
