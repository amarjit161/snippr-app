/**
 * Salon-name labels beside map markers (Google Maps–style), without collisions.
 *
 * Works on top of the existing overlap grouping (lib/mapOverlap): markers that would
 * overlap are already one group badge, so only single salons get a name label. For
 * each zoom level the labels are placed greedily in screen space — the selected salon
 * first, then in list order — on the right of the dot, else on the left, else hidden
 * (still shown on hover/focus, and always available as the marker's name). Nothing
 * here moves a marker.
 */

/** Longest label (px); longer names are truncated with an ellipsis. */
export const LABEL_MAX_WIDTH = 140;
/** Label pill height (px). */
export const LABEL_HEIGHT = 20;
/** Distance from the marker centre to the near edge of its label (px). */
export const LABEL_OFFSET = 14;
/** Below this zoom only the selected salon is labelled (groups/markers carry the view). */
export const MIN_LABEL_ZOOM = 10;
/** Half-sizes of what labels must not cover: a salon dot and a group badge. */
export const DOT_HALF = 12;
export const GROUP_HALF = 16;

export type LabelSide = "right" | "left" | "hidden";

/**
 * Approximate rendered width of a label (11px semibold text plus 2×8px padding and a
 * 1px border); with a `detail` (e.g. "1.5 km"), plus that 10px text and its gap.
 */
export const estimateLabelWidth = (name: string, detail?: string) =>
  Math.min(LABEL_MAX_WIDTH, Math.ceil(name.trim().length * 6.6) + 18) +
  (detail ? Math.ceil(detail.trim().length * 5.8) + 8 : 0);

export interface LabelCandidate {
  id: string;
  name: string;
  /** Marker centre in projected pixels at the current zoom. */
  x: number;
  y: number;
  /** The selected salon: placed first, and labelled at any zoom. */
  selected?: boolean;
  /** Placed before lower priorities (after the selected salon); default 0. */
  priority?: number;
  /** Extra text shown after the name when there is room (e.g. the distance); dropped first. */
  detail?: string;
}

export interface LabelPlacement {
  side: LabelSide;
  /** Whether the candidate's `detail` fits too (false when it had to be dropped, or there is none). */
  detail: boolean;
}

export interface LabelObstacle {
  /** The marker this obstacle belongs to (its own label may touch it). */
  id: string;
  x: number;
  y: number;
  half: number;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const labelBox = (c: LabelCandidate, side: "right" | "left", withDetail = false): Box => {
  const width = estimateLabelWidth(c.name, withDetail ? c.detail : undefined);
  const top = c.y - LABEL_HEIGHT / 2;
  return side === "right"
    ? { left: c.x + LABEL_OFFSET, top, right: c.x + LABEL_OFFSET + width, bottom: top + LABEL_HEIGHT }
    : { left: c.x - LABEL_OFFSET - width, top, right: c.x - LABEL_OFFSET, bottom: top + LABEL_HEIGHT };
};

export interface LabelArea {
  /** Visible map width (px), in the same coordinates as the candidates; labels must fit inside. */
  width?: number;
  /** Areas labels must not go under (e.g. the zoom controls). */
  blocked?: readonly Box[];
}

export type LabelBox = Box;

/** Which side each salon's label goes on (or hidden), so that no two labels overlap. */
export function placeLabels(
  candidates: readonly LabelCandidate[],
  obstacles: readonly LabelObstacle[],
  zoom: number,
  area: LabelArea = {},
): Map<string, LabelSide> {
  const sides = new Map<string, LabelSide>();
  for (const [id, p] of placeLabelsWithDetail(candidates, obstacles, zoom, area)) sides.set(id, p.side);
  return sides;
}

/**
 * As placeLabels, also deciding whether each label's `detail` (e.g. its distance)
 * fits: a label tries right, then left, with its detail, then right/left without it.
 * Order: the selected salon, then higher `priority`, then the order given.
 */
export function placeLabelsWithDetail(
  candidates: readonly LabelCandidate[],
  obstacles: readonly LabelObstacle[],
  zoom: number,
  area: LabelArea = {},
): Map<string, LabelPlacement> {
  const result = new Map<string, LabelPlacement>();
  const placed: Box[] = [];
  const blockers = [
    ...obstacles.map((o) => ({
      id: o.id,
      box: { left: o.x - o.half, top: o.y - o.half, right: o.x + o.half, bottom: o.y + o.half },
    })),
    ...(area.blocked ?? []).map((box, i) => ({ id: `area:${i}`, box })),
  ];
  const fits = (box: Box) => area.width === undefined || (box.left >= 0 && box.right <= area.width);
  // Selected first, then priority, then the order given (the list's order); stable.
  const ordered = [...candidates].sort(
    (a, b) => Number(!!b.selected) - Number(!!a.selected) || (b.priority ?? 0) - (a.priority ?? 0),
  );
  const options = (c: LabelCandidate) =>
    [
      ...(c.detail ? ([["right", true], ["left", true]] as const) : []),
      ["right", false],
      ["left", false],
    ] as const;
  for (const c of ordered) {
    if (zoom < MIN_LABEL_ZOOM && !c.selected) {
      result.set(c.id, { side: "hidden", detail: false });
      continue;
    }
    const choice = options(c).find(([s, withDetail]) => {
      const box = labelBox(c, s, withDetail);
      return fits(box) && !placed.some((p) => overlaps(p, box)) && !blockers.some((b) => b.id !== c.id && overlaps(b.box, box));
    });
    if (choice) {
      placed.push(labelBox(c, choice[0], choice[1]));
      result.set(c.id, { side: choice[0], detail: choice[1] });
    } else {
      result.set(c.id, { side: "hidden", detail: false });
    }
  }
  return result;
}

/**
 * The on-map overlays labels must stay clear of (the Snippr Maps badge, notices, the
 * controls): every `[data-map-avoid]` element inside `root` that has a size, as boxes in
 * the map container's coordinates, padded by `pad` px.
 */
export function avoidAreas(container: HTMLElement, root: ParentNode = container, pad = 6): LabelBox[] {
  const origin = container.getBoundingClientRect();
  const boxes: LabelBox[] = [];
  root.querySelectorAll<HTMLElement>("[data-map-avoid]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    boxes.push({
      left: r.left - origin.left - pad,
      top: r.top - origin.top - pad,
      right: r.right - origin.left + pad,
      bottom: r.bottom - origin.top + pad,
    });
  });
  return boxes;
}

/** Escapes text for use inside a Leaflet divIcon's HTML. */
export const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
