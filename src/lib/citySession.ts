/**
 * /salons city for the current browser tab session, and the "try to detect the
 * city once" guard.
 *
 * Only the city itself is kept (a name, or the place name returned by the city
 * lookup) — never coordinates — and only in sessionStorage, so it is gone when
 * the tab closes. Nothing here is sent to the database.
 */
import type { ResolvedPlace } from "@/lib/cityLocation";

export type SessionCityChoice = { source: "manual"; name: string } | { source: "detected"; place: ResolvedPlace };

const CHOICE_KEY = "snippr:salons:city";
const AUTO_DETECT_KEY = "snippr:salons:city-auto-detect";

// Also kept in memory, so the guard holds when sessionStorage is unavailable
// (private modes, blocked storage) for as long as the app stays loaded.
let autoDetectAttemptedInMemory = false;

const str = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function isPlace(v: unknown): v is ResolvedPlace {
  const p = v as Partial<ResolvedPlace> | null;
  return (
    !!p &&
    str(p.city) &&
    (p.country === null || typeof p.country === "string") &&
    Array.isArray(p.candidates) &&
    p.candidates.every((c) => typeof c === "string")
  );
}

/** The city chosen or detected earlier in this tab session, or null. */
export function readSessionCity(): SessionCityChoice | null {
  try {
    const raw = window.sessionStorage.getItem(CHOICE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SessionCityChoice>;
    if (v?.source === "manual" && str((v as { name?: unknown }).name)) return { source: "manual", name: (v as { name: string }).name };
    if (v?.source === "detected" && isPlace((v as { place?: unknown }).place)) {
      const { city, country, candidates } = (v as { place: ResolvedPlace }).place;
      return { source: "detected", place: { city, country, candidates } }; // city names only
    }
  } catch {
    /* unavailable or malformed: no remembered city */
  }
  return null;
}

/** Remembers (or clears) the city for this tab session. */
export function writeSessionCity(choice: SessionCityChoice | null) {
  try {
    if (!choice) window.sessionStorage.removeItem(CHOICE_KEY);
    else if (choice.source === "manual") window.sessionStorage.setItem(CHOICE_KEY, JSON.stringify({ source: "manual", name: choice.name }));
    else {
      const { city, country, candidates } = choice.place;
      window.sessionStorage.setItem(CHOICE_KEY, JSON.stringify({ source: "detected", place: { city, country, candidates } }));
    }
  } catch {
    /* ignore: the choice still applies while the page is open */
  }
}

/** Whether the automatic detection already ran (whatever its outcome) in this session. */
export function cityAutoDetectAttempted(): boolean {
  if (autoDetectAttemptedInMemory) return true;
  try {
    return window.sessionStorage.getItem(AUTO_DETECT_KEY) === "1";
  } catch {
    return false;
  }
}

export function markCityAutoDetectAttempted() {
  autoDetectAttemptedInMemory = true;
  try {
    window.sessionStorage.setItem(AUTO_DETECT_KEY, "1");
  } catch {
    /* the in-memory flag still applies */
  }
}

/** Test hook: forget the session city and the auto-detect guard. */
export function resetCitySession() {
  autoDetectAttemptedInMemory = false;
  try {
    window.sessionStorage.removeItem(CHOICE_KEY);
    window.sessionStorage.removeItem(AUTO_DETECT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Whether asking for the device position can work here, without asking:
 * "unsupported" (no Geolocation API), "insecure" (not https — browsers refuse),
 * or the Permissions API state ("granted" | "prompt" | "denied"), or "unknown"
 * when the browser doesn't expose permission state (e.g. older Safari).
 */
export type GeolocationAvailability = "unsupported" | "insecure" | "granted" | "prompt" | "denied" | "unknown";

export async function geolocationAvailability(): Promise<GeolocationAvailability> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "unsupported";
  if (typeof window !== "undefined" && window.isSecureContext === false) return "insecure";
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    if (status && (status.state === "granted" || status.state === "prompt" || status.state === "denied")) return status.state;
  } catch {
    /* Permissions API missing or doesn't know "geolocation" */
  }
  return "unknown";
}
