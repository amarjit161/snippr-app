import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getCartoTileUrl, MAP_ATTRIBUTION } from "@/lib/mapConfig";
import { toMapPoints } from "@/lib/salonMapPoints";
import SalonMapPanel from "@/components/salons/SalonMapPanel";
import Salons from "@/pages/Salons";

// ---------------------------------------------------------------------------
// /salons Stage 4: the CARTO/Leaflet map. react-leaflet is mocked (no tiles are
// ever requested); the env key is always a fake stub — never the real one.
// ---------------------------------------------------------------------------
const FAKE_KEY = "test-key-not-real";

// The first test to render the map lazy-loads the Leaflet chunk, which can take
// longer than the 1 s default under a busy full-suite run.
configure({ asyncUtilTimeout: 5000 });

const mocks = vi.hoisted(() => ({
  reducedMotion: false,
  throwOnRender: false,
  mapProps: null as Record<string, unknown> | null,
  tileProps: null as { url: string; eventHandlers: Record<string, () => void> } | null,
  map: null as null | Record<string, ReturnType<typeof vi.fn>>,
  zoom: 12,
  // /salons page data
  salons: [] as Record<string, unknown>[],
  servicePrices: [] as Record<string, unknown>[],
  user: null as null | { id: string },
  favoriteIds: [] as string[],
}));

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => mocks.reducedMotion,
}));

vi.mock("react-leaflet", () => {
  const map = () => {
    if (!mocks.map) {
      mocks.map = {
        setView: vi.fn(), fitBounds: vi.fn(), flyTo: vi.fn(), flyToBounds: vi.fn(), panTo: vi.fn(),
        zoomIn: vi.fn(), zoomOut: vi.fn(), invalidateSize: vi.fn(), on: vi.fn(), off: vi.fn(),
      };
    }
    return {
      ...mocks.map,
      getZoom: () => mocks.zoom,
      // Simple equirectangular projection: enough for screen-distance overlap checks.
      project: (ll: { lat: number; lng: number }, z: number) => ({
        x: ((ll.lng + 180) / 360) * 256 * 2 ** z,
        y: ((90 - ll.lat) / 180) * 256 * 2 ** z,
      }),
      getBounds: () => ({ contains: () => true }),
      getContainer: () => document.createElement("div"),
    };
  };
  return {
    MapContainer: ({ children, ...props }: { children: ReactNode }) => {
      if (mocks.throwOnRender) throw new Error("leaflet exploded");
      mocks.mapProps = props;
      return <div data-testid="leaflet-map">{children}</div>;
    },
    TileLayer: (props: { url: string; eventHandlers: Record<string, () => void> }) => {
      mocks.tileProps = props;
      return null;
    },
    useMap: map,
    Marker: forwardRef(function Marker(
      props: { title?: string; interactive?: boolean; eventHandlers?: { click: () => void } },
      ref: React.Ref<{ getElement: () => HTMLElement | null }>,
    ) {
      const el = useRef<HTMLButtonElement>(null);
      useImperativeHandle(ref, () => ({ getElement: () => el.current }));
      // The non-interactive marker is the user's position dot.
      if (props.interactive === false) return <div data-testid="user-location" />;
      return <button ref={el} type="button" data-testid="marker" title={props.title} onClick={props.eventHandlers?.click} />;
    }),
  };
});

vi.mock("@/integrations/supabase/publicClient", () => ({
  publicSupabase: {
    from: (table: string) => {
      const result = { data: table === "services" ? mocks.servicePrices : mocks.salons, error: null };
      const chain = {
        select: () => chain,
        not: () => chain,
        order: () => chain,
        then: (ok: (r: typeof result) => unknown) => Promise.resolve(result).then(ok),
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
    from: () => ({
      select: () => ({ eq: async () => ({ data: mocks.favoriteIds.map((salon_id) => ({ salon_id })), error: null }) }),
    }),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user, profile: null, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/components/QueueTracker", () => ({ default: () => null }));
vi.mock("@/components/Header", () => ({ default: () => <header data-testid="header" /> }));

const getCurrentPosition = vi.fn();
const setDesktop = (desktop: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: desktop && query.includes("min-width: 1024px"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
};
const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  vi.stubEnv("VITE_CARTO_DEV_API_KEY", FAKE_KEY); // Vitest runs in development mode
  mocks.reducedMotion = false;
  mocks.throwOnRender = false;
  mocks.mapProps = null;
  mocks.tileProps = null;
  mocks.map = null;
  mocks.zoom = 12;
  mocks.salons = [];
  mocks.servicePrices = [];
  mocks.user = null;
  mocks.favoriteIds = [];
  getCurrentPosition.mockReset();
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
  setDesktop(false);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  window.matchMedia = originalMatchMedia;
  vi.restoreAllMocks();
});

const salon = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, open_time: null, close_time: null, is_manual_closed: false, waitTime: 10,
  latitude: 28.6, longitude: 77.2, ...extra,
});

// ---------------------------------------------------------------------------
describe("CARTO configuration", () => {
  it("builds the documented Voyager raster URL with the key", () => {
    expect(getCartoTileUrl({ VITE_CARTO_API_KEY: "abc" })).toBe(
      "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=abc",
    );
    expect(getCartoTileUrl({ VITE_CARTO_API_KEY: " a&b " })).toMatch(/\?key=a%26b$/);
  });

  it.each([[{}], [{ VITE_CARTO_API_KEY: "" }], [{ VITE_CARTO_API_KEY: "   " }], [{ VITE_CARTO_API_KEY: 42 }]])(
    "missing or blank key %j → null",
    (env) => {
      expect(getCartoTileUrl(env)).toBeNull();
    },
  );

  it("attribution names OpenStreetMap contributors and CARTO", () => {
    expect(MAP_ATTRIBUTION.map((a) => a.label)).toEqual(["OpenStreetMap contributors", "CARTO"]);
  });
});

describe("toMapPoints", () => {
  it("only salons with valid coordinates become points, with real accessible labels", () => {
    const points = toMapPoints([
      salon("a", "Salon A"),
      salon("b", "Salon B", { latitude: null }),
      salon("c", "Salon C", { latitude: Number.NaN, longitude: 77 }),
      salon("d", "Salon D", { latitude: "28.6" }),
      salon("e", "Salon E", { is_manual_closed: true, latitude: 19.1, longitude: 72.9 }),
      salon("f", "Salon F", { waitTime: null, latitude: 12.9, longitude: 77.6 }),
    ]);
    expect(points).toEqual([
      { id: "a", name: "Salon A", label: "Salon A, Short wait, about 10 minutes", position: [28.6, 77.2] },
      { id: "e", name: "Salon E", label: "Salon E, Closed now", position: [19.1, 72.9] },
      { id: "f", name: "Salon F", label: "Salon F, Wait time unavailable", position: [12.9, 77.6] },
    ]);
  });

  it("empty input → no points", () => {
    expect(toMapPoints([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("SalonMapPanel", () => {
  const DELHI_VIEW = { center: [28.6139, 77.209] as [number, number], zoom: 11.5 };
  const renderPanel = (props: Partial<Parameters<typeof SalonMapPanel>[0]> = {}) => {
    const onSelect = vi.fn();
    render(
      <div style={{ height: 400 }}>
        <SalonMapPanel
          salons={[salon("a", "Salon A"), salon("b", "Salon B", { latitude: null, longitude: null }), salon("c", "Salon C", { latitude: 28.7, longitude: 77.1 })]}
          selectedId={null}
          onSelect={onSelect}
          userLocation={null}
          scrollWheelZoom={false}
          fallbackView={DELHI_VIEW}
          {...props}
        />
      </div>,
    );
    return { onSelect };
  };

  it("markers only for salons with valid coordinates, labelled from real salon data", async () => {
    renderPanel();
    const markers = await screen.findAllByTestId("marker");
    expect(markers.map((m) => m.getAttribute("title"))).toEqual(["Salon A", "Salon C"]);
    // aria attributes are applied in an effect just after the lazy map commits.
    await waitFor(() => expect(markers[0].getAttribute("aria-label")).toBe("Salon A, Short wait, about 10 minutes"));
    expect(markers[0].getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("1 salon isn't on the map yet — see the list.")).toBeInTheDocument();
  });

  it("uses the configured CARTO tile URL (from the single config) and renders attribution", async () => {
    renderPanel();
    await screen.findByTestId("leaflet-map");
    expect(mocks.tileProps!.url.startsWith("https://basemaps.cartocdn.com/rastertiles/voyager/")).toBe(true);
    expect(mocks.tileProps!.url.endsWith(`?key=${FAKE_KEY}`)).toBe(true);
    const attribution = screen.getByTestId("map-attribution");
    expect(attribution.textContent).toBe("© OpenStreetMap contributors, © CARTO");
    expect(within(attribution).getByRole("link", { name: "OpenStreetMap contributors" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
    expect(within(attribution).getByRole("link", { name: "CARTO" })).toHaveAttribute("href", "https://carto.com/attributions");
  });

  it("missing API key → a notice instead of the map, without crashing", () => {
    vi.stubEnv("VITE_CARTO_DEV_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderPanel();
    expect(screen.getByRole("status").textContent).toMatch(/map isn't available right now/i);
    expect(screen.queryByTestId("leaflet-map")).toBeNull();
  });

  it("no salon with valid coordinates → the basemap still renders, framed on the fallback view, with a note", async () => {
    renderPanel({ salons: [salon("b", "Salon B", { latitude: null, longitude: null })] });
    await screen.findByTestId("leaflet-map");
    expect(screen.queryAllByTestId("marker")).toHaveLength(0);
    expect(mocks.tileProps).not.toBeNull(); // tiles are requested independently of salon coordinates
    expect(mocks.mapProps).toMatchObject({ center: DELHI_VIEW.center, zoom: DELHI_VIEW.zoom, minZoom: 4, maxZoom: 19 });
    expect(mocks.map!.setView).toHaveBeenCalledWith(DELHI_VIEW.center, DELHI_VIEW.zoom, { animate: false });
    expect(screen.getByText("None of these salons has a map location yet — they're all in the list.")).toBeInTheDocument();
  });

  it("a map crash is contained by the error boundary", async () => {
    mocks.throwOnRender = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderPanel();
    expect(await screen.findByText(/map couldn't load/i)).toBeInTheDocument();
    expect(screen.queryByText("Loading map…")).toBeNull(); // no contradictory notice after a crash
  });

  it("shows 'Loading map…' until the first tile arrives", async () => {
    renderPanel();
    await screen.findByTestId("leaflet-map");
    expect(screen.getByText("Loading map…")).toBeInTheDocument();
    act(() => mocks.tileProps!.eventHandlers.tileload());
    expect(screen.queryByText("Loading map…")).toBeNull();
  });

  it("repeated tile errors show a notice with Retry (which re-requests tiles); pins keep working", async () => {
    const { onSelect } = renderPanel();
    await screen.findByTestId("leaflet-map");
    act(() => {
      for (let i = 0; i < 3; i++) mocks.tileProps!.eventHandlers.tileerror();
    });
    expect(screen.queryByText(/tiles couldn't load/i)).toBeNull();
    act(() => mocks.tileProps!.eventHandlers.tileerror());
    expect(await screen.findByText(/tiles couldn't load/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId("marker")[1]);
    expect(onSelect).toHaveBeenCalledWith("c");

    const before = mocks.tileProps;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.queryByText(/tiles couldn't load/i)).toBeNull();
    expect(screen.getByText("Loading map…")).toBeInTheDocument();
    expect(mocks.tileProps).not.toBe(before); // a fresh tile layer
  });

  it("tile errors after tiles have loaded don't trigger the notice", async () => {
    renderPanel();
    await screen.findByTestId("leaflet-map");
    act(() => {
      mocks.tileProps!.eventHandlers.tileload();
      for (let i = 0; i < 10; i++) mocks.tileProps!.eventHandlers.tileerror();
    });
    expect(screen.queryByText(/tiles couldn't load/i)).toBeNull();
  });

  it("clicking a marker selects that salon; the selected marker is marked pressed", async () => {
    const { onSelect } = renderPanel({ selectedId: "c" });
    const markers = await screen.findAllByTestId("marker");
    fireEvent.click(markers[0]);
    expect(onSelect).toHaveBeenCalledWith("a");
    await waitFor(() => expect(markers[1].getAttribute("aria-pressed")).toBe("true"));
    expect(markers[1].classList.contains("is-selected")).toBe(true);
  });

  describe("overlapping markers", () => {
    const zoomTo = (z: number) => {
      mocks.zoom = z;
      act(() => {
        for (const [event, handler] of mocks.map!.on.mock.calls) if (event === "zoomend") (handler as () => void)();
      });
    };

    it("nearby salons become one labelled group badge; clicking it zooms in until they separate", async () => {
      renderPanel({
        salons: [
          salon("a", "Salon A"),
          salon("n", "Salon N", { latitude: 28.6003, longitude: 77.2003 }), // ~45 m away
          salon("c", "Salon C", { latitude: 28.7, longitude: 77.1 }),
        ],
      });
      const markers = await screen.findAllByTestId("marker");
      expect(markers.map((m) => m.title).sort()).toEqual(["2 salons", "Salon C"]);
      const group = markers.find((m) => m.title === "2 salons")!;
      await waitFor(() =>
        expect(group.getAttribute("aria-label")).toBe("2 salons close together: Salon A, Salon N. Zoom in to separate them"),
      );

      mocks.map!.flyToBounds.mockClear();
      fireEvent.click(group);
      expect(mocks.map!.flyToBounds).toHaveBeenCalledTimes(1);
      const [bounds, options] = mocks.map!.flyToBounds.mock.calls[0] as [
        { getSouthWest: () => unknown; getNorthEast: () => unknown },
        Record<string, unknown>,
      ];
      // Framed on the salons' real positions.
      expect(bounds.getSouthWest()).toMatchObject({ lat: 28.6, lng: 77.2 });
      expect(bounds.getNorthEast()).toMatchObject({ lat: 28.6003, lng: 77.2003 });
      expect(options).toMatchObject({ maxZoom: 19, duration: 0.6 });

      // Zoomed in far enough, each salon has its own marker again.
      zoomTo(19);
      await waitFor(() =>
        expect(screen.getAllByTestId("marker").map((m) => m.title).sort()).toEqual(["Salon A", "Salon C", "Salon N"]),
      );
    });

    it("with reduced motion the group zoom is instant", async () => {
      mocks.reducedMotion = true;
      renderPanel({
        salons: [salon("a", "Salon A"), salon("n", "Salon N", { latitude: 28.6003, longitude: 77.2003 })],
      });
      const group = (await screen.findAllByTestId("marker")).find((m) => m.title === "2 salons")!;
      mocks.map!.fitBounds.mockClear();
      fireEvent.click(group);
      expect(mocks.map!.flyToBounds).not.toHaveBeenCalled();
      expect(mocks.map!.fitBounds).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ animate: false }));
    });

    it("salons at exactly the same position are offered as a list (no zoom can separate them)", async () => {
      const { onSelect } = renderPanel({ salons: [salon("a", "Salon A"), salon("b", "Salon B")] });
      const group = (await screen.findAllByTestId("marker")).find((m) => m.title === "2 salons")!;
      await waitFor(() => expect(group.getAttribute("aria-label")).toMatch(/Show them as a list$/));
      mocks.map!.flyToBounds.mockClear();
      fireEvent.click(group);
      expect(mocks.map!.flyToBounds).not.toHaveBeenCalled();
      const list = screen.getByRole("group", { name: "Salons at the same spot" });
      expect(within(list).getByText("2 salons at the same spot")).toBeInTheDocument();
      fireEvent.click(within(list).getByRole("button", { name: "Salon B" }));
      expect(onSelect).toHaveBeenCalledWith("b");
      expect(screen.queryByRole("group", { name: "Salons at the same spot" })).toBeNull();
    });

    it("the selected salon always keeps its own marker", async () => {
      renderPanel({ salons: [salon("a", "Salon A"), salon("b", "Salon B")], selectedId: "a" });
      const markers = await screen.findAllByTestId("marker");
      expect(markers.map((m) => m.title).sort()).toEqual(["Salon A", "Salon B"]);
      await waitFor(() => expect(markers.find((m) => m.title === "Salon A")).toHaveAttribute("aria-pressed", "true"));
    });
  });

  it("never requests geolocation itself; shows the page's location only when given", async () => {
    renderPanel();
    await screen.findByTestId("leaflet-map");
    expect(screen.queryByTestId("user-location")).toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("shows the user's position when the page already has it", async () => {
    renderPanel({ userLocation: { lat: 28.61, lng: 77.21 } });
    expect(await screen.findByTestId("user-location")).toBeInTheDocument();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("smooth native motion: animations on, first framing instant, later re-centring flies", async () => {
    renderPanel();
    await screen.findByTestId("leaflet-map");
    expect(mocks.mapProps).toMatchObject({
      zoomAnimation: true, fadeAnimation: true, markerZoomAnimation: true, inertia: true,
      zoomSnap: 0.25, zoomControl: false,
    });
    expect(mocks.map!.fitBounds).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ animate: false }));
    fireEvent.click(screen.getByRole("button", { name: "Show all salons on the map" }));
    expect(mocks.map!.flyToBounds).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 0.8 }));
  });

  it("reduced motion turns map animations off, including re-centring", async () => {
    mocks.reducedMotion = true;
    renderPanel();
    await screen.findByTestId("leaflet-map");
    expect(mocks.mapProps).toMatchObject({ zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, inertia: false });
    fireEvent.click(screen.getByRole("button", { name: "Show all salons on the map" }));
    expect(mocks.map!.flyToBounds).not.toHaveBeenCalled();
    expect(mocks.map!.fitBounds).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ animate: false }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(mocks.map!.zoomIn).toHaveBeenCalledWith(1, { animate: false });
  });

  it("zoom buttons are labelled, animate by default and respect the zoom limits", async () => {
    mocks.zoom = 19;
    renderPanel();
    await screen.findByTestId("leaflet-map");
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    const zoomOut = screen.getByRole("button", { name: "Zoom out" });
    expect(zoomIn).toBeDisabled(); // at max zoom
    fireEvent.click(zoomOut);
    expect(mocks.map!.zoomOut).toHaveBeenCalledWith(1, { animate: true });
    expect(zoomOut.className).toContain("h-11"); // 44px touch target
  });

  it("a single marker is centred rather than fitted", async () => {
    renderPanel({ salons: [salon("a", "Salon A")] });
    await screen.findByTestId("leaflet-map");
    expect(mocks.map!.setView).toHaveBeenCalledWith([28.6, 77.2], 15, { animate: false });
  });

  it("scroll-wheel zoom follows the page's choice (off on mobile)", async () => {
    renderPanel({ scrollWheelZoom: false });
    await screen.findByTestId("leaflet-map");
    expect(mocks.mapProps!.scrollWheelZoom).toBe(false);
  });

  it("keeps Leaflet sized to its container (tab switch, resize, rotation)", async () => {
    const observed: Element[] = [];
    let callback: (() => void) | null = null;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          callback = cb;
        }
        observe(el: Element) {
          observed.push(el);
        }
        disconnect() {}
      },
    );
    renderPanel();
    await screen.findByTestId("leaflet-map");
    expect(observed).toHaveLength(1);
    act(() => callback!());
    expect(mocks.map!.invalidateSize).toHaveBeenCalledWith({ pan: false });
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
describe("/salons with the map", () => {
  const row = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
    id, name, city: "Delhi", location: "Janpath", latitude: 28.6, longitude: 77.2,
    open_time: null, close_time: null, is_manual_closed: false, image_url: null, queue_count: 1, wait_time: 10,
    ...extra,
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/salons"]}>
          <Routes>
            <Route path="/salons" element={<Salons />} />
            <Route path="/salon/:id" element={<p>Salon detail page</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  const cardNames = () => screen.queryAllByTestId("salon-card").map((c) => c.querySelector("h3")?.textContent);

  beforeEach(() => {
    mocks.salons = [
      row("s-a", "Salon A", { wait_time: 25 }),
      row("s-b", "Salon B", { latitude: null, longitude: null, wait_time: 5 }),
      row("s-c", "Salon C", { is_manual_closed: true, wait_time: 1 }),
      row("s-d", "Salon D", { wait_time: null, latitude: 28.7, longitude: 77.1 }),
    ];
  });

  it("mobile: list by default (no map loaded), Map toggle swaps views, List swaps back", async () => {
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    expect(screen.queryByLabelText("Salon map")).toBeNull();
    const listBtn = screen.getByRole("button", { name: "List" });
    const mapBtn = screen.getByRole("button", { name: "Map" });
    expect(listBtn).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(mapBtn);
    expect(mapBtn).toHaveAttribute("aria-pressed", "true");
    // Salon B has no coordinates; A and C share one position, so they form one group badge.
    const markers = await screen.findAllByTestId("marker");
    expect(markers.map((m) => m.title).sort()).toEqual(["2 salons", "Salon D"]);
    // Below 1024px the map is full width (no side list).
    expect(screen.queryByLabelText("Salon list")).toBeNull();
    expect(screen.queryByTestId("map-split")).toBeNull();

    fireEvent.click(listBtn);
    expect(screen.getByLabelText("Salon list")).toBeInTheDocument();
    expect(screen.queryByLabelText("Salon map")).toBeNull();
  });

  it("mobile map view: tapping a marker opens a compact preview on the map, with a booking action", async () => {
    mocks.servicePrices = [{ salon_id: "s-d", name: "Haircut", price: 300 }];
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    const markers = await screen.findAllByTestId("marker");
    fireEvent.click(markers.find((m) => m.title === "Salon D")!);
    const preview = await screen.findByTestId("map-preview");
    expect(within(screen.getByLabelText("Salon map")).getByTestId("map-preview")).toBe(preview);
    expect(within(preview).getByRole("heading", { name: "Salon D" })).toBeInTheDocument();
    expect(within(preview).getByText("Janpath")).toBeInTheDocument();
    expect(within(preview).getByText("Open now")).toBeInTheDocument();
    expect(within(preview).getByText("Wait unknown")).toBeInTheDocument(); // no invented minutes
    expect(within(preview).getByText("From ₹300")).toBeInTheDocument();
    expect(within(preview).queryByText(/km/)).toBeNull(); // no customer location → no distance
    expect(markers.find((m) => m.title === "Salon D")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(preview).getByRole("button", { name: "Close preview" }));
    expect(screen.queryByTestId("map-preview")).toBeNull();

    fireEvent.click(markers.find((m) => m.title === "Salon D")!);
    fireEvent.click(within(await screen.findByTestId("map-preview")).getByRole("button", { name: "Book a Snipp" }));
    expect(await screen.findByText("Salon detail page")).toBeInTheDocument();
  });

  it("switching views keeps the search, filters and sort; markers follow the filtered list", async () => {
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    fireEvent.click(screen.getByRole("button", { name: "Open now" })); // hides closed Salon C
    fireEvent.click(within(screen.getByRole("group", { name: "Sort salons" })).getByRole("button", { name: "Wait time" }));
    expect(cardNames()).toEqual(["Salon B", "Salon A", "Salon D"]);

    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    const markers = await screen.findAllByTestId("marker");
    // Salon C is filtered out, so A is no longer grouped with it; B has no location.
    expect(markers.map((m) => m.title).sort()).toEqual(["Salon A", "Salon D"]);

    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByRole("button", { name: "Open now" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("group", { name: "Sort salons" })).getByRole("button", { name: "Wait time" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(cardNames()).toEqual(["Salon B", "Salon A", "Salon D"]);
  });

  it("phones: a search placeholder that fits, and Escape closes the suggestions covering the filters", async () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("max-width: 639px"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    const search = screen.getByRole("textbox", { name: "Search salons" });
    expect(search).toHaveAttribute("placeholder", "Search salons or areas…");
    act(() => search.focus());
    expect(screen.getByText("Search suggestions")).toBeInTheDocument();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.queryByText("Search suggestions")).toBeNull();
    expect(search).toHaveFocus(); // the customer keeps typing where they were
  });

  it("phones: a compact city row — the city is the picker button, Detect keeps its full name", async () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("max-width: 639px"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    const city = screen.getByRole("region", { name: "Your city" });
    const trigger = within(city).getByRole("button", { name: "Your city: Choose your city" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(within(city).getByRole("button", { name: "Detect my city" })).toBeInTheDocument();
    // One button per action: no separate "Choose city" button on phones.
    expect(within(city).queryByRole("button", { name: "Choose city" })).toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled(); // still opt-in
    // List stays the default view on phones; the map isn't loaded.
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("leaflet-map")).toBeNull();
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("larger screens keep the full search placeholder", async () => {
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    expect(screen.getByRole("textbox", { name: "Search salons" })).toHaveAttribute(
      "placeholder",
      "Search salons, landmarks, addresses…",
    );
  });

  it("map view with no results shows the empty state with a way to reset", async () => {
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    fireEvent.change(screen.getByRole("textbox", { name: "Search salons" }), { target: { value: "zzz-no-match" } });
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    const empty = (await screen.findByText("No salons found")).parentElement!;
    fireEvent.click(within(empty).getByRole("button", { name: "Clear search" }));
    expect(await screen.findAllByTestId("marker")).toHaveLength(2);
  });

  it("desktop: list-first — search in the masthead, sidebar shown, no map until 'Map' is chosen", async () => {
    setDesktop(true);
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    // List is the default view; the map is not loaded.
    expect(screen.queryByLabelText("Salon map")).toBeNull();
    expect(screen.queryByTestId("leaflet-map")).toBeNull();
    // One search box, in the page masthead (under the heading), at every size.
    const masthead = screen.getByRole("region", { name: "Explore Salons" });
    expect(within(masthead).getByRole("textbox", { name: "Search salons" })).toBeInTheDocument();
    expect(screen.getAllByRole("textbox", { name: "Search salons" })).toHaveLength(1);
    // Filters live in one quick-filter bar for every screen size (no sidebar).
    expect(screen.getByRole("group", { name: "Quick filters" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    // Desktop map view: the results list beside the map, every salon listed (B has no marker).
    const split = await screen.findByTestId("map-split");
    expect(within(split).getByLabelText("Salon list")).toBeInTheDocument();
    expect(within(split).getByLabelText("Salon map")).toBeInTheDocument();
    expect(within(split).getAllByTestId("salon-card")).toHaveLength(4);
    const markers = await screen.findAllByTestId("marker");
    expect(markers.map((m) => m.title).sort()).toEqual(["2 salons", "Salon D"]);

    // Marker → card: the card is highlighted and scrolled into view; the map shows a preview.
    fireEvent.click(markers.find((m) => m.title === "Salon D")!);
    const selected = screen.getAllByTestId("salon-card").filter((c) => c.dataset.selected === "true");
    expect(selected.map((c) => c.id)).toEqual(["salon-card-s-d"]);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" });
    expect(within(await screen.findByTestId("map-preview")).getByRole("heading", { name: "Salon D" })).toBeInTheDocument();
    expect(mocks.mapProps!.scrollWheelZoom).toBe(true);

    // Card → marker: "Show on map" selects that salon; it leaves its group and gets its own marker.
    scrollIntoView.mockClear();
    const cardA = document.getElementById("salon-card-s-a")!;
    const showA = within(cardA).getByRole("button", { name: "Show Salon A on the map" });
    fireEvent.click(showA);
    expect(showA).toHaveAttribute("aria-pressed", "true");
    await waitFor(() =>
      expect(screen.getAllByTestId("marker").map((m) => m.title).sort()).toEqual(["Salon A", "Salon C", "Salon D"]),
    );
    expect(screen.getAllByTestId("marker").find((m) => m.title === "Salon A")).toHaveAttribute("aria-pressed", "true");
    expect(scrollIntoView).not.toHaveBeenCalled(); // the list doesn't jump when the customer used it
    // A salon without a location has no "Show on map" button.
    expect(within(document.getElementById("salon-card-s-b")!).queryByRole("button", { name: /on the map/ })).toBeNull();

    // Back to the list: Salon B (no coordinates, no marker) is still listed.
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(cardNames()).toContain("Salon B");
    expect(getCurrentPosition).not.toHaveBeenCalled(); // location is opt-in: nothing on load
  });

  it("quick filters: 'All filters' opens a dialog and shows how many filters are active", async () => {
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    const quick = screen.getByRole("group", { name: "Quick filters" });
    const all = within(quick).getByRole("button", { name: /All filters/ });
    expect(all).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(within(quick).getByRole("button", { name: "Open now" }));
    expect(all.textContent).toContain("1");
  });

  it("Open now hides closed salons; Short wait keeps open salons with a known wait ≤ 15 min", async () => {
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    const quick = screen.getByRole("group", { name: "Quick filters" });

    fireEvent.click(within(quick).getByRole("button", { name: "Open now" }));
    expect(within(quick).getByRole("button", { name: "Open now" })).toHaveAttribute("aria-pressed", "true");
    expect(cardNames()).toEqual(["Salon A", "Salon B", "Salon D"]);
    expect(screen.getByText("3 salons")).toBeInTheDocument();

    fireEvent.click(within(quick).getByRole("button", { name: "Open now" }));
    fireEvent.click(within(quick).getByRole("button", { name: "Short wait" }));
    expect(cardNames()).toEqual(["Salon B"]);
    expect(screen.getByText("1 salon")).toBeInTheDocument();
  });

  it("sorting: Recommended by default without a location; Nearest disabled until one is shared; Wait time works", async () => {
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    expect(screen.getByText("4 salons")).toBeInTheDocument();
    const sortGroup = screen.getByRole("group", { name: "Sort salons" });
    expect(within(sortGroup).getByRole("button", { name: "Recommended" })).toHaveAttribute("aria-pressed", "true");
    expect(cardNames()).toEqual(["Salon A", "Salon B", "Salon C", "Salon D"]); // API order
    // Without a location, Nearest is the explicit request for one, and the order is explained.
    const nearest = within(sortGroup).getByRole("button", { name: "Nearest" });
    expect(nearest).toBeEnabled();
    expect(nearest).toHaveAccessibleDescription("Nearest asks for your location first.");
    expect(getCurrentPosition).not.toHaveBeenCalled();

    fireEvent.click(within(sortGroup).getByRole("button", { name: "Wait time" }));
    expect(within(sortGroup).getByRole("button", { name: "Wait time" })).toHaveAttribute("aria-pressed", "true");
    expect(cardNames()).toEqual(["Salon B", "Salon A", "Salon D", "Salon C"]);

    fireEvent.click(within(sortGroup).getByRole("button", { name: "Recommended" }));
    expect(cardNames()).toEqual(["Salon A", "Salon B", "Salon C", "Salon D"]);
    // No ratings anywhere.
    expect(within(sortGroup).queryByRole("button", { name: /rating/i })).toBeNull();
  });

  it("Nearest asks for location only when pressed; a denial keeps Recommended order and explains why", async () => {
    getCurrentPosition.mockImplementation((_ok: unknown, fail: (e: { code: number }) => void) => fail({ code: 1 }));
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    const sortGroup = screen.getByRole("group", { name: "Sort salons" });
    expect(getCurrentPosition).not.toHaveBeenCalled();

    fireEvent.click(within(sortGroup).getByRole("button", { name: "Nearest" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(
        "Location access is blocked, so salons are in recommended order. Allow location in your browser settings to sort nearest first.",
      ),
    ).toBeInTheDocument();
    expect(within(sortGroup).getByRole("button", { name: "Recommended" })).toHaveAttribute("aria-pressed", "true");
    expect(cardNames()).toEqual(["Salon A", "Salon B", "Salon C", "Salon D"]);
    expect(screen.queryByText(/ km$/)).toBeNull(); // no invented distances
  });

  it("Nearest with a real fix sorts by distance; salons without a location stay listed, last", async () => {
    getCurrentPosition.mockImplementation((ok: (p: unknown) => void) =>
      ok({ coords: { latitude: 28.71, longitude: 77.11, accuracy: 20 } }),
    );
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    const sortGroup = screen.getByRole("group", { name: "Sort salons" });
    fireEvent.click(within(sortGroup).getByRole("button", { name: "Nearest" }));
    await waitFor(() => expect(within(sortGroup).getByRole("button", { name: "Nearest" })).toHaveAttribute("aria-pressed", "true"));
    await waitFor(() => expect(cardNames()).toEqual(["Salon D", "Salon A", "Salon C", "Salon B"]));
    expect(screen.queryByText("Nearest asks for your location first.")).toBeNull();
  });

  it("with a location but no salon positions, Nearest is unavailable and the reason is shown", async () => {
    mocks.salons = mocks.salons.map((s) => ({ ...s, latitude: null, longitude: null }));
    getCurrentPosition.mockImplementation((ok: (p: unknown) => void) =>
      ok({ coords: { latitude: 28.71, longitude: 77.11, accuracy: 20 } }),
    );
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    const sortGroup = screen.getByRole("group", { name: "Sort salons" });
    fireEvent.click(within(sortGroup).getByRole("button", { name: "Nearest" }));
    expect(
      await screen.findByText("None of these salons has a map location yet, so they can't be sorted by distance."),
    ).toBeInTheDocument();
    expect(within(sortGroup).getByRole("button", { name: "Nearest" })).toBeDisabled();
    expect(within(sortGroup).getByRole("button", { name: "Recommended" })).toHaveAttribute("aria-pressed", "true");
  });

  it("cards use the compact row layout with real data and no invented values", async () => {
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    const card = (name: string) => screen.getAllByTestId("salon-card").find((c) => c.querySelector("h3")?.textContent === name)!;
    expect(within(card("Salon A")).getByText("Open now")).toBeInTheDocument();
    expect(within(card("Salon A")).getByText("Janpath")).toBeInTheDocument();
    expect(within(card("Salon C")).getByText("Closed")).toBeInTheDocument();
    expect(within(card("Salon C")).getByRole("button", { name: "Currently Closed" })).toBeDisabled();
    expect(screen.queryByText(/4.8|votes?|rating/i)).toBeNull();
  });

  it("wait badges use the shared labels; an unknown wait stays unknown", async () => {
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    const card = (name: string) => screen.getAllByTestId("salon-card").find((c) => c.querySelector("h3")?.textContent === name)!;
    expect(within(card("Salon A")).getByTestId("wait-badge").textContent).toBe("25 min waitModerate wait, about 25 minutes");
    expect(within(card("Salon D")).getByTestId("wait-badge").textContent).toBe("Wait unknownWait time unavailable");
    expect(within(card("Salon C")).queryByTestId("wait-badge")).toBeNull(); // closed
  });

  it("starting prices, favourites and booking navigation still work", async () => {
    mocks.user = { id: "u-1" };
    mocks.favoriteIds = ["s-a"];
    mocks.servicePrices = [{ salon_id: "s-a", price: 0 }, { salon_id: "s-d", price: 250 }];
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    await waitFor(() => expect(screen.getAllByTestId("starting-price").map((p) => p.textContent)).toEqual(["Free", "From ₹250"]));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Remove from favorites" })).toHaveLength(1));
    expect(screen.getAllByRole("button", { name: "Add to favorites" })).toHaveLength(3);

    fireEvent.click(screen.getAllByRole("button", { name: "Book a Snipp" })[0]);
    expect(await screen.findByText("Salon detail page")).toBeInTheDocument();
  });

  it("search still filters the list (and therefore the map)", async () => {
    renderPage();
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    fireEvent.change(screen.getByPlaceholderText("Search salons, landmarks, addresses…"), { target: { value: "Salon D" } });
    await waitFor(() => expect(cardNames()).toEqual(["Salon D"]));
  });
});
