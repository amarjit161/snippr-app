import { salonCoordinates } from "@/lib/location";
import { getWaitBadge, isSalonOpen, type DiscoverySalon } from "@/lib/salonDiscovery";

export interface SalonMapPoint {
  id: string;
  name: string;
  /** Accessible marker label, e.g. "Salon A, Short wait, about 12 minutes". */
  label: string;
  position: [number, number];
  /** Approximate (locality / landmark) test location — drawn differently and labelled. */
  approximate?: boolean;
}

export type MapSalon = DiscoverySalon & {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  /** Position explicitly known to be approximate (drawn hollow and labelled). */
  locationApproximate?: boolean;
};

/**
 * Map points for salons with valid coordinates only (same check as distances);
 * salons without them stay in the list with no marker. Order follows the input.
 */
export function toMapPoints(salons: readonly MapSalon[], now: Date = new Date()): SalonMapPoint[] {
  const points: SalonMapPoint[] = [];
  for (const salon of salons) {
    const position = salonCoordinates(salon);
    if (!position) continue;
    const badge = getWaitBadge(salon.waitTime, isSalonOpen(salon, now));
    if (salon.locationApproximate) {
      points.push({
        id: salon.id,
        name: salon.name,
        label: `${salon.name}, ${badge.description}, approximate test location`,
        position,
        approximate: true,
      });
    } else {
      points.push({ id: salon.id, name: salon.name, label: `${salon.name}, ${badge.description}`, position });
    }
  }
  return points;
}
