import { describe, expect, it } from "vitest";
import {
  DOT_HALF,
  LABEL_HEIGHT,
  LABEL_MAX_WIDTH,
  LABEL_OFFSET,
  MIN_LABEL_ZOOM,
  avoidAreas,
  escapeHtml,
  estimateLabelWidth,
  placeLabels,
  placeLabelsWithDetail,
  type LabelCandidate,
} from "@/lib/mapLabels";

// Collision-free salon-name labels (Google Maps–style) on top of marker grouping.

const dot = (c: LabelCandidate) => ({ id: c.id, x: c.x, y: c.y, half: DOT_HALF });
const place = (cands: LabelCandidate[], zoom = 14, extra: { id: string; x: number; y: number; half: number }[] = []) =>
  placeLabels(cands, [...cands.map(dot), ...extra], zoom);

describe("placeLabels", () => {
  it("a lone salon gets its label on the right", () => {
    expect(place([{ id: "a", name: "Sam", x: 100, y: 100 }]).get("a")).toBe("right");
  });

  it("when the right side is taken by a neighbour's label, the next one goes left", () => {
    // b sits just right of a: a's right-hand label would cover b's dot → a goes left.
    const sides = place([
      { id: "a", name: "Looks", x: 100, y: 100 },
      { id: "b", name: "The King", x: 150, y: 100 },
    ]);
    expect(sides.get("a")).toBe("left");
    expect(sides.get("b")).toBe("right");
  });

  it("a label with no free side is hidden (the marker stays, named for screen readers)", () => {
    const sides = place([
      { id: "left", name: "Left Salon", x: 40, y: 100 },
      { id: "mid", name: "Middle Salon Name", x: 100, y: 100 },
      { id: "right", name: "Right Salon", x: 160, y: 100 },
    ]);
    expect(sides.get("mid")).toBe("hidden");
    expect([sides.get("left"), sides.get("right")]).not.toContain("hidden");
  });

  it("the selected salon is placed first, even later in the list", () => {
    const cands = [
      { id: "first", name: "First", x: 100, y: 100 },
      { id: "chosen", name: "Chosen", x: 130, y: 100, selected: true },
    ];
    const sides = place(cands);
    expect(sides.get("chosen")).toBe("right");
    expect(sides.get("first")).not.toBe("right"); // gives way to the selected salon
  });

  it("labels never cover a group badge", () => {
    const sides = place([{ id: "a", name: "Soham", x: 100, y: 100 }], 14, [{ id: "group:x|y", x: 140, y: 100, half: 16 }]);
    expect(sides.get("a")).toBe("left");
  });

  it(`below zoom ${MIN_LABEL_ZOOM} only the selected salon keeps a label`, () => {
    const cands = [
      { id: "a", name: "Sam", x: 100, y: 100 },
      { id: "b", name: "Looks", x: 400, y: 400, selected: true },
    ];
    const sides = place(cands, MIN_LABEL_ZOOM - 1);
    expect(sides.get("a")).toBe("hidden");
    expect(sides.get("b")).toBe("right");
    expect(place(cands, MIN_LABEL_ZOOM).get("a")).toBe("right");
  });

  it("whatever the layout, visible labels never overlap each other or another dot", () => {
    // A dense, deterministic scatter.
    const cands: LabelCandidate[] = Array.from({ length: 40 }, (_, i) => ({
      id: `s${i}`,
      name: `Salon number ${i} ${"x".repeat(i % 9)}`,
      x: (i * 97) % 600,
      y: (i * 53) % 300,
    }));
    const sides = place(cands);
    const boxes = cands
      .filter((c) => sides.get(c.id) !== "hidden")
      .map((c) => {
        const w = estimateLabelWidth(c.name);
        const left = sides.get(c.id) === "right" ? c.x + LABEL_OFFSET : c.x - LABEL_OFFSET - w;
        return { id: c.id, left, right: left + w, top: c.y - LABEL_HEIGHT / 2, bottom: c.y + LABEL_HEIGHT / 2 };
      });
    expect(boxes.length).toBeGreaterThan(5); // not "hide everything"
    for (const a of boxes) {
      for (const b of boxes) if (a !== b) expect(a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom).toBe(false);
      for (const c of cands) {
        if (c.id === a.id) continue;
        const hit = a.left < c.x + DOT_HALF && c.x - DOT_HALF < a.right && a.top < c.y + DOT_HALF && c.y - DOT_HALF < a.bottom;
        expect(hit).toBe(false);
      }
    }
  });
});

describe("label sizing and safety", () => {
  it("width grows with the name and is capped (long names are truncated in CSS)", () => {
    expect(estimateLabelWidth("Sam")).toBeLessThan(estimateLabelWidth("The King"));
    expect(estimateLabelWidth("A really very extremely long salon name that keeps going and going")).toBe(LABEL_MAX_WIDTH);
  });

  it("escapes names for the marker HTML (names come from the database)", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)"> & 'Co'`)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;Co&#39;",
    );
  });
});

describe("placeLabels within the visible map", () => {
  it("a label that would run off the right edge goes left instead", () => {
    const sides = placeLabels([{ id: "edge", name: "John Sallon", x: 370, y: 200 }], [], 14, { width: 390 });
    expect(sides.get("edge")).toBe("left");
  });

  it("a label that would sit under the zoom controls goes left; with no room at all it is hidden", () => {
    const controls = { left: 330, top: 0, right: 390, bottom: 170 };
    expect(placeLabels([{ id: "c", name: "Looks", x: 300, y: 60 }], [], 14, { width: 390, blocked: [controls] }).get("c")).toBe("left");
    expect(placeLabels([{ id: "n", name: "Looks", x: 20, y: 60 }], [], 14, { width: 40 }).get("n")).toBe("hidden");
  });

  it("without a known size no edge rule applies (labels aren't hidden for lack of layout)", () => {
    expect(placeLabels([{ id: "a", name: "Sam", x: 5000, y: 10 }], [], 14).get("a")).toBe("right");
  });
});

describe("avoidAreas (overlays labels keep clear of)", () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;

  it("measures every [data-map-avoid] overlay in map-container coordinates, padded; skips unrendered ones", () => {
    const root = document.createElement("section");
    root.innerHTML = '<div class="map"></div><div data-map-avoid id="brand"></div><p data-map-avoid id="gone"></p><p id="other"></p>';
    const map = root.querySelector<HTMLElement>(".map")!;
    map.getBoundingClientRect = () => rect(100, 50, 600, 400);
    root.querySelector<HTMLElement>("#brand")!.getBoundingClientRect = () => rect(112, 62, 130, 36);
    root.querySelector<HTMLElement>("#gone")!.getBoundingClientRect = () => rect(0, 0, 0, 0);
    expect(avoidAreas(map, root)).toEqual([{ left: 6, top: 6, right: 148, bottom: 54 }]);
  });

  it("a label that would run under the Snippr Maps badge moves to the other side", () => {
    const badge = { left: 6, top: 6, right: 148, bottom: 54 };
    const sides = placeLabels([{ id: "a", name: "Looks", x: 100, y: 30 }], [], 14, { width: 600, blocked: [badge] });
    expect(sides.get("a")).toBe("hidden"); // both sides are under the badge
    const right = placeLabels([{ id: "b", name: "Looks", x: 160, y: 30 }], [], 14, { width: 600, blocked: [badge] });
    expect(right.get("b")).toBe("right");
  });
});

describe("labels with a distance (detail) and priorities", () => {
  it("a label shows its distance when there is room", () => {
    const placed = placeLabelsWithDetail([{ id: "a", name: "Sam", detail: "1.5 km", x: 100, y: 100 }], [], 14, { width: 600 });
    expect(placed.get("a")).toEqual({ side: "right", detail: true });
  });

  it("when crowded, the distance is dropped before the name is hidden", () => {
    // A neighbour 80px to the right leaves room for "Sam" but not "Sam Nearest · 1.5 km"; the map edge blocks the left.
    const sides = placeLabelsWithDetail(
      [
        { id: "a", name: "Sam", detail: "Nearest · 1.5 km", x: 60, y: 100 },
        { id: "b", name: "Looks", x: 140, y: 100 },
      ],
      [{ id: "a", x: 60, y: 100, half: DOT_HALF }, { id: "b", x: 140, y: 100, half: DOT_HALF }],
      14,
      { width: 240 },
    );
    expect(sides.get("a")).toEqual({ side: "right", detail: false });
    expect(sides.get("b")?.side).not.toBe("hidden");
  });

  it("priority: the selected salon, then 'You are here', then the nearest salon, then list order", () => {
    // All four want the same spot; only the first in priority order gets it on the right.
    const at = { x: 100, y: 100 };
    const cands = [
      { id: "plain", name: "Plain", ...at },
      { id: "nearest", name: "Nearest one", priority: 1, ...at },
      { id: "you", name: "You are here", priority: 2, ...at },
    ];
    expect(placeLabelsWithDetail(cands, [], 14).get("you")?.side).toBe("right");
    expect(placeLabelsWithDetail([...cands, { id: "sel", name: "Chosen", selected: true, ...at }], [], 14).get("sel")?.side).toBe("right");
  });

  it("placeLabels (sides only) is unchanged for callers without details", () => {
    const sides = placeLabels([{ id: "a", name: "Sam", x: 100, y: 100 }], [], 14);
    expect(sides.get("a")).toBe("right");
  });

  it("width estimate grows with the detail, but the name part stays capped", () => {
    expect(estimateLabelWidth("Sam", "1.5 km")).toBeGreaterThan(estimateLabelWidth("Sam"));
    const long = "A really very extremely long salon name that keeps going";
    expect(estimateLabelWidth(long, "1.5 km") - estimateLabelWidth(long)).toBeLessThan(60);
    expect(estimateLabelWidth(long)).toBe(LABEL_MAX_WIDTH);
  });
});
