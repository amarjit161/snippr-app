import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_ADDRESS,
  composeAddress,
  composeLocationLine,
  findAddressOnMap,
  formatDistance,
  isValidPincode,
  isWithinIndia,
  locationQualityOf,
  salonLocationPayload,
  splitLegacyAddress,
  validateCoordinates,
  validateSalonAddress,
  LOCATION_CONFIRMATION_FLAG,
  LOCATION_MESSAGES,
  PIN_SOURCE_LABEL,
  pinSourceLabel,
  salonLocationProblem,
  type SalonAddress,
  type SalonPin,
} from "@/lib/salonLocation";

const ADDRESS: SalonAddress = {
  building: "Shop 12",
  street: "Vikas Marg",
  locality: "Preet Vihar",
  city: "Delhi",
  state: "Delhi",
  pincode: "110092",
};

describe("locationQualityOf (never claims owner-verified)", () => {
  it.each([
    [{ latitude: 28.6, longitude: 77.2 }, "on-file"],
    [{ latitude: 28.6, longitude: 77.2, locationApproximate: true }, "approximate"],
    [{ latitude: 28.6, longitude: 77.2, locationDemo: { status: "landmark", basis: "station" } }, "demo"],
    [{ latitude: null, longitude: null, locationDemo: { status: "landmark", basis: "station" } }, "missing"],
    [{ latitude: null, longitude: 77.2 }, "missing"],
    [{ latitude: Number.NaN, longitude: 77.2 }, "missing"],
    [{}, "missing"],
  ])("%j → %s", (salon, quality) => {
    expect(locationQualityOf(salon as never)).toBe(quality);
  });
});

describe("formatDistance (no false precision)", () => {
  it.each([
    [1.234, false, "1.2 km"],
    [1.5, false, "1.5 km"],
    [2, false, "2.0 km"],
    [0.4, false, "400 m"],
    [0.8549, false, "850 m"],
    [0.9996, false, "1.0 km"],
    [0.02, false, "< 50 m"],
    [2.6, true, "≈ 3 km"],
    [0.4, true, "≈ <1 km"],
  ])("%s km, approximate=%s → %s", (km, approx, text) => {
    expect(formatDistance(km, approx)).toBe(text);
  });
  it.each([[undefined], [null], [Number.NaN], [-1]])("%s → null (no distance shown)", (km) => {
    expect(formatDistance(km as number | null, false)).toBeNull();
  });
});

describe("owner address validation", () => {
  it("a complete address has no errors (building is optional)", () => {
    expect(validateSalonAddress({ ...ADDRESS, building: "" })).toEqual({});
  });
  it("reports each missing field next to its field", () => {
    expect(validateSalonAddress(EMPTY_ADDRESS)).toEqual({
      street: "Enter the street or road",
      locality: "Enter the locality or area",
      city: "Enter the city",
      state: "Enter the state",
      pincode: "Enter the 6-digit PIN code",
    });
  });
  it.each([["110092", true], ["201309", true], ["011009", false], ["1100092", false], ["11009", false], ["11a092", false]])(
    "PIN %s valid=%s",
    (pin, ok) => {
      expect(isValidPincode(pin)).toBe(ok);
      expect(Boolean(validateSalonAddress({ ...ADDRESS, pincode: pin }).pincode)).toBe(!ok);
    },
  );
});

describe("coordinate validation", () => {
  it.each([
    [28.6, 77.2, null],
    [-90, 180, null],
    [91, 77, "That pin isn't a valid map position"],
    [28, -181, "That pin isn't a valid map position"],
    [Number.NaN, 77, "Place the pin on the map"],
    [null, 77, "Place the pin on the map"],
  ])("(%s, %s) → %s", (lat, lng, message) => {
    expect(validateCoordinates(lat, lng)).toBe(message);
  });
  it("India check is only a warning helper", () => {
    expect(isWithinIndia(28.6, 77.2)).toBe(true);
    expect(isWithinIndia(51.5, -0.12)).toBe(false);
  });
});

describe("address composition and save payload (existing columns only)", () => {
  it("composes the full address and the short display line", () => {
    expect(composeAddress(ADDRESS)).toBe("Shop 12, Vikas Marg, Preet Vihar, Delhi, Delhi 110092");
    expect(composeLocationLine(ADDRESS)).toBe("Preet Vihar, Delhi");
  });

  it("includes coordinates only for a confirmed, valid pin", () => {
    const base = { address: composeAddress(ADDRESS), location: "Preet Vihar, Delhi", city: "Delhi", pincode: "110092" };
    expect(salonLocationPayload(ADDRESS, null)).toEqual(base);
    expect(salonLocationPayload(ADDRESS, { lat: 28.6, lng: 77.29, source: "placed", confirmed: false })).toEqual(base);
    expect(salonLocationPayload(ADDRESS, { lat: 28.6365431, lng: 77.2868, source: "geocoded", confirmed: true })).toEqual({
      ...base,
      latitude: 28.636543,
      longitude: 77.2868,
    });
    expect(salonLocationPayload(ADDRESS, { lat: 95, lng: 77.2, source: "placed", confirmed: true })).toEqual(base);
  });

  it("legacy single-line addresses are kept intact in 'street' for the owner to split", () => {
    expect(splitLegacyAddress("Noida 62", "Uttar Pradesh", "201309")).toEqual({
      ...EMPTY_ADDRESS,
      street: "Noida 62",
      city: "Uttar Pradesh",
      pincode: "201309",
    });
  });
});

describe("findAddressOnMap (explicit, approximate)", () => {
  const ok = (body: unknown) => vi.fn(async () => ({ ok: true, status: 200, json: async () => body }) as Response);

  it("queries Nominatim search without the building number and returns the match", async () => {
    const fetchImpl = ok([{ lat: "28.6377", lon: "77.2907", display_name: "Bharti Artist Colony, Delhi" }]);
    const match = await findAddressOnMap(ADDRESS, { fetchImpl });
    expect(match).toEqual({ lat: 28.6377, lng: 77.2907, label: "Bharti Artist Colony, Delhi" });
    const url = (fetchImpl.mock.calls[0] as unknown as [string])[0];
    expect(url).toContain("https://nominatim.openstreetmap.org/search?");
    expect(decodeURIComponent(url)).toContain("q=Vikas Marg, Preet Vihar, Delhi, Delhi 110092");
    expect(decodeURIComponent(url)).not.toContain("Shop 12");
  });

  it.each([
    ["no result", ok([])],
    ["invalid coordinates", ok([{ lat: "abc", lon: "77" }])],
    ["HTTP error", vi.fn(async () => ({ ok: false, status: 503, json: async () => [] }) as Response)],
    ["network error", vi.fn(async () => { throw new TypeError("Failed to fetch"); })],
  ])("%s → null (never a guessed position)", async (_label, fetchImpl) => {
    expect(await findAddressOnMap(ADDRESS, { fetchImpl: fetchImpl as unknown as typeof fetch })).toBeNull();
  });

  it("an empty address makes no request", async () => {
    const fetchImpl = vi.fn();
    expect(await findAddressOnMap(EMPTY_ADDRESS, { fetchImpl })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("salonLocationProblem (shared by every new-salon flow)", () => {
  const placed = (confirmed: boolean): SalonPin => ({ lat: 28.6372, lng: 77.2911, source: "placed", confirmed });

  it("needs a pin, then an explicit confirmation; a complete address and a confirmed pin pass", () => {
    expect(salonLocationProblem(ADDRESS, null)).toMatchObject({ pinError: LOCATION_MESSAGES.noPin, ok: false });
    expect(salonLocationProblem(ADDRESS, placed(false))).toMatchObject({ pinError: LOCATION_MESSAGES.unconfirmed, ok: false });
    expect(salonLocationProblem(ADDRESS, placed(true))).toEqual({ addressErrors: {}, pinError: null, ok: true });
  });

  it("an invalid pin counts as no pin, even if marked confirmed", () => {
    expect(salonLocationProblem(ADDRESS, { lat: 95, lng: 77, source: "entered", confirmed: true }).pinError).toBe(LOCATION_MESSAGES.noPin);
  });

  it("an incomplete address fails even with a confirmed pin", () => {
    const result = salonLocationProblem({ ...ADDRESS, pincode: "" }, placed(true));
    expect(result.ok).toBe(false);
    expect(result.addressErrors).toEqual({ pincode: "Enter the 6-digit PIN code" });
  });
});

describe("pin sources (never the owner's device position)", () => {
  it("labels each source; older stored sources fall back to 'placed'", () => {
    expect(pinSourceLabel("geocoded")).toBe("From the address search (approximate — please check)");
    expect(pinSourceLabel("placed")).toBe("Placed by you on the map");
    expect(pinSourceLabel("entered")).toBe("Coordinates you entered");
    expect(pinSourceLabel("detected")).toBe("Placed by you on the map");
    expect(Object.keys(PIN_SOURCE_LABEL)).not.toContain("detected");
  });
});

describe("salonLocationPayload confirmation columns (only once they exist)", () => {
  const pin: SalonPin = { lat: 28.6372, lng: 77.2911, source: "geocoded", confirmed: true };

  it("off by default: only existing columns are written", () => {
    expect(LOCATION_CONFIRMATION_FLAG).toBe("salon_location_confirmation");
    const payload = salonLocationPayload(ADDRESS, pin);
    expect(payload).not.toHaveProperty("location_source");
    expect(payload).not.toHaveProperty("location_confirmed_at");
  });

  it("when enabled, a confirmed pin also records its source and the confirmation", () => {
    const payload = salonLocationPayload(ADDRESS, pin, { confirmationColumns: true });
    expect(payload).toMatchObject({ latitude: 28.6372, longitude: 77.2911, location_source: "geocoded" });
    expect(Number.isNaN(Date.parse((payload as { location_confirmed_at: string }).location_confirmed_at))).toBe(false);
  });

  it("when enabled, an unconfirmed pin records nothing about the location", () => {
    const payload = salonLocationPayload(ADDRESS, { ...pin, confirmed: false }, { confirmationColumns: true });
    expect(payload).not.toHaveProperty("latitude");
    expect(payload).not.toHaveProperty("location_confirmed_at");
  });
});
