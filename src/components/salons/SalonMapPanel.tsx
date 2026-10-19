/**
 * Salon map panel for /salons. Shows the CARTO basemap whenever a key is
 * configured — also when no salon has a location yet (then framed on the user's
 * shared position, the chosen city or India, with a short note). Wraps the lazy
 * Leaflet map in a loading skeleton, an error boundary, tile loading / failure
 * notices with Retry, and the required attribution. Nothing here can break the
 * salon list — every failure ends in a short message and the list keeps working.
 */
import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { MapPin, X } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { CARTO_DEV_KEY_VAR, cartoKeyVariable, getCartoTileUrl, MAP_ATTRIBUTION, redactMapKey } from "@/lib/mapConfig";
import { toMapPoints, type MapSalon, type SalonMapPoint } from "@/lib/salonMapPoints";
import type { MapView } from "@/lib/cityLocation";

const SalonMap = lazy(() => import("./SalonMap"));

/**
 * A full-panel notice. `status` is exposed as data-map-status (with the expected key
 * variable, when relevant) so the cause can be read in DevTools — no values.
 */
export function MapNotice({ children, status, keyVar }: { children: ReactNode; status?: string; keyVar?: string }) {
  return (
    <div
      role="status"
      data-map-status={status}
      data-map-key-var={keyVar}
      className="flex h-full min-h-48 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-muted/50 p-6 text-center"
    >
      <MapPin className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

const MAP_FAILED = "The map couldn't load. You can still browse and book salons from the list.";

class MapErrorBoundary extends Component<{ children: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // The map library's own error, distinct from a missing key or refused tiles; any
    // key in the text is hidden.
    const e = error as { name?: unknown; message?: unknown } | null;
    const name = typeof e?.name === "string" ? e.name : "Error";
    const message = redactMapKey(typeof e?.message === "string" ? e.message : String(error));
    console.error(`[map] SALON_MAP_ERROR: the map failed to start (${name}): ${message}`);
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? <MapNotice status="init-failed">{MAP_FAILED}</MapNotice> : this.props.children;
  }
}

/**
 * The map's own identity: a compact "Snippr Maps" badge, top-left. Marked
 * data-map-avoid so salon labels keep clear of it. It names Snippr's map feature
 * only — the map data credit stays in the attribution (OpenStreetMap, CARTO).
 */
export function MapBrand() {
  return (
    <div
      data-testid="map-brand"
      data-map-avoid
      className="flex items-center gap-2 rounded-xl border border-black/[0.06] bg-white/90 py-1 pl-1 pr-2.5 shadow-[0_1px_2px_rgba(17,24,39,0.06),0_4px_12px_-4px_rgba(76,29,149,0.25)] backdrop-blur-sm"
    >
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-violet-800 text-white shadow-sm"
      >
        <MapPin className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
      <span className="flex flex-col">
        <span className="whitespace-nowrap font-display text-[13px] font-semibold leading-4 tracking-[-0.01em] text-zinc-900">
          Snippr <span className="text-primary">Maps</span>
        </span>
        {/* Desktop only: on a phone every pixel of map counts. */}
        <span className="hidden whitespace-nowrap text-[10px] font-medium leading-3 text-zinc-500 sm:block">Explore nearby salons</span>
      </span>
    </div>
  );
}

/** Small white notes over the (always light) map, in any app theme. */
const NOTE = "rounded-lg border border-black/[0.06] bg-white/95 shadow-sm backdrop-blur-sm";

export function MapSkeleton() {
  return <div data-testid="map-skeleton" aria-hidden="true" className="h-full min-h-48 w-full animate-pulse rounded-2xl bg-muted" />;
}

interface SalonMapPanelProps {
  salons: readonly MapSalon[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The page's existing geolocation result (never requested here). */
  userLocation: { lat: number; lng: number } | null;
  /** Desktop allows scroll-wheel zoom; on touch/mobile it would trap page scrolling. */
  scrollWheelZoom: boolean;
  /** Where to look when no salon has a location. */
  fallbackView: MapView;
  /** The selected salon's compact preview, shown over the bottom of the map. */
  preview?: ReactNode;
  /** Name the missing key variable in the "map isn't available" notice (development server only). */
  showKeyHint?: boolean;
  /** "Show my location": asks the page for the device position (see SalonMap). */
  onLocate?: () => void;
  locating?: boolean;
  /** Centre on the customer once their position is available (the page asks; the map reports back). */
  centreOnUser?: boolean;
  onCentred?: () => void;
  /** A short note about the customer's location (e.g. permission blocked), shown over the map. */
  locationMessage?: string | null;
  onDismissLocationMessage?: () => void;
}

export default function SalonMapPanel({
  salons,
  selectedId,
  onSelect,
  userLocation,
  scrollWheelZoom,
  fallbackView,
  preview,
  showKeyHint = import.meta.env.DEV && import.meta.env.MODE !== "test",
  onLocate,
  locating,
  centreOnUser,
  onCentred,
  locationMessage,
  onDismissLocationMessage,
}: SalonMapPanelProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const [tileStatus, setTileStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const [tileAttempt, setTileAttempt] = useState(0);
  // Once the map itself has failed, only the boundary's message is shown.
  const [crashed, setCrashed] = useState(false);
  const tileUrl = getCartoTileUrl();
  const points = toMapPoints(salons);
  // Salons at exactly the same position, offered as a list (they can't be separated on the map).
  const [stackIds, setStackIds] = useState<string[] | null>(null);
  const stack = (stackIds ?? []).map((id) => points.find((p) => p.id === id)).filter((p): p is SalonMapPoint => !!p);

  useEffect(() => {
    // Diagnostic hint in every build (no key value): the usual cause is a key whose
    // CARTO allowed domains don't include this origin — the Network tab shows 403s.
    if (tileStatus === "failed") {
      console.warn(
        `[map] Map tiles failed to load on ${window.location.origin}. If the tile requests return 403, this origin isn't in the CARTO key's allowed domains.`,
      );
    }
  }, [tileStatus]);

  if (!tileUrl) {
    return (
      <MapNotice status="missing-key" keyVar={cartoKeyVariable({ DEV: import.meta.env.DEV })}>
        The map isn't available right now. You can still browse and book salons from the list.
        {/* import.meta.env.DEV is a build-time constant, so production bundles drop this branch entirely. */}
        {import.meta.env.DEV && showKeyHint ? (
          // Development only (never in production builds): which variable is missing — never a value.
          <span data-testid="map-key-hint" className="mt-2 block text-xs">
            Dev: {CARTO_DEV_KEY_VAR} isn't set for this dev server. Add it to .env.local, then restart the dev server.
          </span>
        ) : null}
      </MapNotice>
    );
  }

  const unmapped = salons.length - points.length;

  return (
    <section
      aria-label="Salon map"
      // loading → loaded | tiles-failed (tiles refused or unreachable — see the Network tab).
      data-map-status={tileStatus === "failed" ? "tiles-failed" : tileStatus}
      data-map-root
      // A crisp hairline frame and a soft, faintly purple lift: the map reads as part of the page.
      className="relative isolate z-0 h-full w-full overflow-hidden rounded-2xl border border-black/[0.08] bg-[#f2efe9] shadow-[0_1px_2px_rgba(17,24,39,0.05),0_16px_36px_-16px_rgba(76,29,149,0.28)]"
    >
      <MapErrorBoundary onError={() => setCrashed(true)}>
        <Suspense fallback={<MapSkeleton />}>
          <SalonMap
            points={points}
            selectedId={selectedId}
            onSelect={onSelect}
            tileUrl={tileUrl}
            userLocation={userLocation}
            reducedMotion={reducedMotion}
            scrollWheelZoom={scrollWheelZoom}
            fallbackView={fallbackView}
            tileAttempt={tileAttempt}
            onTileStatus={setTileStatus}
            onStack={setStackIds}
            onLocate={onLocate}
            locating={locating}
            centreOnUser={centreOnUser}
            onCentred={onCentred}
          />
        </Suspense>
      </MapErrorBoundary>

      {/* The Snippr Maps badge and notices sit top-left, clear of the zoom controls (top-right) and attribution (bottom-right). */}
      {crashed ? null : (
      <div className="pointer-events-none absolute left-3 right-[4.25rem] top-3 z-[1000] flex flex-col items-start gap-2">
      <MapBrand />
      <div aria-live="polite" className="flex flex-col items-start gap-2">
        {tileStatus === "loading" ? (
          <p role="status" data-map-avoid className={`${NOTE} px-3 py-1.5 text-xs font-medium text-zinc-500`}>
            Loading map…
          </p>
        ) : null}
        {tileStatus === "failed" ? (
          <div role="status" data-map-avoid className={`${NOTE} pointer-events-auto flex max-w-sm flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs text-zinc-900`}>
            <span>Map tiles couldn't load. The list still has every salon.</span>
            <button
              type="button"
              onClick={() => {
                setTileStatus("loading");
                setTileAttempt((n) => n + 1);
              }}
              className="min-h-8 rounded-md px-2 font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Retry
            </button>
          </div>
        ) : null}
        {locationMessage ? (
          <div
            role="status"
            data-testid="map-location-message"
            data-map-avoid
            className={`${NOTE} pointer-events-auto flex max-w-sm items-start gap-1 py-1.5 pl-3 pr-1 text-xs leading-relaxed text-zinc-900`}
          >
            <span className="py-0.5">{locationMessage}</span>
            {onDismissLocationMessage ? (
              <button
                type="button"
                aria-label="Dismiss location message"
                onClick={onDismissLocationMessage}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}
        {points.length === 0 && salons.length > 0 ? (
          <p role="status" data-map-avoid className={`${NOTE} px-3 py-2 text-xs text-zinc-900`}>
            None of these salons has a map location yet — they're all in the list.
          </p>
        ) : unmapped > 0 ? (
          <p data-map-avoid className={`${NOTE} px-3 py-1.5 text-xs text-zinc-600`}>
            {unmapped === 1 ? "1 salon isn't" : `${unmapped} salons aren't`} on the map yet — see the list.
          </p>
        ) : null}
      </div>
      </div>
      )}

      {/* Bottom overlays sit above the attribution (bottom-right), clear of the zoom controls (top-right). */}
      {crashed ? null : stack.length > 1 ? (
        <div
          role="group"
          aria-label="Salons at the same spot"
          className="absolute inset-x-3 bottom-8 z-[1000] rounded-xl border border-border bg-card p-3 text-foreground shadow-lg sm:right-auto sm:w-[22rem]"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{stack.length} salons at the same spot</p>
            <button
              type="button"
              aria-label="Close list"
              onClick={() => setStackIds(null)}
              className="-mr-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <ul className="mt-1">
            {stack.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setStackIds(null);
                    onSelect(p.id);
                  }}
                  className="flex min-h-11 w-full items-center rounded-lg px-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : preview ? (
        <div className="absolute inset-x-3 bottom-8 z-[1000] sm:right-auto sm:w-[22rem]">{preview}</div>
      ) : null}

      {/* Required data credit: always visible, small but legible, on its own light surface. */}
      <p
        data-testid="map-attribution"
        className="absolute bottom-0 right-0 z-[1000] rounded-tl-lg border-l border-t border-black/[0.06] bg-white/90 px-2 py-0.5 text-[11px] text-zinc-600 backdrop-blur-sm"
      >
        {MAP_ATTRIBUTION.map((item, i) => (
          <span key={item.href}>
            {i > 0 ? ", " : ""}©{" "}
            <a href={item.href} target="_blank" rel="noopener noreferrer" className="underline">
              {item.label}
            </a>
          </span>
        ))}
      </p>
    </section>
  );
}
