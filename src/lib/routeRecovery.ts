/**
 * Smart URL Recovery — deterministic fuzzy matching of mistyped URLs against
 * the app's registered route patterns.
 *
 * Only ever invoked from the catch-all ("*") route, i.e. after React Router has
 * already decided the URL matches nothing. Valid routes never reach this code.
 *
 * Rules:
 *  - Only fully STATIC routes are fuzzy-matched. Routes with dynamic segments
 *    (":id", ":quickBookingCode") are never recovered — otherwise "/salons/x"
 *    would be read as salon ID "x". IDs/codes are never guessed or altered.
 *  - Segment count must match exactly (no adding/removing segments).
 *  - Each corrected segment must be within a length-scaled edit budget AND a
 *    minimum similarity ratio. Segments of 3 chars or fewer (e.g. "q") must
 *    match exactly.
 *  - The best candidate must be strictly better than every other distinct
 *    candidate; ties are treated as ambiguous and return null (→ 404).
 */
import type { RouteObject } from "react-router-dom";

/** Minimum per-segment similarity (1 - distance / longer length). */
export const MIN_SEGMENT_SIMILARITY = 0.7;

/** Max edits allowed for a static segment, scaled by the route segment length. */
export const maxEditsFor = (length: number): number => {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 8) return 2;
  return 3;
};

/**
 * Optimal string alignment distance (Levenshtein + adjacent transpositions),
 * so "tema" → "team" costs 1 rather than 2.
 */
export const editDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
};

const splitSegments = (path: string): string[] => path.split("/").filter(Boolean);

const joinPattern = (parent: string, path: string): string =>
  path.startsWith("/") ? path : `${parent.replace(/\/+$/, "")}/${path}`;

/**
 * Flattens a React Router route tree into full path patterns
 * (e.g. "/salons", "/salon/:id"). Layout routes contribute no segment;
 * splat/optional patterns are skipped since they can't be recovered safely.
 */
export const collectRoutePatterns = (routes: RouteObject[], parent = ""): string[] => {
  const patterns = new Set<string>();

  for (const route of routes) {
    const full = route.path ? joinPattern(parent, route.path) : parent;
    if (route.path && !full.includes("*") && !full.includes("?")) {
      patterns.add(full === "" ? "/" : full);
    }
    if (route.children?.length) {
      collectRoutePatterns(route.children, full).forEach((p) => patterns.add(p));
    }
  }

  return [...patterns];
};

interface Candidate {
  path: string;
  distance: number;
}

const scorePattern = (inputSegments: string[], pattern: string): Candidate | null => {
  const patternSegments = splitSegments(pattern);
  if (patternSegments.length !== inputSegments.length) return null;
  // Dynamic routes are excluded: any unmatched segment would be mistaken for an ID/code.
  if (patternSegments.some((s) => s.startsWith(":"))) return null;

  let distance = 0;
  const out: string[] = [];

  for (let i = 0; i < patternSegments.length; i++) {
    const target = patternSegments[i];
    const input = inputSegments[i];

    const a = input.toLowerCase();
    const b = target.toLowerCase();
    if (a !== b) {
      const d = editDistance(a, b);
      const similarity = 1 - d / Math.max(a.length, b.length);
      if (d > maxEditsFor(b.length) || similarity < MIN_SEGMENT_SIMILARITY) return null;
      distance += d;
    }
    out.push(target);
  }

  return { path: `/${out.join("/")}`, distance };
};

/**
 * Returns the single high-confidence recovered pathname for an unmatched
 * pathname, or null when there is no match or the match is ambiguous.
 * Never returns the input pathname itself (no redirect loops).
 */
export const recoverPathname = (pathname: string, patterns: string[]): string | null => {
  const inputSegments = splitSegments(pathname);
  if (inputSegments.length === 0) return null;

  // Keep the best distance per distinct resulting path.
  const best = new Map<string, number>();
  for (const pattern of patterns) {
    const candidate = scorePattern(inputSegments, pattern);
    if (!candidate) continue;
    const prev = best.get(candidate.path);
    if (prev === undefined || candidate.distance < prev) best.set(candidate.path, candidate.distance);
  }

  const ranked = [...best.entries()].sort((x, y) => x[1] - y[1]);
  if (ranked.length === 0) return null;
  if (ranked.length > 1 && ranked[1][1] <= ranked[0][1]) return null; // ambiguous — don't guess

  const [recovered] = ranked[0];
  return recovered === pathname ? null : recovered;
};
