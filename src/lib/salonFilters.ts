/**
 * Discovery filters for /salons, derived only from real data:
 *  - Availability: open now / short wait (Stage 2 rules in salonDiscovery.ts)
 *  - Services: customer-friendly categories matched from actual service names
 *  - Starting price: transparent bands of each salon's real lowest service price
 *
 * Not offered (no data supports them): men / women / unisex salon type, "premium",
 * ratings, offers. Groups combine with AND; options within a group with OR.
 */
import { filterSalons, isSalonOpen, normalizeWaitMinutes, SHORT_WAIT_MAX_MINUTES, type DiscoverySalon } from "@/lib/salonDiscovery";
import { formatINR } from "@/lib/currency";

// ── Service categories ─────────────────────────────────────────────────────

export type ServiceCategoryId = "haircut" | "hair-colour" | "beard" | "skin" | "spa" | "nails" | "waxing" | "makeup";

/**
 * Whole-word keyword rules. Only clear service names match — misspellings are not
 * guessed (e.g. "bread" is not treated as "beard"), so a category only appears
 * when a salon really lists such a service.
 */
export const SERVICE_CATEGORIES: { id: ServiceCategoryId; label: string; pattern: RegExp }[] = [
  { id: "haircut", label: "Haircut", pattern: /\b(hair ?cuts?|cut|cuts|trim|trims|styling|blow ?dry)\b/i },
  { id: "hair-colour", label: "Hair colour", pattern: /\b(colou?rs?|colou?ring|highlights?|balayage|global colou?r)\b/i },
  { id: "beard", label: "Beard & shave", pattern: /\b(beards?|shav(e|es|ing)|moustache)\b/i },
  { id: "skin", label: "Skin & de-tan", pattern: /\b(de-?tan|facials?|clean ?up|bleach)\b/i },
  { id: "spa", label: "Spa", pattern: /\b(spa|massages?)\b/i },
  { id: "nails", label: "Nails", pattern: /\b(manicure|pedicure|nails?)\b/i },
  { id: "waxing", label: "Waxing & threading", pattern: /\b(wax|waxing|threading)\b/i },
  { id: "makeup", label: "Makeup", pattern: /\b(make ?-?up|bridal)\b/i },
];

const CATEGORY_LABEL = Object.fromEntries(SERVICE_CATEGORIES.map((c) => [c.id, c.label])) as Record<ServiceCategoryId, string>;
export const serviceCategoryLabel = (id: ServiceCategoryId) => CATEGORY_LABEL[id];

/** Categories a service name belongs to (possibly none). */
export function categorizeService(name: string | null | undefined): ServiceCategoryId[] {
  const text = (name ?? "").trim();
  if (!text) return [];
  return SERVICE_CATEGORIES.filter((c) => c.pattern.test(text)).map((c) => c.id);
}

/** Per salon: the set of categories its real services fall into. */
export function categoriesBySalon(
  services: readonly { salon_id?: string | null; name?: string | null }[] | null | undefined,
): Map<string, Set<ServiceCategoryId>> {
  const result = new Map<string, Set<ServiceCategoryId>>();
  for (const service of services ?? []) {
    if (!service || typeof service.salon_id !== "string" || !service.salon_id) continue;
    const cats = categorizeService(service.name);
    if (cats.length === 0) continue;
    const set = result.get(service.salon_id) ?? new Set<ServiceCategoryId>();
    cats.forEach((c) => set.add(c));
    result.set(service.salon_id, set);
  }
  return result;
}

/** Category labels for a salon, in the canonical order (for cards). */
export function salonCategoryLabels(categories: Set<ServiceCategoryId> | undefined): string[] {
  if (!categories) return [];
  return SERVICE_CATEGORIES.filter((c) => categories.has(c.id)).map((c) => c.label);
}

// ── Starting-price bands ───────────────────────────────────────────────────

export type PriceBandId = "under-200" | "200-499" | "500-999" | "1000-plus";

/** Bands of a salon's lowest real service price. A price range, not a quality tier. */
export const PRICE_BANDS: { id: PriceBandId; label: string; min: number; max: number }[] = [
  { id: "under-200", label: `Under ${formatINR(200)}`, min: 0, max: 199 },
  { id: "200-499", label: `${formatINR(200)}–${formatINR(499)}`, min: 200, max: 499 },
  { id: "500-999", label: `${formatINR(500)}–${formatINR(999)}`, min: 500, max: 999 },
  { id: "1000-plus", label: `${formatINR(1000)}+`, min: 1000, max: Number.POSITIVE_INFINITY },
];
const BAND_LABEL = Object.fromEntries(PRICE_BANDS.map((b) => [b.id, b.label])) as Record<PriceBandId, string>;
export const priceBandLabel = (id: PriceBandId) => BAND_LABEL[id];

/** The band of a starting price, or null when there is no valid price. */
export function priceBandOf(price: number | null | undefined): PriceBandId | null {
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) return null;
  return PRICE_BANDS.find((b) => price >= b.min && price <= b.max)?.id ?? null;
}

// ── Filter state ───────────────────────────────────────────────────────────

export interface DiscoveryFilterState {
  openNow: boolean;
  shortWait: boolean;
  categories: ServiceCategoryId[];
  priceBands: PriceBandId[];
}

export const EMPTY_FILTERS: DiscoveryFilterState = { openNow: false, shortWait: false, categories: [], priceBands: [] };

export const countActiveFilters = (f: DiscoveryFilterState) =>
  Number(f.openNow) + Number(f.shortWait) + f.categories.length + f.priceBands.length;

export interface FilterContext {
  categories: Map<string, Set<ServiceCategoryId>>;
  startingPrices: Map<string, number> | undefined;
  now?: Date;
}

/**
 * Salons matching every selected group (AND); within Services and Starting price
 * any selected option matches (OR). A salon without the data a group needs
 * (no categorised services / no valid price) does not match that group.
 */
export function applyDiscoveryFilters<T extends DiscoverySalon>(
  salons: readonly T[],
  filters: DiscoveryFilterState,
  ctx: FilterContext,
): T[] {
  const available = filterSalons(salons, { openNow: filters.openNow, shortWait: filters.shortWait }, ctx.now);
  return available.filter((salon) => {
    if (filters.categories.length > 0) {
      const cats = ctx.categories.get(salon.id);
      if (!cats || !filters.categories.some((c) => cats.has(c))) return false;
    }
    if (filters.priceBands.length > 0) {
      const band = priceBandOf(ctx.startingPrices?.get(salon.id));
      if (!band || !filters.priceBands.includes(band)) return false;
    }
    return true;
  });
}

/**
 * Options worth offering for the current salons (city + search applied), with
 * real salon counts. Options with no salons are omitted so no filter can promise
 * results that don't exist.
 */
export function filterOptionCounts(salons: readonly DiscoverySalon[], ctx: FilterContext) {
  const now = ctx.now ?? new Date();
  const categories = SERVICE_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    count: salons.filter((s) => ctx.categories.get(s.id)?.has(c.id)).length,
  })).filter((c) => c.count > 0);
  const priceBands = PRICE_BANDS.map((b) => ({
    id: b.id,
    label: b.label,
    count: salons.filter((s) => priceBandOf(ctx.startingPrices?.get(s.id)) === b.id).length,
  })).filter((b) => b.count > 0);
  const openNow = salons.filter((s) => isSalonOpen(s, now)).length;
  const shortWait = salons.filter((s) => {
    const minutes = normalizeWaitMinutes(s.waitTime);
    return isSalonOpen(s, now) && minutes !== null && minutes <= SHORT_WAIT_MAX_MINUTES;
  }).length;
  return { categories, priceBands, openNow, shortWait };
}

/** Human-readable active filters, each removable on its own. */
export function activeFilterChips(
  f: DiscoveryFilterState,
): { key: string; label: string; remove: (state: DiscoveryFilterState) => DiscoveryFilterState }[] {
  return [
    ...(f.openNow ? [{ key: "openNow", label: "Open now", remove: (s: DiscoveryFilterState) => ({ ...s, openNow: false }) }] : []),
    ...(f.shortWait
      ? [{ key: "shortWait", label: "Short wait", remove: (s: DiscoveryFilterState) => ({ ...s, shortWait: false }) }]
      : []),
    ...f.categories.map((id) => ({
      key: `cat:${id}`,
      label: serviceCategoryLabel(id),
      remove: (s: DiscoveryFilterState) => ({ ...s, categories: s.categories.filter((c) => c !== id) }),
    })),
    ...f.priceBands.map((id) => ({
      key: `price:${id}`,
      label: id === "under-200" ? `Starting under ${formatINR(200)}` : `Starting ${priceBandLabel(id)}`,
      remove: (s: DiscoveryFilterState) => ({ ...s, priceBands: s.priceBands.filter((b) => b !== id) }),
    })),
  ];
}

/** Toggle an option in a list (immutable). */
export const toggleIn = <T,>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
