import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";

/**
 * Returns true only if the Leaflet map instance is still mounted and usable.
 * After react-leaflet unmounts a <MapContainer>, Leaflet's `map.remove()`
 * deletes `_mapPane` and detaches the container. Touching the map after that
 * throws "Cannot read properties of undefined (reading '_leaflet_pos')".
 */
export function isMapAlive(map: LeafletMap | null | undefined): boolean {
  if (!map) return false;
  try {
    const container = map.getContainer();
    return (
      !!container &&
      !!(map as any)._mapPane &&
      document.body.contains(container)
    );
  } catch {
    return false;
  }
}

/**
 * Runs a map operation (fitBounds, setView, panTo, etc.) only if the map is
 * still alive, and swallows the Leaflet teardown race ('_leaflet_pos') if the
 * map gets torn down mid-call. Any other error is re-thrown.
 */
export function safeMapCall(
  map: LeafletMap | null | undefined,
  fn: (m: LeafletMap) => void,
): void {
  if (!isMapAlive(map)) return;
  try {
    fn(map as LeafletMap);
  } catch (err) {
    if (err instanceof TypeError && String(err).includes("_leaflet_pos")) {
      return;
    }
    throw err;
  }
}

/**
 * Drop this inside any <MapContainer>. On unmount it cancels any in-flight
 * pan/zoom animation (including popup auto-pan) before react-leaflet removes
 * the map panes, so the pending requestAnimationFrame callback can't read
 * `_leaflet_pos` off an already-deleted map pane and crash.
 */
export function MapTeardownGuard() {
  const map = useMap();
  useEffect(() => {
    return () => {
      try {
        const anyMap = map as any;
        if (typeof anyMap._stop === "function") {
          anyMap._stop();
        } else if (typeof map.stop === "function") {
          map.stop();
        }
      } catch {
        // Map already torn down — nothing to stop.
      }
    };
  }, [map]);
  return null;
}
