import { describe, expect, it } from "vitest";
import { OVERLAP_RADIUS_PX, groupCentre, groupOverlapping, sharesOnePosition } from "@/lib/mapOverlap";

// Screen-space grouping of overlapping markers: positions are never changed.

const p = (id: string, lat: number, lng: number) => ({ id, position: [lat, lng] as [number, number] });
// 1 degree = 1000 px (simple test projection).
const project = ([lat, lng]: [number, number]) => ({ x: lng * 1000, y: -lat * 1000 });

describe("groupOverlapping", () => {
  it("groups markers within the radius and leaves distant ones alone", () => {
    const groups = groupOverlapping([p("a", 28.6, 77.2), p("b", 28.61, 77.21), p("c", 28.7, 77.1)], project, 26);
    expect(groups.map((g) => g.map((m) => m.id))).toEqual([["a", "b"], ["c"]]);
  });

  it("is deterministic regardless of the list's sort order", () => {
    const items = [p("c", 28.7, 77.1), p("b", 28.61, 77.21), p("a", 28.6, 77.2)];
    const ids = (order: typeof items) => groupOverlapping(order, project, 26).map((g) => g.map((m) => m.id));
    expect(ids(items)).toEqual(ids([...items].reverse()));
  });

  it("markers exactly at the radius are separate (strictly closer to group)", () => {
    expect(groupOverlapping([p("a", 0, 0), p("b", 0, 0.026)], project, 26)).toHaveLength(2);
    expect(groupOverlapping([p("a", 0, 0), p("b", 0, 0.025)], project, 26)).toHaveLength(1);
  });

  it("never changes a position", () => {
    const items = [p("a", 28.6, 77.2), p("b", 28.6001, 77.2001)];
    const [group] = groupOverlapping(items, project, 26);
    expect(group).toEqual(items);
  });

  it("the default radius keeps tap targets honest: a tap on one dot can't land on a neighbour", () => {
    const DOT_RADIUS = 12; // 24px visible dot
    const TAP_RADIUS = 20; // 40px round tap target
    expect(OVERLAP_RADIUS_PX).toBeGreaterThan(DOT_RADIUS + TAP_RADIUS);
  });

  it("empty input → no groups", () => {
    expect(groupOverlapping([], project)).toEqual([]);
  });
});

describe("sharesOnePosition / groupCentre", () => {
  it("detects identical coordinates (which no zoom level can separate)", () => {
    expect(sharesOnePosition([p("a", 28.6, 77.2), p("b", 28.6, 77.2)])).toBe(true);
    expect(sharesOnePosition([p("a", 28.6, 77.2), p("b", 28.6001, 77.2)])).toBe(false);
    expect(sharesOnePosition([])).toBe(false);
  });

  it("the group badge sits at the centre of its members", () => {
    const [lat, lng] = groupCentre([p("a", 28.6, 77.2), p("b", 28.8, 77.4)]);
    expect(lat).toBeCloseTo(28.7, 9);
    expect(lng).toBeCloseTo(77.3, 9);
  });
});
