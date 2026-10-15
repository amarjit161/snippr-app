/**
 * Post-login return paths.
 *
 * ProtectedRoute saves the page a signed-out visitor tried to open under
 * `localStorage.redirectAfterLogin`; sign-in flows send the user back there.
 * Anything that ends up in navigate() from storage or a `?next=` query param
 * must be a same-site relative path — never another origin, a dangerous scheme,
 * or a sign-in page (which would loop).
 *
 * Validation parses against a fixed dummy origin, so the browser's current
 * origin (www / app / localhost / preview) never influences the result.
 */

export const RETURN_PATH_STORAGE_KEY = "redirectAfterLogin";
export const DEFAULT_RETURN_PATH = "/salons";
/** Query param carrying the destination to the sign-in pages (e.g. from www.snippr.in to app.snippr.in). */
export const RETURN_PATH_PARAM = "next";

const VALIDATION_ORIGIN = "https://return-path.invalid";

// Control characters (incl. tab/newline, which URL parsing silently strips) and
// backslashes (which browsers treat as "/" in http(s) URLs, so "/\evil.com" can
// become "//evil.com") are rejected outright rather than normalised.
const hasForbiddenChars = (value: string): boolean => {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f || code === 0x5c /* \ */) return true;
  }
  return false;
};

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** Sign-in pages: returning to them after signing in would loop. Case-insensitive, like the router. */
export function isAuthLoopPath(pathname: string): boolean {
  const normalized = safeDecode(pathname).toLowerCase().replace(/\/+$/, "") || "/";
  return normalized === "/login" || normalized === "/auth" || normalized.startsWith("/auth/");
}

/**
 * The value as a safe same-origin relative path (pathname + query + hash),
 * or null when it is missing, external, malformed or a sign-in page.
 */
export function sanitizeReturnPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();

  if (!candidate.startsWith("/")) return null; // absolute URLs, "javascript:", relative paths
  if (candidate.startsWith("//")) return null; // protocol-relative: //evil.com
  if (hasForbiddenChars(candidate)) return null;

  let url: URL;
  try {
    url = new URL(candidate, VALIDATION_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== VALIDATION_ORIGIN) return null;
  if (isAuthLoopPath(url.pathname)) return null;

  return `${url.pathname}${url.search}${url.hash}`;
}

export function isSafeReturnPath(value: unknown): boolean {
  return sanitizeReturnPath(value) !== null;
}

/** Safe path for navigate(): the sanitised value, or the fallback (default /salons). */
export function resolveReturnPath(value: unknown, fallback: string = DEFAULT_RETURN_PATH): string {
  return sanitizeReturnPath(value) ?? fallback;
}

const getStorage = (): Storage | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // storage blocked (privacy mode, sandboxed iframe)
  }
};

/** Read the saved return path without clearing it. Null when absent or unsafe. */
export function readStoredReturnPath(): string | null {
  try {
    return sanitizeReturnPath(getStorage()?.getItem(RETURN_PATH_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * A sign-in page path carrying the destination as `?next=`. The destination is
 * validated first; an unsafe or missing one is simply left off.
 */
export function withReturnPath(authPath: string, destination: unknown): string {
  const safe = sanitizeReturnPath(destination);
  return safe ? `${authPath}?${RETURN_PATH_PARAM}=${encodeURIComponent(safe)}` : authPath;
}

/**
 * The validated `?next=` destination in a sign-in page's query string, also
 * saved as the return path so every sign-in method on this origin (email,
 * Google, phone OTP, profile completion) honours it. Null when absent or unsafe.
 */
export function rememberReturnPathFromQuery(search: string): string | null {
  const safe = sanitizeReturnPath(new URLSearchParams(search).get(RETURN_PATH_PARAM));
  if (safe) {
    try {
      getStorage()?.setItem(RETURN_PATH_STORAGE_KEY, safe);
    } catch {
      // storage blocked — callers still get the value directly
    }
  }
  return safe;
}

/**
 * Read and clear the saved return path, for the moment the user actually
 * navigates to their destination. Always clears the key (an unsafe or stale
 * value must not linger); returns the safe path or the fallback.
 */
export function consumeStoredReturnPath(fallback: string = DEFAULT_RETURN_PATH): string {
  const storage = getStorage();
  let raw: string | null = null;
  try {
    raw = storage?.getItem(RETURN_PATH_STORAGE_KEY) ?? null;
    storage?.removeItem(RETURN_PATH_STORAGE_KEY);
  } catch {
    // ignore storage errors — fall back below
  }
  return resolveReturnPath(raw, fallback);
}
