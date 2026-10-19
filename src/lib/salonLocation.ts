/**
 * Salon location helpers: how trustworthy a salon's position is, how to phrase a
 * distance honestly, and validation / composition for the owner's address and
 * map-pin form.
 *
 * There is no verification column in the database, so stored coordinates are
 * "on file" — never presented as owner-verified. Local demo fixtures are "demo"
 * (shown like normal salons, distances rounded). "approximate" is for positions
 * explicitly flagged as approximate. Salons without coordinates are "missing".
 */

export type LocationQuality = "on-file" | "approximate" | "demo" | "missing";

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function locationQualityOf(salon: {
  latitude?: number | null;
  longitude?: number | null;
  /** Local development demo fixture (see src/dev/testSalonLocations.ts). */
  locationDemo?: unknown;
  /** Position explicitly known to be approximate. */
  locationApproximate?: boolean;
}): LocationQuality {
  if (!finite(salon.latitude) || !finite(salon.longitude)) return "missing";
  if (salon.locationDemo) return "demo";
  return salon.locationApproximate ? "approximate" : "on-file";
}

/** Device readings worse than this (metres) are treated as approximate. */
export const COARSE_ACCURACY_METRES = 1000;

/**
 * A distance phrased no more precisely than the data allows, or null when there
 * is no distance. Approximate distances are rounded and marked with "≈". Under
 * 1 km a precise reading is shown in metres (to the nearest 10 m, never below
 * "50 m" — GPS isn't better than that); from 1 km, one decimal ("1.5 km", "2.0 km").
 */
export function formatDistance(km: number | null | undefined, approximate: boolean): string | null {
  if (!finite(km) || km < 0) return null;
  if (approximate) return km < 1 ? "≈ <1 km" : `≈ ${Math.round(km)} km`;
  const metres = Math.round((km * 1000) / 10) * 10;
  if (metres < 1000) return metres < 50 ? "< 50 m" : `${metres} m`;
  return `${km.toFixed(1)} km`;
}

/** Shown where a distance is expected but the customer's or the salon's position is unknown. */
export const DISTANCE_UNAVAILABLE = "Distance unavailable";

/**
 * Screen-reader / tooltip wording: these are straight-line ("as the crow flies")
 * distances from the customer's device position, not road distances.
 */
export const distanceDescription = (text: string, approximate: boolean) =>
  `${approximate ? "About " : ""}${text.replace(/^≈ /, "")} away in a straight line (not by road)`;

// ── Owner address + pin ────────────────────────────────────────────────────

export interface SalonAddress {
  building: string;
  street: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
}

export const EMPTY_ADDRESS: SalonAddress = { building: "", street: "", locality: "", city: "", state: "", pincode: "" };

/**
 * Where a pin came from — shown to the owner; saved only after confirmation.
 * There is deliberately no "device location" source: the owner's GPS may centre
 * the map, but the salon's pin is always placed by the owner.
 */
export type PinSource = "geocoded" | "placed" | "entered";

export interface SalonPin {
  lat: number;
  lng: number;
  source: PinSource;
  /** The owner has confirmed the pin marks the salon itself. */
  confirmed: boolean;
}

export const PIN_SOURCE_LABEL: Record<PinSource, string> = {
  geocoded: "From the address search (approximate — please check)",
  placed: "Placed by you on the map",
  entered: "Coordinates you entered",
};

/** A label for any stored source (older drafts may hold a source that no longer exists). */
export const pinSourceLabel = (source: string) => PIN_SOURCE_LABEL[source as PinSource] ?? PIN_SOURCE_LABEL.placed;

export const LOCATION_MESSAGES = {
  noPin: "Place your salon's pin on the map.",
  unconfirmed: "Press “Confirm this location” once the pin is on your salon's entrance.",
} as const;

/**
 * Whether a NEW salon's location can be accepted: a valid address and a valid pin
 * the owner has explicitly confirmed. Shared by every new-salon flow so they can't
 * drift apart. (Client-side only — see supabase/proposals for the server check.)
 */
export function salonLocationProblem(a: SalonAddress, pin: SalonPin | null) {
  const addressErrors = validateSalonAddress(a);
  const pinError =
    !pin || validateCoordinates(pin.lat, pin.lng) !== null
      ? LOCATION_MESSAGES.noPin
      : !pin.confirmed
      ? LOCATION_MESSAGES.unconfirmed
      : null;
  return { addressErrors, pinError, ok: Object.keys(addressErrors).length === 0 && pinError === null };
}

/** Indian PIN code: six digits, not starting with 0. */
export const isValidPincode = (pin: string) => /^[1-9][0-9]{5}$/.test(pin.trim());

/** Field-level messages for the address (empty object when valid). */
export function validateSalonAddress(a: SalonAddress): Partial<Record<keyof SalonAddress, string>> {
  const errors: Partial<Record<keyof SalonAddress, string>> = {};
  if (!a.street.trim()) errors.street = "Enter the street or road";
  if (!a.locality.trim()) errors.locality = "Enter the locality or area";
  if (!a.city.trim()) errors.city = "Enter the city";
  if (!a.state.trim()) errors.state = "Enter the state";
  if (!a.pincode.trim()) errors.pincode = "Enter the 6-digit PIN code";
  else if (!isValidPincode(a.pincode)) errors.pincode = "PIN code must be 6 digits and can't start with 0";
  return errors;
}

/** Coordinate check: null when valid, otherwise a message. */
export function validateCoordinates(lat: unknown, lng: unknown): string | null {
  if (!finite(lat) || !finite(lng)) return "Place the pin on the map";
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return "That pin isn't a valid map position";
  return null;
}

/** Rough bounding box of India — used only to warn, never to block. */
export const isWithinIndia = (lat: number, lng: number) => lat >= 6 && lat <= 37.6 && lng >= 68 && lng <= 97.5;

/** The full address saved in `salons.address` (no state column exists, so it is kept here). */
export function composeAddress(a: SalonAddress): string {
  const tail = [a.state.trim(), a.pincode.trim()].filter(Boolean).join(" ");
  return [a.building, a.street, a.locality, a.city]
    .map((p) => p.trim())
    .filter(Boolean)
    .concat(tail ? [tail] : [])
    .join(", ");
}

/** The short display line saved in `salons.location` (shown on salon cards). */
export function composeLocationLine(a: SalonAddress): string {
  return [a.locality, a.city].map((p) => p.trim()).filter(Boolean).join(", ");
}

/**
 * Set (VITE_FLAG_SALON_LOCATION_CONFIRMATION=true) once the proposed
 * salons.location_source / location_confirmed_at columns exist
 * (supabase/proposals/20261018_salon_location_confirmation_*.sql). Until then the
 * payload must not mention them, or the insert/update would be rejected.
 */
export const LOCATION_CONFIRMATION_FLAG = "salon_location_confirmation";

// Read by name, not via the generic feature-flag helper: that helper indexes the
// whole import.meta.env object, which makes Vite inline EVERY VITE_ variable
// (including the development-only map key) into the production bundle.
const confirmationColumnsEnabled = () => import.meta.env.VITE_FLAG_SALON_LOCATION_CONFIRMATION === "true";

/**
 * Columns to write for a salon's address and position — only existing columns.
 * Coordinates are included only when the pin is confirmed; otherwise left as-is.
 * With the confirmation columns enabled, a confirmed pin also records its source
 * and the confirmation (the server is expected to stamp the time itself).
 */
export function salonLocationPayload(
  a: SalonAddress,
  pin: SalonPin | null,
  { confirmationColumns = confirmationColumnsEnabled() }: { confirmationColumns?: boolean } = {},
) {
  const confirmed = !!pin && pin.confirmed && !validateCoordinates(pin.lat, pin.lng);
  return {
    address: composeAddress(a),
    location: composeLocationLine(a) || composeAddress(a),
    city: a.city.trim(),
    pincode: a.pincode.trim(),
    ...(confirmed && pin ? { latitude: Number(pin.lat.toFixed(6)), longitude: Number(pin.lng.toFixed(6)) } : {}),
    ...(confirmed && pin && confirmationColumns
      ? { location_source: pin.source, location_confirmed_at: new Date().toISOString() }
      : {}),
  };
}

// ── Explicit address → map lookup (owner clicks "Find my address on the map") ──

export interface AddressMatch {
  lat: number;
  lng: number;
  /** What OpenStreetMap matched, shown so the owner can judge it. */
  label: string;
}

/**
 * One Nominatim search for the owner's address, only on an explicit click (the
 * app's existing geocoding capability; moderate use, attribution shown). The
 * result is approximate and must be checked and confirmed on the map.
 */
export async function findAddressOnMap(
  a: SalonAddress,
  { signal, fetchImpl = fetch }: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<AddressMatch | null> {
  const q = composeAddress({ ...a, building: "" }); // building numbers rarely match and can mislead
  if (!q) return null;
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&accept-language=en&q=" +
    encodeURIComponent(q);
  try {
    const res = await fetchImpl(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const body = (await res.json()) as { lat?: string; lon?: string; display_name?: string }[];
    const hit = Array.isArray(body) ? body[0] : undefined;
    const lat = Number(hit?.lat);
    const lng = Number(hit?.lon);
    if (!hit || validateCoordinates(lat, lng)) return null;
    return { lat, lng, label: hit.display_name ?? q };
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") throw error;
    return null;
  }
}

/**
 * Best-effort split of a legacy single-line address into the structured fields
 * (for editing older salons). Unparsed text stays in "street" for the owner to fix.
 */
export function splitLegacyAddress(address: string | null, city: string | null, pincode: string | null): SalonAddress {
  return { ...EMPTY_ADDRESS, street: (address ?? "").trim(), city: (city ?? "").trim(), pincode: (pincode ?? "").trim() };
}
