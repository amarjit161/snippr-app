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

  it.each(TEST_SALON_LOCATIONS.map((t) => [t.salonName, t] as const))(
    "%s: its exact fixture coordinate becomes one labelled demo marker",
    (_name, t) => {
      const [row] = withTestLocations([{ id: t.salonId, latitude: null, longitude: null }], true);
      expect([row.latitude, row.longitude]).toEqual([t.lat, t.lng]);
      expect(row.locationDemo).toEqual({ status: t.status, basis: t.basis });
      const points = toMapPoints([
        { ...row, name: t.salonName, open_time: null, close_time: null, is_manual_closed: false, waitTime: 0 },
      ]);
      expect(points).toHaveLength(1);
      expect(points[0].position).toEqual([t.lat, t.lng]);
      expect(points[0].label).toMatch(/, demo location$/);
      expect(points[0].approximate).toBeUndefined();
    },
  );

  it("the fixture covers exactly these six salon ids (no extra or invented entries)", () => {
    expect(TEST_SALON_LOCATIONS.map((t) => t.salonId)).toEqual([
      "59581580-0ade-4372-a4f3-73f3f7778760",
      "19b6801b-321a-41ed-b3fc-603f2d3b5a11",
      "1212f6b0-06ef-4384-a88f-1d5395d19890",
      "6d8ad927-22d4-4e0b-9287-1594c4426620",
      "f44a75eb-9f0f-4a31-a34a-c51f7f81c576",
      "50a23609-e0f3-45d4-93f4-825d37993d2d",
    ]);
    // A salon outside the fixture (e.g. the one without an address) gets nothing.
    const [other] = withTestLocations([{ id: "f10567a2-0000-0000-0000-000000000000", latitude: null, longitude: null }], true);
    expect(other).toEqual({ id: "f10567a2-0000-0000-0000-000000000000", latitude: null, longitude: null });
  });

  it("demo salons become normal map markers (not the hollow approximate style)", () => {
    const [demo] = withTestLocations([{ id: TEST_SALON_LOCATIONS[0].salonId, latitude: null, longitude: null }], true);
    const [point] = toMapPoints([
      { ...demo, name: "John Sallon", open_time: null, close_time: null, is_manual_closed: false, waitTime: 0 },
    ]);
    expect(point.approximate).toBeUndefined();
    // Named as a demo location for screen readers (and labelled in the UI).
    expect(point.label).toBe("John Sallon, No wait, walk in now, demo location");
  });
});
