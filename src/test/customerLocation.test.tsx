import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { calculateDistance, distanceToSalonKm } from "@/lib/location";
import { nearestSalon, sortSalons } from "@/lib/salonDiscovery";
import { forgetRememberedLocation, REMEMBERED_LOCATION_MAX_AGE_MS, useGeolocation } from "@/hooks/useGeolocation";

// Customer location → salon distances → nearest salon. Pure helpers plus the
// geolocation hook's in-memory "remember" option (never storage).

describe("Haversine distance (straight line)", () => {
  it("one degree of latitude is ~111.2 km", () => {
    expect(calculateDistance(0, 0, 1, 0)).toBeCloseTo(111.195, 2);
  });

  it("matches the standard reference pair: Nashville (BNA) → Los Angeles (LAX)", () => {
    // Rosetta Code's Haversine example: 2887.26 km with R = 6372.8 km, i.e. 2886.44 km with R = 6371 km.
    expect(Math.abs(calculateDistance(36.12, -86.67, 33.94, -118.4) - 2886.44)).toBeLessThan(0.1);
  });

  it("a short hop inside a city: Laxmi Nagar → Preet Vihar is ~2 km", () => {
    const km = calculateDistance(28.6304, 77.2774, 28.6417, 77.2953);
    expect(km).toBeGreaterThan(1.9);
    expect(km).toBeLessThan(2.3);
  });

  it("is 0 for the same point and symmetric", () => {
    expect(calculateDistance(28.6, 77.2, 28.6, 77.2)).toBe(0);
    expect(calculateDistance(28.6, 77.2, 28.7, 77.1)).toBeCloseTo(calculateDistance(28.7, 77.1, 28.6, 77.2), 10);
  });

  it.each([
    ["no customer position", null, { latitude: 28.6, longitude: 77.2 }],
    ["salon without latitude", { lat: 28.6, lng: 77.2 }, { latitude: null, longitude: 77.2 }],
    ["salon without longitude", { lat: 28.6, lng: 77.2 }, { latitude: 28.6, longitude: undefined }],
    ["non-numeric coordinate", { lat: 28.6, lng: 77.2 }, { latitude: Number.NaN, longitude: 77.2 }],
  ])("never fabricates a distance: %s → undefined", (_label, user, salon) => {
    expect(distanceToSalonKm(user, salon)).toBeUndefined();
  });
});

describe("nearest salon", () => {
  const s = (id: string, name: string, distance?: number | null, extra: Record<string, unknown> = {}) => ({ id, name, distance, ...extra });

  it("is the salon with the smallest calculated distance", () => {
    const list = [s("a", "Far", 4.2), s("b", "Middle", 1.6), s("c", "Close", 0.7), s("d", "No coords")];
    expect(nearestSalon(list)?.salon.id).toBe("c");
    expect(nearestSalon(list)?.demo).toBe(false);
  });

  it("is null when no salon has a distance (never a claim without coordinates)", () => {
    expect(nearestSalon([s("a", "A"), s("b", "B", null), s("c", "C", Number.NaN)])).toBeNull();
    expect(nearestSalon([])).toBeNull();
  });

  it("ties are deterministic: by name, then id — whatever the input order", () => {
    const tie = [s("z", "Looks", 1), s("y", "Sam", 1), s("x", "Looks", 1)];
    expect(nearestSalon(tie)?.salon.id).toBe("x");
    expect(nearestSalon([...tie].reverse())?.salon.id).toBe("x");
  });

  it("says when the nearest is a demo/test coordinate", () => {
    expect(nearestSalon([s("a", "Demo", 0.5, { locationDemo: { source: "test" } })])).toMatchObject({ demo: true });
  });
});

describe("Nearest sort", () => {
  const s = (id: string, name: string, distance?: number) => ({ id, name, distance });
  const ids = (list: { id: string }[]) => list.map((x) => x.id);

  it("orders by calculated distance; salons without coordinates stay in the list, after, in Recommended order", () => {
    const list = [s("none-1", "Zed"), s("far", "Far", 9), s("near", "Near", 0.3), s("none-2", "Abe"), s("mid", "Mid", 2)];
    expect(ids(sortSalons(list, "distance"))).toEqual(["near", "mid", "far", "none-1", "none-2"]);
  });

  it("equal distances are ordered by name then id, independent of the API's row order", () => {
    const list = [s("2", "The King", 1.5), s("3", "Looks", 1.5), s("1", "Looks", 1.5)];
    expect(ids(sortSalons(list, "distance"))).toEqual(["1", "3", "2"]);
    expect(ids(sortSalons([...list].reverse(), "distance"))).toEqual(["1", "3", "2"]);
  });

  it("Recommended and Wait time keep their meaning (the tie-break is for distance only)", () => {
    const list = [s("b", "B", 1), s("a", "A", 1)];
    expect(ids(sortSalons(list, "recommended"))).toEqual(["b", "a"]);
  });
});

// ---------------------------------------------------------------------------
describe("useGeolocation", () => {
  let calls: { ok: PositionCallback; fail: PositionErrorCallback }[] = [];
  const getCurrentPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) => {
    calls.push({ ok, fail });
  });
  const answer = (lat = 28.63, lng = 77.27) =>
    act(() => calls[calls.length - 1].ok({ coords: { latitude: lat, longitude: lng, accuracy: 25 } } as GeolocationPosition));
  const fail = (code: number) => act(() => calls[calls.length - 1].fail({ code, message: "x" } as GeolocationPositionError));

  beforeEach(() => {
    calls = [];
    getCurrentPosition.mockClear();
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  afterEach(() => {
    forgetRememberedLocation();
    vi.useRealTimers();
  });

  it("opt-in: nothing is requested until request(); re-renders never request again", () => {
    const { result, rerender } = renderHook(() => useGeolocation({ enabled: false, remember: true }));
    expect(getCurrentPosition).not.toHaveBeenCalled();
    act(() => result.current.request());
    for (let i = 0; i < 5; i++) rerender();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("pending");
    expect(result.current.location).toBeNull(); // no position until the browser returns one
    answer();
    expect(result.current).toMatchObject({ status: "located", location: { lat: 28.63, lng: 77.27 }, accuracy: 25 });
  });

  it("an invalid reading is not a position", () => {
    const { result } = renderHook(() => useGeolocation({ enabled: false, remember: true }));
    act(() => result.current.request());
    act(() => calls[0].ok({ coords: { latitude: Number.NaN, longitude: 77.2 } } as GeolocationPosition));
    expect(result.current).toMatchObject({ status: "unavailable", location: null });
  });

  it.each([
    [1, "Location permission denied"],
    [2, "Location unavailable"],
    [3, "Location request timed out"],
  ])("error code %s → no position, a reason (%s)", (code, message) => {
    const { result } = renderHook(() => useGeolocation({ enabled: false, remember: true }));
    act(() => result.current.request());
    fail(code);
    expect(result.current).toMatchObject({ status: "unavailable", location: null, error: message });
  });

  it("no Geolocation API → unavailable, nothing requested", () => {
    Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
    const { result } = renderHook(() => useGeolocation({ enabled: false, remember: true }));
    act(() => result.current.request());
    expect(result.current).toMatchObject({ status: "unavailable", location: null, error: "Geolocation not supported" });
  });

  it("remember: a later mount (e.g. back to the page) reuses the reading without asking — in memory only", () => {
    const first = renderHook(() => useGeolocation({ enabled: false, remember: true }));
    act(() => first.result.current.request());
    answer(28.61, 77.21);
    first.unmount();

    const again = renderHook(() => useGeolocation({ enabled: false, remember: true }));
    expect(again.result.current).toMatchObject({ status: "located", location: { lat: 28.61, lng: 77.21 } });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    // Never written to browser storage.
    const stored = JSON.stringify({ ...window.localStorage }) + JSON.stringify({ ...window.sessionStorage });
    expect(stored).not.toContain("28.61");
    expect(stored).not.toContain("77.21");
  });

  it("remember: a stale reading (older than the limit) is not reused", () => {
    vi.useFakeTimers({ now: new Date("2026-10-19T10:00:00Z"), toFake: ["Date"] });
    const first = renderHook(() => useGeolocation({ enabled: false, remember: true }));
    act(() => first.result.current.request());
    answer();
    first.unmount();
    vi.setSystemTime(new Date(Date.now() + REMEMBERED_LOCATION_MAX_AGE_MS + 1000));
    const later = renderHook(() => useGeolocation({ enabled: false, remember: true }));
    expect(later.result.current).toMatchObject({ status: "idle", location: null });
  });

  it("remember: a failed refresh forgets the old reading (it is never reused as if current)", () => {
    const first = renderHook(() => useGeolocation({ enabled: false, remember: true }));
    act(() => first.result.current.request());
    answer();
    act(() => first.result.current.request());
    fail(1);
    expect(first.result.current.location).toBeNull();
    first.unmount();
    expect(renderHook(() => useGeolocation({ enabled: false, remember: true })).result.current.location).toBeNull();
  });

  it("without remember (other pages) nothing carries over", () => {
    const first = renderHook(() => useGeolocation({ enabled: false }));
    act(() => first.result.current.request());
    answer();
    first.unmount();
    expect(renderHook(() => useGeolocation({ enabled: false, remember: true })).result.current.location).toBeNull();
  });
});
