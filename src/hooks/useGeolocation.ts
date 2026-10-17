import { useCallback, useState, useEffect } from "react";

interface GeoLocation {
  lat: number;
  lng: number;
}

/**
 * "idle"        — not requested yet (opt-in callers, before `request()`)
 * "pending"     — waiting for the browser (permission prompt or lookup)
 * "located"     — `location` holds the device's real position
 * "unavailable" — unsupported, permission denied, lookup failed or timed out;
 *                 `location` stays null (never a substitute position) and
 *                 `error` says why
 */
export type GeolocationStatus = "idle" | "pending" | "located" | "unavailable";

/** A short, user-facing reason for a failed lookup. */
export const geolocationErrorMessage = (err: { code?: number } | null | undefined): string => {
  switch (err?.code) {
    case 1: // PERMISSION_DENIED
      return "Location permission denied";
    case 3: // TIMEOUT
      return "Location request timed out";
    default: // 2 POSITION_UNAVAILABLE, or unknown
      return "Location unavailable";
  }
};

/**
 * The device's position. By default it asks once on mount (unchanged behaviour).
 * With `{ enabled: false }` nothing is requested until `request()` is called —
 * e.g. when the user presses "Use current location" — and `enabled` turning true
 * later (like a queue entry appearing) starts the request at that point.
 */
export const useGeolocation = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Reported accuracy of the reading in metres (null when unknown).
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>(enabled ? "pending" : "idle");
  // Explicit requests (request()); each one starts a fresh lookup.
  const [attempt, setAttempt] = useState(0);

  const request = useCallback(() => {
    setError(null);
    setStatus("pending");
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled && attempt === 0) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation not supported");
      setStatus("unavailable");
      return;
    }

    let active = true;
    setStatus("pending");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!active) return;
        const { latitude, longitude } = pos.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setLocation(null);
          setAccuracy(null);
          setError("Location unavailable");
          setStatus("unavailable");
          return;
        }
        setLocation({ lat: latitude, lng: longitude });
        setAccuracy(typeof pos.coords.accuracy === "number" && Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null);
        setError(null);
        setStatus("located");
      },
      (err) => {
        if (!active) return;
        // No substitute position: callers must treat the location as unknown.
        setLocation(null);
        setAccuracy(null);
        setError(geolocationErrorMessage(err));
        setStatus("unavailable");
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );

    return () => {
      active = false;
    };
  }, [enabled, attempt]);

  return { location, error, status, request, accuracy };
};

/** Simple haversine-based travel time estimate (walking ~5km/h avg with city factor) */
export const estimateTravelMinutes = (
  userLat: number,
  userLng: number,
  salonLat: number | null,
  salonLng: number | null
): number => {
  if (!salonLat || !salonLng) return 10; // default
  const R = 6371;
  const dLat = ((salonLat - userLat) * Math.PI) / 180;
  const dLng = ((salonLng - userLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((userLat * Math.PI) / 180) *
      Math.cos((salonLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distKm = R * c;
  // Assume avg city speed ~20 km/h (mix of walking/transit)
  return Math.max(2, Math.round((distKm / 20) * 60));
};

