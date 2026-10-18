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
 * The build-time decision (used by vite.config.ts): demo locations only when the build
 * explicitly asks for them, and never in a Vercel Production build.
 */
export function demoSalonLocationsForBuild(flag: string | undefined, vercelEnv: string | undefined): boolean {
  return flag === "true" && vercelEnv !== "production";
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
