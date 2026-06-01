import { useQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useState } from "react";
import { Clock, Phone, RefreshCw, AlertCircle, CheckCircle2, Car, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapTeardownGuard } from "@/lib/mapSafe";
import jobrunnerLogo from "@assets/jobrunner-logo-cropped.png";

interface TrackingData {
  id: string;
  isActive: boolean;
  expiresAt: string;
  lastLocation: {
    lat: number;
    lng: number;
    updatedAt: string;
  } | null;
  estimatedArrival: string | null;
  job: {
    title: string;
    scheduledTime: string | null;
    status: string;
  };
  business: {
    name: string;
    phone: string | null;
    email: string | null;
    logoUrl: string | null;
  };
  worker: {
    firstName: string;
  };
  trackingType?: undefined;
}

interface ETATrackingData {
  trackingType: 'eta';
  businessName: string;
  businessLogo?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
  tradieName: string;
  suburb: string;
  sentAt: string;
  estimatedMinutes: number;
  remainingMinutes: number;
  status: 'on_the_way' | 'arrived' | 'completed' | 'arriving_soon';
}

type AnyTrackingData = TrackingData | ETATrackingData;

function createWorkerIcon(name: string) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return L.divIcon({
    className: 'uber-worker-marker',
    html: `
      <div style="position: relative; width: 48px; height: 48px;">
        <div style="
          position: absolute;
          width: 56px;
          height: 56px;
          top: -4px;
          left: -4px;
          border-radius: 50%;
          background: #3b82f6;
          opacity: 0.25;
          animation: uber-pulse 2s ease-out infinite;
        "></div>
        <div style="
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          border: 3px solid white;
          box-shadow: 0 4px 20px rgba(37,99,235,0.4), 0 2px 8px rgba(0,0,0,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 16px;
          letter-spacing: 0.5px;
        ">
          ${initials}
        </div>
        <div style="
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #22c55e;
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        "></div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -28],
  });
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  
  if (diffSeconds < 60) {
    return "Just now";
  } else if (diffMinutes === 1) {
    return "1 minute ago";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`;
  } else {
    return past.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
}

function formatETA(etaString: string): string {
  const eta = new Date(etaString);
  const now = new Date();
  const diffMs = eta.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes <= 0) {
    return "Arriving now";
  } else if (diffMinutes === 1) {
    return "~1 minute away";
  } else if (diffMinutes < 60) {
    return `~${diffMinutes} minutes away`;
  } else {
    return eta.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
}

function useForceLight() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.classList.contains('dark') ? 'dark' : 'light';
    root.classList.remove('dark');
    root.style.setProperty('--background', '210 40% 98%');
    root.style.setProperty('--foreground', '222.2 84% 4.9%');
    root.style.setProperty('--card', '0 0% 100%');
    root.style.setProperty('--card-foreground', '222.2 84% 4.9%');
    root.style.setProperty('--muted', '210 40% 96.1%');
    root.style.setProperty('--muted-foreground', '215.4 16.3% 46.9%');
    root.style.setProperty('--border', '214.3 31.8% 91.4%');
    root.style.setProperty('color-scheme', 'light');
    return () => {
      if (previousTheme === 'dark') root.classList.add('dark');
      root.style.removeProperty('--background');
      root.style.removeProperty('--foreground');
      root.style.removeProperty('--card');
      root.style.removeProperty('--card-foreground');
      root.style.removeProperty('--muted');
      root.style.removeProperty('--muted-foreground');
      root.style.removeProperty('--border');
      root.style.removeProperty('color-scheme');
    };
  }, []);
}

function BrandedHeader({ businessName, businessLogo, businessPhone, businessEmail }: {
  businessName: string;
  businessLogo?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
}) {
  return (
    <header className="bg-brand text-white sticky top-0 z-20">
      <div className="px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {businessLogo ? (
              <img
                src={businessLogo}
                alt={businessName}
                className="w-11 h-11 object-contain rounded-md bg-white/15 p-0.5 flex-shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-md bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
                <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 object-contain" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-base truncate text-white">{businessName}</h1>
              <div className="flex gap-3 text-xs text-white/70">
                {businessPhone && (
                  <a href={`tel:${businessPhone}`} className="hover:text-white flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {businessPhone}
                  </a>
                )}
                {businessEmail && (
                  <a href={`mailto:${businessEmail}`} className="hover:text-white flex items-center gap-1 hidden sm:flex">
                    <Mail className="w-3 h-3" /> {businessEmail}
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {businessPhone && (
              <a href={`tel:${businessPhone}`}>
                <Button variant="ghost" size="icon" className="text-white bg-white/15 backdrop-blur-sm rounded-full">
                  <Phone className="w-4 h-4" />
                </Button>
              </a>
            )}
            {businessPhone && (
              <a href={`sms:${businessPhone}`}>
                <Button variant="ghost" size="icon" className="text-white bg-white/15 backdrop-blur-sm rounded-full">
                  <MessageCircle className="w-4 h-4" />
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function BrandedFooter({ businessName, businessPhone }: { businessName: string; businessPhone?: string | null }) {
  return (
    <footer className="bg-white border-t border-slate-100 py-5 px-4 mt-auto">
      <div className="max-w-2xl mx-auto text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-brand" />
          <span>Secure & encrypted</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Powered by <span className="text-brand font-medium">JobRunner</span>
          {businessPhone && (
            <> · Questions? Contact{' '}
              <a href={`tel:${businessPhone}`} className="hover:underline text-slate-600">{businessName}</a>
            </>
          )}
        </p>
      </div>
    </footer>
  );
}

function ETATrackingView({ data }: { data: ETATrackingData }) {
  useForceLight();
  const [now, setNow] = useState(Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const sentAt = new Date(data.sentAt).getTime();
  const arrivalTime = sentAt + data.estimatedMinutes * 60000;
  const remainingMs = Math.max(0, arrivalTime - now);
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  const isArrivingSoon = remainingMinutes <= 0;
  const statusText = isArrivingSoon ? 'Arriving soon' : `Arriving in ${remainingMinutes} min`;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <BrandedHeader
        businessName={data.businessName}
        businessLogo={data.businessLogo}
        businessPhone={data.businessPhone}
        businessEmail={data.businessEmail}
      />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <Card className="border-blue-100 overflow-hidden">
            <div className="bg-blue-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
                    {data.tradieName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-slate-900">{data.tradieName} is on the way</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Car className="h-3.5 w-3.5 text-blue-500" />
                    <p className="text-sm text-blue-600 font-medium">
                      Heading to {data.suburb}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <CardContent className="pt-5 pb-5">
              <div className="text-center space-y-3">
                <div className="bg-slate-50 rounded-xl p-5">
                  <p className="text-3xl font-bold text-brand">
                    {statusText}
                  </p>
                  {!isArrivingSoon && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Estimated {data.estimatedMinutes} min travel time
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2">
                  <div className="relative flex-shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${isArrivingSoon ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                    {!isArrivingSoon && (
                      <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping opacity-50" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-slate-600">
                    {isArrivingSoon ? "Almost there" : "On the Way"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <BrandedFooter businessName={data.businessName} businessPhone={data.businessPhone} />
    </div>
  );
}

interface TrackArrivalProps {
  token: string;
}

export default function TrackArrival({ token }: TrackArrivalProps) {
  useForceLight();
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  
  const { data, isLoading, error, refetch, isFetching } = useQuery<AnyTrackingData>({
    queryKey: ['/api/track', token],
    refetchInterval: autoRefreshEnabled ? 10000 : false,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="bg-brand h-16" />
        <div className="max-w-2xl mx-auto p-4 space-y-4 -mt-2">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = (error as any)?.message || "Unable to load tracking information";
    const isExpired = errorMessage.includes("expired") || errorMessage.includes("410");
    const isNotFound = errorMessage.includes("not found") || errorMessage.includes("404");
    
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <header className="bg-brand text-white px-4 py-4">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="w-11 h-11 rounded-md bg-white/20 flex items-center justify-center">
              <img src={jobrunnerLogo} alt="JobRunner" className="w-8 h-8 object-contain" />
            </div>
            <h1 className="font-bold text-base text-white">Live Tracking</h1>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold mb-2" data-testid="text-error-title">
                {isExpired ? "Tracking Link Expired" : isNotFound ? "Link No Longer Available" : "Unable to Load"}
              </h2>
              <p className="text-muted-foreground" data-testid="text-error-message">
                {isExpired 
                  ? "This tracking link has expired. Please contact the business for updated information."
                  : isNotFound
                    ? "This tracking link has expired or is no longer available."
                    : "There was a problem loading the tracking information. Please try again later."}
              </p>
            </CardContent>
          </Card>
        </main>
        <BrandedFooter businessName="your tradie" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (data.trackingType === 'eta') {
    return <ETATrackingView data={data} />;
  }

  const trackingData = data as TrackingData;
  const { job, business, worker, lastLocation, estimatedArrival, isActive } = trackingData;
  const workerName = worker.firstName;
  const jobCompleted = job.status === 'done' || job.status === 'completed';

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <BrandedHeader
        businessName={business.name}
        businessLogo={business.logoUrl}
        businessPhone={business.phone}
        businessEmail={business.email}
      />

      <main className="flex-1">
        <div className="max-w-2xl mx-auto">
          {jobCompleted ? (
            <div className="px-4 py-6 space-y-4">
              <Card className="border-emerald-200 bg-emerald-50 overflow-hidden">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg text-emerald-800" data-testid="text-completed-title">
                        Work Completed
                      </h2>
                      <p className="text-sm text-emerald-700 mt-0.5" data-testid="text-completed-message">
                        {workerName} has finished the job
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5 space-y-4">
                  <h3 className="font-semibold text-base" data-testid="text-job-title">{job.title}</h3>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <div className="px-4 pt-4 pb-2">
                <Card className="border-blue-100 overflow-hidden">
                  <div className="bg-blue-50 px-5 py-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
                            {workerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-white" />
                        </div>
                        <div>
                          <h2 className="font-bold text-base text-slate-900" data-testid="text-worker-name">{workerName}</h2>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Car className="h-3.5 w-3.5 text-blue-500" />
                            {estimatedArrival ? (
                              <p className="text-sm text-blue-600 font-semibold" data-testid="text-eta">
                                {formatETA(estimatedArrival)}
                              </p>
                            ) : lastLocation ? (
                              <p className="text-sm text-blue-600 font-medium" data-testid="text-on-the-way">
                                On the way
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground" data-testid="text-waiting">
                                Waiting for update
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isFetching}
                        data-testid="button-refresh"
                      >
                        <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                  </div>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-shrink-0">
                          <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-blue-500' : 'bg-gray-400'}`} />
                          {isActive && (
                            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping opacity-50" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-slate-600">
                          {isActive ? "Live Tracking Active" : "Tracking Inactive"}
                        </span>
                      </div>
                      {lastLocation && (
                        <span className="text-xs text-muted-foreground" data-testid="text-last-updated">
                          Updated {formatTimeAgo(lastLocation.updatedAt)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {lastLocation && (
                <div className="px-4 py-2">
                  <Card className="overflow-hidden">
                    <CardContent className="p-0">
                      <style>{`
                        @keyframes uber-pulse {
                          0% { transform: scale(1); opacity: 0.3; }
                          100% { transform: scale(2); opacity: 0; }
                        }
                        .uber-worker-marker, .uber-destination-marker {
                          background: transparent !important;
                          border: none !important;
                        }
                        .uber-worker-marker {
                          transition: transform 0.8s ease-out !important;
                        }
                      `}</style>
                      <div className="h-[50vh] min-h-[320px] max-h-[500px] relative" data-testid="container-map">
                        <MapContainer
                          center={[lastLocation.lat, lastLocation.lng]}
                          zoom={15}
                          className="h-full w-full"
                          scrollWheelZoom={false}
                          zoomControl={false}
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                          />
                          <MapTeardownGuard />
                          <Marker position={[lastLocation.lat, lastLocation.lng]} icon={createWorkerIcon(workerName)}>
                            <Popup>
                              <div className="text-center p-1">
                                <p className="font-bold text-sm">{workerName}</p>
                                <p className="text-xs text-blue-600 mt-1">
                                  {estimatedArrival ? formatETA(estimatedArrival) : "On the way"}
                                </p>
                              </div>
                            </Popup>
                          </Marker>
                          <Circle 
                            center={[lastLocation.lat, lastLocation.lng]} 
                            radius={100} 
                            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 1 }}
                          />
                        </MapContainer>
                        <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md border border-gray-200">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-xs font-medium text-gray-700">Live tracking</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="px-4 py-2 space-y-4">
                <Card>
                  <CardContent className="pt-5 space-y-4">
                    <h3 className="font-semibold text-base" data-testid="text-job-title">{job.title}</h3>
                    {job.scheduledTime && (
                      <div className="flex items-start gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Scheduled</p>
                          <p className="text-sm" data-testid="text-scheduled-time">
                            {job.scheduledTime}
                          </p>
                        </div>
                      </div>
                    )}
                    {business.phone && (
                      <div className="flex items-start gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Contact</p>
                          <a 
                            href={`tel:${business.phone}`} 
                            className="text-sm text-brand hover:underline"
                            data-testid="link-phone"
                          >
                            {business.phone}
                          </a>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex items-center justify-between flex-wrap gap-2 text-sm text-muted-foreground">
                  <span data-testid="text-auto-refresh-status">
                    Auto-refresh: {autoRefreshEnabled ? "On (every 10s)" : "Off"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                    data-testid="button-toggle-auto-refresh"
                  >
                    {autoRefreshEnabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <BrandedFooter businessName={business.name} businessPhone={business.phone} />
    </div>
  );
}
