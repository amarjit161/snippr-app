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
import { Loader2, LocateFixed, Minus, Plus, Scan } from "lucide-react";
import { labelDetail, type SalonMapPoint } from "@/lib/salonMapPoints";
import type { MapView } from "@/lib/cityLocation";
import { groupOverlapping, groupCentre, sharesOnePosition } from "@/lib/mapOverlap";
import {
  DOT_HALF,
  GROUP_HALF,
  avoidAreas,
  escapeHtml,
  placeLabelsWithDetail,
  type LabelCandidate,
  type LabelPlacement,
  type LabelSide,
} from "@/lib/mapLabels";

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
  /** Asks the page for the device position ("Show my location"); without it there is no such control. */
  onLocate?: () => void;
  /** A position request is in progress (the control shows it and ignores presses). */
  locating?: boolean;
  /** Centre on `userLocation` as soon as it is available, then call `onCentred` (the page decides when). */
  centreOnUser?: boolean;
  onCentred?: () => void;
}

/** Tile failures (with no successful tile) before the page shows the tile fallback. */
export const TILE_ERROR_THRESHOLD = 4;
export const MIN_ZOOM = 4;
export const MAX_ZOOM = 19;
const SINGLE_SALON_ZOOM = 15;

// One icon per salon name; selection and the label's side are shown by toggling
// classes on the marker element (not by swapping icons) so a keyboard user's focus
// stays on the marker. The visible dot is 24px; the marker element (the tap target)
// is 40px around it, and the name label sits beside it as part of the same element —
// so tapping the label is tapping the marker.
const MARKER_HIT = 40;
// "!flex": Leaflet's stylesheet sets marker icons to display:block, which would leave
// the dot in the top-left of its tap target — drawn 8px off the salon's coordinate.
const MARKER_CLASS =
  "group !flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary";
// Brand-purple pin with a white rim, a soft purple drop shadow and a small white core;
// selected = a restrained purple halo (same 24px footprint, so label placement holds).
const DOT_BASE =
  "relative block h-6 w-6 rounded-full motion-safe:transition-transform motion-safe:duration-150 group-hover:scale-110 group-[.is-selected]:scale-110 group-[.is-selected]:ring-[5px] group-[.is-selected]:ring-primary/25";
const DOT_CLASS = `${DOT_BASE} border-[2.5px] border-white bg-primary shadow-[0_2px_6px_rgba(76,29,149,0.45)] after:absolute after:inset-[6px] after:rounded-full after:bg-white/90`;
// Approximate (test) locations: a hollow, dashed pin so they never read as exact.
const APPROX_DOT_CLASS = `${DOT_BASE} border-2 border-dashed border-primary bg-white/90 shadow-[0_2px_6px_rgba(76,29,149,0.3)] group-[.is-selected]:bg-violet-100`;
// White pill, deep-purple text, 20px tall (see lib/mapLabels). Right of the dot by default;
// .label-left / .label-hidden (set by the collision step) move or hide it; hidden labels
// still appear on hover / keyboard focus. The selected salon's label turns brand purple.
const LABEL_CLASS =
  "pointer-events-auto absolute left-[calc(100%-6px)] top-1/2 max-w-[140px] -translate-y-1/2 truncate whitespace-nowrap rounded-full border border-black/[0.06] bg-white px-2 text-[11px] font-semibold leading-[18px] tracking-[0.01em] text-[#3b0764] shadow-[0_1px_2px_rgba(17,24,39,0.12),0_3px_8px_-2px_rgba(76,29,149,0.22)] motion-safe:transition-opacity group-[.label-left]:left-auto group-[.label-left]:right-[calc(100%-6px)] group-[.label-hidden]:pointer-events-none group-[.label-hidden]:opacity-0 group-[.label-hidden:hover]:opacity-100 group-[.label-hidden:focus-visible]:opacity-100 group-[.is-selected]:border-primary group-[.is-selected]:bg-primary group-[.is-selected]:text-white";

// With a distance: the name truncates on its own (same 140px pill as without), and the
// distance follows it — dropped (.label-short) when the collision step finds no room.
const LABEL_WITH_DETAIL_CLASS = LABEL_CLASS.replace("max-w-[140px] -translate-y-1/2 truncate", "flex -translate-y-1/2 items-center gap-1");
const DETAIL_CLASS =
  "shrink-0 text-[10px] font-medium text-zinc-500 group-[.label-short]:hidden group-[.is-selected]:text-white/85";

const salonIcons = new Map<string, L.DivIcon>();
const salonIconFor = (name: string, approximate: boolean, point: Pick<SalonMapPoint, "distanceText" | "nearest"> = {}) => {
  const detail = labelDetail(point);
  const key = `${approximate ? "approx" : "exact"}|${name}|${detail ?? ""}`;
  let icon = salonIcons.get(key);
  if (!icon) {
    const label = detail
      ? `<span aria-hidden="true" data-salon-label class="${LABEL_WITH_DETAIL_CLASS}"><span data-label-name class="min-w-0 max-w-[122px] truncate">${escapeHtml(name)}</span><span data-label-detail class="${DETAIL_CLASS}">${
          point.nearest
            ? `<span class="font-bold text-primary group-[.is-selected]:text-white">Nearest</span> · ${escapeHtml(point.distanceText!)}`
            : escapeHtml(detail)
        }</span></span>`
      : `<span aria-hidden="true" data-salon-label class="${LABEL_CLASS}">${escapeHtml(name)}</span>`;
    icon = L.divIcon({
      className: MARKER_CLASS,
      // The label is decorative (aria-hidden): the marker's own accessible name carries
      // the salon name (and distance). Names come from the database, so they are escaped.
      html: `<span aria-hidden="true" class="${approximate ? APPROX_DOT_CLASS : DOT_CLASS}"></span>${label}`,
      iconSize: [MARKER_HIT, MARKER_HIT],
      iconAnchor: [MARKER_HIT / 2, MARKER_HIT / 2],
    });
    salonIcons.set(key, icon);
  }
  return icon;
};

// A group of overlapping salons: a deep-purple count badge with a soft halo, clearly
// not a single salon (white text on #2e1065 is well above 4.5:1).
const groupIcons = new Map<number, L.DivIcon>();
const groupIcon = (count: number) => {
  let icon = groupIcons.get(count);
  if (!icon) {
    icon = L.divIcon({
      // A 32px badge inside a 44px tap target.
      className:
        "group !flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary",
      html: `<span aria-hidden="true" class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#2e1065] text-xs font-bold tabular-nums text-white shadow-[0_2px_8px_rgba(46,16,101,0.4)] ring-4 ring-primary/25 motion-safe:transition-transform motion-safe:duration-150 group-hover:scale-105">${count}</span>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
    groupIcons.set(count, icon);
  }
  return icon;
};

// The customer's own position — only ever the browser's real reading, passed in by the
// page (never a city centre, map default or demo coordinate). Blue, not purple, so it
// can't be mistaken for a salon: an 18px dot with a white outline and a soft halo, and
// a small "You are here" pill placed by the same collision step as salon labels.
// Non-interactive (nothing to select) and never part of salon grouping. A divIcon
// rather than an SVG circle needs no vector renderer.
const USER_ID = "__you__";
const USER_LABEL = "You are here";
/** Half the user marker's visible footprint (dot + halo), for label collisions. */
const USER_HALF = 15;
const userIcon = L.divIcon({
  className: "snippr-user-location group !flex items-center justify-center",
  html:
    '<span aria-hidden="true" class="block h-[18px] w-[18px] rounded-full border-[3px] border-white bg-blue-600 shadow-[0_1px_4px_rgba(37,99,235,0.55)] ring-[6px] ring-blue-500/20"></span>' +
    `<span aria-hidden="true" data-user-label class="pointer-events-none absolute left-[calc(100%+3px)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-blue-200 bg-white px-2 text-[11px] font-semibold leading-[18px] text-blue-700 shadow-[0_1px_2px_rgba(17,24,39,0.12),0_3px_8px_-2px_rgba(37,99,235,0.25)] group-[.label-left]:left-auto group-[.label-left]:right-[calc(100%+3px)] group-[.label-hidden]:hidden">${USER_LABEL}</span>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
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
        // Keep markers clear of the Snippr Maps badge and notes (top-left) and the zoom controls (right).
        const options = {
          paddingTopLeft: [32, 144] as [number, number],
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
  // Order-independent: re-sorting the list (e.g. Nearest once the customer's position
  // arrives) is not a change of what's on the map, so it doesn't reframe it. The fallback
  // view counts only when it is shown (no salon has a location): the customer's position
  // arriving must not reframe the salons over the centring on the customer.
  const key =
    points.length > 0
      ? points
          .map((p) => `${p.id}@${p.position.join(",")}`)
          .sort()
          .join("|")
      : `#${fallbackView.center.join(",")}@${fallbackView.zoom}`;
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

/** Within this distance (m) the nearest salon is kept in view when centring on the customer. */
const NEAREST_IN_VIEW_METRES = 15_000;
const USER_ZOOM = 14;

/**
 * Centres the map on the customer when the page asks (`pending`: their position was
 * just obtained, or they pressed "Show my location") — once per request, so manual
 * panning and zooming afterwards are never overridden. When the nearest salon is
 * close, the view also keeps it on screen (still centred on the customer).
 */
function CentreOnUser({
  userLocation,
  pending,
  onDone,
  nearest,
  animate,
}: {
  userLocation: { lat: number; lng: number } | null;
  pending: boolean;
  onDone?: () => void;
  nearest: [number, number] | null;
  animate: boolean;
}) {
  const map = useMap();
  const firstPaint = useRef(true);
  useEffect(() => {
    const instant = firstPaint.current || !animate;
    firstPaint.current = false;
    if (!pending || !userLocation) return;
    const here = L.latLng(userLocation.lat, userLocation.lng);
    const near = nearest ? L.latLng(nearest[0], nearest[1]) : null;
    if (near && here.distanceTo(near) <= NEAREST_IN_VIEW_METRES) {
      // A box centred on the customer that reaches the nearest salon.
      const dLat = Math.max(Math.abs(near.lat - here.lat), 0.002);
      const dLng = Math.max(Math.abs(near.lng - here.lng), 0.002);
      const bounds = L.latLngBounds([here.lat - dLat, here.lng - dLng], [here.lat + dLat, here.lng + dLng]);
      // Equal padding keeps the customer centred; 96px keeps the nearest salon (or its group
      // badge) clear of the controls column on the right and the badge on the left.
      const options = { padding: [96, 96] as [number, number], maxZoom: 16 };
      if (instant) map.fitBounds(bounds, { ...options, animate: false });
      else map.flyToBounds(bounds, { ...options, duration: 0.8 });
    } else if (instant) {
      map.setView(here, Math.max(map.getZoom(), USER_ZOOM), { animate: false });
    } else {
      map.flyTo(here, Math.max(map.getZoom(), USER_ZOOM), { duration: 0.8 });
    }
    onDone?.();
    // Re-runs only when a new centring is requested or a new reading arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pending, userLocation]);
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

/**
 * Zoom in / out, "Show my location" (when the page offers it) and "Show all salons":
 * 44px, labelled, keyboard-focusable controls.
 */
function ZoomControls({
  points,
  fallbackView,
  animate,
  onLocate,
  locating = false,
}: {
  points: SalonMapPoint[];
  fallbackView: MapView;
  animate: boolean;
  onLocate?: () => void;
  locating?: boolean;
}) {
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

  // White surfaces on the (always light) map, whatever the app theme; purple on hover (only
  // where hover exists — a tap mustn't leave a stuck tint on phones), a deeper tint while
  // pressed, and an inset focus ring that stays inside the rounded shell.
  const button =
    "flex h-11 w-11 items-center justify-center bg-white text-zinc-700 transition-colors [@media(hover:hover)]:hover:bg-violet-50 [@media(hover:hover)]:hover:text-primary active:bg-violet-100 active:text-primary focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-white disabled:text-zinc-300";
  const shell =
    "overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(17,24,39,0.06),0_6px_16px_-4px_rgba(17,24,39,0.18)]";
  return (
    <div ref={ref} data-map-avoid className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
      <div role="group" aria-label="Zoom" className={`flex flex-col ${shell}`}>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => map.zoomIn(1, { animate })}
          className={`${button} border-b border-zinc-100`}
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" aria-label="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => map.zoomOut(1, { animate })} className={button}>
          <Minus className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {onLocate ? (
        <button
          type="button"
          aria-label={locating ? "Finding your location…" : "Show my location"}
          title="Show my location"
          aria-busy={locating}
          // A press while the browser is still answering does nothing (no duplicate requests).
          onClick={() => {
            if (!locating) onLocate();
          }}
          className={`${button} ${shell} text-blue-600 [@media(hover:hover)]:hover:text-blue-700`}
        >
          {locating ? (
            <Loader2 className="h-5 w-5 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <LocateFixed className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      ) : null}
      <button
        type="button"
        aria-label={points.length > 0 ? "Show all salons on the map" : "Back to the starting view"}
        title={points.length > 0 ? "Show all salons" : "Back to the starting view"}
        onClick={() => showAll(true)}
        className={`${button} ${shell}`}
      >
        {onLocate ? <Scan className="h-5 w-5" aria-hidden="true" /> : <LocateFixed className="h-5 w-5" aria-hidden="true" />}
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
  userLocation,
  controlButtons,
}: {
  points: SalonMapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  animate: boolean;
  onStack?: (ids: string[]) => void;
  userLocation: { lat: number; lng: number } | null;
  /** Standalone 44px buttons under the zoom pair (locate and/or show-all). */
  controlButtons: number;
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
  // Name labels for single salons, placed so they don't collide (lib/mapLabels):
  // candidates in list order, avoiding every dot and group badge, the zoom controls and
  // the map's edges. Placed in on-screen (container) coordinates, so re-placed after a pan.
  const [viewVersion, setViewVersion] = useState(0);
  useEffect(() => {
    const onMove = () => setViewVersion((v) => v + 1);
    map.on("moveend", onMove);
    return () => {
      map.off("moveend", onMove);
    };
  }, [map]);
  const placements = useMemo(() => {
    const at = (position: [number, number]) => map.latLngToContainerPoint(L.latLng(position[0], position[1]));
    const size = map.getSize();
    // Unknown size (e.g. no layout yet): skip the edge/overlay checks rather than hide labels.
    const container = size.x > 0 ? map.getContainer() : null;
    const area =
      container
        ? {
            width: size.x,
            blocked: [
              // The map controls: right-3 top-3, 44px wide: the 88px zoom pair, then each
              // further 44px button after an 8px gap (fixed, so it holds before layout).
              { left: size.x - 12 - 44 - 6, top: 0, right: size.x, bottom: 12 + 88 + controlButtons * (8 + 44) + 6 },
              // Whatever overlays the panel marks (the Snippr Maps badge, notices), as laid out now.
              ...avoidAreas(container, container.closest("[data-map-root]") ?? container),
            ],
          }
        : {};
    const singleIds = new Set(groups.filter((g) => g.length === 1).map((g) => g[0].id));
    if (selected) singleIds.add(selected.id);
    // Order: the selected salon, then "You are here", then the nearest salon, then list order.
    // Distances ride along as each label's detail, kept only where there is room.
    const candidates: LabelCandidate[] = points
      .filter((p) => singleIds.has(p.id))
      .map((p) => {
        const xy = at(p.position);
        return {
          id: p.id,
          name: p.name,
          x: xy.x,
          y: xy.y,
          selected: p.id === selectedId,
          priority: p.nearest ? 1 : 0,
          detail: labelDetail(p),
        };
      });
    const you = userLocation ? at([userLocation.lat, userLocation.lng]) : null;
    if (you) candidates.push({ id: USER_ID, name: USER_LABEL, x: you.x, y: you.y, priority: 2 });
    const obstacles = [
      ...candidates.map((c) => ({ id: c.id, x: c.x, y: c.y, half: c.id === USER_ID ? USER_HALF : DOT_HALF })),
      ...groups
        .filter((g) => g.length > 1)
        .map((g) => {
          const xy = at(groupCentre(g));
          return { id: `group:${g.map((m) => m.id).join("|")}`, x: xy.x, y: xy.y, half: GROUP_HALF };
        }),
    ];
    return placeLabelsWithDetail(candidates, obstacles, zoom, area);
    // viewVersion: re-place after every pan (positions are on-screen coordinates).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points, groups, selected, selectedId, zoom, viewVersion, userLocation, controlButtons]);
  const placementOf = (id: string): LabelPlacement => placements.get(id) ?? { side: "hidden", detail: false };

  const markers = groups.map((members) =>
    members.length === 1 ? (
      <SalonMarker
        key={members[0].id}
        point={members[0]}
        selected={false}
        onSelect={onSelect}
        label={placementOf(members[0].id)}
      />
    ) : (
      <GroupMarker key={`group:${members.map((m) => m.id).join("|")}`} members={members} animate={animate} onStack={onStack} />
    ),
  );
  if (selected) {
    markers.push(
      <SalonMarker key={selected.id} point={selected} selected onSelect={onSelect} label={placementOf(selected.id)} />,
    );
  }
  if (userLocation) {
    markers.push(<UserMarker key={USER_ID} location={userLocation} labelSide={placementOf(USER_ID).side} />);
  }
  return <>{markers}</>;
}

/** The customer's position: a named, non-interactive image (not a button, not focusable). */
function UserMarker({ location, labelSide }: { location: { lat: number; lng: number }; labelSide: LabelSide }) {
  const markerRef = useRef<L.Marker | null>(null);
  const sync = useCallback(
    (el: HTMLElement | undefined) => {
      if (!el) return;
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", "Your location");
      el.classList.toggle("label-left", labelSide === "left");
      el.classList.toggle("label-hidden", labelSide === "hidden");
    },
    [labelSide],
  );
  useEffect(() => sync(markerRef.current?.getElement()));
  return (
    <Marker
      ref={markerRef}
      position={[location.lat, location.lng]}
      icon={userIcon}
      title="Your location"
      interactive={false}
      keyboard={false}
      // Above ordinary salon pins, below groups and the selected salon.
      zIndexOffset={400}
      eventHandlers={{ add: (e) => sync((e.target as L.Marker).getElement()) }}
    />
  );
}

function SalonMarker({
  point,
  selected,
  onSelect,
  label = { side: "right", detail: true },
}: {
  point: SalonMapPoint;
  selected: boolean;
  onSelect: (id: string) => void;
  label?: LabelPlacement;
}) {
  const labelSide = label.side;
  const markerRef = useRef<L.Marker | null>(null);
  const sync = useCallback(
    (el: HTMLElement | undefined) => {
      if (!el) return;
      el.setAttribute("aria-label", point.label);
      el.setAttribute("aria-pressed", String(selected));
      el.classList.toggle("is-selected", selected);
      el.classList.toggle("label-left", labelSide === "left");
      el.classList.toggle("label-hidden", labelSide === "hidden");
      el.classList.toggle("label-short", !label.detail);
    },
    [point.label, selected, labelSide, label.detail],
  );
  useEffect(() => sync(markerRef.current?.getElement()));

  return (
    <Marker
      ref={markerRef}
      position={point.position}
      icon={salonIconFor(point.name, !!point.approximate, point)}
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
  onLocate,
  locating,
  centreOnUser = false,
  onCentred,
}: SalonMapProps) {
  const animate = !reducedMotion;
  const nearest = points.find((p) => p.nearest)?.position ?? null;

  return (
    <MapContainer
      center={points[0]?.position ?? fallbackView.center}
      zoom={points.length > 0 ? SINGLE_SALON_ZOOM : fallbackView.zoom}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      // "!" so Leaflet's own stylesheet (loaded later, background #ddd) can't override it.
      // A light touch on the tiles only (not markers): slightly calmer colours, a crisper
      // road/label contrast — the map data and geography are unchanged.
      className="h-full w-full !bg-[#f2efe9] [&_.leaflet-tile-pane]:[filter:saturate(0.88)_contrast(1.03)]"
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
      {/* After FrameView, so a requested centring on the customer wins on first paint. */}
      <CentreOnUser userLocation={userLocation} pending={centreOnUser} onDone={onCentred} nearest={nearest} animate={animate} />
      <ZoomControls points={points} fallbackView={fallbackView} animate={animate} onLocate={onLocate} locating={locating} />
      <SalonMarkers
        points={points}
        selectedId={selectedId}
        onSelect={onSelect}
        animate={animate}
        onStack={onStack}
        userLocation={userLocation}
        controlButtons={onLocate ? 2 : 1}
      />
    </MapContainer>
  );
}
