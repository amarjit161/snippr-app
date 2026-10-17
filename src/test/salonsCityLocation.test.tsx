import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Salons from "@/pages/Salons";
import { clearCityCache } from "@/lib/cityLocation";

// ---------------------------------------------------------------------------
// /salons city experience: opt-in detection (GPS → OpenStreetMap Nominatim
// reverse lookup), a "YOUR CITY" panel, and a searchable city picker built on
// real salon data. Supabase, geolocation and fetch are mocked: no network.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({ salons: [] as Record<string, unknown>[] }));

vi.mock("@/integrations/supabase/publicClient", () => ({
  publicSupabase: {
    from: (table: string) => {
      const result = { data: table === "services" ? [] : mocks.salons, error: null };
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
    from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }),
  },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, profile: null, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/components/QueueTracker", () => ({ default: () => null }));
vi.mock("@/components/Header", () => ({ default: () => <header data-testid="header" /> }));

const row = (id: string, name: string, city: string | null) => ({
  id, name, city, location: `${name} street`, latitude: null, longitude: null,
  open_time: null, close_time: null, is_manual_closed: false, image_url: null, queue_count: 0, wait_time: 5,
});

// Geolocation: callbacks are captured so each test decides when (and how) the browser answers.
let geo: { success?: PositionCallback; error?: PositionErrorCallback } = {};
const getCurrentPosition = vi.fn((success: PositionCallback, error: PositionErrorCallback) => {
  geo = { success, error };
});
const answerPosition = (lat = 28.535, lng = 77.391) =>
  act(() => geo.success!({ coords: { latitude: lat, longitude: lng } } as GeolocationPosition));
const denyPosition = (code = 1) => act(() => geo.error!({ code, message: "x" } as GeolocationPositionError));

// Nominatim: each call returns a promise the test resolves.
let lookups: { url: string; resolve: (body: unknown, status?: number) => void; signal?: AbortSignal }[] = [];
const fetchMock = vi.fn((url: string, init?: RequestInit) =>
  new Promise<Response>((resolve) => {
    lookups.push({
      url,
      signal: init?.signal ?? undefined,
      resolve: (body, status = 200) =>
        resolve({ ok: status >= 200 && status < 300, status, json: async () => body } as Response),
    });
  }),
);
const answerLookup = async (address: Record<string, string> | null, status = 200) => {
  await act(async () => {
    lookups[lookups.length - 1].resolve(address ? { address } : {}, status);
  });
};

beforeEach(() => {
  mocks.salons = [row("d1", "Delhi One", "Delhi"), row("d2", "Delhi Two", "Delhi"), row("n1", "Noida One", "Noida")];
  geo = {};
  lookups = [];
  getCurrentPosition.mockClear();
  fetchMock.mockClear();
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
  vi.stubGlobal("fetch", fetchMock);
  clearCityCache();
  window.sessionStorage.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const renderPage = async () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/salons"]}>
        <Salons />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getAllByTestId("salon-card")).toHaveLength(3));
};
const panel = () => screen.getByRole("region", { name: "Your city" });
const cityText = () => screen.getByTestId("location-status").textContent;
const cards = () => screen.queryAllByTestId("salon-card").map((c) => c.querySelector("h3")?.textContent);
const openPicker = () => fireEvent.click(within(panel()).getByRole("button", { name: /Choose city|Change city/ }));
const picker = () => screen.getByRole("dialog", { name: "Choose your city" });

// ---------------------------------------------------------------------------
describe("/salons city panel — before any choice", () => {
  it("asks for nothing on load: 'Choose your city', a 'Detect my city' action, no 'All cities' select", async () => {
    await renderPage();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(within(panel()).getByText("Your city")).toBeInTheDocument();
    expect(cityText()).toBe("Choose your city");
    expect(within(panel()).getByRole("button", { name: "Detect my city" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("All cities")).toBeNull();
    expect(cards()).toHaveLength(3);
  });
});

describe("/salons city detection — permission granted", () => {
  it("detects the city via one reverse lookup and filters the list to it", async () => {
    await renderPage();
    fireEvent.click(within(panel()).getByRole("button", { name: "Detect my city" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(cityText()).toBe("Detecting your city…");

    answerPosition(28.535, 77.391);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(lookups[0].url).toMatch(/^https:\/\/nominatim\.openstreetmap\.org\/reverse\?format=jsonv2&zoom=10/);
    expect(lookups[0].url).toContain("lat=28.53500");
    expect(lookups[0].url).toContain("lon=77.39100");

    await answerLookup({ city: "Noida", state: "Uttar Pradesh", country: "India" });
    expect(cityText()).toBe("Noida, India");
    expect(cards()).toEqual(["Noida One"]);
    expect(within(panel()).getByRole("button", { name: "Change city" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "OpenStreetMap contributors" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  });

  it("'New Delhi' (a real alternate name) shows as detected and matches salons listed under Delhi", async () => {
    await renderPage();
    fireEvent.click(within(panel()).getByRole("button", { name: "Detect my city" }));
    answerPosition(28.61, 77.21);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await answerLookup({ city: "New Delhi", state: "Delhi", country: "India" });
    expect(cityText()).toBe("New Delhi, India");
    expect(cards()).toEqual(["Delhi One", "Delhi Two"]);
  });

  it("a detected city with no salons says so honestly and offers a way out", async () => {
    await renderPage();
    fireEvent.click(within(panel()).getByRole("button", { name: "Detect my city" }));
    answerPosition(22.57, 88.36);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await answerLookup({ city: "Kolkata", state: "West Bengal", country: "India" });
    expect(cityText()).toBe("Kolkata, India");
    expect(screen.getByText("No salons on Snippr in Kolkata yet.")).toBeInTheDocument();
    expect(screen.getByText("No salons in Kolkata yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all cities" }));
    expect(cards()).toHaveLength(3);
    expect(cityText()).toBe("Choose your city");
  });
});

describe("/salons city detection — failures", () => {
  it("permission denied: explains, keeps manual choice working, never re-prompts by itself", async () => {
    await renderPage();
    fireEvent.click(within(panel()).getByRole("button", { name: "Detect my city" }));
    denyPosition(1);
    expect(cityText()).toBe("Choose your city");
    expect(screen.getByText(/Location access is blocked/)).toBeInTheDocument();
    expect(within(panel()).queryByRole("button", { name: /Detect my city|Try again/ })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    openPicker();
    expect(within(picker()).queryByRole("button", { name: "Detect my city" })).toBeNull();
    expect(within(picker()).getByText(/blocked in this browser/)).toBeInTheDocument();
    fireEvent.click(within(picker()).getByRole("button", { name: /^Delhi/ }));
    expect(cityText()).toBe("Delhi");
    expect(cards()).toEqual(["Delhi One", "Delhi Two"]);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("a timeout or unavailable position offers 'Try again'", async () => {
    await renderPage();
    fireEvent.click(within(panel()).getByRole("button", { name: "Detect my city" }));
    denyPosition(3);
    expect(screen.getByText("Location request timed out. Try again, or choose your city.")).toBeInTheDocument();
    fireEvent.click(within(panel()).getByRole("button", { name: "Try again" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["the lookup service errors", null, 503],
    ["the answer has no city-level name", { state: "Uttar Pradesh", country: "India" }, 200],
  ])("city can't be resolved when %s: no guess, manual selection offered", async (_label, address, status) => {
    await renderPage();
    fireEvent.click(within(panel()).getByRole("button", { name: "Detect my city" }));
    answerPosition();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await answerLookup(address as Record<string, string> | null, status);
    expect(cityText()).toBe("Choose your city");
    expect(screen.getByText("We found your location but couldn't identify the city. Choose it instead.")).toBeInTheDocument();
    expect(cards()).toHaveLength(3); // no filter applied from a guess
    expect(within(panel()).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("/salons manual city selection", () => {
  it("lists real cities with real counts, marks cities without salons, and filters on selection — no GPS", async () => {
    await renderPage();
    openPicker();
    const dialog = picker();
    const withSalons = within(dialog).getByRole("region", { name: "Cities with salons" });
    expect(within(withSalons).getAllByRole("button").map((b) => b.textContent)).toEqual(["Delhi2 salons", "Noida1 salon"]);
    const popular = within(dialog).getByRole("region", { name: "Popular cities" });
    expect(within(popular).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "GurugramNo salons yet",
      "MumbaiNo salons yet",
      "BengaluruNo salons yet",
      "KolkataNo salons yet",
    ]);

    fireEvent.change(within(dialog).getByRole("searchbox", { name: "Search cities" }), { target: { value: "noi" } });
    expect(within(picker()).getAllByRole("button", { name: /Noida/ })).toHaveLength(1);
    fireEvent.click(within(picker()).getByRole("button", { name: /^Noida/ }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(cityText()).toBe("Noida");
    expect(cards()).toEqual(["Noida One"]);
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("choosing a city with no salons shows an honest empty state; 'Show salons in all cities' clears it", async () => {
    await renderPage();
    openPicker();
    fireEvent.click(within(picker()).getByRole("button", { name: /^Mumbai/ }));
    expect(screen.getByText("No salons in Mumbai yet")).toBeInTheDocument();
    openPicker();
    fireEvent.click(within(picker()).getByRole("button", { name: "Show salons in all cities" }));
    expect(cards()).toHaveLength(3);
  });

  it("the picker is a labelled dialog; Escape closes it and returns focus to the city button", async () => {
    await renderPage();
    const trigger = within(panel()).getByRole("button", { name: "Choose city" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    trigger.focus();
    fireEvent.click(trigger);
    expect(picker()).toBeInTheDocument();
    fireEvent.keyDown(picker(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(within(panel()).getByRole("button", { name: "Choose city" })));
  });

  it("the picker offers 'Detect my city' as a retry", async () => {
    await renderPage();
    openPicker();
    fireEvent.click(within(picker()).getByRole("button", { name: "Detect my city" }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });
});

describe("/salons late results never override a manual choice", () => {
  it("a GPS fix that arrives after the user picked a city is ignored (no lookup, city kept)", async () => {
    await renderPage();
    fireEvent.click(within(panel()).getByRole("button", { name: "Detect my city" }));
    openPicker();
    fireEvent.click(within(picker()).getByRole("button", { name: /^Delhi/ }));
    answerPosition();
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cityText()).toBe("Delhi");
    expect(cards()).toEqual(["Delhi One", "Delhi Two"]);
  });

  it("a city lookup that answers after a manual pick is aborted and ignored", async () => {
    await renderPage();
    fireEvent.click(within(panel()).getByRole("button", { name: "Detect my city" }));
    answerPosition();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    openPicker();
    fireEvent.click(within(picker()).getByRole("button", { name: /^Mumbai/ }));
    expect(lookups[0].signal?.aborted).toBe(true);
    await answerLookup({ city: "Noida", country: "India" });
    expect(cityText()).toBe("Mumbai");
  });
});

describe("/salons distances after detection", () => {
  it("shows real distances only for salons with coordinates", async () => {
    mocks.salons = [
      { ...row("d1", "Delhi One", "Delhi"), latitude: 28.6239, longitude: 77.2191 },
      row("d2", "Delhi Two", "Delhi"),
      row("n1", "Noida One", "Noida"),
    ];
    await renderPage();
    expect(screen.queryByText(/ km$/)).toBeNull();
    fireEvent.click(within(panel()).getByRole("button", { name: "Detect my city" }));
    answerPosition(28.6315, 77.2167);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await answerLookup({ city: "Delhi", state: "Delhi", country: "India" });
    await waitFor(() => expect(screen.getAllByText(/ km$/)).toHaveLength(1));
    expect(cards()).toEqual(["Delhi One", "Delhi Two"]);
  });
});

describe("/salons city options use only real, recognisable cities", () => {
  beforeEach(() => {
    mocks.salons = [
      row("d1", "Delhi One", "Delhi"),
      row("d2", "Delhi Two", "Delhi"),
      row("n1", "Noida One", "Noida"),
      row("s1", "State Only", "Uttar Pradesh"),
      row("t1", "Placeholder Salon", "Test"),
    ];
  });

  it("the picker lists Delhi and Noida only, with an honest note about salons without a city", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/salons"]}>
          <Salons />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getAllByTestId("salon-card")).toHaveLength(5));
    openPicker();
    const withSalons = within(picker()).getByRole("region", { name: "Cities with salons" });
    expect(within(withSalons).getAllByRole("button").map((b) => b.textContent)).toEqual(["Delhi2 salons", "Noida1 salon"]);
    expect(within(picker()).queryByText("Uttar Pradesh")).toBeNull();
    expect(within(picker()).queryByText("Test")).toBeNull();
    expect(within(picker()).getByText(/2 salons don't have a city listed yet/)).toBeInTheDocument();
    // Searching for the state doesn't surface it as a city either.
    fireEvent.change(within(picker()).getByRole("searchbox", { name: "Search cities" }), { target: { value: "uttar" } });
    expect(within(picker()).queryByRole("button", { name: /Uttar Pradesh/ })).toBeNull();
  });

  it("those salons are never hidden: they show under all cities and return after clearing a city", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/salons"]}>
          <Salons />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getAllByTestId("salon-card")).toHaveLength(5));
    expect(cards()).toEqual(expect.arrayContaining(["State Only", "Placeholder Salon"]));
    openPicker();
    fireEvent.click(within(picker()).getByRole("button", { name: /^Delhi/ }));
    expect(cards()).toEqual(["Delhi One", "Delhi Two"]);
    openPicker();
    fireEvent.click(within(picker()).getByRole("button", { name: "Show all cities" }));
    expect(cards()).toHaveLength(5);
  });

  it("a detected city never maps onto a salon whose city field holds a state name", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/salons"]}>
          <Salons />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getAllByTestId("salon-card")).toHaveLength(5));
    fireEvent.click(within(panel()).getByRole("button", { name: "Detect my city" }));
    answerPosition(26.85, 80.95);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await answerLookup({ city: "Lucknow", state: "Uttar Pradesh", country: "India" });
    expect(cityText()).toBe("Lucknow, India");
    expect(screen.getByText("No salons on Snippr in Lucknow yet.")).toBeInTheDocument();
    expect(cards()).toEqual([]);
  });
});

describe("/salons nearest-first default and honest distances", () => {
  beforeEach(() => {
    mocks.salons = [
      { ...row("far", "Far Salon", "Delhi"), latitude: 28.70, longitude: 77.10 },
      { ...row("near", "Near Salon", "Delhi"), latitude: 28.632, longitude: 77.218 },
      row("nocoords", "No Coords Salon", "Delhi"),
    ];
  });
  const sortGroup = () => screen.getByRole("group", { name: "Sort salons" });
  const detectAt = async (accuracy?: number) => {
    fireEvent.click(within(panel()).getByRole("button", { name: "Detect my city" }));
    act(() =>
      geo.success!({ coords: { latitude: 28.6315, longitude: 77.2167, ...(accuracy ? { accuracy } : {}) } } as GeolocationPosition),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await answerLookup({ city: "Delhi", state: "Delhi", country: "India" });
  };

  it("explains why location is asked for, before anything is requested", async () => {
    await renderPage();
    expect(screen.getByText(/Used only for your city and distances. It isn.t saved./)).toBeInTheDocument();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("Recommended until located; then Nearest by default, missing coordinates last and marked", async () => {
    await renderPage();
    expect(within(sortGroup()).getByRole("button", { name: "Recommended" })).toHaveAttribute("aria-pressed", "true");
    // Nearest stays available as the explicit way to share a location, and the order is explained.
    expect(within(sortGroup()).getByRole("button", { name: /^Nearest/ })).toBeEnabled();
    expect(screen.getByText("Nearest asks for your location first.")).toBeInTheDocument();
    expect(cards()).toEqual(["Far Salon", "Near Salon", "No Coords Salon"]);

    await detectAt();
    await waitFor(() => expect(within(sortGroup()).getByRole("button", { name: "Nearest" })).toHaveAttribute("aria-pressed", "true"));
    await waitFor(() => expect(cards()).toEqual(["Near Salon", "Far Salon", "No Coords Salon"]));
    const card = (n: string) => screen.getAllByTestId("salon-card").find((c) => c.querySelector("h3")?.textContent === n)!;
    expect(within(card("Near Salon")).getByText(/^\d+\.\d km$/)).toBeInTheDocument(); // precise reading → one decimal
    expect(within(card("No Coords Salon")).getByText("Location unavailable")).toBeInTheDocument();
    expect(within(card("Near Salon")).queryByText("Location unavailable")).toBeNull();
  });

  it("a sort the customer picked is kept when their location arrives", async () => {
    await renderPage();
    fireEvent.click(within(sortGroup()).getByRole("button", { name: "Wait time" }));
    await detectAt();
    await waitFor(() => expect(screen.getAllByText(/ km$/).length).toBeGreaterThan(0));
    expect(within(sortGroup()).getByRole("button", { name: "Wait time" })).toHaveAttribute("aria-pressed", "true");
    expect(within(sortGroup()).getByRole("button", { name: "Nearest" })).toHaveAttribute("aria-pressed", "false");
  });

  it("a coarse device reading only supports approximate distances, and says so", async () => {
    await renderPage();
    await detectAt(5000);
    await waitFor(() => expect(screen.getAllByText(/^≈ /).length).toBeGreaterThan(0));
    expect(screen.queryByText(/^\d+\.\d km$/)).toBeNull();
    expect(screen.getByText("Your device gave an approximate location (about 5 km), so distances are approximate.")).toBeInTheDocument();
  });
});
