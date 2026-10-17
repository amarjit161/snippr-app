/**
 * Calculates straight line distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};

const isCoordinate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * A salon's [latitude, longitude], or null when either is missing or not a finite
 * number. The same check distanceToSalonKm uses, so a salon has a map marker
 * exactly when it can have a distance — never a guessed position.
 */
export const salonCoordinates = (salon: {
  latitude?: number | null;
  longitude?: number | null;
}): [number, number] | null =>
  isCoordinate(salon.latitude) && isCoordinate(salon.longitude) ? [salon.latitude, salon.longitude] : null;

/**
 * Straight-line distance (km) from the user to a salon, or undefined when either
 * position is unknown. Salons carry `latitude` / `longitude` (salon_with_stats);
 * a missing or non-numeric coordinate means "no distance", never a guess.
 */
export const distanceToSalonKm = (
  user: { lat: number; lng: number } | null | undefined,
  salon: { latitude?: number | null; longitude?: number | null },
): number | undefined => {
  if (!user || !isCoordinate(user.lat) || !isCoordinate(user.lng)) return undefined;
  if (!isCoordinate(salon.latitude) || !isCoordinate(salon.longitude)) return undefined;
  return calculateDistance(user.lat, user.lng, salon.latitude, salon.longitude);
};

export const getCurrentPosition = (): Promise<{lat: number, lng: number}> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn("Geolocation blocked/failed, falling back to Laxmi Nagar, Delhi", error);
          resolve({
            lat: 28.6304,
            lng: 77.2774,
          });
        }
      );
    }
  });
};

