/**
 * Pure salon-discovery logic for /salons: open status, queue wait badges,
 * filters, sorting and starting prices. No React, no Supabase — every function
 * takes plain data (and, where time matters, an injectable `now`).
 *
 * Deliberately absent: ratings, review counts, "Top rated", rating sorting and
 * category filters — no verified data source exists for them (see the /salons
 * audit). Nothing here invents a value: unknown stays unknown.
 */
import { formatINR } from "@/lib/currency";

// ── Open / closed ──────────────────────────────────────────────────────────

/**
 * Whether `now` falls within a salon's opening hours. Identical behaviour to
 * the private copies in SalonCard, SalonPage and QuickBooking (so /salons can't
 * disagree with them):
 *   - no open or close time → open
 *   - "HH:MM" or "HH:MM:SS", compared as HHMM, both ends inclusive
 *   - close earlier than open → the range wraps past midnight
 *   - unexpected failure → open
 */
export function isWithinOperatingHours(
  openTime: string | null | undefined,
  closeTime: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!openTime || !closeTime) return true;
  try {
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const openParts = openTime.split(":").map(Number);
    const closeParts = closeTime.split(":").map(Number);
    const openTimeNum = openParts[0] * 100 + (openParts[1] || 0);
    const closeTimeNum = closeParts[0] * 100 + (closeParts[1] || 0);
    if (openTimeNum <= closeTimeNum) {
      return currentTime >= openTimeNum && currentTime <= closeTimeNum;
    }
    return currentTime >= openTimeNum || currentTime <= closeTimeNum;
  } catch {
    return true;
  }
}

/** The fields discovery logic reads; Salons.tsx's mapped rows already have them. */
export interface DiscoverySalon {
  id: string;
  open_time?: string | null;
  close_time?: string | null;
  is_manual_closed?: boolean | null;
  /** Estimated wait in minutes (salon_with_stats.wait_time). */
  waitTime?: number | null;
  /** Distance from the user in km; absent when the location is unknown. */
  distance?: number | null;
}

/** Open = not manually closed and within opening hours (same rule as SalonCard). */
export function isSalonOpen(salon: DiscoverySalon, now: Date = new Date()): boolean {
  return !salon.is_manual_closed && isWithinOperatingHours(salon.open_time, salon.close_time, now);
}

// ── Queue wait badge ───────────────────────────────────────────────────────

export const NOW_MAX_MINUTES = 3;
export const SHORT_WAIT_MAX_MINUTES = 15;
export const MODERATE_WAIT_MAX_MINUTES = 30;

export type WaitTone = "now" | "short" | "moderate" | "long" | "closed" | "unknown";
/** Semantic colour for the UI to map onto its tokens (success / warning / destructive / muted). */
export type WaitColor = "green" | "amber" | "red" | "muted";

export interface WaitBadge {
  tone: WaitTone;
  color: WaitColor;
  /** Short badge text: "Now", "12 min", "Closed", or "—" when unknown. */
  label: string;
  /** Accessible description, e.g. "Short wait, about 12 minutes". */
  description: string;
  /** Whole minutes used for the label, or null when closed / unknown. */
  minutes: number | null;
}

/**
 * A wait in whole minutes, or null when it isn't a usable number. Rounded first
 * so the label and the band always agree (15.4 → 15 → short).
 */
export function normalizeWaitMinutes(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

/**
 * Badge for a salon's queue wait.
 *   0–3 → "Now" (green) · 4–15 → short (green) · 16–30 → moderate (amber)
 *   over 30 → long (red) · closed → "Closed" · unknown/invalid → "—" (no number invented)
 */
export function getWaitBadge(waitMinutes: unknown, isOpen: boolean): WaitBadge {
  if (!isOpen) {
    return { tone: "closed", color: "muted", label: "Closed", description: "Closed now", minutes: null };
  }
  const minutes = normalizeWaitMinutes(waitMinutes);
  if (minutes === null) {
    return { tone: "unknown", color: "muted", label: "—", description: "Wait time unavailable", minutes: null };
  }
  if (minutes <= NOW_MAX_MINUTES) {
    return { tone: "now", color: "green", label: "Now", description: "No wait, walk in now", minutes };
  }
  const label = `${minutes} min`;
  if (minutes <= SHORT_WAIT_MAX_MINUTES) {
    return { tone: "short", color: "green", label, description: `Short wait, about ${minutes} minutes`, minutes };
  }
  if (minutes <= MODERATE_WAIT_MAX_MINUTES) {
    return { tone: "moderate", color: "amber", label, description: `Moderate wait, about ${minutes} minutes`, minutes };
  }
  return { tone: "long", color: "red", label, description: `Long wait, about ${minutes} minutes`, minutes };
}

// ── Filters ────────────────────────────────────────────────────────────────

export interface DiscoveryFilters {
  /** Only salons open right now. */
  openNow?: boolean;
  /** Only open salons with a known wait of SHORT_WAIT_MAX_MINUTES or less. */
  shortWait?: boolean;
}

/** Filters (combined with AND). Never mutates the input; keeps its order. */
export function filterSalons<T extends DiscoverySalon>(
  salons: readonly T[],
  filters: DiscoveryFilters,
  now: Date = new Date(),
): T[] {
  return salons.filter((salon) => {
    const open = isSalonOpen(salon, now);
    if (filters.openNow && !open) return false;
    if (filters.shortWait) {
      const minutes = normalizeWaitMinutes(salon.waitTime);
      if (!open || minutes === null || minutes > SHORT_WAIT_MAX_MINUTES) return false;
    }
    return true;
  });
}

// ── Sorting ────────────────────────────────────────────────────────────────

export type DiscoverySort = "recommended" | "distance" | "wait";

const finiteOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

/**
 * Sorted copy (the input is never mutated):
 *   - "recommended": the input order, unchanged (stable default)
 *   - "distance": nearest first; salons without a known distance last
 *   - "wait": open salons with a known wait (shortest first), then open with
 *     unknown wait, then closed
 * Ties always keep the input order.
 */
export function sortSalons<T extends DiscoverySalon>(
  salons: readonly T[],
  sort: DiscoverySort,
  now: Date = new Date(),
): T[] {
  const indexed = salons.map((salon, index) => ({ salon, index }));
  if (sort === "recommended") return indexed.map((e) => e.salon);

  const key = (salon: T): [number, number] => {
    if (sort === "distance") {
      const d = finiteOrNull(salon.distance);
      return d === null ? [1, 0] : [0, d];
    }
    if (!isSalonOpen(salon, now)) return [2, 0];
    const minutes = normalizeWaitMinutes(salon.waitTime);
    return minutes === null ? [1, 0] : [0, minutes];
  };

  return indexed
    .map((e) => ({ ...e, key: key(e.salon) }))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.index - b.index)
    .map((e) => e.salon);
}

// ── Starting prices ────────────────────────────────────────────────────────

export interface PricedService {
  salon_id?: string | null;
  price?: number | null;
}

/**
 * Lowest valid service price per salon. Ignores services without a salon and
 * prices that are null, non-numeric, non-finite or negative. A ₹0 price is
 * valid and kept. Salons with no valid price are simply absent from the map.
 */
export function getStartingPrices(services: readonly PricedService[] | null | undefined): Map<string, number> {
  const result = new Map<string, number>();
  for (const service of services ?? []) {
    if (!service || typeof service.salon_id !== "string" || service.salon_id === "") continue;
    const price = service.price;
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0) continue;
    const current = result.get(service.salon_id);
    if (current === undefined || price < current) result.set(service.salon_id, price);
  }
  return result;
}

/** "Free" for ₹0, "From ₹199" otherwise, null when there is no valid price (show nothing). */
export function formatStartingPrice(price: number | null | undefined): string | null {
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) return null;
  if (price === 0) return "Free";
  return `From ${formatINR(price)}`;
}
