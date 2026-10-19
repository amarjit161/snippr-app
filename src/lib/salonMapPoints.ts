import { salonCoordinates } from "@/lib/location";
import { getWaitBadge, isSalonOpen, type DiscoverySalon } from "@/lib/salonDiscovery";
import { distanceDescription, formatDistance } from "@/lib/salonLocation";

export interface SalonMapPoint {
  id: string;
  name: string;
  /** Accessible marker label, e.g. "Salon A, Short wait, about 12 minutes". */
  label: string;
  position: [number, number];
  /** Approximate (locality / landmark) test location — drawn differently and labelled. */
  approximate?: boolean;
  /** Straight-line distance from the customer's device position, e.g. "1.5 km" (absent when unknown). */
  distanceText?: string;
  /** The closest salon to the customer (by calculated distance). */
  nearest?: boolean;
}

export type MapSalon = DiscoverySalon & {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  /** Position explicitly known to be approximate (drawn hollow and labelled). */
  locationApproximate?: boolean;
  /** A demo/test coordinate (lib/demoLocations.ts) — named as such for screen readers. */
  locationDemo?: unknown;
  /** Distances are rounded (demo/approximate positions, coarse device reading). */
  distanceApproximate?: boolean;
  /** Set by the page on the closest salon (lib/salonDiscovery nearestSalon). */
  isNearest?: boolean;
};

/** ", 1.5 km away in a straight line (not by road), nearest salon" — or "" with no distance. */
function distancePart(salon: MapSalon): { distanceText?: string; nearest?: boolean; spoken: string } {
  const text = formatDistance(salon.distance, !!salon.distanceApproximate);
  if (!text) return { spoken: "" };
  const nearest = !!salon.isNearest;
  return {
    distanceText: text,
    ...(nearest ? { nearest } : {}),
    spoken: `, ${distanceDescription(text, !!salon.distanceApproximate)}${nearest ? ", nearest salon" : ""}`,
  };
}

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
    const { spoken, ...distance } = distancePart(salon);
    if (salon.locationApproximate) {
      points.push({
        id: salon.id,
        name: salon.name,
        label: `${salon.name}, ${badge.description}, approximate test location${spoken}`,
        position,
        approximate: true,
        ...distance,
      });
    } else {
      points.push({
        id: salon.id,
        name: salon.name,
        label: `${salon.name}, ${badge.description}${salon.locationDemo ? ", demo location" : ""}${spoken}`,
        position,
        ...distance,
      });
    }
  }
  return points;
}

/** A map label's extra text: the distance, led by "Nearest" for the closest salon. */
export const labelDetail = (point: Pick<SalonMapPoint, "distanceText" | "nearest">) =>
  point.distanceText ? `${point.nearest ? "Nearest · " : ""}${point.distanceText}` : undefined;
