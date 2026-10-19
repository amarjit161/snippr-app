import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { calculateDistance, distanceToSalonKm } from "@/lib/location";
import { geolocationErrorMessage, useGeolocation } from "@/hooks/useGeolocation";
import SalonCard from "@/components/SalonCard";
import Salons from "@/pages/Salons";
import type { Tables } from "@/integrations/supabase/types";
import { markCityAutoDetectAttempted, resetCitySession } from "@/lib/citySession";

// ---------------------------------------------------------------------------
// /salons Stage 1: real distances from latitude/longitude, no invented
// ratings, and no silent substitute location when geolocation fails.
// Supabase, auth and the browser geolocation API are mocked.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  salons: [] as Record<string, unknown>[],
}));

vi.mock("@/integrations/supabase/publicClient", () => ({
  publicSupabase: {
    // salon_with_stats → the salons; services (starting prices) → none.
    from: (table: string) => {
      const result = { data: table === "services" ? [] : mocks.salons, error: null };
      const chain = {
        select: () => chain,
        not: () => chain,
        order: () => chain,
        then: (resolve: (r: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain;
    },
    channel: () => {
      const ch = { on: () => ch, subscribe: () => ch };
      return ch;
    },
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://img.invalid/${p}` } }) }) },
    from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, profile: null, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/components/QueueTracker", () => ({ default: () => null }));
vi.mock("@/components/Header", () => ({ default: () => <header data-testid="header" /> }));

// Delhi (Connaught Place) and two salons: one with coordinates, one without.
const USER = { lat: 28.6315, lng: 77.2167 };
const SALON_WITH_COORDS = {
  id: "s-1", name: "Salon With Coords", city: "Delhi", location: "Janpath",
  latitude: 28.6239, longitude: 77.2191, open_time: null, close_time: null, is_manual_closed: false,
  image_url: null, queue_count: 2, wait_time: 12,
};
const SALON_NO_COORDS = {
  id: "s-2", name: "Salon Without Coords", city: "Delhi", location: "Karol Bagh",
  latitude: null, longitude: null, open_time: null, close_time: null, is_manual_closed: false,
  image_url: null, queue_count: 0, wait_time: 0,
};

type GeoCallbacks = { success?: PositionCallback; error?: PositionErrorCallback };
let geo: GeoCallbacks;
const installGeolocation = (impl: "success" | "error" | "pending" | "missing", errorCode = 1) => {
  geo = {};
  if (impl === "missing") {
    Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
    return;
  }
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (success: PositionCallback, error: PositionErrorCallback) => {
        geo = { success, error };
        if (impl === "success") success({ coords: { latitude: USER.lat, longitude: USER.lng } } as GeolocationPosition);
        if (impl === "error") error({ code: errorCode, message: "x" } as GeolocationPositionError);
      },
    },
  });
};

beforeEach(() => {
  // Not about city detection: start after this tab session's automatic attempt
  // (salonsCityLocation.test covers the first visit).
  resetCitySession();
  markCityAutoDetectAttempted();
  mocks.salons = [SALON_WITH_COORDS, SALON_NO_COORDS];
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
describe("distanceToSalonKm", () => {
  it("uses the salon's latitude/longitude", () => {
    const d = distanceToSalonKm(USER, SALON_WITH_COORDS);
    expect(d).toBeCloseTo(calculateDistance(USER.lat, USER.lng, 28.6239, 77.2191), 10);
    expect(d!).toBeGreaterThan(0.5);
    expect(d!).toBeLessThan(1.5);
  });

  it.each([
    ["no user position", null, SALON_WITH_COORDS],
    ["missing salon coordinates", USER, SALON_NO_COORDS],
    ["only latitude", USER, { latitude: 28.6, longitude: null }],
    ["non-numeric coordinates", USER, { latitude: "28.6" as unknown as number, longitude: "77.2" as unknown as number }],
    ["NaN coordinates", USER, { latitude: Number.NaN, longitude: 77.2 }],
    ["legacy lat/lng fields only (ignored)", USER, { lat: 28.6, lng: 77.2 } as unknown as { latitude: number }],
    ["a non-finite user position", { lat: Number.NaN, lng: 77.2 }, SALON_WITH_COORDS],
  ])("%s → undefined (no guessed distance)", (_label, user, salon) => {
    expect(distanceToSalonKm(user as never, salon as never)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
describe("useGeolocation", () => {
  it("success → located with the real position", () => {
    installGeolocation("success");
    const { result } = renderHook(() => useGeolocation());
    expect(result.current).toMatchObject({ location: USER, error: null, status: "located" });
  });

  it.each([
    [1, "Location permission denied"],
    [2, "Location unavailable"],
    [3, "Location request timed out"],
  ])("failure code %s → unavailable, no substitute location", (code, message) => {
    installGeolocation("error", code);
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.location).toBeNull();
    expect(result.current.status).toBe("unavailable");
    expect(result.current.error).toBe(message);
  });

  it("starts pending while the browser has not answered", () => {
    installGeolocation("pending");
    const { result } = renderHook(() => useGeolocation());
    expect(result.current).toMatchObject({ location: null, error: null, status: "pending" });
  });

  it("unsupported browser → unavailable", () => {
    installGeolocation("missing");
    const { result } = renderHook(() => useGeolocation());
    expect(result.current).toMatchObject({ location: null, error: "Geolocation not supported", status: "unavailable" });
  });

  it("non-finite coordinates from the browser → unavailable", () => {
    installGeolocation("pending");
    const { result } = renderHook(() => useGeolocation());
    act(() => geo.success!({ coords: { latitude: Number.NaN, longitude: 1 } } as GeolocationPosition));
    expect(result.current.location).toBeNull();
    expect(result.current.status).toBe("unavailable");
  });

  it("a late answer after unmount is ignored", () => {
    installGeolocation("pending");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = renderHook(() => useGeolocation());
    unmount();
    act(() => geo.success!({ coords: { latitude: 1, longitude: 1 } } as GeolocationPosition));
    expect(errors).not.toHaveBeenCalled();
  });

  it("geolocationErrorMessage tolerates a missing error", () => {
    expect(geolocationErrorMessage(undefined)).toBe("Location unavailable");
  });
});

// ---------------------------------------------------------------------------
describe("SalonCard ratings", () => {
  const cardSalon = (extra: Record<string, unknown> = {}) =>
    ({ ...SALON_WITH_COORDS, queueCount: 2, waitTime: 12, ...extra }) as unknown as Tables<"salons"> & {
      queueCount: number; waitTime: number; distance?: number; rating?: number | null;
    };

  const renderCard = (extra?: Record<string, unknown>) =>
    render(<SalonCard salon={cardSalon(extra)} index={0} onSelect={vi.fn()} />);

  it("no rating data → no rating shown, and never an invented 4.8", () => {
    renderCard();
    expect(screen.queryByText("4.8")).toBeNull();
    expect(screen.getByText("Salon With Coords")).toBeInTheDocument();
  });

  it.each([[0], [Number.NaN], [null], [-1]])("rating %s → not shown", (rating) => {
    const { container } = renderCard({ rating });
    expect(container.textContent).not.toMatch(/4\.8/);
    expect(container.querySelector(".fill-primary")).toBeNull();
  });

  it("a genuine rating is shown as given", () => {
    renderCard({ rating: 4.6 });
    expect(screen.getByText("4.6")).toBeInTheDocument();
  });

  it("Favorites-style props (plain salon row + queue fields) still render", () => {
    render(
      <SalonCard
        salon={{ ...(SALON_NO_COORDS as unknown as Tables<"salons">), queueCount: 0, waitTime: 0 }}
        index={1}
        onSelect={vi.fn()}
        isFavorited
        onToggleFavorite={vi.fn()}
      />,
    );
    expect(screen.getByText("Salon Without Coords")).toBeInTheDocument();
    expect(screen.queryByText("4.8")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("useGeolocation opt-in ({ enabled: false } + request())", () => {
  it("does nothing until request(): idle, no browser call", () => {
    installGeolocation("success");
    const spy = vi.spyOn(navigator.geolocation, "getCurrentPosition");
    const { result } = renderHook(() => useGeolocation({ enabled: false }));
    expect(result.current.status).toBe("idle");
    expect(result.current.location).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("request() asks once and reports the real position", () => {
    installGeolocation("pending");
    const spy = vi.spyOn(navigator.geolocation, "getCurrentPosition");
    const { result } = renderHook(() => useGeolocation({ enabled: false }));
    act(() => result.current.request());
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("pending");
    act(() => geo.success!({ coords: { latitude: USER.lat, longitude: USER.lng } } as GeolocationPosition));
    expect(result.current).toMatchObject({ status: "located", location: USER, error: null });
  });

  it("request() after a denial can try again; a failure never invents a position", () => {
    installGeolocation("error", 1);
    const { result } = renderHook(() => useGeolocation({ enabled: false }));
    act(() => result.current.request());
    expect(result.current).toMatchObject({ status: "unavailable", location: null, error: "Location permission denied" });
    installGeolocation("success");
    act(() => result.current.request());
    expect(result.current).toMatchObject({ status: "located", location: USER });
  });

  it("enabled turning true later starts the lookup then (e.g. a queue entry appearing)", () => {
    installGeolocation("pending");
    const spy = vi.spyOn(navigator.geolocation, "getCurrentPosition");
    const { result, rerender } = renderHook(({ on }) => useGeolocation({ enabled: on }), { initialProps: { on: false } });
    expect(spy).not.toHaveBeenCalled();
    rerender({ on: true });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("pending");
  });

  it("default (no options) still asks once on mount, as before", () => {
    installGeolocation("pending");
    const spy = vi.spyOn(navigator.geolocation, "getCurrentPosition");
    renderHook(() => useGeolocation());
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
