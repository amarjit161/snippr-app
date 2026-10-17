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
import { getCartoTileUrl, MAP_ATTRIBUTION } from "@/lib/mapConfig";
import { toMapPoints, type MapSalon, type SalonMapPoint } from "@/lib/salonMapPoints";
import type { MapView } from "@/lib/cityLocation";

const SalonMap = lazy(() => import("./SalonMap"));

export function MapNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
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
    console.error("SALON_MAP_ERROR", error);
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? <MapNotice>{MAP_FAILED}</MapNotice> : this.props.children;
  }
}

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
}

export default function SalonMapPanel({
  salons,
  selectedId,
  onSelect,
  userLocation,
  scrollWheelZoom,
  fallbackView,
  preview,
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
    // Developer hint only (never in production builds or tests): the usual local cause.
    if (tileStatus === "failed" && import.meta.env.DEV && import.meta.env.MODE !== "test") {
      console.warn(
        `Map tiles failed. CARTO refuses keys that aren't allowed for ${window.location.origin}: add it to the key's allowed domains in CARTO, or use a local dev key.`,
      );
    }
  }, [tileStatus]);

  if (!tileUrl) {
    return <MapNotice>The map isn't available right now. You can still browse and book salons from the list.</MapNotice>;
  }

  const unmapped = salons.length - points.length;

  return (
    <section aria-label="Salon map" className="relative isolate z-0 h-full w-full overflow-hidden rounded-2xl border border-border">
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
          />
        </Suspense>
      </MapErrorBoundary>

      {/* Notices sit top-left, clear of the zoom controls (top-right) and attribution (bottom-right). */}
      {crashed ? null : (
      <div
        aria-live="polite"
        className="pointer-events-none absolute left-3 right-[4.25rem] top-3 z-[1000] flex flex-col items-start gap-2"
      >
        {tileStatus === "loading" ? (
          <p role="status" className="rounded-lg bg-card/95 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            Loading map…
          </p>
        ) : null}
        {tileStatus === "failed" ? (
          <div role="status" className="pointer-events-auto flex max-w-sm flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-card/95 px-3 py-2 text-xs text-foreground shadow-sm">
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
        {points.length === 0 && salons.length > 0 ? (
          <p role="status" className="rounded-lg bg-card/95 px-3 py-2 text-xs text-foreground shadow-sm">
            None of these salons has a map location yet — they're all in the list.
          </p>
        ) : unmapped > 0 ? (
          <p className="rounded-lg bg-card/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
            {unmapped === 1 ? "1 salon isn't" : `${unmapped} salons aren't`} on the map yet — see the list.
          </p>
        ) : null}
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

      <p data-testid="map-attribution" className="absolute bottom-0 right-0 z-[1000] rounded-tl-md bg-card/90 px-2 py-0.5 text-[11px] text-foreground/80">
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
