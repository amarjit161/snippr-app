/**
 * Basemap configuration for the salon discovery map — the only place that reads
 * the CARTO key.
 *
 * CARTO basemaps (raster "Voyager" style), as documented at
 * https://www.carto.com/basemaps/apikey/ : one `key` query parameter on every
 * tile URL, and "© OpenStreetMap contributors, © CARTO" on every map.
 *
 * Two keys, chosen by Vite mode:
 *  - development (`npm run dev`): VITE_CARTO_DEV_API_KEY — allowed for local origins;
 *  - production builds: VITE_CARTO_API_KEY — restricted to app.snippr.in.
 * There is no fallback between them: a missing dev key fails loudly in development
 * instead of silently sending the production key from localhost (CARTO would refuse it).
 * Only the selected variable is referenced in each build, so a production bundle
 * never contains the development key.
 *
 * Keys are bundled into the browser JavaScript, so they are public by design; abuse
 * protection relies on CARTO-side domain restrictions, not secrecy.
 */
const CARTO_VOYAGER_TILES = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";

/** Required attribution, rendered visibly on the map. */
export const MAP_ATTRIBUTION = [
  { label: "OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright" },
  { label: "CARTO", href: "https://carto.com/attributions" },
] as const;

export const CARTO_DEV_KEY_VAR = "VITE_CARTO_DEV_API_KEY";
export const CARTO_PROD_KEY_VAR = "VITE_CARTO_API_KEY";

export interface CartoEnv {
  DEV?: boolean;
  VITE_CARTO_DEV_API_KEY?: unknown;
  VITE_CARTO_API_KEY?: unknown;
}

/**
 * The current build's values. Each branch reads only its own variable, and Vite
 * replaces `import.meta.env.DEV` with a constant, so the other branch is removed.
 */
function currentEnv(): CartoEnv {
  return import.meta.env.DEV
    ? { DEV: true, VITE_CARTO_DEV_API_KEY: import.meta.env.VITE_CARTO_DEV_API_KEY }
    : { DEV: false, VITE_CARTO_API_KEY: import.meta.env.VITE_CARTO_API_KEY };
}

/** Which variable supplies the key in this environment. */
export const cartoKeyVariable = (env: CartoEnv) => (env.DEV ? CARTO_DEV_KEY_VAR : CARTO_PROD_KEY_VAR);

let reportedMissingDevKey = false;

/**
 * The tile URL template with the key applied, or null when the key for this
 * environment is missing (the map then shows a fallback instead of failing tiles).
 */
export function getCartoTileUrl(env: CartoEnv = currentEnv()): string | null {
  const key = env.DEV ? env.VITE_CARTO_DEV_API_KEY : env.VITE_CARTO_API_KEY;
  if (typeof key !== "string" || key.trim() === "") {
    if (env.DEV && !reportedMissingDevKey) {
      reportedMissingDevKey = true;
      console.error(
        `[map] ${CARTO_DEV_KEY_VAR} is not set, so the map is disabled in development. ` +
          `Add it to .env.local and restart the dev server. (${CARTO_PROD_KEY_VAR} is used only by production builds.)`,
      );
    }
    return null;
  }
  return `${CARTO_VOYAGER_TILES}?key=${encodeURIComponent(key.trim())}`;
}
