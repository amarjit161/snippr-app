import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SalonCard from "@/components/SalonCard";
import Salons from "@/pages/Salons";
import SalonPage from "@/pages/SalonPage";
import QuickBooking from "@/pages/QuickBooking";
import type { Tables } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// /salons Stage 3: real starting prices from one batched services read, and a
// single shared opening-hours rule for SalonCard, SalonPage and QuickBooking.
// Supabase, auth and geolocation are mocked; no network.
// ---------------------------------------------------------------------------
type Result = { data: unknown; error: unknown };
const mocks = vi.hoisted(() => ({
  salons: [] as Record<string, unknown>[],
  /** What the services read resolves to; a never-settling promise models "loading". */
  services: null as null | Promise<{ data: unknown; error: unknown }>,
  /** SalonPage's own services read (filtered by salon id). */
  salonServices: [] as Record<string, unknown>[],
  /** The single-row salon for SalonPage / QuickBooking. */
  salon: null as Record<string, unknown> | null,
  calls: [] as { table: string; ops: [string, unknown[]][] }[],
}));

vi.mock("@/integrations/supabase/publicClient", () => ({
  publicSupabase: {
    from: (table: string) => {
      const call = { table, ops: [] as [string, unknown[]][] };
      mocks.calls.push(call);
      const resolve = (): Promise<Result> => {
        if (table === "services") {
          // SalonPage's own services read (filtered by salon) → mocks.salonServices; /salons batch → mocks.services.
          if (call.ops.some(([op]) => op === "eq")) return Promise.resolve({ data: mocks.salonServices, error: null });
          return mocks.services ?? Promise.resolve({ data: [], error: null });
        }
        if (call.ops.some(([op]) => op === "maybeSingle")) return Promise.resolve({ data: mocks.salon, error: null });
        return Promise.resolve({ data: mocks.salons, error: null });
      };
      const chain: Record<string, unknown> = {};
      for (const op of ["select", "not", "order", "eq", "maybeSingle"]) {
        chain[op] = (...args: unknown[]) => {
          call.ops.push([op, args]);
          return chain;
        };
      }
      chain.then = (ok: (r: Result) => unknown, fail?: (e: unknown) => unknown) => resolve().then(ok, fail);
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

const salonRow = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, city: "Delhi", location: "Janpath", latitude: null, longitude: null,
  open_time: null, close_time: null, is_manual_closed: false, image_url: null, queue_count: 0, wait_time: 5,
  ...extra,
});

beforeEach(() => {
  mocks.salons = [];
  mocks.services = null;
  mocks.salon = null;
  mocks.salonServices = [];
  mocks.calls = [];
  // No location: keeps the page to a single list (no "Near you" duplicates).
  Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const renderSalons = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/salons"]}>
        <Salons />
      </MemoryRouter>
    </QueryClientProvider>,
  );

/** The starting-price label inside the card titled `name`, or null. */
const priceFor = (name: string) => {
  const card = screen.getByText(name).closest(".group") as HTMLElement;
  return card.querySelector('[data-testid="starting-price"]')?.textContent ?? null;
};

// ---------------------------------------------------------------------------
describe("/salons starting prices", () => {
  beforeEach(() => {
    mocks.salons = [
      salonRow("s-a", "Salon A"),
      salonRow("s-b", "Salon B"),
      salonRow("s-c", "Salon C"),
      salonRow("s-d", "Salon D"),
    ];
  });

  it("shows the lowest valid price per salon, 'Free' for ₹0, nothing without a valid price", async () => {
    mocks.services = Promise.resolve({
      data: [
        { salon_id: "s-a", price: 300 },
        { salon_id: "s-a", price: 199 },
        { salon_id: "s-b", price: 150 },
        { salon_id: "s-b", price: 0 },
        { salon_id: "s-c", price: null },
        { salon_id: "s-c", price: -20 },
        { salon_id: null, price: 1 },
      ],
      error: null,
    });
    renderSalons();
    await waitFor(() => expect(priceFor("Salon A")).toBe("From ₹199"));
    expect(priceFor("Salon B")).toBe("Free");
    expect(priceFor("Salon C")).toBeNull();
    expect(priceFor("Salon D")).toBeNull();
  });

  it("fetches all services in one batched, cheapest-first read (no request per salon)", async () => {
    mocks.services = Promise.resolve({ data: [{ salon_id: "s-a", price: 99 }], error: null });
    renderSalons();
    await waitFor(() => expect(priceFor("Salon A")).toBe("From ₹99"));
    const serviceCalls = mocks.calls.filter((c) => c.table === "services");
    expect(serviceCalls).toHaveLength(1);
    expect(serviceCalls[0].ops).toEqual([
      ["select", ["salon_id, name, price"]],
      ["order", ["price", { ascending: true }]],
    ]);
  });

  it("a failed price query leaves discovery working, with no price labels", async () => {
    mocks.services = Promise.resolve({ data: null, error: { message: "boom" } });
    renderSalons();
    await waitFor(() => expect(screen.getByText("Salon A")).toBeInTheDocument());
    await waitFor(() => expect(mocks.calls.some((c) => c.table === "services")).toBe(true));
    expect(screen.getByText("Salon D")).toBeInTheDocument();
    expect(screen.queryAllByTestId("starting-price")).toHaveLength(0);
    expect(screen.queryByText("Could not load salons right now.")).toBeNull();
  });

  it("while prices are still loading, salons render without labels", async () => {
    mocks.services = new Promise(() => {});
    renderSalons();
    await waitFor(() => expect(screen.getByText("Salon A")).toBeInTheDocument());
    expect(screen.queryAllByTestId("starting-price")).toHaveLength(0);
  });

  it("no services at all → no labels", async () => {
    mocks.services = Promise.resolve({ data: [], error: null });
    renderSalons();
    await waitFor(() => expect(screen.getByText("Salon A")).toBeInTheDocument());
    expect(screen.queryAllByTestId("starting-price")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe("SalonCard starting-price label", () => {
  const card = (startingPrice?: number | null) =>
    render(
      <SalonCard
        salon={{ ...(salonRow("s-1", "Card Salon") as unknown as Tables<"salons">), queueCount: 0, waitTime: 0, startingPrice }}
        index={1}
        onSelect={vi.fn()}
      />,
    );

  it.each([
    [0, "Free"],
    [1500, "From ₹1,500"],
  ])("%s → %s", (price, label) => {
    card(price);
    expect(screen.getByTestId("starting-price").textContent).toBe(label);
  });

  it.each([[undefined], [null], [Number.NaN], [-5]])("%s → no label", (price) => {
    card(price);
    expect(screen.queryByTestId("starting-price")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Open/closed now comes from one shared function. Each caller keeps its own
// inputs (e.g. SalonPage still defaults missing hours to 09:00–20:00).
const setNow = (hh: number, mm: number) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 17, hh, mm));
};

describe("shared opening hours: SalonCard", () => {
  const renderCard = (extra: Record<string, unknown>) =>
    render(
      <SalonCard
        salon={{ ...(salonRow("s-1", "Hours Salon", extra) as unknown as Tables<"salons">), queueCount: 0, waitTime: 0 }}
        index={1}
        onSelect={vi.fn()}
      />,
    );

  it.each([
    ["before opening", 8, 59, { open_time: "09:00", close_time: "21:00" }, false],
    ["at opening (inclusive)", 9, 0, { open_time: "09:00", close_time: "21:00" }, true],
    ["at closing (inclusive)", 21, 0, { open_time: "09:00:00", close_time: "21:00:00" }, true],
    ["after closing", 21, 1, { open_time: "09:00", close_time: "21:00" }, false],
    ["overnight, late evening", 23, 0, { open_time: "22:00", close_time: "06:00" }, true],
    ["overnight, midday", 12, 0, { open_time: "22:00", close_time: "06:00" }, false],
    ["no hours set", 3, 0, { open_time: null, close_time: null }, true],
    ["malformed hours", 12, 0, { open_time: "abc", close_time: "xyz" }, false],
    ["manually closed within hours", 12, 0, { open_time: "09:00", close_time: "21:00", is_manual_closed: true }, false],
  ])("%s → %s", (_label, hh, mm, extra, open) => {
    setNow(hh, mm);
    renderCard(extra);
    expect(screen.getByText(open ? "Open" : "Closed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: open ? "Book a Snipp" : "Currently Closed" })).toBeInTheDocument();
  });
});

describe("shared opening hours: SalonPage", () => {
  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={["/salon/s-1"]}>
        <Routes>
          <Route path="/salon/:id" element={<SalonPage />} />
        </Routes>
      </MemoryRouter>,
    );

  it.each([
    ["within hours", 12, 0, { open_time: "09:00:00", close_time: "21:00:00" }, true],
    ["after closing", 21, 1, { open_time: "09:00:00", close_time: "21:00:00" }, false],
    ["overnight", 23, 30, { open_time: "22:00", close_time: "06:00" }, true],
    ["manually closed", 12, 0, { open_time: "09:00", close_time: "21:00", is_manual_closed: true }, false],
    // SalonPage's own default for missing hours (09:00–20:00) is preserved.
    ["missing hours use the page default, after 20:00", 20, 30, { open_time: null, close_time: null }, false],
    ["missing hours use the page default, midday", 12, 0, { open_time: null, close_time: null }, true],
  ])("%s → %s", async (_label, hh, mm, extra, open) => {
    setNow(hh, mm);
    mocks.salon = { ...salonRow("s-1", "Detail Salon", extra), owner_id: "o-1", address: "1 Road", phone: "" };
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Detail Salon").length).toBeGreaterThan(0));
    expect(screen.getAllByText(open ? "Open" : "Closed").length).toBeGreaterThan(0);
    if (open) expect(screen.queryByText("Open now")).toBeInTheDocument();
    else expect(screen.queryByText("Open now")).toBeNull();
  });
});

describe("shared opening hours: QuickBooking", () => {
  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={["/q/CODE1"]}>
        <Routes>
          <Route path="/q/:quickBookingCode" element={<QuickBooking />} />
        </Routes>
      </MemoryRouter>,
    );

  it.each([
    ["within hours", 12, 0, { open_time: "09:00", close_time: "21:00" }, true],
    ["before opening", 8, 59, { open_time: "09:00", close_time: "21:00" }, false],
    ["no hours set", 3, 0, { open_time: null, close_time: null }, true],
    ["malformed hours", 12, 0, { open_time: "abc", close_time: "xyz" }, false],
    ["manually closed", 12, 0, { open_time: "09:00", close_time: "21:00", is_manual_closed: true }, false],
  ])("%s → %s", async (_label, hh, mm, extra, open) => {
    setNow(hh, mm);
    mocks.salon = { ...salonRow("s-1", "QR Salon", extra), address: "1 Road" };
    renderPage();
    await waitFor(() => expect(screen.getByRole("heading", { name: /booking at QR Salon/ })).toBeInTheDocument());
    expect(screen.getByText(open ? "Open" : "Closed")).toBeInTheDocument();
    expect(screen.getByText(open ? "Book at this Salon" : "Currently Closed")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe("SalonPage starting price", () => {
  const renderDetail = async (services: Record<string, unknown>[], extra: Record<string, unknown> = {}) => {
    setNow(12, 0);
    mocks.salon = {
      ...salonRow("s-1", "Detail Salon", { open_time: "09:00", close_time: "21:00", ...extra }),
      owner_id: "o-1", address: "1 Road", phone: "",
    };
    mocks.salonServices = services;
    render(
      <MemoryRouter initialEntries={["/salon/s-1"]}>
        <Routes>
          <Route path="/salon/:id" element={<SalonPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText("Detail Salon").length).toBeGreaterThan(0));
  };
  const svc = (id: string, price: unknown) => ({ id, name: `Service ${id}`, price, duration: 30 });

  it("shows the lowest valid price, formatted like the cards", async () => {
    await renderDetail([svc("a", 450), svc("b", 199), svc("c", null)]);
    expect(screen.getByTestId("starting-price").textContent).toBe("From ₹199");
    // The service list itself is unchanged.
    expect(screen.getByText("Service a")).toBeInTheDocument();
    expect(screen.getByText("Service c")).toBeInTheDocument();
  });

  it("₹0 → 'Free'", async () => {
    await renderDetail([svc("a", 300), svc("b", 0)]);
    expect(screen.getByTestId("starting-price").textContent).toBe("Free");
  });

  it("services with only missing or invalid prices → no starting price, never ₹∞ / NaN", async () => {
    await renderDetail([svc("a", null), svc("b", -10), svc("c", Number.NaN)]);
    expect(screen.getByText("Service a")).toBeInTheDocument();
    expect(screen.queryByTestId("starting-price")).toBeNull();
    // (The per-service rows are out of scope here; they still format each price as before.)
    expect(document.body.textContent).not.toMatch(/∞|Infinity|Services from|From ₹/);
  });

  it("no services → no starting price", async () => {
    await renderDetail([]);
    expect(screen.queryByTestId("starting-price")).toBeNull();
  });

  it("closed salon → no starting price (existing rule kept)", async () => {
    await renderDetail([svc("a", 199)], { is_manual_closed: true });
    expect(screen.getByText("Service a")).toBeInTheDocument();
    expect(screen.queryByTestId("starting-price")).toBeNull();
  });
});
