import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  activeFilterChips,
  applyDiscoveryFilters,
  categoriesBySalon,
  categorizeService,
  countActiveFilters,
  filterOptionCounts,
  priceBandOf,
  salonCategoryLabels,
  toggleIn,
  type DiscoveryFilterState,
} from "@/lib/salonFilters";

const NOON = new Date(2026, 9, 17, 12, 0);
const salon = (id: string, extra: Record<string, unknown> = {}) => ({
  id, open_time: null, close_time: null, is_manual_closed: false, waitTime: 10, ...extra,
});

describe("categorizeService (real service names)", () => {
  it.each([
    ["Haircut", ["haircut"]],
    ["Realtime Proof Cut", ["haircut"]],
    ["colour", ["hair-colour"]],
    ["detan", ["skin"]],
    ["SPA", ["spa"]],
    ["Beard trim", ["haircut", "beard"]],
    ["Manicure", ["nails"]],
    ["Full arms waxing", ["waxing"]],
  ])("%j → %j", (name, expected) => {
    expect(categorizeService(name)).toEqual(expected);
  });

  it.each([["bread"], ["bread saving"], ["Consultation"], [""], [null]])(
    "%j → no category (misspellings and unclear names are not guessed)",
    (name) => {
      expect(categorizeService(name as string | null)).toEqual([]);
    },
  );
});

describe("categoriesBySalon / salonCategoryLabels", () => {
  it("groups real services per salon; ignores rows without a salon or a recognisable name", () => {
    const map = categoriesBySalon([
      { salon_id: "a", name: "Haircut" },
      { salon_id: "a", name: "SPA" },
      { salon_id: "b", name: "bread saving" },
      { salon_id: null, name: "Haircut" },
      { salon_id: "c", name: null },
    ]);
    expect([...map.keys()]).toEqual(["a"]);
    expect(salonCategoryLabels(map.get("a"))).toEqual(["Haircut", "Spa"]);
    expect(salonCategoryLabels(undefined)).toEqual([]);
    expect(categoriesBySalon(null).size).toBe(0);
  });
});

describe("priceBandOf (starting price ranges)", () => {
  it.each([
    [0, "under-200"], [199, "under-200"], [200, "200-499"], [499, "200-499"],
    [500, "500-999"], [999, "500-999"], [1000, "1000-plus"], [25000, "1000-plus"],
  ])("₹%s → %s", (price, band) => {
    expect(priceBandOf(price)).toBe(band);
  });
  it.each([[null], [undefined], [Number.NaN], [-1], [Number.POSITIVE_INFINITY]])("%s → null", (price) => {
    expect(priceBandOf(price as number | null)).toBeNull();
  });
});

describe("applyDiscoveryFilters", () => {
  const salons = [
    salon("a", { waitTime: 10 }),
    salon("b", { waitTime: 40 }),
    salon("c", { is_manual_closed: true }),
    salon("d", { waitTime: null }),
  ];
  const ctx = {
    now: NOON,
    categories: categoriesBySalon([
      { salon_id: "a", name: "Haircut" },
      { salon_id: "a", name: "SPA" },
      { salon_id: "b", name: "Haircut" },
      { salon_id: "c", name: "colour" },
    ]),
    startingPrices: new Map([["a", 300], ["b", 150], ["c", 600]]),
  };
  const run = (f: Partial<DiscoveryFilterState>) => applyDiscoveryFilters(salons, { ...EMPTY_FILTERS, ...f }, ctx).map((s) => s.id);

  it("no filters → every salon, in order", () => {
    expect(run({})).toEqual(["a", "b", "c", "d"]);
  });
  it("availability", () => {
    expect(run({ openNow: true })).toEqual(["a", "b", "d"]);
    expect(run({ shortWait: true })).toEqual(["a"]);
  });
  it("services: OR within the group; salons without categorised services never match", () => {
    expect(run({ categories: ["spa"] })).toEqual(["a"]);
    expect(run({ categories: ["spa", "hair-colour"] })).toEqual(["a", "c"]);
  });
  it("starting price: OR within the group; salons without a price never match", () => {
    expect(run({ priceBands: ["under-200"] })).toEqual(["b"]);
    expect(run({ priceBands: ["under-200", "500-999"] })).toEqual(["b", "c"]);
  });
  it("AND across groups", () => {
    expect(run({ categories: ["haircut"], priceBands: ["200-499"] })).toEqual(["a"]);
    expect(run({ openNow: true, categories: ["hair-colour"] })).toEqual([]);
    expect(run({ shortWait: true, categories: ["haircut"], priceBands: ["under-200"] })).toEqual([]);
  });
  it("empty input → empty output", () => {
    expect(applyDiscoveryFilters([], { ...EMPTY_FILTERS, openNow: true }, ctx)).toEqual([]);
  });
});

describe("filterOptionCounts", () => {
  it("offers only options that match salons, with real counts", () => {
    const salons = [salon("a"), salon("b", { is_manual_closed: true }), salon("c", { waitTime: 30 })];
    const counts = filterOptionCounts(salons, {
      now: NOON,
      categories: categoriesBySalon([{ salon_id: "a", name: "Haircut" }, { salon_id: "b", name: "SPA" }, { salon_id: "c", name: "bread" }]),
      startingPrices: new Map([["a", 300], ["b", 2000]]),
    });
    expect(counts.categories).toEqual([
      { id: "haircut", label: "Haircut", count: 1 },
      { id: "spa", label: "Spa", count: 1 },
    ]);
    expect(counts.priceBands.map((b) => [b.id, b.count])).toEqual([["200-499", 1], ["1000-plus", 1]]);
    expect(counts.openNow).toBe(2);
    expect(counts.shortWait).toBe(1);
  });
  it("no services loaded → no service or price options", () => {
    const counts = filterOptionCounts([salon("a")], { now: NOON, categories: new Map(), startingPrices: undefined });
    expect(counts.categories).toEqual([]);
    expect(counts.priceBands).toEqual([]);
  });
});

describe("activeFilterChips / countActiveFilters / toggleIn", () => {
  it("labels every active filter and removes each one individually", () => {
    const state: DiscoveryFilterState = { openNow: true, shortWait: false, categories: ["spa"], priceBands: ["under-200", "200-499"] };
    const chips = activeFilterChips(state);
    expect(chips.map((c) => c.label)).toEqual(["Open now", "Spa", "Starting under ₹200", "Starting ₹200–₹499"]);
    expect(countActiveFilters(state)).toBe(4);
    expect(chips[1].remove(state)).toEqual({ ...state, categories: [] });
    expect(chips[2].remove(state).priceBands).toEqual(["200-499"]);
    expect(activeFilterChips(EMPTY_FILTERS)).toEqual([]);
  });
  it("toggleIn adds and removes without mutating", () => {
    const list = ["a"] as const;
    expect(toggleIn(list, "b")).toEqual(["a", "b"]);
    expect(toggleIn(list, "a")).toEqual([]);
    expect(list).toEqual(["a"]);
  });
});
