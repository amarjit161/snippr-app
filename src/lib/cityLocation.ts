/**
 * City detection and matching for /salons.
 *
 * Reverse geocoding reuses the capability the app already has (OwnerRegistration /
 * RegisterSalon): the public OpenStreetMap Nominatim `/reverse` endpoint. Its usage
 * policy allows direct, user-triggered requests from browsers at moderate volume,
 * requires results to be cached, at most 1 request per second, and visible
 * attribution — so it is called only when the user presses "Detect my city", once
 * per detection, with a per-session cache. There is no SLA; see the Stage report.
 *
 * Nothing here invents a place: an unreadable answer resolves to null and the UI
 * falls back to manual city selection.
 */

export const REVERSE_GEOCODE_ATTRIBUTION = {
  label: "OpenStreetMap contributors",
  href: "https://www.openstreetmap.org/copyright",
} as const;

export interface ResolvedPlace {
  /** The settlement name (city, town, village or municipality). */
  city: string;
  /** Country name, when the service returns one. */
  country: string | null;
  /** City-level names usable for matching (city, district…), most specific first. */
  candidates: string[];
}

/** Well-known cities offered in the picker; ones without salons are marked "No salons yet". */
export const POPULAR_CITIES = ["Delhi", "Gurugram", "Noida", "Mumbai", "Bengaluru", "Kolkata"];

// Real alternate names for the same city (former names / common forms), used only
// to match a detected place to the city names stored on salons.
const CITY_ALIASES: Record<string, string> = {
  "new delhi": "delhi",
  "nct of delhi": "delhi",
  gurgaon: "gurugram",
  bangalore: "bengaluru",
  bombay: "mumbai",
  calcutta: "kolkata",
};

/** Comparable form of a city name: trimmed, lower-case, single spaces, aliases folded. */
export function normalizeCity(name: string | null | undefined): string {
  const key = (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return CITY_ALIASES[key] ?? key;
}

const cacheKey = (lat: number, lng: number) => `snippr:city:${lat.toFixed(2)},${lng.toFixed(2)}`;
const memoryCache = new Map<string, ResolvedPlace | null>();

const readCache = (key: string): ResolvedPlace | null | undefined => {
  if (memoryCache.has(key)) return memoryCache.get(key);
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw) return JSON.parse(raw) as ResolvedPlace;
  } catch {
    /* storage unavailable: fine, just no cache */
  }
  return undefined;
};

const writeCache = (key: string, place: ResolvedPlace) => {
  memoryCache.set(key, place);
  try {
    window.sessionStorage.setItem(key, JSON.stringify(place));
  } catch {
    /* ignore */
  }
};

/** Test hook: forget cached lookups. */
export function clearCityCache() {
  memoryCache.clear();
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Reads a Nominatim jsonv2 `/reverse` response; null when no settlement name is present. */
export function parseNominatimPlace(body: unknown): ResolvedPlace | null {
  const address = (body as { address?: Record<string, unknown> } | null)?.address;
  if (!address || typeof address !== "object") return null;
  const city = str(address.city) ?? str(address.town) ?? str(address.village) ?? str(address.municipality);
  if (!city) return null; // no reliable city-level name: don't guess from a state or road
  const state = str(address.state);
  const candidates = [
    city,
    str(address.city_district),
    str(address.state_district),
    str(address.county),
    // Delhi is a city-state: its "state" is the city name salons use.
    state && normalizeCity(state) === "delhi" ? state : null,
  ].filter((v): v is string => Boolean(v));
  return { city, country: str(address.country), candidates: [...new Set(candidates)] };
}

/**
 * The city at a coordinate, or null when it can't be resolved reliably (invalid
 * coordinates, network/service error, or no city-level name in the answer).
 * Aborting via `signal` rejects with the AbortError so callers can ignore it.
 */
export async function reverseGeocodeCity(
  lat: number,
  lng: number,
  { signal, fetchImpl = fetch }: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<ResolvedPlace | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const key = cacheKey(lat, lng);
  const cached = readCache(key);
  if (cached !== undefined) return cached;

  const url =
    "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&accept-language=en" +
    `&lat=${encodeURIComponent(lat.toFixed(5))}&lon=${encodeURIComponent(lng.toFixed(5))}`;
  let response: Response;
  try {
    response = await fetchImpl(url, { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") throw error;
    return null;
  }
  if (!response.ok) return null;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }
  const place = parseNominatimPlace(body);
  if (place) writeCache(key, place);
  return place;
}

/**
 * The salon city (as stored on salons) that a detected place corresponds to, or
 * null when no salon is listed there. Only exact names and known aliases match.
 */
export function matchSalonCity(place: ResolvedPlace, salonCities: readonly string[]): string | null {
  for (const candidate of place.candidates) {
    const wanted = normalizeCity(candidate);
    const hit = salonCities.find((city) => normalizeCity(city) === wanted);
    if (hit) return hit;
  }
  return null;
}

// Indian states and union territories. A salon whose "city" holds one of these
// names has no city recorded, so it is never offered as a city option. Delhi,
// Chandigarh and Puducherry are also cities and are deliberately not listed.
const STATE_AND_UT_NAMES = new Set(
  [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Orissa", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "Uttaranchal", "West Bengal",
    "Andaman and Nicobar Islands", "Dadra and Nagar Haveli and Daman and Diu", "Jammu and Kashmir",
    "Ladakh", "Lakshadweep",
  ].map((name) => name.toLowerCase()),
);

// Generic placeholder values that are not place names (e.g. left in test data).
const PLACEHOLDER_CITY_VALUES = new Set(["test", "testing", "demo", "sample", "na", "n/a", "none", "null", "unknown", "city", "-", "--", "."]);

export type CityValueIssue = "missing" | "state" | "placeholder";

/** Why a salon's city value can't be used as a city option, or null when it can. */
export function cityValueIssue(value: string | null | undefined): CityValueIssue | null {
  const key = (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return "missing";
  if (STATE_AND_UT_NAMES.has(key)) return "state";
  if (PLACEHOLDER_CITY_VALUES.has(key)) return "placeholder";
  return null;
}

/**
 * Real city options from salon data, with real counts (most salons first, ties
 * alphabetical). Salons whose city value is missing, a state name or a
 * placeholder are not turned into options; they are counted in `unlisted` and
 * stay visible when the list is not filtered by city. Data is never altered.
 */
export function salonCityOptions(salons: readonly { city?: string | null }[]): {
  cities: { name: string; count: number }[];
  unlisted: number;
} {
  const byKey = new Map<string, { name: string; count: number }>();
  let unlisted = 0;
  for (const salon of salons) {
    if (cityValueIssue(salon.city)) {
      unlisted += 1;
      continue;
    }
    const name = (salon.city as string).trim();
    const key = normalizeCity(name);
    const entry = byKey.get(key);
    if (entry) entry.count += 1;
    else byKey.set(key, { name, count: 1 });
  }
  return {
    cities: [...byKey.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    unlisted,
  };
}

// ── Map framing ────────────────────────────────────────────────────────────

export interface MapView {
  center: [number, number];
  zoom: number;
}

/** The whole of India: the map's view when no position or city is known. */
export const INDIA_VIEW: MapView = { center: [22.5, 79.0], zoom: 4.5 };

// Approximate city centres, used ONLY to frame the map for a chosen city. They
// are never used as, or shown as, a salon's location.
const CITY_CENTERS: Record<string, [number, number]> = {
  delhi: [28.6139, 77.209],
  noida: [28.5355, 77.391],
  gurugram: [28.4595, 77.0266],
  ghaziabad: [28.6692, 77.4538],
  faridabad: [28.4089, 77.3178],
  mumbai: [19.076, 72.8777],
  bengaluru: [12.9716, 77.5946],
  kolkata: [22.5726, 88.3639],
  chennai: [13.0827, 80.2707],
  hyderabad: [17.385, 78.4867],
  pune: [18.5204, 73.8567],
  ahmedabad: [23.0225, 72.5714],
  jaipur: [26.9124, 75.7873],
  lucknow: [26.8467, 80.9462],
  chandigarh: [30.7333, 76.7794],
};

/**
 * Where the map should look without salon markers: the device position the user
 * chose to share, else the chosen city's centre, else all of India.
 */
export function mapViewFor(city: string | null | undefined, userLocation: { lat: number; lng: number } | null | undefined): MapView {
  if (userLocation && Number.isFinite(userLocation.lat) && Number.isFinite(userLocation.lng)) {
    return { center: [userLocation.lat, userLocation.lng], zoom: 13 };
  }
  const center = city ? CITY_CENTERS[normalizeCity(city)] : undefined;
  return center ? { center, zoom: 11.5 } : INDIA_VIEW;
}
