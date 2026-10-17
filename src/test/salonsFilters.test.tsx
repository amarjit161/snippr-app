import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Salons from "@/pages/Salons";

// ---------------------------------------------------------------------------
// /salons discovery filters: quick chips, the "All filters" sheet, applied-filter
// chips, empty state, and interplay with city, sort and the map. Only real data
// drives options (no salon type, ratings or premium flags exist). No network.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  salons: [] as Record<string, unknown>[],
  services: [] as Record<string, unknown>[],
  servicesError: null as null | { message: string },
}));

vi.mock("@/integrations/supabase/publicClient", () => ({
  publicSupabase: {
    from: (table: string) => {
      const result =
        table === "services"
          ? { data: mocks.servicesError ? null : mocks.services, error: mocks.servicesError }
          : { data: mocks.salons, error: null };
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
// The map receives exactly the filtered salons.
vi.mock("@/components/salons/SalonMapPanel", () => ({
  default: ({ salons }: { salons: { name: string }[] }) => <p data-testid="map-salons">{salons.map((s) => s.name).join(",")}</p>,
  MapNotice: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  MapSkeleton: () => <p>loading map</p>,
}));

const row = (id: string, name: string, city: string, extra: Record<string, unknown> = {}) => ({
  id, name, city, location: `${name} street`, latitude: null, longitude: null,
  open_time: null, close_time: null, is_manual_closed: false, image_url: null, queue_count: 0, wait_time: 10,
  ...extra,
});

beforeEach(() => {
  mocks.salons = [
    row("a", "Aura", "Delhi", { wait_time: 10 }),
    row("b", "Blade", "Delhi", { wait_time: 40 }),
    row("c", "Colour Co", "Noida", { is_manual_closed: true }),
    row("d", "Dapper", "Noida", { wait_time: null }),
  ];
  mocks.services = [
    { salon_id: "a", name: "Haircut", price: 300 },
    { salon_id: "a", name: "SPA", price: 2000 },
    { salon_id: "b", name: "Haircut", price: 150 },
    { salon_id: "c", name: "colour", price: 600 },
    { salon_id: "d", name: "bread saving", price: null },
  ];
  mocks.servicesError = null;
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition: vi.fn() }, configurable: true });
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const renderPage = async () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/salons"]}>
        <Salons />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getAllByTestId("salon-card")).toHaveLength(4));
  // Service-derived options appear once the services read resolves.
  await waitFor(() => expect(within(quick()).getByRole("button", { name: "Haircut" })).toBeInTheDocument());
};
const quick = () => screen.getByRole("group", { name: "Quick filters" });
const names = () => screen.queryAllByTestId("salon-card").map((c) => c.querySelector("h3")?.textContent);
const openSheet = () => fireEvent.click(within(quick()).getByRole("button", { name: /All filters/ }));
const sheet = () => screen.getByRole("dialog", { name: "Filters" });
const check = (label: RegExp | string) => fireEvent.click(within(sheet()).getByRole("checkbox", { name: label }));

describe("quick filters", () => {
  it("offer only supported filters: availability plus service categories that have salons", async () => {
    await renderPage();
    const labels = within(quick()).getAllByRole("button").map((b) => b.textContent);
    expect(labels).toEqual(["All filters", "Open now", "Short wait", "Haircut", "Hair colour", "Spa"]);
    expect(screen.queryByText(/\b(men|women|unisex|premium|beard|ratings?)\b/i)).toBeNull();
  });

  it("toggle in place (aria-pressed), combine with AND, and show removable applied chips", async () => {
    await renderPage();
    fireEvent.click(within(quick()).getByRole("button", { name: "Haircut" }));
    expect(names()).toEqual(["Aura", "Blade"]);
    fireEvent.click(within(quick()).getByRole("button", { name: "Short wait" }));
    expect(within(quick()).getByRole("button", { name: "Short wait" })).toHaveAttribute("aria-pressed", "true");
    expect(names()).toEqual(["Aura"]);
    expect(screen.getByText("1 salon")).toBeInTheDocument();

    const applied = screen.getByRole("group", { name: "Applied filters" });
    expect(within(applied).getAllByRole("button").map((b) => b.textContent)).toEqual(["Short wait", "Haircut", "Clear all"]);
    fireEvent.click(within(applied).getByRole("button", { name: "Remove filter: Short wait" }));
    expect(names()).toEqual(["Aura", "Blade"]);
    fireEvent.click(within(screen.getByRole("group", { name: "Applied filters" })).getByRole("button", { name: "Clear all" }));
    expect(names()).toHaveLength(4);
    expect(screen.queryByRole("group", { name: "Applied filters" })).toBeNull();
  });

  it("cards show each salon's real service categories", async () => {
    await renderPage();
    const card = (n: string) => screen.getAllByTestId("salon-card").find((c) => c.querySelector("h3")?.textContent === n)!;
    expect(within(card("Aura")).getByTestId("service-labels").textContent).toBe("Haircut · Spa");
    expect(within(card("Dapper")).getByTestId("service-labels").textContent).toBe(""); // "bread saving" isn't guessed
  });
});

describe("All filters sheet", () => {
  it("is a labelled dialog with grouped options, real counts, and only non-empty price ranges", async () => {
    await renderPage();
    openSheet();
    const dialog = sheet();
    expect(within(dialog).getByRole("button", { name: "Close filters" })).toBeInTheDocument();
    const groups = within(dialog).getAllByRole("group").map((g) => g.querySelector("legend")?.textContent);
    expect(groups).toEqual(["Availability", "Services", "Starting price"]);
    expect(within(dialog).getAllByRole("checkbox").map((c) => c.closest("label")!.textContent)).toEqual([
      "Open now3",
      "Short waitOpen, with a live wait of 15 minutes or less1",
      "Haircut2",
      "Hair colour1",
      "Spa1",
      "Under ₹2001",
      "₹200–₹4991",
      "₹500–₹9991",
    ]);
    expect(within(dialog).getByRole("button", { name: "Show 4 salons" })).toBeInTheDocument();
  });

  it("drafts changes with a live count; Apply filters the list (OR within a group, AND across groups)", async () => {
    await renderPage();
    openSheet();
    check(/Under ₹200/);
    check(/₹500–₹999/);
    expect(within(sheet()).getByRole("button", { name: "Show 2 salons" })).toBeInTheDocument();
    expect(names()).toHaveLength(4); // nothing applied yet
    check(/^Haircut/);
    expect(within(sheet()).getByRole("button", { name: "Show 1 salon" })).toBeInTheDocument();
    fireEvent.click(within(sheet()).getByRole("button", { name: "Show 1 salon" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(names()).toEqual(["Blade"]);
    expect(within(quick()).getByRole("button", { name: /All filters/ }).textContent).toContain("3");
  });

  it("closing without applying discards the draft and returns focus to 'All filters'", async () => {
    await renderPage();
    const trigger = within(quick()).getByRole("button", { name: /All filters/ });
    trigger.focus();
    openSheet();
    check(/^Spa/);
    fireEvent.keyDown(sheet(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(names()).toHaveLength(4);
    await waitFor(() => expect(document.activeElement).toBe(within(quick()).getByRole("button", { name: /All filters/ })));
  });

  it("'Clear all' in the sheet resets the draft; applying restores every salon", async () => {
    await renderPage();
    fireEvent.click(within(quick()).getByRole("button", { name: "Spa" }));
    expect(names()).toEqual(["Aura"]);
    openSheet();
    expect(within(sheet()).getByRole("checkbox", { name: /^Spa/ })).toBeChecked();
    fireEvent.click(within(sheet()).getByRole("button", { name: "Clear all" }));
    fireEvent.click(within(sheet()).getByRole("button", { name: "Show 4 salons" }));
    expect(names()).toHaveLength(4);
  });
});

describe("empty results, city and map", () => {
  it("explains which filters left no results and clears them in one tap", async () => {
    await renderPage();
    fireEvent.click(within(quick()).getByRole("button", { name: "Open now" }));
    fireEvent.click(within(quick()).getByRole("button", { name: "Hair colour" })); // the colour salon is closed
    expect(names()).toEqual([]);
    expect(screen.getByText("No salons match these filters")).toBeInTheDocument();
    expect(screen.getByText("Active filters: Open now · Hair colour")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(names()).toHaveLength(4);
  });

  it("works with the chosen city: options are recounted and clearing filters keeps the city", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Choose city" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Choose your city" })).getByRole("button", { name: /^Noida/ }));
    expect(names()).toEqual(["Colour Co", "Dapper"]);
    expect(within(quick()).getAllByRole("button").map((b) => b.textContent)).toEqual(["All filters", "Open now", "Short wait", "Hair colour"]);
    fireEvent.click(within(quick()).getByRole("button", { name: "Hair colour" }));
    expect(names()).toEqual(["Colour Co"]);
    fireEvent.click(within(screen.getByRole("group", { name: "Applied filters" })).getByRole("button", { name: "Clear all" }));
    expect(names()).toEqual(["Colour Co", "Dapper"]);
  });

  it("filters and sort apply together, and the map shows exactly the filtered salons", async () => {
    await renderPage();
    fireEvent.click(within(quick()).getByRole("button", { name: "Haircut" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Sort salons" })).getByRole("button", { name: "Wait time" }));
    expect(names()).toEqual(["Aura", "Blade"]);
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    expect(screen.getByTestId("map-salons").textContent).toBe("Aura,Blade");
  });

  it("if services can't load, salons still list and no service or price options are offered", async () => {
    mocks.servicesError = { message: "boom" };
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/salons"]}>
          <Salons />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getAllByTestId("salon-card")).toHaveLength(4));
    expect(within(quick()).getAllByRole("button").map((b) => b.textContent)).toEqual(["All filters", "Open now", "Short wait"]);
    openSheet();
    expect(within(sheet()).getAllByRole("group").map((g) => g.querySelector("legend")?.textContent)).toEqual(["Availability"]);
  });
});
