import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Phone, Mail, MapPin, AlertCircle, CheckCircle2, Clock, Calendar,
  User, Navigation, FileText, Camera, ChevronRight, Timer, Building2,
  MessageCircle, Loader2, Signal, ClipboardCheck, Package, CreditCard, Shield,
  Activity, Receipt, CircleDot, RefreshCw, Layers, Wrench, CheckCircle, Circle, Download
} from "lucide-react";
import { format, addDays, differenceInDays, startOfDay } from "date-fns";
import jobrunnerLogo from "@assets/jobrunner-logo-cropped.png";
import { useEffect, useLayoutEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapTeardownGuard, safeMapCall } from '@/lib/mapSafe';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { getWorkerDisplayName } from '@shared/displayName';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function WorkerAvatar({
  photoUrl,
  name,
  initials,
  bgColor,
  bgClass,
  textClass = "text-sm",
}: {
  photoUrl?: string | null;
  name: string;
  initials: string;
  bgColor?: string;
  bgClass?: string;
  textClass?: string;
}) {
  const [errored, setErrored] = useState(false);
  if (photoUrl && !errored) {
    return (
      <img
        src={photoUrl}
        alt={name}
        loading="lazy"
        className="w-12 h-12 rounded-full object-cover shadow-md"
        onError={() => setErrored(true)}
      />
    );
  }
  return (
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${textClass} shadow-md ${bgClass ?? ''}`}
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >
      {initials}
    </div>
  );
}

interface TimelineEvent {
  stage: string;
  label: string;
  date: string | null;
  completed: boolean;
}

interface ActivityFeedItem {
  type: string;
  title: string;
  description: string | null;
  timestamp: string;
}

interface JobPortalData {
  job: {
    id: number;
    title: string;
    description?: string;
    address?: string;
    latitude?: string;
    longitude?: string;
    status: string;
    notes?: string;
    workerStatus: null | 'assigned' | 'on_my_way' | 'arrived' | 'in_progress' | 'completed';
    workerStatusUpdatedAt?: string;
    workerEta?: string;
    workerEtaMinutes?: number;
    scheduledAt?: string;
    scheduledTime?: string;
    estimatedDuration?: number;
    photos: Array<{ url: string; description?: string; type?: string; uploadedAt?: string }>;
    startedAt?: string;
    completedAt?: string;
  };
  business: {
    name: string;
    phone?: string;
    email?: string;
    logo?: string;
    abn?: string;
  };
  worker: { firstName: string; lastName: string; phone?: string; photoUrl?: string | null } | null;
  client: { name: string; phone?: string; phoneLast4?: string } | null;
  documents: {
    quotes: Array<{ id: number; title: string; status: string; total: string; token: string; createdAt: string }>;
    invoices: Array<{ id: number; invoiceNumber: string; status: string; total: string; token: string; createdAt: string }>;
  };
  checklist: Array<{ text: string; isCompleted: boolean; sortOrder: number }>;
  checklistSummary?: { total: number; completed: number; percentage: number } | null;
  materials: Array<{ name: string; quantity: number; unit?: string; status?: string }>;
  assignments?: PortalAssignment[];
  workerAttendance?: Array<{
    startTime: string;
    endTime: string;
    duration: number;
    gpsVerified: boolean;
    clockInAddress: string | null;
    clockOutAddress: string | null;
  }>;
  timeline?: TimelineEvent[] | null;
  activityFeed?: ActivityFeedItem[];
  clientMessage?: string | null;
  phases?: Array<{
    id: string;
    phaseCode: string;
    name: string;
    status: 'not_started' | 'in_progress' | 'complete' | 'invoiced';
    sortOrder: number;
    scheduledStart: string | null;
    scheduledEnd: string | null;
  }> | null;
  visibility?: {
    showTimeline: boolean;
    showPhotos: boolean;
    showChecklist: boolean;
    showActivityFeed: boolean;
    showProgrammeOnPortal?: boolean;
  };
}

interface PortalProjectDocument {
  id: string;
  docNumber: string;
  title: string;
  category: string;
  currentRevision: string;
  updatedAt: string;
  latestRevision: {
    id: string;
    revision: string;
    fileName: string;
    fileSize: number | null;
    mimeType: string | null;
    uploadedAt: string;
    fileUrl: string | null;
  } | null;
}
interface PortalFinancials {
  originalContractValue: string;
  approvedVariations: Array<{
    variationNumber: string;
    description: string;
    amount: string;
    approvedAt: string | null;
  }>;
  approvedVariationsTotal: string;
  revisedContractValue: string;
  claims: Array<{
    claimNumber: string;
    periodStart: string | null;
    periodEnd: string | null;
    claimDate: string | null;
    amountClaimed: string;
    status: string;
    paidAt: string | null;
    submittedAt: string | null;
    approvedAt: string | null;
    retentionPercent: string;
    retentionAmount: string;
  }>;
  summary: {
    totalClaimed: string;
    totalPaid: string;
    outstanding: string;
    totalRetentionHeld: string;
  };
}

interface PortalAssignment {
  id: string;
  status: string;
  isPrimary: boolean;
  etaMinutes: number | null;
  etaUpdatedAt: string | null;
  travelStartedAt: string | null;
  arrivedAt: string | null;
  worker: {
    name: string;
    phone: string | null;
    photoUrl?: string | null;
  };
}

interface CrewLocationWorker {
  assignmentId: string;
  name: string;
  status: string;
  isPrimary: boolean;
  etaMinutes: number | null;
  etaUpdatedAt: string | null;
  travelStartedAt: string | null;
  arrivedAt: string | null;
  location: {
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    recordedAt: string;
  } | null;
  stale: boolean;
}

interface SubcontractorLocation {
  tokenId: string;
  name: string;
  status: string;
  isSubcontractor: boolean;
  location: {
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    recordedAt: string;
  } | null;
  stale: boolean;
  lastUpdated: string | null;
  etaMinutes: number | null;
}

interface CrewLocationResponse {
  tracking: boolean;
  jobLocation: { latitude: number; longitude: number } | null;
  workers: CrewLocationWorker[];
  subcontractors?: SubcontractorLocation[];
}

interface LocationResponse {
  tracking: boolean;
  status: string;
  message?: string;
  workerLocation?: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    updatedAt: number;
    stale: boolean;
  } | null;
  jobLocation?: {
    latitude: number;
    longitude: number;
  } | null;
  etaMinutes?: number;
  lastUpdated?: string;
}

const STATUS_ORDER = ['assigned', 'on_my_way', 'arrived', 'in_progress', 'completed'] as const;

function getStatusIndex(status: string | null): number {
  if (!status) return -1;
  return STATUS_ORDER.indexOf(status as any);
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(num || 0);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(dateStr));
}

function formatTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  return formatDate(dateStr);
}

function getStatusConfig(status: string | null) {
  switch (status) {
    case 'assigned':
      return { label: 'Scheduled', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', dot: 'bg-blue-500', pulse: false };
    case 'on_my_way':
      return { label: 'On the Way', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500', pulse: true };
    case 'arrived':
      return { label: 'Arrived on Site', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-500', pulse: false };
    case 'in_progress':
      return { label: 'Work in Progress', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', dot: 'bg-blue-500', pulse: true };
    case 'completed':
      return { label: 'Job Complete', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-500', pulse: false };
    default:
      return { label: 'Pending', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400', pulse: false };
  }
}

function getDocStatusBadge(status: string) {
  switch (status) {
    case 'accepted':
    case 'paid':
      return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 no-default-hover-elevate no-default-active-elevate">{status}</Badge>;
    case 'sent':
    case 'viewed':
      return <Badge variant="secondary" className="bg-blue-100 text-blue-700 no-default-hover-elevate no-default-active-elevate">{status}</Badge>;
    case 'overdue':
    case 'declined':
      return <Badge variant="secondary" className="bg-red-100 text-red-700 no-default-hover-elevate no-default-active-elevate">{status}</Badge>;
    default:
      return <Badge variant="secondary" className="bg-gray-100 text-gray-600 no-default-hover-elevate no-default-active-elevate">{status}</Badge>;
  }
}

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    safeMapCall(map, (m) => m.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: false }));
  }, [map, bounds]);
  return null;
}

const workerIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:48px;height:48px;">
    <div style="position:absolute;inset:-4px;width:56px;height:56px;border-radius:50%;background:#2563EB;opacity:0.12;animation:vehicle-ping 2s ease-out infinite;"></div>
    <div style="position:absolute;inset:-2px;width:52px;height:52px;border-radius:50%;background:#2563EB;opacity:0.06;animation:vehicle-ping 2s ease-out infinite 0.5s;"></div>
    <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#2563EB 0%,#1d4ed8 100%);border:3px solid white;box-shadow:0 4px 14px rgba(37,99,235,0.45);display:flex;align-items:center;justify-content:center;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/>
        <circle cx="6.5" cy="16.5" r="2.5" fill="white" stroke="white"/>
        <circle cx="16.5" cy="16.5" r="2.5" fill="white" stroke="white"/>
      </svg>
    </div>
  </div>
  <style>
    @keyframes vehicle-ping{0%{transform:scale(1);opacity:0.2}100%{transform:scale(2.8);opacity:0}}
  </style>`,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

const jobIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const jobPinIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:44px;height:54px;">
    <div style="position:absolute;top:0;left:0;width:44px;height:44px;border-radius:50%;background:white;box-shadow:0 2px 12px rgba(16,185,129,0.35);display:flex;align-items:center;justify-content:center;">
      <div style="width:36px;height:36px;border-radius:50%;background:#10B981;display:flex;align-items:center;justify-content:center;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><rect x="9" y="13" width="6" height="9" fill="rgba(255,255,255,0.5)"/></svg>
      </div>
    </div>
    <div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid white;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.1));"></div>
  </div>`,
  iconSize: [44, 54],
  iconAnchor: [22, 54],
  popupAnchor: [0, -54],
});

const subbieIcon = new L.DivIcon({
  className: '',
  html: `<div style="position:relative;width:34px;height:34px;">
    <div style="width:34px;height:34px;background:#F59E0B;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(245,158,11,0.35);display:flex;align-items:center;justify-content:center">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="white" stroke="none"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
    </div>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const WORKER_COLORS = ['#2563EB', '#E67E22', '#8E44AD', '#E74C3C', '#2ECC71', '#3498DB'];

function createWorkerIcon(color: string, isPrimary: boolean) {
  const size = isPrimary ? 48 : 36;
  const svgSize = isPrimary ? 22 : 16;
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      ${isPrimary ? `<div style="position:absolute;inset:-4px;width:${size + 8}px;height:${size + 8}px;border-radius:50%;background:${color};opacity:0.12;animation:vehicle-ping 2s ease-out infinite;"></div>` : ''}
      <div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,${color} 0%,${color}dd 100%);border:3px solid white;box-shadow:0 3px 12px ${color}55;display:flex;align-items:center;justify-content:center;">
        <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/>
          <circle cx="6.5" cy="16.5" r="2.5" fill="white" stroke="white"/>
          <circle cx="16.5" cy="16.5" r="2.5" fill="white" stroke="white"/>
        </svg>
      </div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
}

function RecenterControl({ center, bounds }: { center: [number, number]; bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const btn = document.createElement('button');
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`;
    btn.style.cssText = 'position:absolute;top:60px;right:12px;z-index:1000;width:38px;height:38px;border-radius:50%;background:white;border:none;box-shadow:0 1px 4px rgba(0,0,0,0.12);display:flex;align-items:center;justify-content:center;cursor:pointer;color:#64748b;';
    btn.addEventListener('click', () => {
      safeMapCall(map, (m) => {
        if (bounds) {
          m.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
        } else {
          m.setView(center, 15);
        }
      });
    });
    container.appendChild(btn);
    return () => { try { container.removeChild(btn); } catch {} };
  }, [map, center, bounds]);

  return null;
}

function RouteLine({ from, to }: { from: [number, number]; to: [number, number] }) {
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const map = useMap();

  useEffect(() => {
    let active = true;
    const fetchRoute = async () => {
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
        );
        if (!active || !res.ok) return;
        const data = await res.json();
        if (!active) return;
        if (data.routes && data.routes[0]) {
          const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]]
          );
          if (!active) return;
          setRouteCoords(coords);
          if (coords.length > 0) {
            const bounds = L.latLngBounds(coords);
            bounds.extend(from);
            bounds.extend(to);
            safeMapCall(map, (m) => m.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: false }));
          }
        }
      } catch {}
    };
    fetchRoute();
    return () => { active = false; };
  }, [from[0], from[1], to[0], to[1], map]);

  if (routeCoords.length < 2) return null;

  return (
    <>
      <Polyline
        positions={routeCoords}
        pathOptions={{
          color: '#2563EB',
          weight: 14,
          opacity: 0.12,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      <Polyline
        positions={routeCoords}
        pathOptions={{
          color: '#2563EB',
          weight: 5,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </>
  );
}

function HeroMap({ 
  token, 
  jobLat, 
  jobLng, 
  jobAddress,
  workerStatus,
  assignments,
  scheduledAt 
}: { 
  token: string; 
  jobLat?: string; 
  jobLng?: string; 
  jobAddress?: string;
  workerStatus: string | null;
  assignments?: PortalAssignment[];
  scheduledAt?: string;
}) {
  const [crewData, setCrewData] = useState<CrewLocationResponse | null>(null);
  const [locationData, setLocationData] = useState<LocationResponse | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isEnRoute = workerStatus === 'on_my_way' || assignments?.some(a => a.status === 'en_route');

  const fetchLocations = useCallback(async () => {
    try {
      const [crewRes, locRes] = await Promise.allSettled([
        fetch(`/api/public/job-portal/${token}/crew-locations`),
        fetch(`/api/public/job-portal/${token}/location`),
      ]);
      if (crewRes.status === 'fulfilled' && crewRes.value.ok) {
        const data: CrewLocationResponse = await crewRes.value.json();
        setCrewData(data);
      }
      if (locRes.status === 'fulfilled' && locRes.value.ok) {
        const data: LocationResponse = await locRes.value.json();
        setLocationData(data);
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchLocations();
    const pollInterval = isEnRoute ? 10000 : 60000;
    intervalRef.current = setInterval(fetchLocations, pollInterval);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchLocations, isEnRoute]);

  const jobLatNum = jobLat ? parseFloat(jobLat) : null;
  const jobLngNum = jobLng ? parseFloat(jobLng) : null;
  const hasJobCoords = jobLatNum != null && jobLngNum != null && !isNaN(jobLatNum) && !isNaN(jobLngNum);

  const crewWorkers = crewData?.workers?.filter(w => w.location && ['en_route', 'arrived', 'in_progress'].includes(w.status)) || [];
  const singleWorkerLoc = locationData?.workerLocation;
  const hasSingleWorker = singleWorkerLoc && singleWorkerLoc.latitude && singleWorkerLoc.longitude;

  const workerPosition: [number, number] | null = (() => {
    if (crewWorkers.length > 0) {
      const primary = crewWorkers.find(w => w.isPrimary) || crewWorkers[0];
      if (primary.location) return [primary.location.latitude, primary.location.longitude];
    }
    if (hasSingleWorker) return [singleWorkerLoc.latitude, singleWorkerLoc.longitude];
    return null;
  })();

  const allPoints: [number, number][] = [];
  if (hasJobCoords) allPoints.push([jobLatNum, jobLngNum]);
  crewWorkers.forEach(w => {
    if (w.location) allPoints.push([w.location.latitude, w.location.longitude]);
  });
  const subcontractorWorkers = crewData?.subcontractors?.filter(s => s.location) || [];
  subcontractorWorkers.forEach(s => {
    if (s.location) allPoints.push([s.location.latitude, s.location.longitude]);
  });
  if (hasSingleWorker && crewWorkers.length === 0) {
    allPoints.push([singleWorkerLoc.latitude, singleWorkerLoc.longitude]);
  }

  const jobLocFromApi = crewData?.jobLocation || locationData?.jobLocation;
  if (!hasJobCoords && jobLocFromApi) {
    allPoints.push([jobLocFromApi.latitude, jobLocFromApi.longitude]);
  }

  const center: [number, number] = allPoints.length > 0 ? allPoints[0] : [-33.8688, 151.2093];
  const bounds: L.LatLngBoundsExpression | null = allPoints.length >= 2 ? allPoints as L.LatLngBoundsExpression : null;

  const etaMinutes = crewData?.workers?.find(w => w.isPrimary)?.etaMinutes 
    || crewData?.workers?.[0]?.etaMinutes 
    || locationData?.etaMinutes 
    || null;

  const jobPinLat = hasJobCoords ? jobLatNum : jobLocFromApi?.latitude;
  const jobPinLng = hasJobCoords ? jobLngNum : jobLocFromApi?.longitude;
  const hasJobPin = jobPinLat != null && jobPinLng != null;

  if (!hasJobPin && crewWorkers.length === 0 && !hasSingleWorker) {
    return (
      <div className="relative w-full pt-16 pb-4 px-4">
        <div className="rounded-2xl overflow-hidden shadow-lg" style={{ height: '320px' }}>
          <MapContainer
            center={[-33.8688, 151.2093]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            <MapTeardownGuard />
            <RecenterControl center={[-33.8688, 151.2093]} bounds={null} />
          </MapContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full pt-16 pb-4 px-4">
      <div className="relative rounded-2xl overflow-hidden shadow-lg" style={{ height: '320px' }}>
        <MapContainer
          center={center}
          zoom={hasJobPin && crewWorkers.length === 0 && !hasSingleWorker ? 15 : 13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          <MapTeardownGuard />
          <RecenterControl center={center} bounds={bounds} />
          {bounds && <FitBounds bounds={bounds} />}
          {hasJobPin && (
            <Marker position={[jobPinLat!, jobPinLng!]} icon={jobPinIcon}>
              <Popup>
                <span className="text-sm font-medium">{jobAddress || 'Your job location'}</span>
              </Popup>
            </Marker>
          )}

          {crewWorkers.map((w, idx) => {
            if (!w.location) return null;
            const color = WORKER_COLORS[idx % WORKER_COLORS.length];
            const icon = createWorkerIcon(color, w.isPrimary);
            return (
              <Marker 
                key={w.assignmentId}
                position={[w.location.latitude, w.location.longitude]} 
                icon={icon}
              >
                <Popup>
                  <span className="text-sm font-medium">{w.name}</span>
                  {w.etaMinutes && <span className="text-xs block">ETA: {w.etaMinutes} min</span>}
                </Popup>
              </Marker>
            );
          })}

          {subcontractorWorkers.map((s) => {
            if (!s.location) return null;
            return (
              <Marker 
                key={`sub-${s.tokenId}`}
                position={[s.location.latitude, s.location.longitude]} 
                icon={subbieIcon}
              >
                <Popup>
                  <span className="text-sm font-medium">{s.name}</span>
                  {s.lastUpdated && (
                    <span className="text-xs block text-muted-foreground">
                      Last updated {formatTimeAgo(s.lastUpdated)}
                    </span>
                  )}
                </Popup>
              </Marker>
            );
          })}

          {hasSingleWorker && crewWorkers.length === 0 && (
            <Marker position={[singleWorkerLoc.latitude, singleWorkerLoc.longitude]} icon={workerIcon}>
              <Popup>
                <span className="text-sm font-medium">Your tradesperson</span>
              </Popup>
            </Marker>
          )}

          {hasJobPin && workerPosition && (
            <RouteLine from={workerPosition} to={[jobPinLat!, jobPinLng!]} />
          )}
        </MapContainer>

        {isEnRoute && (
          <div className="absolute top-3 left-3 z-[1000]">
            <div className="bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </div>
          </div>
        )}

        {(() => {
          const showOverlay = workerStatus && ['assigned', 'on_my_way', 'arrived', 'in_progress', 'completed'].includes(workerStatus);
          if (!showOverlay && !scheduledAt) return null;

          if (!showOverlay && scheduledAt) {
            const schedDate = new Date(scheduledAt);
            const isToday = schedDate.toDateString() === new Date().toDateString();
            const isTomorrow = schedDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
            const dateLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : schedDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
            const timeLabel = schedDate.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
            return (
              <div className="absolute bottom-0 left-0 right-0 z-[1000] pointer-events-none">
                <div className="bg-gradient-to-t from-black/60 via-black/30 to-transparent px-4 pt-8 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand/80 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Scheduled for {dateLabel}</p>
                      <p className="text-white/70 text-xs">{timeLabel} - Your tradesperson will be in touch</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          if (workerStatus === 'assigned') {
            return (
              <div className="absolute bottom-0 left-0 right-0 z-[1000] pointer-events-none">
                <div className="bg-gradient-to-t from-black/60 via-black/30 to-transparent px-4 pt-8 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand/80 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Tradesperson assigned</p>
                      <p className="text-white/70 text-xs">You'll be notified when they're on the way</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          if (workerStatus === 'on_my_way') {
            return (
              <div className="absolute bottom-0 left-0 right-0 z-[1000] pointer-events-none">
                <div className="bg-gradient-to-t from-black/70 via-black/40 to-transparent px-4 pt-8 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center">
                          <Navigation className="w-5 h-5 text-white" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-black/40 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">Your tradesperson is on the way</p>
                        <p className="text-white/70 text-xs">Live tracking active</p>
                      </div>
                    </div>
                    {etaMinutes && (
                      <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center">
                        <p className="text-white font-bold text-lg leading-tight">{etaMinutes}</p>
                        <p className="text-white/70 text-[10px]">min away</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          if (workerStatus === 'arrived') {
            return (
              <div className="absolute bottom-0 left-0 right-0 z-[1000] pointer-events-none">
                <div className="bg-gradient-to-t from-emerald-900/80 via-emerald-900/40 to-transparent px-4 pt-8 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Your tradesperson has arrived</p>
                      <p className="text-white/70 text-xs">At the job site now</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          if (workerStatus === 'in_progress') {
            return (
              <div className="absolute bottom-0 left-0 right-0 z-[1000] pointer-events-none">
                <div className="bg-gradient-to-t from-blue-900/80 via-blue-900/40 to-transparent px-4 pt-8 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                        <Timer className="w-5 h-5 text-white" />
                      </div>
                      <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-400 rounded-full border-2 border-blue-900/60 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Work in progress</p>
                      <p className="text-white/70 text-xs">Your tradesperson is working on the job</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          if (workerStatus === 'completed') {
            return (
              <div className="absolute bottom-0 left-0 right-0 z-[1000] pointer-events-none">
                <div className="bg-gradient-to-t from-emerald-900/80 via-emerald-900/40 to-transparent px-4 pt-8 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Job complete</p>
                      <p className="text-white/70 text-xs">The work has been finished</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })()}

        {(crewWorkers.length > 0 && subcontractorWorkers.length > 0) && (
          <div className={cn("absolute z-[1000]", isEnRoute ? "top-3 left-20" : "top-3 left-3")}>
            <div className="bg-white/90 backdrop-blur-sm rounded-full shadow-sm px-3 py-1.5 flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-brand" />
                <span className="text-[10px] text-muted-foreground">Team</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                <span className="text-[10px] text-muted-foreground">Subbie</span>
              </div>
            </div>
          </div>
        )}

        {!workerStatus && hasJobPin && crewWorkers.length === 0 && !hasSingleWorker && (
          <div className="absolute bottom-3 left-3 z-[1000]">
            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md px-3 py-2 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-brand" />
              <span className="text-xs font-medium text-foreground">Your job location</span>
            </div>
          </div>
        )}

      {(() => {
        const staleWorker = crewWorkers.find(w => w.stale) || (hasSingleWorker && singleWorkerLoc?.stale ? singleWorkerLoc : null);
        const staleSubbie = subcontractorWorkers.find(s => s.stale);
        const isStale = !!staleWorker || !!staleSubbie;
        const lastUpdated = staleWorker 
          ? ('location' in staleWorker && staleWorker.location ? staleWorker.location.recordedAt : null)
          : staleSubbie?.lastUpdated || (staleSubbie?.location?.recordedAt ?? null);
        if (!isStale) return null;
        return (
          <div className="absolute top-3 right-3 z-[1000]">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span className="text-xs text-amber-700">
                Location last updated {lastUpdated ? formatTimeAgo(lastUpdated) : 'a while ago'}
              </span>
            </div>
          </div>
        );
      })()}
      </div>
    </div>
  );
}

// ── Portal Programme (read-only phase Gantt) ─────────────────────────────────

const PORTAL_STATUS_COLORS: Record<string, { bar: string; border: string; chip: string; chipText: string }> = {
  not_started: { bar: '#E5E7EB', border: '#D1D5DB', chip: 'bg-gray-100', chipText: 'text-gray-600' },
  in_progress:  { bar: '#3B82F6', border: '#2563EB', chip: 'bg-blue-100',  chipText: 'text-blue-700'  },
  complete:     { bar: '#10B981', border: '#059669', chip: 'bg-emerald-100', chipText: 'text-emerald-700' },
  invoiced:     { bar: '#8B5CF6', border: '#7C3AED', chip: 'bg-purple-100', chipText: 'text-purple-700' },
};
const PORTAL_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started', in_progress: 'In progress', complete: 'Complete', invoiced: 'Invoiced',
};

const DAY_W = 40; // px per day (week-ish view)
const ROW_H  = 36;
const LABEL_W = 140;
const HEADER_H = 26;

function parsePortalDate(s: string): Date {
  const [y, m, d] = s.substring(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function PortalProgramme({ phases }: {
  phases: Array<{ id: string; phaseCode: string; name: string; status: string; sortOrder: number; scheduledStart: string | null; scheduledEnd: string | null }>;
}) {
  const withDates  = phases.filter(p => p.scheduledStart || p.scheduledEnd);
  const noDates    = phases.filter(p => !p.scheduledStart && !p.scheduledEnd);

  const today = startOfDay(new Date());

  const rangeInfo = (() => {
    if (withDates.length === 0) return { start: addDays(today, -7), days: 60 };
    const allD: Date[] = [];
    for (const p of withDates) {
      if (p.scheduledStart) allD.push(parsePortalDate(p.scheduledStart));
      if (p.scheduledEnd)   allD.push(parsePortalDate(p.scheduledEnd));
    }
    const earliest = new Date(Math.min(...allD.map(d => d.getTime())));
    const latest   = new Date(Math.max(...allD.map(d => d.getTime())));
    const s = addDays(earliest, -7);
    const e = addDays(latest, 14);
    const effectiveStart = s > today ? addDays(today, -7) : s;
    const effectiveEnd   = e < today ? addDays(today, 14) : e;
    return {
      start: startOfDay(effectiveStart),
      days: Math.max(differenceInDays(effectiveEnd, effectiveStart) + 1, 30),
    };
  })();

  const { start: rangeStart, days: totalDays } = rangeInfo;
  const gridWidth = totalDays * DAY_W;
  const todayOff  = differenceInDays(today, rangeStart);

  // Tick every 7 days
  const ticks: { label: string; offset: number }[] = [];
  for (let i = 0; i < totalDays; i += 7) {
    ticks.push({ label: format(addDays(rangeStart, i), 'd MMM'), offset: i });
  }

  function getBar(p: typeof phases[0]) {
    const hasS = !!p.scheduledStart, hasE = !!p.scheduledEnd;
    if (!hasS && !hasE) return null;
    const s = hasS ? Math.max(0, differenceInDays(parsePortalDate(p.scheduledStart!), rangeStart)) : 0;
    const e = hasE ? Math.min(totalDays, differenceInDays(parsePortalDate(p.scheduledEnd!), rangeStart) + 1) : s + 3;
    return { left: s * DAY_W, width: Math.max((e - Math.max(0, s)) * DAY_W, DAY_W) };
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-brand text-white px-5 py-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-300" />
          <span className="font-semibold text-sm">Project Programme</span>
          <span className="text-xs text-white/60 ml-1">{phases.length} phase{phases.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {withDates.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <div className="flex" style={{ minWidth: LABEL_W + gridWidth }}>
              {/* Fixed label column */}
              <div className="shrink-0 border-r border-slate-100 bg-slate-50/60" style={{ width: LABEL_W }}>
                <div style={{ height: HEADER_H }} className="border-b border-slate-100" />
                {withDates.map(p => {
                  const cfg = PORTAL_STATUS_COLORS[p.status] ?? PORTAL_STATUS_COLORS.not_started;
                  return (
                    <div key={p.id} className="flex items-center gap-1.5 px-2 border-b border-slate-50 last:border-0 overflow-hidden" style={{ height: ROW_H }}>
                      <span className="shrink-0 text-[9px] font-mono font-bold px-1 py-0.5 rounded border border-slate-200 text-slate-500">{p.phaseCode}</span>
                      <span className="text-[11px] font-medium truncate text-slate-700 leading-tight">{p.name}</span>
                    </div>
                  );
                })}
              </div>

              {/* Scrollable grid */}
              <div className="flex-1 relative" style={{ width: gridWidth, minWidth: 0 }}>
                {/* Tick header */}
                <div className="relative border-b border-slate-100 bg-slate-50/60 overflow-hidden" style={{ height: HEADER_H }}>
                  {ticks.map(t => (
                    <div key={t.offset} className="absolute top-0 h-full flex items-center pl-1 border-r border-slate-100" style={{ left: t.offset * DAY_W, width: 7 * DAY_W }}>
                      <span className="text-[9px] text-slate-400 whitespace-nowrap">{t.label}</span>
                    </div>
                  ))}
                </div>

                {/* Today line */}
                {todayOff >= 0 && todayOff < totalDays && (
                  <div className="absolute pointer-events-none z-10" style={{ top: HEADER_H, bottom: 0, left: todayOff * DAY_W + DAY_W / 2 - 1, width: 2, background: 'rgba(59,130,246,0.45)' }} />
                )}

                {/* Phase rows */}
                {withDates.map(p => {
                  const bar = getBar(p);
                  const cfg = PORTAL_STATUS_COLORS[p.status] ?? PORTAL_STATUS_COLORS.not_started;
                  return (
                    <div key={p.id} className="relative border-b border-slate-50 last:border-0" style={{ height: ROW_H }}>
                      {ticks.map(t => (
                        <div key={t.offset} className="absolute top-0 bottom-0 border-r border-slate-50" style={{ left: t.offset * DAY_W }} />
                      ))}
                      {bar && (
                        <div className="absolute rounded" style={{ top: 6, bottom: 6, left: bar.left + 2, width: Math.max(bar.width - 4, 4), backgroundColor: cfg.bar, border: `1px solid ${cfg.border}` }}>
                          {bar.width > 50 && (
                            <span className="absolute inset-0 flex items-center px-1.5 text-[9px] font-semibold leading-none overflow-hidden whitespace-nowrap text-white">
                              {bar.width > 90 ? `${p.phaseCode} ${p.name}` : p.phaseCode}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(PORTAL_STATUS_COLORS).map(([status, cfg]) => (
            <div key={status} className="flex items-center gap-1 text-[10px] text-slate-500">
              <div className="w-3 h-2 rounded-sm border" style={{ backgroundColor: cfg.bar, borderColor: cfg.border }} />
              <span className="capitalize">{PORTAL_STATUS_LABELS[status] ?? status.replace(/_/g, ' ')}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <div className="w-0.5 h-3 rounded" style={{ background: 'rgba(59,130,246,0.45)' }} />
            <span>today</span>
          </div>
        </div>

        {/* Phase status list */}
        <div className="space-y-1.5">
          {phases.map(p => {
            const cfg = PORTAL_STATUS_COLORS[p.status] ?? PORTAL_STATUS_COLORS.not_started;
            const dateRange = p.scheduledStart || p.scheduledEnd
              ? [
                  p.scheduledStart ? format(parsePortalDate(p.scheduledStart), 'd MMM yyyy') : null,
                  p.scheduledEnd   ? format(parsePortalDate(p.scheduledEnd),   'd MMM yyyy') : null,
                ].filter(Boolean).join(' – ')
              : null;
            return (
              <div key={p.id} className="flex items-center gap-2 py-1 border-b border-slate-50 last:border-0">
                <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded border border-slate-200 text-slate-500 shrink-0">{p.phaseCode}</span>
                <span className="text-xs text-slate-700 flex-1 truncate">{p.name}</span>
                {dateRange && <span className="text-[10px] text-slate-400 shrink-0 hidden sm:block">{dateRange}</span>}
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.chip} ${cfg.chipText}`}>
                  {PORTAL_STATUS_LABELS[p.status] ?? p.status.replace(/_/g, ' ')}
                </span>
              </div>
            );
          })}
        </div>

        {noDates.length > 0 && withDates.length > 0 && (
          <p className="text-[10px] text-slate-400 italic">
            {noDates.length} phase{noDates.length !== 1 ? 's' : ''} not yet scheduled
          </p>
        )}
      </div>
    </div>
  );
}

interface PortalDefectItem {
  id: string;
  description: string;
  photoUrl?: string | null;
  assignedToName?: string | null;
  dueDate?: string | null;
  status: string;
  notes?: string | null;
  resolvedAt?: string | null;
  clientApprovedAt?: string | null;
}

const DEFECT_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  client_approved: 'Client Approved',
};
const DEFECT_STATUS_COLORS: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  client_approved: 'bg-purple-100 text-purple-700',
};

export default function JobPortal() {
  const { token } = useParams<{ token: string }>();

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.classList.contains('dark') ? 'dark' : 'light';
    root.classList.remove('dark');

    root.style.setProperty('--background', '210 40% 98%');
    root.style.setProperty('--foreground', '222.2 84% 4.9%');
    root.style.setProperty('--card', '0 0% 100%');
    root.style.setProperty('--card-foreground', '222.2 84% 4.9%');
    root.style.setProperty('--popover', '0 0% 100%');
    root.style.setProperty('--popover-foreground', '222.2 84% 4.9%');
    root.style.setProperty('--muted', '210 40% 96.1%');
    root.style.setProperty('--muted-foreground', '215.4 16.3% 46.9%');
    root.style.setProperty('--border', '214.3 31.8% 91.4%');
    root.style.setProperty('--input', '214.3 31.8% 91.4%');
    root.style.setProperty('--ring', '221.2 83.2% 53.3%');
    root.style.setProperty('color-scheme', 'light');

    return () => {
      if (previousTheme === 'dark') {
        root.classList.add('dark');
      }
      root.style.removeProperty('--background');
      root.style.removeProperty('--foreground');
      root.style.removeProperty('--card');
      root.style.removeProperty('--card-foreground');
      root.style.removeProperty('--popover');
      root.style.removeProperty('--popover-foreground');
      root.style.removeProperty('--muted');
      root.style.removeProperty('--muted-foreground');
      root.style.removeProperty('--border');
      root.style.removeProperty('--input');
      root.style.removeProperty('--ring');
      root.style.removeProperty('color-scheme');
    };
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  const { data, isLoading, error } = useQuery<JobPortalData>({
    queryKey: ['/api/public/job-portal', token],
    queryFn: async () => {
      const res = await fetch(`/api/public/job-portal/${token}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Job not found');
      }
      return res.json();
    },
    retry: false,
    refetchInterval: (query) => {
      const d = query.state.data as JobPortalData | undefined;
      if (d?.job?.status === 'done' || d?.job?.status === 'invoiced') {
        return false;
      }
      if (d?.job?.workerStatus && ['on_my_way', 'arrived', 'in_progress'].includes(d.job.workerStatus)) {
        return 15000;
      }
      return 60000;
    },
  });

  const { data: portalDefectItems = [] } = useQuery<PortalDefectItem[]>({
    queryKey: ['/api/public/job-portal', token, 'defect-items'],
    queryFn: async () => {
      const res = await fetch(`/api/public/job-portal/${token}/defect-items`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  const { data: crewLocationData } = useQuery<CrewLocationResponse>({
    queryKey: ['/api/public/job-portal', token, 'crew-locations'],
    queryFn: async () => {
      const res = await fetch(`/api/public/job-portal/${token}/crew-locations`);
      if (!res.ok) return { tracking: false, jobLocation: null, workers: [], subcontractors: [] };
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 60000,
  });

  const { data: financialData } = useQuery<PortalFinancials>({
    queryKey: ['/api/public/job-portal', token, 'financials'],
    queryFn: async () => {
      const res = await fetch(`/api/public/job-portal/${token}/financials`);
      if (!res.ok) return null as any;
      return res.json();
    },
    enabled: !!token && !!data?.visibility,
    staleTime: 60000,
    retry: false,
  });

  const { data: portalDocs = [] } = useQuery<PortalProjectDocument[]>({
    queryKey: ['/api/public/job-portal', token, 'project-documents'],
    queryFn: async () => {
      const res = await fetch(`/api/public/job-portal/${token}/project-documents`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
    staleTime: 60000,
    retry: false,
  });

  const [portalMessage, setPortalMessage] = useState('');
  const [messageSent, setMessageSent] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch(`/api/public/job-portal/${token}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send message');
      }
      return res.json();
    },
    onSuccess: () => {
      setPortalMessage('');
      setMessageSent(true);
      setTimeout(() => setMessageSent(false), 3000);
    },
  });

  useEffect(() => {
    if (data?.business?.name) {
      document.title = `Job Tracking - ${data.business.name} | JobRunner`;
    } else {
      document.title = 'Job Tracking | JobRunner';
    }
    const meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      const m = document.createElement('meta');
      m.name = 'description';
      m.content = 'Track your job progress in real-time. See worker status, ETA, and job details.';
      document.head.appendChild(m);
    }
    return () => { document.title = 'JobRunner'; };
  }, [data?.business?.name]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto">
          <Skeleton className="h-[300px] w-full" />
          <div className="p-4 space-y-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const handleRefreshLink = async () => {
    setRefreshing(true);
    setRefreshError('');
    try {
      const res = await fetch(`/api/public/job-portal/${token}/refresh`, { method: 'POST' });
      const result = await res.json();
      if (res.ok && result.token) {
        window.location.href = `/p/${result.token}`;
      } else {
        setRefreshError(result.error || 'Unable to refresh link');
      }
    } catch {
      setRefreshError('Something went wrong. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  if (error || !data) {
    const errorMsg = (error as Error)?.message || '';
    const isExpired = errorMsg.toLowerCase().includes('expired');
    const isRevoked = errorMsg.toLowerCase().includes('revoked');

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-white">
        <Card className="max-w-md w-full rounded-2xl shadow-lg">
          <CardContent className="pt-8 pb-8 text-center">
            {isExpired ? (
              <>
                <Clock className="w-14 h-14 text-amber-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">Link Expired</h2>
                <p className="text-muted-foreground text-sm mb-4">
                  This tracking link has expired.
                </p>
                <Button onClick={handleRefreshLink} disabled={refreshing}>
                  {refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Get New Link
                </Button>
                {refreshError && <p className="text-sm text-red-500 mt-3">{refreshError}</p>}
              </>
            ) : isRevoked ? (
              <>
                <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">Link No Longer Active</h2>
                <p className="text-muted-foreground text-sm">
                  This tracking link has been deactivated. Please contact the business if you need access.
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">Job Not Found</h2>
                <p className="text-muted-foreground text-sm">
                  This job doesn't exist or the link is invalid. Please contact the business directly if you need assistance.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { job, business, worker, client, documents } = data;
  const effectiveWorkerStatus = (job.status === 'done' || job.status === 'invoiced' || job.status === 'paid') ? 'completed' : job.workerStatus;
  const statusConfig = getStatusConfig(effectiveWorkerStatus);
  const statusIdx = getStatusIndex(effectiveWorkerStatus);
  const hasPhotos = data.visibility?.showPhotos !== false && job.photos && job.photos.length > 0;
  const hasDocuments = (documents.quotes.length + documents.invoices.length) > 0;
  const showTimeline = data.visibility?.showTimeline !== false && data.timeline && data.timeline.length > 0;
  const showChecklist = data.visibility?.showChecklist !== false;
  const showActivityFeed = data.visibility?.showActivityFeed !== false && data.activityFeed && data.activityFeed.length > 0;
  const showPhotos = data.visibility?.showPhotos !== false;
  const showProgramme = data.visibility?.showProgrammeOnPortal === true && data.phases != null;

  const mapsUrl = job.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`
    : null;

  const progressSteps = [
    { key: 'assigned', label: 'Scheduled' },
    { key: 'on_my_way', label: 'On the Way' },
    { key: 'arrived', label: 'Arrived' },
    { key: 'in_progress', label: 'Working' },
    { key: 'completed', label: 'Complete' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="max-w-2xl mx-auto w-full flex flex-col flex-1">

        <div className="relative">
          {token && (
            <HeroMap
              token={token}
              jobLat={job.latitude}
              jobLng={job.longitude}
              jobAddress={job.address}
              workerStatus={effectiveWorkerStatus}
              assignments={data.assignments}
              scheduledAt={job.scheduledAt}
            />
          )}

          <div className="absolute top-0 left-0 right-0 z-[1000]">
            <div className="bg-brand backdrop-blur-md px-4 py-3">
              <div className="flex items-center gap-3">
                {business.logo ? (
                  <img src={business.logo} alt={business.name}
                    className="w-11 h-11 object-contain rounded-md bg-white/90 p-0.5 flex-shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-md bg-white/90 flex items-center justify-center flex-shrink-0 p-0.5">
                    <img src={jobrunnerLogo} alt="JobRunner" className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h1 className="font-bold text-white text-sm truncate drop-shadow-sm">{business.name}</h1>
                  {client && (
                    <p className="text-xs text-white/70 truncate">Hi {client.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {business.phone && (
                    <a href={`tel:${business.phone}`}>
                      <Button variant="ghost" size="icon" className="text-white bg-white/15 backdrop-blur-sm rounded-full">
                        <Phone className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                  {business.phone && (
                    <a href={`sms:${business.phone}`}>
                      <Button variant="ghost" size="icon" className="text-white bg-white/15 backdrop-blur-sm rounded-full">
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                  {business.email && (
                    <a href={`mailto:${business.email}`}>
                      <Button variant="ghost" size="icon" className="text-white bg-white/15 backdrop-blur-sm rounded-full">
                        <Mail className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10">

        {(effectiveWorkerStatus) && (
          <div className="px-4">
            <div className="bg-white rounded-2xl shadow-lg pt-5 px-4 pb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-shrink-0">
                  <div className={`w-3 h-3 rounded-full ${statusConfig.dot}`} />
                  {statusConfig.pulse && (
                    <div className={`absolute inset-0 w-3 h-3 rounded-full ${statusConfig.dot} animate-ping opacity-50`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-lg text-foreground">{statusConfig.label}</span>
                </div>
                {effectiveWorkerStatus === 'completed' && (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                )}
                {effectiveWorkerStatus === 'on_my_way' && (job.workerEtaMinutes || job.workerEta) && (
                  <span className="text-sm font-semibold text-brand bg-brand/10 px-3 py-1 rounded-full flex-shrink-0">
                    ETA: {job.workerEtaMinutes ? `${job.workerEtaMinutes} min` : job.workerEta}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-1">
                {progressSteps.map((step, idx) => {
                  const stepIdx = getStatusIndex(step.key);
                  const isCompleted = statusIdx > stepIdx;
                  const isCurrent = statusIdx === stepIdx;
                  return (
                    <div key={step.key} className="flex flex-col items-center flex-1 min-w-0">
                      <div className="flex items-center w-full">
                        {idx > 0 && (
                          <div className={`flex-1 h-0.5 ${isCompleted ? 'bg-emerald-400' : isCurrent ? 'bg-brand/30' : 'bg-gray-200'}`} />
                        )}
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          isCompleted ? 'bg-emerald-500' : isCurrent ? 'bg-brand' : 'bg-gray-200'
                        }`} />
                        {idx < progressSteps.length - 1 && (
                          <div className={`flex-1 h-0.5 ${isCompleted ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                        )}
                      </div>
                      <span className={`text-[9px] mt-1.5 text-center leading-tight ${
                        isCompleted ? 'text-emerald-600 font-medium' : isCurrent ? 'text-brand font-semibold' : 'text-muted-foreground'
                      }`}>{step.label}</span>
                    </div>
                  );
                })}
              </div>

              {job.workerStatusUpdatedAt && (
                <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
                  {effectiveWorkerStatus === 'on_my_way' && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      <Signal className="w-2.5 h-2.5" />
                      Live tracking
                    </span>
                  )}
                  <p className="text-[10px] text-muted-foreground ml-auto">
                    Updated {formatTimeAgo(job.workerStatusUpdatedAt)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mx-4 mt-3">
          <Card className="border-0 shadow-none bg-blue-50 dark:bg-blue-950/30">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className={cn(
                "w-2.5 h-2.5 rounded-full flex-shrink-0",
                effectiveWorkerStatus === 'on_my_way' ? "bg-green-500 animate-pulse" :
                effectiveWorkerStatus === 'arrived' ? "bg-emerald-500" :
                effectiveWorkerStatus === 'in_progress' ? "bg-blue-500 animate-pulse" :
                effectiveWorkerStatus === 'completed' ? "bg-emerald-500" :
                "bg-gray-400"
              )} />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {effectiveWorkerStatus === 'on_my_way' ? "Your tradesperson is on the way" :
                   effectiveWorkerStatus === 'arrived' ? "Your tradesperson has arrived at the job site" :
                   effectiveWorkerStatus === 'in_progress' ? "Work is in progress" :
                   effectiveWorkerStatus === 'completed' ? "This job has been completed" :
                   "We'll notify you when your tradesperson is on the way"}
                </p>
                {effectiveWorkerStatus === 'on_my_way' && (job.workerEtaMinutes || job.workerEta) && (
                  <p className="text-xs text-muted-foreground">
                    Estimated arrival: {job.workerEtaMinutes ? `~${job.workerEtaMinutes} minutes` : job.workerEta}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {data.clientMessage && (
          <div className="mx-4 mt-3">
            <Card className="border-0 shadow-none bg-amber-50 dark:bg-amber-950/30">
              <CardContent className="py-3 px-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MessageCircle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-800 mb-0.5">Message from {business.name}</p>
                  <p className="text-sm text-amber-900">{data.clientMessage}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {(() => {
          const paidInvoices = effectiveWorkerStatus === 'completed'
            ? documents.invoices.filter(i => i.status === 'paid')
            : [];
          const allPaid = documents.invoices.length > 0 && paidInvoices.length === documents.invoices.length;
          if (allPaid) {
            const totalPaid = paidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);
            return (
              <div className="mx-4 mt-3">
                <Card className="border border-emerald-200 bg-emerald-50/50">
                  <CardContent className="py-4 px-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-emerald-900">Payment Received</p>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        {formatCurrency(totalPaid.toString())} paid - Thank you!
                      </p>
                    </div>
                    {paidInvoices.length === 1 && paidInvoices[0]?.token ? (
                      <a href={`/portal/invoice/${paidInvoices[0].token}`}>
                        <Button variant="outline" size="sm" className="text-emerald-700 border-emerald-300 flex-shrink-0">
                          <Receipt className="w-4 h-4 mr-1.5" />
                          Receipt
                        </Button>
                      </a>
                    ) : paidInvoices.length > 1 ? (
                      <div className="flex flex-col gap-1">
                        {paidInvoices.map((inv, idx) => (
                          <a key={inv.id} href={`/portal/invoice/${inv.token}`}>
                            <Button variant="outline" size="sm" className="text-emerald-700 border-emerald-300 w-full text-xs">
                              <Receipt className="w-3 h-3 mr-1" />
                              #{inv.invoiceNumber}
                            </Button>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            );
          }
          return null;
        })()}

        {(() => {
          const unpaidInvoices = effectiveWorkerStatus === 'completed' 
            ? documents.invoices.filter(i => i.status !== 'paid') 
            : [];
          if (unpaidInvoices.length === 0) return null;
          const totalDue = unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);
          return (
            <div className="mx-4 mt-3 space-y-2">
              {unpaidInvoices.map((inv) => (
                <Card 
                  key={inv.id} 
                  className="border-2 border-brand/30 bg-brand/5 shadow-md cursor-pointer hover-elevate"
                  onClick={() => window.location.href = `/portal/invoice/${inv.token}`}
                >
                  <CardContent className="py-4 px-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-5 h-5 text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {unpaidInvoices.length > 1 ? `Invoice ${inv.invoiceNumber}` : 'Invoice Ready for Payment'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatCurrency(inv.total)}
                      </p>
                    </div>
                    <Button size="sm" className="bg-brand flex-shrink-0">
                      <CreditCard className="w-4 h-4 mr-1.5" />
                      Pay Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          );
        })()}

        <div className="px-4 py-4 space-y-4 flex-1">

          {(data.assignments && data.assignments.length > 0) ? (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-brand text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Your Team</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {data.assignments.map((a, idx) => {
                  const color = WORKER_COLORS[idx % WORKER_COLORS.length];
                  const statusLabel = a.status === 'en_route' ? 'On the Way' : 
                                      a.status === 'arrived' ? 'Arrived' :
                                      a.status === 'in_progress' ? 'Working' :
                                      a.status === 'completed' ? 'Done' :
                                      a.status === 'assigned' ? 'Scheduled' : a.status;
                  const initials = a.worker.name === 'Support Crew' ? 'SC' : 
                    a.worker.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                  const isActive = ['en_route', 'arrived', 'in_progress'].includes(a.status);
                  return (
                    <div key={a.id} className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <WorkerAvatar
                          photoUrl={a.worker.photoUrl}
                          name={a.worker.name}
                          initials={initials}
                          bgColor={color}
                          textClass="text-sm"
                        />
                        {isActive && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground text-sm truncate">{a.worker.name}</p>
                          {a.isPrimary && (
                            <span className="text-[10px] font-medium text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded">Lead</span>
                          )}
                        </div>
                        <p className={`text-xs ${isActive ? 'text-emerald-600' : 'text-muted-foreground'}`}>{statusLabel}</p>
                        {a.worker.phone && (
                          <p className="text-xs text-muted-foreground">{a.worker.phone}</p>
                        )}
                      </div>
                      {a.worker.phone && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <a href={`sms:${a.worker.phone}`}>
                            <Button variant="outline" size="icon" className="rounded-full border">
                              <MessageCircle className="w-4 h-4 text-brand" />
                            </Button>
                          </a>
                          <a href={`tel:${a.worker.phone}`}>
                            <Button variant="default" size="icon" className="rounded-full bg-brand">
                              <Phone className="w-4 h-4" />
                            </Button>
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
                {crewLocationData?.subcontractors?.map((s) => {
                  const sConf = getStatusConfig(s.status === 'en_route' ? 'on_my_way' : s.status);
                  return (
                    <div key={`sub-list-${s.tokenId}`} className="flex items-center justify-between gap-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.status === 'en_route' && s.etaMinutes
                              ? `ETA: ~${s.etaMinutes} min`
                              : s.lastUpdated ? `Last update ${formatTimeAgo(s.lastUpdated)}` : 'No location data'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={sConf.bg + ' ' + sConf.text + ' no-default-hover-elevate no-default-active-elevate'}>
                        {sConf.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : worker && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-brand text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Your Technician</span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <WorkerAvatar
                      photoUrl={worker.photoUrl}
                      name={getWorkerDisplayName(worker, 'Your technician')}
                      initials={`${worker.firstName?.[0] ?? ''}${worker.lastName?.[0] ?? ''}`.toUpperCase()}
                      bgClass="bg-brand"
                      textClass="text-base"
                    />
                    {job.workerStatus && ['on_my_way', 'arrived', 'in_progress'].includes(job.workerStatus) && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">{getWorkerDisplayName(worker, 'Your technician')}</p>
                    <p className="text-xs text-muted-foreground">Your assigned technician</p>
                    {worker.phone && (
                      <p className="text-xs text-muted-foreground mt-0.5">{worker.phone}</p>
                    )}
                  </div>
                  {worker.phone && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <a href={`sms:${worker.phone}`}>
                        <Button variant="outline" size="icon" className="rounded-full border">
                          <MessageCircle className="w-4 h-4 text-brand" />
                        </Button>
                      </a>
                      <a href={`tel:${worker.phone}`}>
                        <Button variant="default" size="icon" className="rounded-full bg-brand">
                          <Phone className="w-4 h-4" />
                        </Button>
                      </a>
                    </div>
                  )}
                </div>
                {crewLocationData?.subcontractors?.map((s) => {
                  const sConf2 = getStatusConfig(s.status === 'en_route' ? 'on_my_way' : s.status);
                  return (
                    <div key={`sub-tech-${s.tokenId}`} className="flex items-center justify-between gap-3 py-2 mt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.status === 'en_route' && s.etaMinutes
                              ? `ETA: ~${s.etaMinutes} min`
                              : s.lastUpdated ? `Last update ${formatTimeAgo(s.lastUpdated)}` : 'No location data'}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={sConf2.bg + ' ' + sConf2.text + ' no-default-hover-elevate no-default-active-elevate'}>
                        {sConf2.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-brand text-white px-5 py-3">
              <span className="font-semibold text-sm">{job.title}</span>
            </div>
            <div className="p-5 space-y-3">
              {job.description && (
                <p className="text-sm text-slate-600">{job.description}</p>
              )}
              {job.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{job.address}</p>
                    {mapsUrl && (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="mt-2 text-brand border-brand/30">
                          <Navigation className="w-3.5 h-3.5 mr-1.5" />
                          Navigate
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
                {(job.scheduledAt || job.scheduledTime) && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{job.scheduledAt ? formatDate(job.scheduledAt) : ''}{job.scheduledTime ? ` at ${job.scheduledTime}` : ''}</span>
                  </div>
                )}
                {job.estimatedDuration && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>{job.estimatedDuration} {job.estimatedDuration === 1 ? 'hour' : 'hours'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {job.notes && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-brand text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Notes</span>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm text-slate-600 whitespace-pre-line">{job.notes}</p>
              </div>
            </div>
          )}

          {showTimeline && data.timeline && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-brand text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Job Progress</span>
                </div>
              </div>
              <div className="p-5">
                <div className="relative pl-8">
                  {data.timeline.map((event, idx) => {
                    const isLast = idx === data.timeline!.length - 1;
                    const isCurrent = event.completed && (isLast || !data.timeline![idx + 1]?.completed);
                    const timelineIcons: Record<string, typeof CheckCircle2> = {
                      quoted: FileText,
                      scheduled: Calendar,
                      in_progress: Timer,
                      complete: CheckCircle2,
                      invoiced: Receipt,
                    };
                    const StepIcon = timelineIcons[event.stage] || CircleDot;

                    return (
                      <div key={event.stage} className="relative pb-7 last:pb-0">
                        {!isLast && (
                          <div
                            className={`absolute left-[-20px] top-8 w-0.5 h-full ${
                              event.completed && !isCurrent ? 'bg-emerald-400' : isCurrent ? 'bg-brand/30' : 'bg-gray-200'
                            }`}
                          />
                        )}
                        <div className="flex items-start gap-3">
                          <div className="absolute left-[-28px]">
                            {event.completed && !isCurrent ? (
                              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center mt-0.5 shadow-sm">
                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                              </div>
                            ) : isCurrent ? (
                              <div className="relative mt-0.5">
                                <div className="w-5 h-5 rounded-full bg-brand shadow-sm" />
                                <div className="absolute inset-0 w-5 h-5 rounded-full bg-brand animate-ping opacity-50" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gray-200 mt-0.5" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm font-semibold ${
                              event.completed && !isCurrent ? 'text-emerald-700' : isCurrent ? 'text-foreground' : 'text-muted-foreground'
                            }`}>
                              {event.label}
                            </p>
                            {event.date && event.completed && (
                              <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(event.date)}</p>
                            )}
                          </div>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            event.completed && !isCurrent ? 'bg-emerald-50' : isCurrent ? 'bg-blue-50' : 'bg-gray-50'
                          }`}>
                            <StepIcon className={`w-3.5 h-3.5 ${
                              event.completed && !isCurrent ? 'text-emerald-500' : isCurrent ? 'text-brand' : 'text-gray-300'
                            }`} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {showProgramme && data.phases && (
            <PortalProgramme phases={data.phases} />
          )}

          {showChecklist && data.checklistSummary && data.checklistSummary.total > 0 && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-brand text-white px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-slate-300" />
                    <span className="font-semibold text-sm">Work Progress</span>
                  </div>
                  <span className="text-xs text-white/70">
                    {data.checklistSummary.completed} of {data.checklistSummary.total} complete
                  </span>
                </div>
              </div>
              <div className="p-5">
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-medium text-slate-700">
                      {data.checklistSummary.percentage}% Complete
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {data.checklistSummary.completed}/{data.checklistSummary.total} tasks
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand rounded-full transition-all duration-500"
                      style={{ width: `${data.checklistSummary.percentage}%` }}
                    />
                  </div>
                </div>
                {data.checklist && data.checklist.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    {data.checklist
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3 py-1.5">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          item.isCompleted 
                            ? 'bg-emerald-500 border-emerald-500' 
                            : 'border-gray-300'
                        }`}>
                          {item.isCompleted && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`text-sm ${item.isCompleted ? 'text-muted-foreground line-through' : 'text-slate-800'}`}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {showChecklist && (!data.checklistSummary || data.checklistSummary.total === 0) && data.checklist && data.checklist.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-brand text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Work Scope</span>
                </div>
              </div>
              <div className="p-5">
                <div className="space-y-2">
                  {data.checklist
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 py-1.5">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        item.isCompleted 
                          ? 'bg-emerald-500 border-emerald-500' 
                          : 'border-gray-300'
                      }`}>
                        {item.isCompleted && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-sm ${item.isCompleted ? 'text-muted-foreground line-through' : 'text-slate-800'}`}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {data.checklist.filter(c => c.isCompleted).length} of {data.checklist.length} completed
                    </span>
                    <div className="flex-1 max-w-[120px] h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-brand rounded-full transition-all"
                        style={{ width: `${(data.checklist.filter(c => c.isCompleted).length / data.checklist.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {data.materials && data.materials.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-brand text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Materials</span>
                </div>
              </div>
              <div className="p-5">
                <div className="space-y-2">
                  {data.materials.map((material, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="text-sm text-slate-800">{material.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {material.quantity && (
                          <span className="text-xs text-muted-foreground">
                            {material.quantity}{material.unit ? ` ${material.unit}` : ''}
                          </span>
                        )}
                        {material.status && (
                          <Badge variant="secondary" className={`text-xs no-default-hover-elevate no-default-active-elevate ${
                            material.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                            material.status === 'ordered' ? 'bg-blue-100 text-blue-700' :
                            material.status === 'on_order' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-slate-600'
                          }`}>
                            {material.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {portalDefectItems.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-brand text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Defects &amp; Punch List</span>
                  <span className="ml-auto text-xs text-slate-300">{portalDefectItems.filter(d => d.status === 'resolved' || d.status === 'client_approved').length}/{portalDefectItems.length} resolved</span>
                </div>
              </div>
              <div className="p-5 space-y-3">
                {portalDefectItems.every(d => d.status === 'resolved' || d.status === 'client_approved') && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-sm text-emerald-700 font-medium">All defects cleared</span>
                  </div>
                )}
                {portalDefectItems.map(item => (
                  <div key={item.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                    <div className="mt-0.5 shrink-0">
                      {item.status === 'resolved' || item.status === 'client_approved'
                        ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                        : <Circle className="w-4 h-4 text-slate-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800">{item.description}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DEFECT_STATUS_COLORS[item.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {DEFECT_STATUS_LABELS[item.status] ?? item.status}
                        </span>
                        {item.dueDate && (
                          <span className="text-xs text-slate-500">Due {format(new Date(item.dueDate), 'd MMM yyyy')}</span>
                        )}
                      </div>
                      {item.notes && <p className="text-xs text-slate-500 mt-1">{item.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.workerAttendance && data.workerAttendance.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-brand text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Worker Attendance</span>
                  {data.workerAttendance.some(a => a.gpsVerified) && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-500/20 text-emerald-100 px-2 py-0.5 rounded-full">
                      <Shield className="w-3 h-3" />
                      GPS Verified
                    </span>
                  )}
                </div>
              </div>
              <div className="p-5">
                <div className="space-y-3">
                  {data.workerAttendance.map((entry, idx) => {
                    const startDate = new Date(entry.startTime);
                    const endDate = new Date(entry.endTime);
                    const hours = entry.duration ? Math.round(entry.duration / 60 * 10) / 10 : 0;
                    return (
                      <div key={idx} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                        <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${entry.gpsVerified ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-800">
                              {startDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                            </span>
                            <span className="text-xs text-slate-500">
                              {startDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                              {' — '}
                              {endDate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {hours > 0 && (
                              <span className="text-xs text-slate-500">({hours}h)</span>
                            )}
                          </div>
                          {entry.clockInAddress && (
                            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {entry.clockInAddress}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-400">
                    Total: {Math.round(data.workerAttendance.reduce((sum, a) => sum + (a.duration || 0), 0) / 60 * 10) / 10} hours across {data.workerAttendance.length} session{data.workerAttendance.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
          )}

          {showPhotos && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-brand text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Photos</span>
                </div>
              </div>
              {hasPhotos ? (
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-2">
                    {job.photos.map((photo, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
                        onClick={() => setSelectedPhoto(idx)}>
                        <img
                          src={photo.url}
                          alt={photo.description || `Job photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {photo.type && (photo.type === 'before' || photo.type === 'after') && (
                          <span className={`absolute top-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                            photo.type === 'before' ? 'bg-gray-900/60 text-white' : 'bg-emerald-600/80 text-white'
                          }`}>
                            {photo.type === 'before' ? 'Before' : 'After'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Camera className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No photos yet</p>
                  <p className="text-xs text-muted-foreground/60">Job photos will be shared here as work progresses</p>
                </div>
              )}
            </div>
          )}

          {financialData && financialData.claims && financialData.claims.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-brand text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Schedule of Values</span>
                </div>
              </div>
              <div className="p-5 space-y-5">

                {/* Contract value summary */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-500">Original Contract Value</span>
                    <span className="font-medium text-slate-800">{formatCurrency(financialData.originalContractValue)}</span>
                  </div>
                  {financialData.approvedVariations.length > 0 && (
                    <>
                      {financialData.approvedVariations.map((v, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 text-sm pl-3 border-l-2 border-brand/20">
                          <span className="text-slate-500 truncate">{v.variationNumber ? `Var #${v.variationNumber}` : 'Variation'}{v.description ? ` — ${v.description}` : ''}</span>
                          <span className="font-medium text-slate-700 flex-shrink-0">+{formatCurrency(v.amount)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-2 text-sm pt-1 border-t border-slate-100">
                        <span className="font-semibold text-slate-700">Revised Contract Value</span>
                        <span className="font-bold text-slate-900">{formatCurrency(financialData.revisedContractValue)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Claims table */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Claim Schedule</p>
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-sm min-w-[340px]">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left text-xs font-medium text-slate-400 py-1.5 pr-2">Claim</th>
                          <th className="text-left text-xs font-medium text-slate-400 py-1.5 pr-2">Period</th>
                          <th className="text-right text-xs font-medium text-slate-400 py-1.5 pr-2">Amount</th>
                          <th className="text-center text-xs font-medium text-slate-400 py-1.5">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financialData.claims.map((claim, idx) => {
                          const statusColors: Record<string, string> = {
                            submitted: 'bg-blue-100 text-blue-700',
                            approved: 'bg-emerald-100 text-emerald-700',
                            paid: 'bg-slate-100 text-slate-600',
                          };
                          const statusLabels: Record<string, string> = {
                            submitted: 'Submitted',
                            approved: 'Approved',
                            paid: 'Paid',
                          };
                          const period = claim.periodStart && claim.periodEnd
                            ? `${formatDate(claim.periodStart)} – ${formatDate(claim.periodEnd)}`
                            : claim.claimDate ? formatDate(claim.claimDate) : '—';
                          return (
                            <tr key={idx} className="border-b border-slate-50 last:border-0">
                              <td className="py-2 pr-2 font-medium text-slate-700">#{claim.claimNumber}</td>
                              <td className="py-2 pr-2 text-xs text-slate-500">{period}</td>
                              <td className="py-2 pr-2 text-right font-medium text-slate-800">{formatCurrency(claim.amountClaimed)}</td>
                              <td className="py-2 text-center">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${statusColors[claim.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {statusLabels[claim.status] ?? claim.status}
                                </span>
                                {claim.status === 'paid' && claim.paidAt && (
                                  <div className="text-[10px] text-slate-400 mt-0.5">{formatDate(claim.paidAt)}</div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Running balance */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-500">Total Claimed</span>
                    <span className="font-medium text-slate-800">{formatCurrency(financialData.summary.totalClaimed)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-500">Total Paid</span>
                    <span className="font-medium text-emerald-700">{formatCurrency(financialData.summary.totalPaid)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm pt-1 border-t border-slate-200">
                    <span className="font-semibold text-slate-700">Outstanding</span>
                    <span className={`font-bold ${parseFloat(financialData.summary.outstanding) > 0 ? 'text-brand' : 'text-emerald-600'}`}>
                      {formatCurrency(financialData.summary.outstanding)}
                    </span>
                  </div>
                  {parseFloat(financialData.summary.totalRetentionHeld) > 0 && (
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400 pt-1 border-t border-slate-100">
                      <span>Retention held (to date)</span>
                      <span>{formatCurrency(financialData.summary.totalRetentionHeld)}</span>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {showActivityFeed && data.activityFeed && data.activityFeed.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-brand text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Recent Activity</span>
                </div>
              </div>
              <div className="p-5">
                <div className="space-y-3">
                  {data.activityFeed.slice(0, 10).map((item, idx) => {
                    const activityIcons: Record<string, typeof CheckCircle2> = {
                      status_change: Navigation,
                      photo_added: Camera,
                      check_in: MapPin,
                      check_out: MapPin,
                      job_created: FileText,
                    };
                    const ItemIcon = activityIcons[item.type] || CircleDot;
                    return (
                      <div key={idx} className="flex items-start gap-3 py-1.5 border-b border-slate-100 last:border-0">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <ItemIcon className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">{item.title}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">{formatTimeAgo(item.timestamp)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {hasDocuments && (
            <div className="flex gap-2 flex-wrap">
              {documents.quotes.length > 0 && (
                <a href={`/portal/quote/${documents.quotes[0].token}`} className="flex-1 min-w-[140px]">
                  <Button variant="outline" className="w-full text-brand border-brand/30">
                    <FileText className="w-4 h-4 mr-1.5" />
                    View Quote
                  </Button>
                </a>
              )}
              {documents.invoices.filter(i => i.status !== 'paid').length > 0 && (
                <a href={`/portal/invoice/${documents.invoices.filter(i => i.status !== 'paid')[0].token}`} className="flex-1 min-w-[140px]">
                  <Button className="w-full bg-brand">
                    <CreditCard className="w-4 h-4 mr-1.5" />
                    Pay Invoice
                  </Button>
                </a>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-brand text-white px-5 py-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-300" />
                <span className="font-semibold text-sm">Documents & Payments</span>
              </div>
            </div>
            {hasDocuments ? (
              <div className="p-4 space-y-3">
                {documents.quotes.map((quote) => (
                  <a
                    key={`q-${quote.id}`}
                    href={`/portal/quote/${quote.token}`}
                    className="block rounded-xl border border-slate-200 overflow-hidden hover-elevate active-elevate-2"
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{quote.title || 'Quote'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(quote.createdAt)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-base font-bold text-foreground">{formatCurrency(quote.total)}</p>
                          <div className="mt-1">{getDocStatusBadge(quote.status)}</div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <Button variant="outline" size="sm" className="w-full text-brand border-brand/30">
                          View Quote
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </a>
                ))}
                {documents.invoices.map((invoice) => {
                  const isPayable = invoice.status !== 'paid';
                  return (
                    <a
                      key={`i-${invoice.id}`}
                      href={`/portal/invoice/${invoice.token}`}
                      className={`block rounded-xl overflow-hidden hover-elevate active-elevate-2 ${
                        isPayable 
                          ? 'bg-brand/5 border-2 border-brand/20' 
                          : 'border border-slate-200'
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isPayable ? 'bg-brand/10' : 'bg-slate-100'
                          }`}>
                            <CreditCard className={`w-5 h-5 ${isPayable ? 'text-brand' : 'text-slate-400'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">Invoice #{invoice.invoiceNumber}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(invoice.createdAt)}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-base font-bold ${isPayable ? 'text-brand' : 'text-foreground'}`}>{formatCurrency(invoice.total)}</p>
                            <div className="mt-1">{getDocStatusBadge(invoice.status)}</div>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <Button 
                            variant={isPayable ? 'default' : 'outline'} 
                            size="sm" 
                            className={`w-full ${isPayable ? 'bg-brand' : 'text-brand border-brand/30'}`}
                          >
                            {isPayable ? (
                              <>
                                <CreditCard className="w-4 h-4 mr-1.5" />
                                Pay Invoice
                              </>
                            ) : (
                              <>
                                <Receipt className="w-4 h-4 mr-1.5" />
                                View Receipt
                                <ChevronRight className="w-4 h-4 ml-1" />
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <FileText className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No documents yet</p>
                <p className="text-xs text-muted-foreground/60">Quotes and invoices will appear here</p>
              </div>
            )}
          </div>

          {portalDocs.length > 0 && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-brand text-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-300" />
                  <span className="font-semibold text-sm">Project Documents</span>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {portalDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-400">{doc.docNumber}</span>
                        <span className="font-medium text-sm text-slate-800 truncate">{doc.title}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                          {doc.category}
                        </span>
                        <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                          Rev {doc.currentRevision}
                        </span>
                        {doc.latestRevision && (
                          <span className="text-xs text-slate-400">
                            {formatDate(doc.latestRevision.uploadedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    {doc.latestRevision?.fileUrl && (
                      <a
                        href={doc.latestRevision.fileUrl}
                        download={doc.latestRevision.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 flex items-center gap-1.5 text-brand text-xs font-medium px-2.5 py-1.5 rounded-lg border border-brand/20 hover:bg-brand/5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-brand text-white px-5 py-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-slate-300" />
                <span className="font-semibold text-sm">Message {business.name}</span>
              </div>
            </div>
            <div className="p-5">
              {messageSent ? (
                <div className="flex flex-col items-center py-4 gap-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-700">Message sent! The team will get back to you.</p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (portalMessage.trim()) {
                      sendMessageMutation.mutate(portalMessage.trim());
                    }
                  }}
                  className="space-y-3"
                >
                  <Textarea
                    value={portalMessage}
                    onChange={(e) => setPortalMessage(e.target.value)}
                    placeholder={`Send a message to ${business.name}...`}
                    maxLength={1000}
                    className="resize-none min-h-[100px] border-gray-200 text-sm bg-white text-foreground placeholder:text-muted-foreground"
                  />
                  {sendMessageMutation.isError && (
                    <p className="text-xs text-red-600">
                      {sendMessageMutation.error?.message || 'Failed to send message. Please try again.'}
                    </p>
                  )}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground">{portalMessage.length}/1000</span>
                    <Button
                      type="submit"
                      disabled={!portalMessage.trim() || sendMessageMutation.isPending}
                      variant="default"
                      size="lg"
                      className="bg-brand"
                    >
                      {sendMessageMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <MessageCircle className="w-4 h-4 mr-1.5" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-sm">Your Documents</h3>
                  <p className="text-xs text-slate-600 mt-0.5">View invoices, quotes, and make secure payments</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <Button 
                      onClick={() => {
                        const params = new URLSearchParams();
                        if (client?.phone) params.set('phone', client.phone);
                        window.location.href = `/portal${params.toString() ? '?' + params.toString() : ''}`;
                      }}
                      variant="outline"
                      size="sm"
                      className="text-sm text-brand border-brand/30"
                    >
                      View Documents
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Secure
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="text-center py-8 space-y-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/portal', '_blank')}
            className="text-brand border-brand/30"
          >
            <FileText className="w-4 h-4 mr-1.5" />
            Open Client Portal
          </Button>
          <div className="flex items-center justify-center gap-2.5">
            <img src={jobrunnerLogo} alt="JobRunner" className="w-7 h-7 object-contain" />
            <span className="text-sm font-medium text-brand/70">Powered by <strong className="text-brand">JobRunner</strong></span>
          </div>
          {business.abn && (
            <p className="text-xs text-muted-foreground">ABN: {business.abn}</p>
          )}
          <div className="flex items-center justify-center gap-1.5 text-xs text-brand/50">
            <Shield className="w-3.5 h-3.5" />
            <span>Secure & encrypted</span>
          </div>
        </div>
        </div>
      </div>

      {selectedPhoto !== null && hasPhotos && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="max-w-2xl max-h-[80vh] w-full">
            <img
              src={job.photos[selectedPhoto].url}
              alt={job.photos[selectedPhoto].description || 'Job photo'}
              className="w-full h-full object-contain rounded-lg"
            />
            {job.photos[selectedPhoto].description && (
              <p className="text-white/80 text-sm text-center mt-3">{job.photos[selectedPhoto].description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
