import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCityCache,
  matchSalonCity,
  normalizeCity,
  parseNominatimPlace,
  reverseGeocodeCity,
  cityValueIssue,
  salonCityOptions,
} from "@/lib/cityLocation";

const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

beforeEach(() => {
  clearCityCache();
  window.sessionStorage.clear();
});

describe("normalizeCity", () => {
  it.each([
    ["  Delhi ", "delhi"],
    ["NEW   DELHI", "delhi"],
    ["Gurgaon", "gurugram"],
    ["Bangalore", "bengaluru"],
    ["Bombay", "mumbai"],
    ["Calcutta", "kolkata"],
    ["Noida", "noida"],
    [null, ""],
  ])("%j → %j", (input, expected) => {
    expect(normalizeCity(input as string | null)).toBe(expected);
  });
});

describe("parseNominatimPlace", () => {
  it("takes the settlement (city → town → village → municipality) and the country", () => {
    expect(parseNominatimPlace({ address: { city: "Noida", state: "Uttar Pradesh", country: "India" } })).toEqual({
      city: "Noida", country: "India", candidates: ["Noida"],
    });
    expect(parseNominatimPlace({ address: { town: "Greater Noida", state_district: "Gautam Buddha Nagar", country: "India" } })?.candidates)
      .toEqual(["Greater Noida", "Gautam Buddha Nagar"]);
    expect(parseNominatimPlace({ address: { village: "Dadri" } })).toMatchObject({ city: "Dadri", country: null });
  });

  it("Delhi's state is included as a candidate (it is a city-state); other states are not", () => {
    expect(parseNominatimPlace({ address: { city: "New Delhi", state: "Delhi" } })?.candidates).toEqual(["New Delhi", "Delhi"]);
    expect(parseNominatimPlace({ address: { city: "Lucknow", state: "Uttar Pradesh" } })?.candidates).toEqual(["Lucknow"]);
  });

  it.each([[null], [{}], [{ address: null }], [{ address: { state: "Haryana", country: "India" } }], [{ address: { road: "MG Road" } }], [{ error: "Unable to geocode" }]])(
    "no reliable city in %j → null",
    (body) => {
      expect(parseNominatimPlace(body)).toBeNull();
    },
  );
});

describe("reverseGeocodeCity", () => {
  it("calls Nominatim reverse at city zoom and caches the answer for the session", async () => {
    const fetchImpl = vi.fn(async () => okResponse({ address: { city: "Noida", country: "India" } }));
    const place = await reverseGeocodeCity(28.5355, 77.391, { fetchImpl });
    expect(place).toMatchObject({ city: "Noida", country: "India" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toBe(
      "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&accept-language=en&lat=28.53550&lon=77.39100",
    );
    // Same ~1 km spot again: served from cache, no second request.
    await reverseGeocodeCity(28.5361, 77.3899, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["HTTP error", async () => ({ ok: false, status: 429, json: async () => ({}) }) as Response],
    ["network failure", async () => { throw new TypeError("Failed to fetch"); }],
    ["invalid JSON", async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad"); } }) as unknown as Response],
    ["no city in the answer", async () => okResponse({ address: { state: "Haryana" } })],
  ])("%s → null (never a guess)", async (_label, impl) => {
    expect(await reverseGeocodeCity(28.6, 77.2, { fetchImpl: vi.fn(impl) as unknown as typeof fetch })).toBeNull();
  });

  it("invalid coordinates → null without a request", async () => {
    const fetchImpl = vi.fn();
    expect(await reverseGeocodeCity(Number.NaN, 77, { fetchImpl })).toBeNull();
    expect(await reverseGeocodeCity(120, 77, { fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("an aborted lookup rejects (so callers can ignore it) and is not cached", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetchImpl = vi.fn(async () => { throw abort; });
    await expect(reverseGeocodeCity(28.6, 77.2, { fetchImpl })).rejects.toBe(abort);
    const fetchOk = vi.fn(async () => okResponse({ address: { city: "Delhi" } }));
    expect(await reverseGeocodeCity(28.6, 77.2, { fetchImpl: fetchOk })).toMatchObject({ city: "Delhi" });
  });
});

describe("matchSalonCity / salonCityOptions", () => {
  it("matches only exact names or known aliases, most specific candidate first", () => {
    const cities = ["Delhi", "Noida", "Uttar Pradesh"];
    expect(matchSalonCity({ city: "Noida", country: "India", candidates: ["Noida"] }, cities)).toBe("Noida");
    expect(matchSalonCity({ city: "New Delhi", country: "India", candidates: ["New Delhi", "Delhi"] }, cities)).toBe("Delhi");
    expect(matchSalonCity({ city: "Gurugram", country: "India", candidates: ["Gurugram"] }, cities)).toBeNull();
    // A state name in salon data is never matched from a city-level detection.
    expect(matchSalonCity({ city: "Lucknow", country: "India", candidates: ["Lucknow"] }, cities)).toBeNull();
  });

  it("counts real salons per valid city (case/space-insensitive)", () => {
    expect(salonCityOptions([{ city: "Delhi" }, { city: " delhi " }, { city: "Noida" }]).cities).toEqual([
      { name: "Delhi", count: 2 },
      { name: "Noida", count: 1 },
    ]);
    expect(salonCityOptions([])).toEqual({ cities: [], unlisted: 0 });
  });
});

describe("city data quality (no state names, no placeholders as cities)", () => {
  it.each([
    ["Uttar Pradesh", "state"],
    ["  uttar   pradesh ", "state"],
    ["West Bengal", "state"],
    ["Orissa", "state"],
    ["Jammu and Kashmir", "state"],
    ["Test", "placeholder"],
    ["N/A", "placeholder"],
    ["unknown", "placeholder"],
    ["", "missing"],
    [null, "missing"],
  ])("%j → %s", (value, issue) => {
    expect(cityValueIssue(value as string | null)).toBe(issue);
  });

  it.each([["Delhi"], ["Noida"], ["Chandigarh"], ["Puducherry"], ["Gurugram"], ["Testville"]])(
    "%j is a usable city (city-states and real names containing 'test' are not excluded)",
    (value) => {
      expect(cityValueIssue(value)).toBeNull();
    },
  );

  it("state names and placeholders are not city options; their salons are counted, never dropped", () => {
    const salons = [
      { city: "Delhi" }, { city: "Delhi" }, { city: "Noida" },
      { city: "Uttar Pradesh" }, // e.g. address "Noida 62": the owner entered the state
      { city: "Test" }, // e.g. an internal test record
      { city: null },
    ];
    const options = salonCityOptions(salons);
    expect(options.cities.map((c) => c.name)).toEqual(["Delhi", "Noida"]);
    expect(options.unlisted).toBe(3);
    expect(options.cities.reduce((n, c) => n + c.count, 0) + options.unlisted).toBe(salons.length);
  });
});
