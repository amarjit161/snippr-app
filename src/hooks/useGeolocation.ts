import { useState, useEffect } from "react";

interface GeoLocation {
  lat: number;
  lng: number;
}

export const useGeolocation = () => {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        // Fallback: mock NYC location
        setLocation({ lat: 40.7580, lng: -73.9855 });
        setError("Using approximate location");
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );
  }, []);

  return { location, error };
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

