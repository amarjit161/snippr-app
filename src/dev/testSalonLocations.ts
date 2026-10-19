/**
 * LOCAL DEVELOPMENT ONLY — demo coordinates for the current test salons, which
 * have no stored coordinates. Lets the map, distances and nearest-first sorting
 * be evaluated locally without touching production data.
 *
 * - Loaded only in `vite` dev mode via a DEV-guarded dynamic import in
 *   src/pages/Salons.tsx: never in tests, never shipped in a production build.
 * - Never overrides coordinates that a salon actually has stored.
 * - Each coordinate comes from that salon's OWN stored address (locality /
 *   landmark / street / PIN-code area centre) — never a street address or
 *   entrance, never an owner-verified position. Provenance is kept below.
 * - These records are explicitly demo data, so the UI shows them like normal
 *   salons (no "approximate" label); distances stay rounded ("≈").
 *
 * Generated 2026-10-17/18 with OpenStreetMap Nominatim search (rate-limited, per
 * its usage policy). Coordinates rounded to 3 decimals (~100 m).
 * To remove: delete this file and its dynamic import in src/pages/Salons.tsx.
 */

export const TEST_LOCATIONS_ENABLED = import.meta.env.DEV && import.meta.env.MODE !== "test";

/** What the coordinate represents. */
export type DemoLocationStatus =
  | "locality-centre" // the address only names a locality/city: its centre
  | "landmark" // the address names a landmark (station etc.)
  | "street" // the address names a street: the street's centre
  | "ambiguous-pin-area"; // address unclear: PIN-code area centre — needs manual selection

export interface TestSalonLocation {
  salonId: string;
  salonName: string;
  lat: number;
  lng: number;
  status: DemoLocationStatus;
  /** What the coordinate is based on (from the stored address only). */
  basis: string;
  /** The place OpenStreetMap matched. */
  matched: string;
}

export const TEST_LOCATION_SOURCE = "OpenStreetMap Nominatim search, 2026-10-17/18 (© OpenStreetMap contributors)";

export const TEST_SALON_LOCATIONS: readonly TestSalonLocation[] = [
  {
    salonId: "59581580-0ade-4372-a4f3-73f3f7778760",
    salonName: "John Sallon",
    lat: 28.614,
    lng: 77.369,
    status: "ambiguous-pin-area",
    basis:
      'Stored address is only "Noida 62" (PIN 201309). Using the PIN-code area centre. NEEDS MANUAL SELECTION: ' +
      '"Noida 62" may mean Sector 62, but a literal search matched unrelated businesses at "62, B Block Road, Sector 64".',
    matched: "201309, Noida, Gautam Buddha Nagar, Uttar Pradesh",
  },
  {
    salonId: "19b6801b-321a-41ed-b3fc-603f2d3b5a11",
    salonName: "luxi",
    lat: 28.571,
    lng: 77.327,
    status: "locality-centre",
    basis: "Stored address names only the city (Noida, Gautam Buddha Nagar): city centre",
    matched: "Noida, Gautam Buddha Nagar, Uttar Pradesh",
  },
  {
    salonId: "1212f6b0-06ef-4384-a88f-1d5395d19890",
    salonName: "Soham",
    lat: 28.64,
    lng: 77.22,
    status: "landmark",
    basis: "Landmark named in the stored address (New Delhi Railway Station, 110001)",
    matched: "New Delhi Railway Station, New Delhi",
  },
  {
    salonId: "6d8ad927-22d4-4e0b-9287-1594c4426620",
    salonName: "Sam",
    lat: 28.635,
    lng: 77.289,
    status: "street",
    basis: "Street named in the stored address (Nirman Vihar Road, Preet Vihar): street centre",
    matched: "Nirman Vihar Road, Preet Vihar, Shahdara South, Delhi",
  },
  {
    salonId: "f44a75eb-9f0f-4a31-a34a-c51f7f81c576",
    salonName: "The King",
    lat: 28.637,
    lng: 77.287,
    status: "landmark",
    basis: "Landmark named in the stored address (Nirman Vihar metro station)",
    matched: "Nirman Vihar Metro Station, Vikas Marg, Delhi",
  },
  {
    salonId: "50a23609-e0f3-45d4-93f4-825d37993d2d",
    salonName: "Looks",
    lat: 28.638,
    lng: 77.291,
    status: "locality-centre",
    basis: "Locality named in the stored address (Bharti Artist Colony): locality centre",
    matched: "Bharti Artist Colony, Preet Vihar, Delhi 110051",
  },
  // "Realtime Proof 876956" (f10567a2-…) has no stored address: no coordinate (stays off the map).
];

/** Salons whose demo coordinate should be replaced by a manual pin before relying on it. */
export const NEEDS_MANUAL_SELECTION = TEST_SALON_LOCATIONS.filter((t) => t.status === "ambiguous-pin-area").map((t) => t.salonName);

const BY_ID = new Map(TEST_SALON_LOCATIONS.map((t) => [t.salonId, t]));

const hasCoords = (row: { latitude?: unknown; longitude?: unknown }) =>
  typeof row.latitude === "number" &&
  Number.isFinite(row.latitude) &&
  typeof row.longitude === "number" &&
  Number.isFinite(row.longitude);

/**
 * Adds demo coordinates (with their provenance) to salons that have none.
 * Salons with real stored coordinates are returned unchanged.
 */
export function withTestLocations<T extends { id: string; latitude?: number | null; longitude?: number | null }>(
  rows: T[],
  enabled: boolean = TEST_LOCATIONS_ENABLED,
): (T & { locationDemo?: { status: DemoLocationStatus; basis: string } })[] {
  if (!enabled) return rows;
  return rows.map((row) => {
    const demo = BY_ID.get(row.id);
    if (!demo || hasCoords(row)) return row;
    return { ...row, latitude: demo.lat, longitude: demo.lng, locationDemo: { status: demo.status, basis: demo.basis } };
  });
}
