import { describe, expect, it } from "vitest";
import {
  NEEDS_MANUAL_SELECTION,
  TEST_LOCATIONS_ENABLED,
  TEST_SALON_LOCATIONS,
  withTestLocations,
} from "@/dev/testSalonLocations";
import { isWithinIndia, locationQualityOf } from "@/lib/salonLocation";
import { toMapPoints } from "@/lib/salonMapPoints";

// The development-only demo coordinates: deterministic, derived from each salon's
// own address, never applied in tests or production, never overriding real data.

describe("development demo-location fixture", () => {
  it("is never active in tests (and production builds don't include it)", () => {
    expect(TEST_LOCATIONS_ENABLED).toBe(false);
    const rows = [{ id: TEST_SALON_LOCATIONS[0].salonId, latitude: null, longitude: null }];
    expect(withTestLocations(rows)).toBe(rows);
  });

  it("every entry is in India, ≤3 decimals, with a status and recorded basis", () => {
    expect(TEST_SALON_LOCATIONS.map((t) => t.salonName)).toEqual(["John Sallon", "luxi", "Soham", "Sam", "The King", "Looks"]);
    for (const t of TEST_SALON_LOCATIONS) {
      expect(isWithinIndia(t.lat, t.lng)).toBe(true);
      expect(Math.round(t.lat * 1000) / 1000).toBe(t.lat);
      expect(Math.round(t.lng * 1000) / 1000).toBe(t.lng);
      expect(["locality-centre", "landmark", "street", "ambiguous-pin-area"]).toContain(t.status);
      expect(t.basis.length).toBeGreaterThan(10);
    }
    // The test salon without a stored address deliberately has no coordinate.
    expect(TEST_SALON_LOCATIONS.some((t) => t.salonName.startsWith("Realtime Proof"))).toBe(false);
  });

  it("each salon has its own coordinate (no shared or arbitrary positions)", () => {
    const keys = TEST_SALON_LOCATIONS.map((t) => `${t.lat},${t.lng}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ambiguous addresses are flagged for manual selection", () => {
    expect(NEEDS_MANUAL_SELECTION).toEqual(["John Sallon"]);
    expect(TEST_SALON_LOCATIONS.find((t) => t.salonName === "John Sallon")!.basis).toMatch(/NEEDS MANUAL SELECTION/);
  });

  it("when enabled, adds demo coordinates (with provenance) only to listed salons that have none", () => {
    const listed = TEST_SALON_LOCATIONS[2];
    const rows = [
      { id: listed.salonId, latitude: null, longitude: null },
      { id: TEST_SALON_LOCATIONS[3].salonId, latitude: 28.1, longitude: 77.1 }, // real stored coords win
      { id: "not-in-fixture", latitude: null, longitude: null },
    ];
    const out = withTestLocations(rows, true);
    expect(out[0]).toMatchObject({ latitude: listed.lat, longitude: listed.lng, locationDemo: { status: listed.status, basis: listed.basis } });
    expect(locationQualityOf(out[0])).toBe("demo");
    expect(out[1]).toEqual(rows[1]);
    expect(locationQualityOf(out[1])).toBe("on-file");
    expect(out[2]).toEqual(rows[2]);
    expect(locationQualityOf(out[2])).toBe("missing");
  });

  it("demo salons become normal map markers (not the hollow approximate style)", () => {
    const [demo] = withTestLocations([{ id: TEST_SALON_LOCATIONS[0].salonId, latitude: null, longitude: null }], true);
    const [point] = toMapPoints([
      { ...demo, name: "John Sallon", open_time: null, close_time: null, is_manual_closed: false, waitTime: 0 },
    ]);
    expect(point.approximate).toBeUndefined();
    expect(point.label).toBe("John Sallon, No wait, walk in now");
  });
});
