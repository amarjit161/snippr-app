import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cityAutoDetectAttempted,
  geolocationAvailability,
  markCityAutoDetectAttempted,
  readSessionCity,
  resetCitySession,
  writeSessionCity,
} from "@/lib/citySession";
import { clearCityCache, reverseGeocodeCity } from "@/lib/cityLocation";

// The /salons city for this tab session (city names only) and the once-per-session
// automatic-detection guard.

beforeEach(() => {
  resetCitySession();
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "permissions", { value: undefined, configurable: true });
  Object.defineProperty(window, "isSecureContext", { value: undefined, configurable: true });
});

describe("session city", () => {
  it("round-trips a manual choice and a detected place", () => {
    writeSessionCity({ source: "manual", name: "Delhi" });
    expect(readSessionCity()).toEqual({ source: "manual", name: "Delhi" });
    const place = { city: "Noida", country: "India", candidates: ["Noida", "Gautam Buddha Nagar"] };
    writeSessionCity({ source: "detected", place });
    expect(readSessionCity()).toEqual({ source: "detected", place });
    writeSessionCity(null);
    expect(readSessionCity()).toBeNull();
  });

  it("stores city names only — anything else on the object is dropped", () => {
    const place = { city: "Noida", country: "India", candidates: ["Noida"], lat: 28.535, lng: 77.391 };
    writeSessionCity({ source: "detected", place });
    const raw = Object.values({ ...window.sessionStorage }).join(" ");
    expect(raw).not.toMatch(/28\.535|77\.391|lat|lng/);
    expect(readSessionCity()).toEqual({ source: "detected", place: { city: "Noida", country: "India", candidates: ["Noida"] } });
  });

  it.each([["not json"], [JSON.stringify({ source: "manual", name: "" })], [JSON.stringify({ source: "detected", place: { city: 4 } })], [JSON.stringify({ source: "other" })]])(
    "ignores malformed stored data %s",
    (raw) => {
      window.sessionStorage.setItem("snippr:salons:city", raw);
      expect(readSessionCity()).toBeNull();
    },
  );

  it("works without storage (private mode): no crash, nothing remembered", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writeSessionCity({ source: "manual", name: "Delhi" })).not.toThrow();
    expect(readSessionCity()).toBeNull();
  });
});

describe("once-per-session automatic detection guard", () => {
  it("is false until marked; then true (also when storage is blocked)", () => {
    expect(cityAutoDetectAttempted()).toBe(false);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    markCityAutoDetectAttempted();
    expect(cityAutoDetectAttempted()).toBe(true); // in-memory fallback
  });

  it("survives a remount via sessionStorage", () => {
    markCityAutoDetectAttempted();
    expect(window.sessionStorage.getItem("snippr:salons:city-auto-detect")).toBe("1");
  });
});

describe("geolocationAvailability (never asks)", () => {
  it("unsupported without the Geolocation API", async () => {
    const saved = Object.getOwnPropertyDescriptor(navigator, "geolocation");
    Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
    expect(await geolocationAvailability()).toBe("unsupported");
    if (saved) Object.defineProperty(navigator, "geolocation", saved);
  });

  it("insecure on a non-https page", async () => {
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition: vi.fn() }, configurable: true });
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
    expect(await geolocationAvailability()).toBe("insecure");
  });

  it.each([["granted"], ["prompt"], ["denied"]] as const)("reports the permission state %s", async (state) => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
    Object.defineProperty(navigator, "permissions", { value: { query: vi.fn(async () => ({ state })) }, configurable: true });
    expect(await geolocationAvailability()).toBe(state);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("unknown when the Permissions API is missing or throws", async () => {
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition: vi.fn() }, configurable: true });
    expect(await geolocationAvailability()).toBe("unknown");
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn(async () => { throw new TypeError("unsupported name"); }) },
      configurable: true,
    });
    expect(await geolocationAvailability()).toBe("unknown");
  });
});

describe("reverse lookup cache", () => {
  it("is memory-only: nothing position-related goes into browser storage", async () => {
    clearCityCache();
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ address: { city: "Noida", country: "India" } }) }) as Response);
    expect((await reverseGeocodeCity(28.535, 77.391, { fetchImpl }))?.city).toBe("Noida");
    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.length).toBe(0);
    // Still cached in memory: a second lookup makes no request.
    await reverseGeocodeCity(28.535, 77.391, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
