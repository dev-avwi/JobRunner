interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

interface GoogleGeocodingResponse {
  results: Array<{
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    formatted_address: string;
  }>;
  status: string;
  error_message?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function geocodeWithNominatim(address: string): Promise<GeocodingResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=au`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'JobRunner/1.0',
      },
    });
    if (!response.ok) return null;
    const data: NominatimResult[] = await response.json();
    if (data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
        formattedAddress: data[0].display_name,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn('[Geocoding] No Google Maps API key found - trying Nominatim');
    const nominatimResult = await geocodeWithNominatim(address);
    if (nominatimResult) return nominatimResult;
    console.warn('[Geocoding] Nominatim failed - using suburb fallback');
    return geocodeAustralianSuburb(address);
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}&region=au`;
    
    const response = await fetch(url);
    const data: GoogleGeocodingResponse = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      return {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
      };
    } else if (data.status === 'REQUEST_DENIED') {
      console.warn('[Geocoding] API request denied:', data.error_message);
      const nominatimResult = await geocodeWithNominatim(address);
      if (nominatimResult) return nominatimResult;
      return geocodeAustralianSuburb(address);
    } else {
      console.warn('[Geocoding] No results for address:', address, 'Status:', data.status);
      const nominatimResult = await geocodeWithNominatim(address);
      if (nominatimResult) return nominatimResult;
      return geocodeAustralianSuburb(address);
    }
  } catch (error) {
    console.error('[Geocoding] Error geocoding address:', error);
    const nominatimResult = await geocodeWithNominatim(address);
    if (nominatimResult) return nominatimResult;
    return geocodeAustralianSuburb(address);
  }
}

const AUSTRALIAN_SUBURBS: Record<string, { lat: number; lng: number }> = {
  'cairns': { lat: -16.9186, lng: 145.7781 },
  'brisbane': { lat: -27.4698, lng: 153.0251 },
  'sydney': { lat: -33.8688, lng: 151.2093 },
  'melbourne': { lat: -37.8136, lng: 144.9631 },
  'perth': { lat: -31.9505, lng: 115.8605 },
  'adelaide': { lat: -34.9285, lng: 138.6007 },
  'darwin': { lat: -12.4634, lng: 130.8456 },
  'hobart': { lat: -42.8821, lng: 147.3272 },
  'gold coast': { lat: -28.0167, lng: 153.4000 },
  'newcastle': { lat: -32.9283, lng: 151.7817 },
  'townsville': { lat: -19.2590, lng: 146.8169 },
  'wollongong': { lat: -34.4278, lng: 150.8931 },
  'geelong': { lat: -38.1499, lng: 144.3617 },
  'sunshine coast': { lat: -26.6500, lng: 153.0667 },
  'canberra': { lat: -35.2809, lng: 149.1300 },
  'smithfield': { lat: -16.8494, lng: 145.7094 },
  'edge hill': { lat: -16.9019, lng: 145.7478 },
  'whitfield': { lat: -16.8903, lng: 145.7328 },
  'manoora': { lat: -16.9025, lng: 145.7389 },
  'westcourt': { lat: -16.9244, lng: 145.7467 },
  'mooroobool': { lat: -16.9347, lng: 145.7204 },
  'brinsmead': { lat: -16.9058, lng: 145.7175 },
  'kanimbla': { lat: -16.9225, lng: 145.7222 },
  'manunda': { lat: -16.9158, lng: 145.7522 },
  'cairns city': { lat: -16.9186, lng: 145.7781 },
  'parramatta park': { lat: -16.9272, lng: 145.7619 },
  'parramatta': { lat: -33.8150, lng: 151.0031 },
  'bondi': { lat: -33.8914, lng: 151.2744 },
  'st kilda': { lat: -37.8571, lng: 144.9856 },
  'surfers paradise': { lat: -28.0023, lng: 153.4296 },
  'manly': { lat: -33.7969, lng: 151.2886 },
  'fremantle': { lat: -32.0569, lng: 115.7439 },
};

function geocodeAustralianSuburb(address: string): GeocodingResult | null {
  const lowerAddress = address.toLowerCase();
  
  for (const [suburb, coords] of Object.entries(AUSTRALIAN_SUBURBS)) {
    if (lowerAddress.includes(suburb)) {
      return {
        latitude: coords.lat,
        longitude: coords.lng,
        formattedAddress: address,
      };
    }
  }
  
  const defaultCoords = AUSTRALIAN_SUBURBS['cairns'];
  return {
    latitude: defaultCoords.lat,
    longitude: defaultCoords.lng,
    formattedAddress: address,
  };
}

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function calculateRouteETA(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<{ durationMinutes: number; distanceKm: number } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    let res: Response;
    try {
      res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`,
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) return null;
    const data = await res.json();
    if (data.routes && data.routes[0]) {
      return {
        durationMinutes: Math.ceil(data.routes[0].duration / 60),
        distanceKm: Math.round(data.routes[0].distance / 100) / 10,
      };
    }
    return null;
  } catch {
    return null;
  }
}
