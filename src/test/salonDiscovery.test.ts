import { describe, expect, it } from "vitest";
import {
  filterSalons,
  formatStartingPrice,
  getStartingPrices,
  getWaitBadge,
  isSalonOpen,
  isWithinOperatingHours,
  normalizeWaitMinutes,
  sortSalons,
  type DiscoverySalon,
} from "@/lib/salonDiscovery";

/** A local date at the given time (the helpers read local hours/minutes). */
const at = (hh: number, mm: number) => new Date(2026, 9, 17, hh, mm);
const NOON = at(12, 0);

const salon = (id: string, extra: Partial<DiscoverySalon> = {}): DiscoverySalon => ({
  id,
  open_time: "09:00",
  close_time: "21:00",
  is_manual_closed: false,
  ...extra,
});
const ids = (list: DiscoverySalon[]) => list.map((s) => s.id);

// ---------------------------------------------------------------------------
describe("isWithinOperatingHours (same rules as SalonCard / SalonPage / QuickBooking)", () => {
  it("no open or close time → open", () => {
    expect(isWithinOperatingHours(null, "21:00", NOON)).toBe(true);
    expect(isWithinOperatingHours("09:00", null, NOON)).toBe(true);
    expect(isWithinOperatingHours(undefined, undefined, NOON)).toBe(true);
    expect(isWithinOperatingHours("", "", NOON)).toBe(true);
  });

  it("same-day hours, both ends inclusive", () => {
    expect(isWithinOperatingHours("09:00", "21:00", at(8, 59))).toBe(false);
    expect(isWithinOperatingHours("09:00", "21:00", at(9, 0))).toBe(true);
    expect(isWithinOperatingHours("09:00", "21:00", at(21, 0))).toBe(true);
    expect(isWithinOperatingHours("09:00", "21:00", at(21, 1))).toBe(false);
  });

  it("accepts HH:MM:SS", () => {
    expect(isWithinOperatingHours("09:30:00", "18:00:00", at(9, 29))).toBe(false);
    expect(isWithinOperatingHours("09:30:00", "18:00:00", at(9, 30))).toBe(true);
  });

  it("overnight hours wrap past midnight", () => {
    expect(isWithinOperatingHours("22:00", "06:00", at(23, 0))).toBe(true);
    expect(isWithinOperatingHours("22:00", "06:00", at(5, 59))).toBe(true);
    expect(isWithinOperatingHours("22:00", "06:00", at(12, 0))).toBe(false);
  });

  it("unparseable times compare as closed (NaN), exactly like the existing copies", () => {
    expect(isWithinOperatingHours("abc", "xyz", NOON)).toBe(false);
  });
});

describe("isSalonOpen", () => {
  it("manually closed overrides opening hours", () => {
    expect(isSalonOpen(salon("a", { is_manual_closed: true }), NOON)).toBe(false);
  });
  it("open within hours, closed outside", () => {
    expect(isSalonOpen(salon("a"), NOON)).toBe(true);
    expect(isSalonOpen(salon("a"), at(22, 0))).toBe(false);
  });
  it("null is_manual_closed counts as not closed", () => {
    expect(isSalonOpen(salon("a", { is_manual_closed: null }), NOON)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("normalizeWaitMinutes", () => {
  it.each([
    [0, 0], [3, 3], [15.4, 15], [15.5, 16], [42, 42],
  ])("%s → %s", (input, expected) => {
    expect(normalizeWaitMinutes(input)).toBe(expected);
  });

  it.each([[null], [undefined], [Number.NaN], [Number.POSITIVE_INFINITY], [-1], ["10"], [{}]])(
    "%s → null (never a made-up number)",
    (input) => {
      expect(normalizeWaitMinutes(input)).toBeNull();
    },
  );
});

describe("getWaitBadge", () => {
  it.each([
    [0, "now", "green", "Now"],
    [3, "now", "green", "Now"],
    [4, "short", "green", "4 min"],
    [15, "short", "green", "15 min"],
    [16, "moderate", "amber", "16 min"],
    [30, "moderate", "amber", "30 min"],
    [31, "long", "red", "31 min"],
    [90, "long", "red", "90 min"],
  ])("%s min open → %s / %s / %s", (minutes, tone, color, label) => {
    const badge = getWaitBadge(minutes, true);
    expect(badge).toMatchObject({ tone, color, label, minutes });
  });

  it("rounding keeps label and band consistent (15.4 → short, 15.5 → moderate)", () => {
    expect(getWaitBadge(15.4, true)).toMatchObject({ tone: "short", label: "15 min" });
    expect(getWaitBadge(15.5, true)).toMatchObject({ tone: "moderate", label: "16 min" });
    expect(getWaitBadge(3.4, true)).toMatchObject({ tone: "now", label: "Now" });
  });

  it("closed → 'Closed', no wait shown even if a wait value exists", () => {
    expect(getWaitBadge(5, false)).toEqual({
      tone: "closed", color: "muted", label: "Closed", description: "Closed now", minutes: null,
    });
    expect(getWaitBadge(null, false).tone).toBe("closed");
  });

  it.each([[null], [undefined], [Number.NaN], [-5], ["12"]])("open with unusable wait %s → unknown, no number", (value) => {
    expect(getWaitBadge(value, true)).toEqual({
      tone: "unknown", color: "muted", label: "—", description: "Wait time unavailable", minutes: null,
    });
  });

  it("descriptions are accessible sentences", () => {
    expect(getWaitBadge(12, true).description).toBe("Short wait, about 12 minutes");
    expect(getWaitBadge(20, true).description).toBe("Moderate wait, about 20 minutes");
    expect(getWaitBadge(45, true).description).toBe("Long wait, about 45 minutes");
  });
});

// ---------------------------------------------------------------------------
describe("filterSalons", () => {
  const list = [
    salon("open-short", { waitTime: 10 }),
    salon("open-now", { waitTime: 0 }),
    salon("open-boundary", { waitTime: 15 }),
    salon("open-long", { waitTime: 16 }),
    salon("open-unknown", { waitTime: null }),
    salon("manual-closed", { waitTime: 5, is_manual_closed: true }),
    salon("after-hours", { waitTime: 5, open_time: "13:00", close_time: "14:00" }),
  ];

  it("no filters → everything, in the same order", () => {
    expect(ids(filterSalons(list, {}, NOON))).toEqual(ids(list));
  });

  it("open now → excludes manually closed and out-of-hours salons", () => {
    expect(ids(filterSalons(list, { openNow: true }, NOON))).toEqual([
      "open-short", "open-now", "open-boundary", "open-long", "open-unknown",
    ]);
  });

  it("short wait → open, known wait, ≤ 15 (boundary included; unknown and closed excluded)", () => {
    expect(ids(filterSalons(list, { shortWait: true }, NOON))).toEqual(["open-short", "open-now", "open-boundary"]);
  });

  it("filters combine with AND", () => {
    expect(ids(filterSalons(list, { openNow: true, shortWait: true }, NOON))).toEqual([
      "open-short", "open-now", "open-boundary",
    ]);
  });

  it("does not mutate the input; empty input → empty output", () => {
    const copy = [...list];
    filterSalons(list, { openNow: true }, NOON);
    expect(list).toEqual(copy);
    expect(filterSalons([], { openNow: true, shortWait: true }, NOON)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("sortSalons", () => {
  it("recommended keeps the input order exactly", () => {
    const list = [salon("c", { distance: 3 }), salon("a", { distance: 1 }), salon("b", { distance: 2 })];
    expect(ids(sortSalons(list, "recommended", NOON))).toEqual(["c", "a", "b"]);
  });

  it("distance: nearest first, unknown distances last, ties keep input order", () => {
    const list = [
      salon("unknown-1"),
      salon("far", { distance: 5.2 }),
      salon("tie-1", { distance: 1 }),
      salon("nan", { distance: Number.NaN }),
      salon("tie-2", { distance: 1 }),
      salon("near", { distance: 0.4 }),
      salon("negative", { distance: -2 }),
    ];
    expect(ids(sortSalons(list, "distance", NOON))).toEqual([
      "near", "tie-1", "tie-2", "far", "unknown-1", "nan", "negative",
    ]);
  });

  it("wait: open with known wait (shortest first), then open unknown, then closed; ties stable", () => {
    const list = [
      salon("closed-short", { waitTime: 1, is_manual_closed: true }),
      salon("open-unknown", { waitTime: null }),
      salon("open-20", { waitTime: 20 }),
      salon("open-5a", { waitTime: 5 }),
      salon("after-hours", { waitTime: 0, open_time: "13:00", close_time: "14:00" }),
      salon("open-5b", { waitTime: 5 }),
      salon("open-0", { waitTime: 0 }),
    ];
    expect(ids(sortSalons(list, "wait", NOON))).toEqual([
      "open-0", "open-5a", "open-5b", "open-20", "open-unknown", "closed-short", "after-hours",
    ]);
  });

  it("returns a new array and never mutates the input", () => {
    const list = [salon("b", { distance: 2 }), salon("a", { distance: 1 })];
    const result = sortSalons(list, "distance", NOON);
    expect(result).not.toBe(list);
    expect(ids(list)).toEqual(["b", "a"]);
  });

  it.each(["recommended", "distance", "wait"] as const)("empty input → empty output (%s)", (sort) => {
    expect(sortSalons([], sort, NOON)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("getStartingPrices", () => {
  it("lowest valid price per salon; zero is kept", () => {
    const prices = getStartingPrices([
      { salon_id: "a", price: 300 },
      { salon_id: "a", price: 199 },
      { salon_id: "b", price: 0 },
      { salon_id: "b", price: 150 },
      { salon_id: "c", price: 450 },
    ]);
    expect(Object.fromEntries(prices)).toEqual({ a: 199, b: 0, c: 450 });
  });

  it("ignores null, non-numeric, non-finite and negative prices", () => {
    const prices = getStartingPrices([
      { salon_id: "a", price: null },
      { salon_id: "a", price: Number.NaN },
      { salon_id: "a", price: Number.POSITIVE_INFINITY },
      { salon_id: "a", price: -50 },
      { salon_id: "a", price: "100" as unknown as number },
      { salon_id: "a", price: 250 },
      { salon_id: "only-invalid", price: null },
      { salon_id: "only-invalid", price: -1 },
    ]);
    expect(Object.fromEntries(prices)).toEqual({ a: 250 });
    expect(prices.has("only-invalid")).toBe(false);
  });

  it("ignores services without a salon", () => {
    const prices = getStartingPrices([
      { salon_id: null, price: 10 },
      { salon_id: "", price: 10 },
      { price: 10 },
      null as unknown as { salon_id: string; price: number },
    ]);
    expect(prices.size).toBe(0);
  });

  it("empty, null or undefined input → empty map", () => {
    expect(getStartingPrices([]).size).toBe(0);
    expect(getStartingPrices(null).size).toBe(0);
    expect(getStartingPrices(undefined).size).toBe(0);
  });
});

describe("formatStartingPrice", () => {
  it("₹0 → 'Free'", () => {
    expect(formatStartingPrice(0)).toBe("Free");
  });

  it("a positive price → 'From ₹…' using the app's INR formatting", () => {
    expect(formatStartingPrice(199)).toBe("From ₹199");
    expect(formatStartingPrice(1500)).toBe("From ₹1,500");
  });

  it.each([[null], [undefined], [Number.NaN], [-1], [Number.POSITIVE_INFINITY]])("%s → null (show nothing)", (value) => {
    expect(formatStartingPrice(value)).toBeNull();
  });
});
