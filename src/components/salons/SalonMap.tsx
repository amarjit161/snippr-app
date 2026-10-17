/**
 * The Leaflet map for /salons. Lazy-loaded by SalonMapPanel (Leaflet and its CSS
 * stay out of the initial bundle). It receives already-validated points, a
 * fallback view (device position, chosen city or India) and the user's position
 * from the page; it never asks the browser for location itself.
 *
 * Markers that would overlap on screen at the current zoom are drawn as one
 * group badge (see lib/mapOverlap): positions are never moved. Clicking a badge
 * zooms in until they separate; salons sharing exactly one position are listed
 * instead (onStack). The selected salon always keeps its own marker.
 *
 * Motion uses Leaflet's native features only (zoom/fade/marker animation,
 * inertia, flyTo); Leaflet itself skips zoom animation where the browser lacks
 * CSS transform support. With reduced motion every view change is instant.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { LocateFixed, Minus, Plus } from "lucide-react";
import type { SalonMapPoint } from "@/lib/salonMapPoints";
import type { MapView } from "@/lib/cityLocation";
import { groupOverlapping, groupCentre, sharesOnePosition } from "@/lib/mapOverlap";

export interface SalonMapProps {
  points: SalonMapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  tileUrl: string;
  userLocation: { lat: number; lng: number } | null;
  reducedMotion: boolean;
  scrollWheelZoom: boolean;
  /** Where to look when no salon has a location (device position, city centre or India). */
  fallbackView: MapView;
  /** Changing this remounts the tile layer (a manual "Retry"). */
  tileAttempt?: number;
  /** "loaded" on the first tile; "failed" when tiles keep failing and none has loaded. */
  onTileStatus: (status: "loaded" | "failed") => void;
  /** Salons at exactly the same position (no zoom can separate them): show them as a list. */
  onStack?: (ids: string[]) => void;
}

/** Tile failures (with no successful tile) before the page shows the tile fallback. */
export const TILE_ERROR_THRESHOLD = 4;
export const MIN_ZOOM = 4;
export const MAX_ZOOM = 19;
const SINGLE_SALON_ZOOM = 15;

// One shared icon; selection is shown by toggling a class on the marker element
// (not by swapping icons) so a keyboard user's focus stays on the marker.
// The visible dot is 24px; the marker element (the tap target) is 40px around it.
const MARKER_HIT = 40;
const salonIcon = L.divIcon({
  className:
    "group flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary",
  html: '<span aria-hidden="true" class="block h-6 w-6 rounded-full border-2 border-white bg-primary shadow-md motion-safe:transition-transform group-[.is-selected]:scale-125 group-[.is-selected]:bg-accent"></span>',
  iconSize: [MARKER_HIT, MARKER_HIT],
  iconAnchor: [MARKER_HIT / 2, MARKER_HIT / 2],
});

// Approximate (test) locations: a hollow, dashed pin so they never read as exact.
const approxIcon = L.divIcon({
  className:
    "group flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary",
  html: '<span aria-hidden="true" class="block h-6 w-6 rounded-full border-2 border-dashed border-primary bg-white/85 shadow-md motion-safe:transition-transform group-[.is-selected]:scale-125 group-[.is-selected]:bg-accent/30"></span>',
  iconSize: [MARKER_HIT, MARKER_HIT],
  iconAnchor: [MARKER_HIT / 2, MARKER_HIT / 2],
});

// A group of overlapping salons: a dark count badge, clearly not a single salon.
const groupIcons = new Map<number, L.DivIcon>();
const groupIcon = (count: number) => {
  let icon = groupIcons.get(count);
  if (!icon) {
    icon = L.divIcon({
      // A 32px badge inside a 44px tap target.
      className:
        "group flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary",
      html: `<span aria-hidden="true" class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#0b0b10] font-mono text-xs font-semibold text-white shadow-md ring-4 ring-primary/30">${count}</span>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
    groupIcons.set(count, icon);
  }
  return icon;
};

// The user's own position (from the page's opt-in request): a plain,
// non-interactive dot. A divIcon rather than an SVG circle needs no vector renderer.
const userIcon = L.divIcon({
  className: "snippr-user-location",
  html: '<span aria-hidden="true" class="block h-full w-full rounded-full border-2 border-white bg-blue-600 shadow-md"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** Shows every salon marker, or the fallback view when there are none. */
function useShowAll(points: SalonMapPoint[], fallbackView: MapView, animate: boolean) {
  const map = useMap();
  return useCallback(
    (smooth: boolean) => {
      const fly = smooth && animate;
      if (points.length === 0) {
        if (fly) map.flyTo(fallbackView.center, fallbackView.zoom, { duration: 0.8 });
        else map.setView(fallbackView.center, fallbackView.zoom, { animate: false });
      } else if (points.length === 1) {
        if (fly) map.flyTo(points[0].position, SINGLE_SALON_ZOOM, { duration: 0.8 });
        else map.setView(points[0].position, SINGLE_SALON_ZOOM, { animate: false });
      } else {
        const bounds = L.latLngBounds(points.map((p) => p.position));
        // Keep markers clear of the notes (top-left, up to two lines) and the zoom controls (right).
        const options = {
          paddingTopLeft: [32, 104] as [number, number],
          paddingBottomRight: [76, 40] as [number, number],
          maxZoom: SINGLE_SALON_ZOOM,
        };
        if (fly) map.flyToBounds(bounds, { ...options, duration: 0.8 });
        else map.fitBounds(bounds, { ...options, animate: false });
      }
    },
    [map, points, fallbackView, animate],
  );
}

/** Frames the markers (or fallback) on first show and whenever they change. */
function FrameView({ points, fallbackView, animate }: { points: SalonMapPoint[]; fallbackView: MapView; animate: boolean }) {
  const showAll = useShowAll(points, fallbackView, animate);
  const first = useRef(true);
  const key =
    points.map((p) => `${p.id}@${p.position.join(",")}`).join("|") + `#${fallbackView.center.join(",")}@${fallbackView.zoom}`;
  useEffect(() => {
    showAll(!first.current); // no fly-in on first paint; smooth afterwards
    first.current = false;
    // `key` captures every change that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

/** Brings the selected marker into view if it is off-screen. */
function KeepSelectedInView({ point, animate }: { point: SalonMapPoint | undefined; animate: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!point || map.getBounds().contains(point.position)) return;
    if (animate) map.flyTo(point.position, Math.max(map.getZoom(), 13), { duration: 0.6 });
    else map.setView(point.position, Math.max(map.getZoom(), 13), { animate: false });
  }, [map, point, animate]);
  return null;
}

/** Keeps Leaflet's size in step with its container (tab switch, resize, rotation). */
function TrackContainerSize() {
  const map = useMap();
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/** Zoom in / out / re-centre: 44px, labelled, keyboard-focusable controls. */
function ZoomControls({ points, fallbackView, animate }: { points: SalonMapPoint[]; fallbackView: MapView; animate: boolean }) {
  const map = useMap();
  const showAll = useShowAll(points, fallbackView, animate);
  const ref = useRef<HTMLDivElement>(null);
  const zoom = useMapZoom();

  useEffect(() => {
    // Clicks and wheel on the controls must not reach the map underneath.
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current);
      L.DomEvent.disableScrollPropagation(ref.current);
    }
  }, []);

  const button =
    "flex h-11 w-11 items-center justify-center bg-card text-foreground transition-colors hover:bg-muted focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:text-muted-foreground/50";
  return (
    <div ref={ref} className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
      <div role="group" aria-label="Zoom" className="flex flex-col overflow-hidden rounded-xl border border-border shadow-md">
        <button
          type="button"
          aria-label="Zoom in"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => map.zoomIn(1, { animate })}
          className={`${button} border-b border-border`}
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" aria-label="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => map.zoomOut(1, { animate })} className={button}>
          <Minus className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        aria-label={points.length > 0 ? "Show all salons on the map" : "Back to the starting view"}
        onClick={() => showAll(true)}
        className={`${button} rounded-xl border border-border shadow-md`}
      >
        <LocateFixed className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Reports the first loaded tile, or repeated failures with nothing loaded. */
function TileEvents({ tileUrl, onTileStatus }: { tileUrl: string; onTileStatus: (s: "loaded" | "failed") => void }) {
  const tiles = useRef({ errors: 0, loaded: false, reported: false });
  return (
    <TileLayer
      url={tileUrl}
      maxZoom={MAX_ZOOM}
      eventHandlers={{
        tileload: () => {
          if (!tiles.current.loaded) {
            tiles.current.loaded = true;
            onTileStatus("loaded");
          }
        },
        tileerror: () => {
          const t = tiles.current;
          t.errors += 1;
          if (!t.reported && !t.loaded && t.errors >= TILE_ERROR_THRESHOLD) {
            t.reported = true;
            onTileStatus("failed");
          }
        },
      }}
    />
  );
}

/** The map's current zoom, updated after every zoom change. */
function useMapZoom() {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useEffect(() => {
    const update = () => setZoom(map.getZoom());
    map.on("zoomend", update);
    // The first framing (FrameView) can change the zoom before this subscribes.
    update();
    return () => {
      map.off("zoomend", update);
    };
  }, [map]);
  return zoom;
}

function GroupMarker({
  members,
  animate,
  onStack,
}: {
  members: SalonMapPoint[];
  animate: boolean;
  onStack?: (ids: string[]) => void;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const samePosition = sharesOnePosition(members);
  const label = `${members.length} salons close together: ${members.map((m) => m.name).join(", ")}. ${
    samePosition ? "Show them as a list" : "Zoom in to separate them"
  }`;
  const sync = useCallback((el: HTMLElement | undefined) => el?.setAttribute("aria-label", label), [label]);
  useEffect(() => sync(markerRef.current?.getElement()));

  const open = () => {
    if (samePosition || map.getZoom() >= MAX_ZOOM) {
      onStack?.(members.map((m) => m.id));
      return;
    }
    const bounds = L.latLngBounds(members.map((m) => m.position));
    const options = { padding: [72, 72] as [number, number], maxZoom: MAX_ZOOM };
    if (animate) map.flyToBounds(bounds, { ...options, duration: 0.6 });
    else map.fitBounds(bounds, { ...options, animate: false });
  };

  return (
    <Marker
      ref={markerRef}
      position={groupCentre(members)}
      icon={groupIcon(members.length)}
      title={`${members.length} salons`}
      keyboard
      zIndexOffset={500}
      eventHandlers={{
        click: open,
        keydown: (e) => {
          const key = (e.originalEvent as KeyboardEvent).key;
          if (key === "Enter" || key === " ") {
            e.originalEvent.preventDefault();
            open();
          }
        },
        add: (e) => sync((e.target as L.Marker).getElement()),
      }}
    />
  );
}

/**
 * Salon markers with overlap grouping. One flat keyed list, so a salon's marker
 * is kept (not re-created) when it is selected or leaves a group — keyboard focus stays.
 */
function SalonMarkers({
  points,
  selectedId,
  onSelect,
  animate,
  onStack,
}: {
  points: SalonMapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  animate: boolean;
  onStack?: (ids: string[]) => void;
}) {
  const map = useMap();
  const zoom = useMapZoom();
  const selected = points.find((p) => p.id === selectedId);
  const groups = useMemo(
    () =>
      groupOverlapping(
        points.filter((p) => p.id !== selectedId),
        (position) => map.project(L.latLng(position[0], position[1]), zoom),
      ),
    [map, points, selectedId, zoom],
  );
  const markers = groups.map((members) =>
    members.length === 1 ? (
      <SalonMarker key={members[0].id} point={members[0]} selected={false} onSelect={onSelect} />
    ) : (
      <GroupMarker key={`group:${members.map((m) => m.id).join("|")}`} members={members} animate={animate} onStack={onStack} />
    ),
  );
  if (selected) markers.push(<SalonMarker key={selected.id} point={selected} selected onSelect={onSelect} />);
  return <>{markers}</>;
}

function SalonMarker({ point, selected, onSelect }: { point: SalonMapPoint; selected: boolean; onSelect: (id: string) => void }) {
  const markerRef = useRef<L.Marker | null>(null);
  const sync = useCallback(
    (el: HTMLElement | undefined) => {
      if (!el) return;
      el.setAttribute("aria-label", point.label);
      el.setAttribute("aria-pressed", String(selected));
      el.classList.toggle("is-selected", selected);
    },
    [point.label, selected],
  );
  useEffect(() => sync(markerRef.current?.getElement()));

  return (
    <Marker
      ref={markerRef}
      position={point.position}
      icon={point.approximate ? approxIcon : salonIcon}
      title={point.name}
      keyboard
      zIndexOffset={selected ? 1000 : 0}
      eventHandlers={{
        click: () => onSelect(point.id),
        // Leaflet makes markers focusable but only opens popups on Enter; select on Enter/Space.
        keydown: (e) => {
          const key = (e.originalEvent as KeyboardEvent).key;
          if (key === "Enter" || key === " ") {
            e.originalEvent.preventDefault();
            onSelect(point.id);
          }
        },
        add: (e) => sync((e.target as L.Marker).getElement()),
      }}
    />
  );
}

export default function SalonMap({
  points,
  selectedId,
  onSelect,
  tileUrl,
  userLocation,
  reducedMotion,
  scrollWheelZoom,
  fallbackView,
  tileAttempt = 0,
  onTileStatus,
  onStack,
}: SalonMapProps) {
  const animate = !reducedMotion;

  return (
    <MapContainer
      center={points[0]?.position ?? fallbackView.center}
      zoom={points.length > 0 ? SINGLE_SALON_ZOOM : fallbackView.zoom}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      // "!" so Leaflet's own stylesheet (loaded later, background #ddd) can't override it.
      className="h-full w-full !bg-[#f2efe9]"
      // Attribution is rendered by SalonMapPanel so it stays visible and consistent.
      attributionControl={false}
      zoomControl={false}
      scrollWheelZoom={scrollWheelZoom}
      // Smooth, native motion: fractional zoom steps and gentler wheel/trackpad zoom.
      zoomSnap={0.25}
      zoomDelta={1}
      wheelPxPerZoomLevel={90}
      wheelDebounceTime={30}
      zoomAnimation={animate}
      fadeAnimation={animate}
      markerZoomAnimation={animate}
      inertia={animate}
      easeLinearity={0.2}
    >
      <TileEvents key={tileAttempt} tileUrl={tileUrl} onTileStatus={onTileStatus} />
      <TrackContainerSize />
      <FrameView points={points} fallbackView={fallbackView} animate={animate} />
      <KeepSelectedInView point={points.find((p) => p.id === selectedId)} animate={animate} />
      <ZoomControls points={points} fallbackView={fallbackView} animate={animate} />
      {userLocation ? (
        <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} interactive={false} keyboard={false} />
      ) : null}
      <SalonMarkers points={points} selectedId={selectedId} onSelect={onSelect} animate={animate} onStack={onStack} />
    </MapContainer>
  );
}
