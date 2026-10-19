/**
 * When the demo salon coordinates (src/dev/testSalonLocations.ts) may be used.
 *
 * - Local development server: always (as before).
 * - A deployed build: only when it was built with VITE_DEMO_SALON_LOCATIONS=true —
 *   meant for the Vercel *Preview* environment only. vite.config.ts bakes the flag in
 *   as a constant and forces it off for Vercel Production builds (VERCEL_ENV), so an
 *   ordinary build drops the fixture entirely.
 * - Never on the production domains, whatever the build says (a runtime backstop).
 *
 * The coordinates are never written anywhere; they only decorate the fetched list in
 * the browser, and the UI labels them as demo/test locations.
 */

/**
 * Whether the flag says "true". Tolerant of how dashboards store values (case,
 * surrounding spaces or quotes) but still an explicit yes — "1", "yes" etc. are no.
 */
export const isDemoFlagOn = (flag: string | undefined) =>
  (flag ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim().toLowerCase() === "true";

/**
 * The build-time decision (used by vite.config.ts) and a one-line reason for the
 * build log: demo locations only when the build explicitly asks for them, and never in
 * a Vercel Production build. Contains no secrets (the flag and VERCEL_ENV only).
 */
export function describeDemoBuild(flag: string | undefined, vercelEnv: string | undefined): { enabled: boolean; reason: string } {
  const env = vercelEnv ? `VERCEL_ENV=${vercelEnv}` : "VERCEL_ENV not set";
  if (!isDemoFlagOn(flag)) {
    return { enabled: false, reason: `OFF — VITE_DEMO_SALON_LOCATIONS is ${flag === undefined ? "not set" : "not \"true\""} for this build (${env})` };
  }
  if (vercelEnv === "production") {
    return { enabled: false, reason: "OFF — Vercel Production build (the flag is ignored in Production)" };
  }
  return { enabled: true, reason: `ON — VITE_DEMO_SALON_LOCATIONS=true (${env}); never applied on production domains` };
}

export function demoSalonLocationsForBuild(flag: string | undefined, vercelEnv: string | undefined): boolean {
  return describeDemoBuild(flag, vercelEnv).enabled;
}

let reportedDemoRows = false;

/**
 * Runtime note, once per page load, when demo coordinates are in use: how many of the
 * listed salons got one (salons outside the fixture get none). Returns the rows as-is.
 */
export function reportDemoLocations<T extends { locationDemo?: unknown }>(rows: T[]): T[] {
  if (!reportedDemoRows) {
    reportedDemoRows = true;
    const withDemo = rows.filter((row) => row.locationDemo).length;
    console.info(`[map] Demo salon locations are on: ${withDemo} of ${rows.length} salons use test coordinates (not real locations).`);
  }
  return rows;
}

/** Production hostnames: demo locations are never applied here. */
export const PRODUCTION_HOSTS: readonly string[] = ["app.snippr.in", "snippr.in", "www.snippr.in"];

export const isProductionHost = (hostname: string) => PRODUCTION_HOSTS.includes(hostname.trim().toLowerCase());

/** Why demo locations are active ("dev" server or explicit "demo-build"), or null. */
export function demoLocationMode({
  devServer,
  demoBuild,
  hostname,
}: {
  devServer: boolean;
  demoBuild: boolean;
  hostname: string;
}): "dev" | "demo-build" | null {
  if (devServer) return "dev";
  if (demoBuild && !isProductionHost(hostname)) return "demo-build";
  return null;
}
