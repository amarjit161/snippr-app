/**
 * Marketing / app domain separation.
 *
 *   www.snippr.in  — marketing pages only (MARKETING_PATHS)
 *   app.snippr.in  — the booking product (every other route)
 *
 * The split is OFF unless VITE_APP_ORIGIN is set at build time. With it unset
 * (local dev, Vercel previews, or production before app.snippr.in is live) every
 * host is "combined" and serves all routes exactly as before.
 *
 * This module must stay free of Supabase/React imports: main.tsx calls
 * getAppHostRedirect() BEFORE the Supabase client is created, so auth tokens in
 * the URL hash are forwarded to the app host instead of being consumed (and the
 * session stored) on the marketing host's localStorage.
 */

const originOf = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export const APP_ORIGIN = originOf(import.meta.env.VITE_APP_ORIGIN);
export const MARKETING_ORIGIN = originOf(import.meta.env.VITE_MARKETING_ORIGIN) ?? "https://www.snippr.in";

const MARKETING_HOSTS = new Set(["www.snippr.in", "snippr.in", new URL(MARKETING_ORIGIN).host]);

/** Routes that stay on the marketing host. Everything else belongs to the app. */
export const MARKETING_PATHS = ["/", "/how-it-works", "/careers", "/support", "/privacy"] as const;

export type HostRole = "marketing" | "app" | "combined";

type LocationLike = Pick<Location, "origin" | "host" | "pathname" | "search" | "hash">;

export function getHostRole(loc: LocationLike = window.location): HostRole {
  if (!APP_ORIGIN || APP_ORIGIN === MARKETING_ORIGIN) return "combined";
  if (loc.origin === APP_ORIGIN) return "app";
  if (MARKETING_HOSTS.has(loc.host)) return "marketing";
  return "combined";
}

export const isMarketingPath = (pathname: string): boolean => {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return (MARKETING_PATHS as readonly string[]).includes(normalized.toLowerCase());
};

/**
 * Supabase email links (magic link, signup confirm, password recovery) and their
 * error variants. Implicit flow puts tokens in the hash; token_hash/code variants
 * use the query string.
 */
export function hasAuthPayload(search: string, hash: string): boolean {
  const h = new URLSearchParams(hash.replace(/^#/, ""));
  const q = new URLSearchParams(search);
  return Boolean(
    h.get("access_token") || h.get("error_code") || h.get("error") ||
    q.get("code") || q.get("token_hash") || q.get("error_code"),
  );
}

/**
 * Where a root-level auth link should continue. Shared by the marketing
 * homepage and the app-host "/" route so both handle Supabase's Site URL
 * fallback identically. Returns null when the URL carries no recovery/error payload.
 */
export function resolveRootAuthTarget(search: string, hash: string): string | null {
  const h = new URLSearchParams(hash.replace(/^#/, ""));
  const q = new URLSearchParams(search);

  // Expired reset links can land on site root with hash errors only.
  // Send users directly to reset page where OTP code fallback is available.
  if (h.get("error_code") === "otp_expired" || h.get("error") === "access_denied") {
    return "/reset-password?expired=1";
  }

  const isRecovery = h.get("type") === "recovery" || q.get("type") === "recovery";
  const hasRecoveryPayload =
    Boolean(h.get("access_token") && h.get("refresh_token")) ||
    Boolean(q.get("token_hash")) ||
    Boolean(q.get("code"));

  if (isRecovery && hasRecoveryPayload) return `/auth/callback${search}${hash}`;
  return null;
}

/**
 * Absolute app-host URL to send this marketing-host request to, or null to stay.
 * Path, query and hash are always preserved, so printed QR codes
 * (www.snippr.in/q/<code>) and in-flight email links keep working.
 */
export function getAppHostRedirect(loc: LocationLike = window.location): string | null {
  if (getHostRole(loc) !== "marketing" || !APP_ORIGIN) return null;

  if (!isMarketingPath(loc.pathname)) {
    return `${APP_ORIGIN}${loc.pathname}${loc.search}${loc.hash}`;
  }

  // Auth links that fell back to the Site URL root: finish signing in on the app
  // host, where the session is actually used.
  if (loc.pathname === "/" && hasAuthPayload(loc.search, loc.hash)) {
    const target = resolveRootAuthTarget(loc.search, loc.hash) ?? `/${loc.search}${loc.hash}`;
    return `${APP_ORIGIN}${target}`;
  }

  return null;
}

/** Link to an app route: absolute on the marketing host, relative everywhere else. */
export const appHref = (path: string): string =>
  getHostRole() === "marketing" && APP_ORIGIN ? `${APP_ORIGIN}${path}` : path;

/** Link to a marketing route: absolute on the app host, relative everywhere else. */
export const marketingHref = (path: string): string =>
  getHostRole() === "app" ? `${MARKETING_ORIGIN}${path}` : path;

/** Public origin that owns app pages (salon discovery) for canonical URLs. */
export const appCanonicalOrigin = (): string => APP_ORIGIN ?? MARKETING_ORIGIN;
