/**
 * Honest overlap handling for map markers: salons whose markers would overlap on
 * screen at the current zoom are shown as one group badge ("3 salons"). Positions
 * are never changed — zooming in separates them, and salons that share exactly
 * the same coordinates are offered as a list instead.
 */

/**
 * Markers closer than this on screen (px) are grouped. The visible dot is 24px and
 * its round tap target 40px: at 36px apart, a tap on one dot can never land in another
 * marker's tap target (12px dot radius + 20px target radius < 36px).
 */
export const OVERLAP_RADIUS_PX = 36;

interface Positioned {
  id: string;
  position: [number, number];
}

/**
 * Groups items whose projected screen positions lie within `radius` px of a
 * group's first member. Deterministic: items are considered in id order, so the
 * grouping doesn't change when the list is re-sorted. Single items are groups of one.
 */
export function groupOverlapping<T extends Positioned>(
  items: readonly T[],
  project: (position: [number, number]) => { x: number; y: number },
  radius: number = OVERLAP_RADIUS_PX,
): T[][] {
  const groups: { members: T[]; x: number; y: number }[] = [];
  for (const item of [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const p = project(item.position);
    const group = groups.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < radius);
    if (group) group.members.push(item);
    else groups.push({ members: [item], x: p.x, y: p.y });
  }
  return groups.map((g) => g.members);
}

/** True when every member has the same coordinates (zooming can never separate them). */
export function sharesOnePosition(members: readonly Positioned[]): boolean {
  const [first] = members;
  return (
    !!first &&
    members.every(
      (m) => Math.abs(m.position[0] - first.position[0]) < 1e-7 && Math.abs(m.position[1] - first.position[1]) < 1e-7,
    )
  );
}

/** Where a group badge is drawn: the centre of its members (a group symbol, not a salon position). */
export function groupCentre(members: readonly Positioned[]): [number, number] {
  const lat = members.reduce((s, m) => s + m.position[0], 0) / members.length;
  const lng = members.reduce((s, m) => s + m.position[1], 0) / members.length;
  return [lat, lng];
}
