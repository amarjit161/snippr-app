/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** CARTO basemap key for production builds (see src/lib/mapConfig.ts). */
  readonly VITE_CARTO_API_KEY?: string;
  /** CARTO basemap key for the development server only. */
  readonly VITE_CARTO_DEV_API_KEY?: string;
  /** "true" once the salon location-confirmation columns exist (see src/lib/salonLocation.ts). */
  readonly VITE_FLAG_SALON_LOCATION_CONFIRMATION?: string;
  /** "true" only in builds made for demo testing (Vercel Preview); see src/lib/demoLocations.ts. */
  readonly VITE_DEMO_SALON_LOCATIONS?: string;
}

