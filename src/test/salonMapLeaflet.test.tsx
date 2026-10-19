import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import SalonMap from "@/components/salons/SalonMap";

// ---------------------------------------------------------------------------
// Smoke test with the REAL Leaflet + react-leaflet (the other map tests mock
// them). jsdom never downloads images, and the tile host is a reserved
// .invalid domain, so no tile request can leave the machine.
// ---------------------------------------------------------------------------
const points = [
  { id: "a", name: "Salon A", label: "Salon A, Short wait, about 10 minutes", position: [28.6, 77.2] as [number, number] },
  { id: "b", name: "Salon B", label: "Salon B, Closed now", position: [28.7, 77.1] as [number, number] },
];

const SALON_MARKERS = ".leaflet-marker-icon:not(.snippr-user-location)";
const DELHI = { center: [28.6139, 77.209] as [number, number], zoom: 11.5 };

afterEach(() => vi.restoreAllMocks());

const renderMap = (selectedId: string | null = null, onSelect = vi.fn()) =>
  render(
    <div style={{ width: 600, height: 400 }}>
      <SalonMap
        points={points}
        selectedId={selectedId}
        onSelect={onSelect}
        tileUrl="https://tiles.invalid/{z}/{x}/{y}.png"
        userLocation={{ lat: 28.65, lng: 77.15 }}
        reducedMotion
        scrollWheelZoom={false}
        fallbackView={DELHI}
        onTileStatus={vi.fn()}
      />
    </div>,
  );

describe("SalonMap with real Leaflet", () => {
  it("shows the given user position as a non-interactive, named image (no SVG renderer needed)", async () => {
    const { container } = renderMap();
    await waitFor(() => expect(container.querySelector(".snippr-user-location")).not.toBeNull());
    const dot = container.querySelector<HTMLElement>(".snippr-user-location")!;
    // An image named "Your location" — not a button, not focusable, not clickable.
    await waitFor(() => expect(dot.getAttribute("aria-label")).toBe("Your location"));
    expect(dot.getAttribute("role")).toBe("img");
    expect(dot.getAttribute("tabindex")).toBeNull();
    expect(dot.classList.contains("leaflet-interactive")).toBe(false);
  });

  it("renders keyboard-focusable, labelled salon markers", async () => {
    const { container } = renderMap("b");
    await waitFor(() => expect(container.querySelectorAll(SALON_MARKERS)).toHaveLength(2));
    const [a, b] = Array.from(container.querySelectorAll<HTMLElement>(SALON_MARKERS));
    expect(a.getAttribute("role")).toBe("button");
    expect(a.tabIndex).toBe(0);
    expect(a.getAttribute("title")).toBe("Salon A");
    expect(a.getAttribute("aria-label")).toBe("Salon A, Short wait, about 10 minutes");
    expect(a.getAttribute("aria-pressed")).toBe("false");
    expect(b.getAttribute("aria-pressed")).toBe("true");
    expect(b.classList.contains("is-selected")).toBe(true);
    // Leaflet's own attribution control is off (the panel renders attribution).
    expect(container.querySelector(".leaflet-control-attribution")).toBeNull();
  });

  it("clicking a marker reports its salon id", async () => {
    const onSelect = vi.fn();
    const { container } = renderMap(null, onSelect);
    await waitFor(() => expect(container.querySelectorAll(SALON_MARKERS)).toHaveLength(2));
    fireEvent.click(container.querySelectorAll(SALON_MARKERS)[1]);
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("selection changes update the marker in place (focus is not lost)", async () => {
    const { container, rerender } = renderMap(null);
    await waitFor(() => expect(container.querySelectorAll(SALON_MARKERS)).toHaveLength(2));
    const a = container.querySelectorAll<HTMLElement>(SALON_MARKERS)[0];
    a.focus();
    rerender(
      <div style={{ width: 600, height: 400 }}>
        <SalonMap
          points={points}
          selectedId="a"
          onSelect={vi.fn()}
          tileUrl="https://tiles.invalid/{z}/{x}/{y}.png"
          userLocation={null}
          reducedMotion
          scrollWheelZoom={false}
          fallbackView={DELHI}
        onTileStatus={vi.fn()}
        />
      </div>,
    );
    expect(container.querySelectorAll(SALON_MARKERS)[0]).toBe(a);
    expect(a.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(a);
  });
});

describe("SalonMap with real Leaflet — basemap, zoom and keyboard", () => {
  const renderWith = (props: Partial<Parameters<typeof SalonMap>[0]> = {}) =>
    render(
      <div style={{ width: 600, height: 400 }}>
        <SalonMap
          points={points}
          selectedId={null}
          onSelect={vi.fn()}
          tileUrl="https://tiles.invalid/{z}/{x}/{y}.png"
          userLocation={null}
          reducedMotion
          scrollWheelZoom={false}
          fallbackView={DELHI}
          onTileStatus={vi.fn()}
          {...props}
        />
      </div>,
    );

  it("with no salon locations the basemap still renders (tile layer, no markers)", async () => {
    const { container } = renderWith({ points: [] });
    await waitFor(() => expect(container.querySelector(".leaflet-tile-pane .leaflet-layer")).not.toBeNull());
    expect(container.querySelectorAll(SALON_MARKERS)).toHaveLength(0);
    expect(container.querySelector(".leaflet-control-zoom")).toBeNull(); // Leaflet's small default control is replaced
  });

  it("zoom buttons change Leaflet's real zoom and stop at the limit", async () => {
    const { container, getByRole } = renderWith({ points: [] });
    await waitFor(() => expect(container.querySelector(".leaflet-container")).not.toBeNull());
    const zoomIn = getByRole("button", { name: "Zoom in" });
    const zoomOut = getByRole("button", { name: "Zoom out" });
    for (let i = 0; i < 12; i++) fireEvent.click(zoomOut);
    await waitFor(() => expect(zoomOut).toBeDisabled()); // reached MIN_ZOOM (4)
    fireEvent.click(zoomIn);
    await waitFor(() => expect(zoomOut).not.toBeDisabled());
  });

  it.each([["Enter"], [" "]])("pressing %j on a focused marker selects it", async (key) => {
    const onSelect = vi.fn();
    const { container } = renderWith({ onSelect });
    await waitFor(() => expect(container.querySelectorAll(SALON_MARKERS)).toHaveLength(2));
    const b = container.querySelectorAll<HTMLElement>(SALON_MARKERS)[1];
    b.focus();
    fireEvent.keyDown(b, { key });
    expect(onSelect).toHaveBeenCalledWith("b");
  });
});

describe("SalonMap with real Leaflet — touch targets", () => {
  it("salon markers are 40px tap targets around a 24px dot; group badges 44px around 32px", async () => {
    const { container } = render(
      <div style={{ width: 600, height: 400 }}>
        <SalonMap
          points={[
            ...points,
            { id: "c", name: "Salon C", label: "Salon C, Closed now", position: [28.6, 77.2] },
          ]}
          selectedId={null}
          onSelect={vi.fn()}
          tileUrl="https://tiles.invalid/{z}/{x}/{y}.png"
          userLocation={null}
          reducedMotion
          scrollWheelZoom={false}
          fallbackView={DELHI}
          onTileStatus={vi.fn()}
        />
      </div>,
    );
    await waitFor(() => expect(container.querySelectorAll(SALON_MARKERS)).toHaveLength(2));
    const markers = Array.from(container.querySelectorAll<HTMLElement>(SALON_MARKERS));
    const single = markers.find((m) => m.title === "Salon B")!;
    const group = markers.find((m) => m.title === "2 salons")!;
    expect([single.style.width, single.style.height]).toEqual(["40px", "40px"]);
    expect(single.querySelector("span")).toHaveClass("h-6", "w-6");
    expect([group.style.width, group.style.height]).toEqual(["44px", "44px"]);
    expect(group.querySelector("span")).toHaveClass("h-8", "w-8");
  });
});

describe("SalonMap with real Leaflet — overlapping markers", () => {
  const stacked = [
    { id: "a", name: "Salon A", label: "Salon A, Closed now", position: [28.6, 77.2] as [number, number] },
    { id: "b", name: "Salon B", label: "Salon B, Closed now", position: [28.6, 77.2] as [number, number] },
    { id: "far", name: "Far Salon", label: "Far Salon, Closed now", position: [12.97, 77.59] as [number, number] },
  ];

  it.each([["Enter"], [" "]])("a group badge is a labelled, focusable button; %j opens it", async (key) => {
    const onStack = vi.fn();
    const { container } = render(
      <div style={{ width: 600, height: 400 }}>
        <SalonMap
          points={stacked}
          selectedId={null}
          onSelect={vi.fn()}
          tileUrl="https://tiles.invalid/{z}/{x}/{y}.png"
          userLocation={null}
          reducedMotion
          scrollWheelZoom={false}
          fallbackView={DELHI}
          onTileStatus={vi.fn()}
          onStack={onStack}
        />
      </div>,
    );
    await waitFor(() => expect(container.querySelectorAll(SALON_MARKERS)).toHaveLength(2));
    const group = Array.from(container.querySelectorAll<HTMLElement>(SALON_MARKERS)).find((m) => m.title === "2 salons")!;
    expect(group.getAttribute("role")).toBe("button");
    expect(group.tabIndex).toBe(0);
    await waitFor(() =>
      expect(group.getAttribute("aria-label")).toBe("2 salons close together: Salon A, Salon B. Show them as a list"),
    );
    group.focus();
    fireEvent.keyDown(group, { key });
    expect(onStack).toHaveBeenCalledWith(["a", "b"]);
  });
});

describe("SalonMap with real Leaflet — approximate locations", () => {
  it("an approximate point uses the hollow dashed marker and keeps its label", async () => {
    const { container } = render(
      <div style={{ width: 600, height: 400 }}>
        <SalonMap
          points={[
            { id: "x", name: "Approx", label: "Approx, Closed now, approximate test location", position: [28.6, 77.2], approximate: true },
            { id: "y", name: "On file", label: "On file, Closed now", position: [28.7, 77.1] },
          ]}
          selectedId={null}
          onSelect={vi.fn()}
          tileUrl="https://tiles.invalid/{z}/{x}/{y}.png"
          userLocation={null}
          reducedMotion
          scrollWheelZoom={false}
          fallbackView={DELHI}
          onTileStatus={vi.fn()}
        />
      </div>,
    );
    await waitFor(() => expect(container.querySelectorAll(SALON_MARKERS)).toHaveLength(2));
    const [approx, onFile] = Array.from(container.querySelectorAll<HTMLElement>(SALON_MARKERS));
    expect(approx.innerHTML).toContain("border-dashed");
    expect(onFile.innerHTML).not.toContain("border-dashed");
    expect(approx.getAttribute("aria-label")).toBe("Approx, Closed now, approximate test location");
  });
});

describe("SalonMap with real Leaflet — salon name labels", () => {
  const renderWith = (props: Partial<Parameters<typeof SalonMap>[0]> = {}) =>
    render(
      <div style={{ width: 600, height: 400 }}>
        <SalonMap
          points={points}
          selectedId={null}
          onSelect={vi.fn()}
          tileUrl="https://tiles.invalid/{z}/{x}/{y}.png"
          userLocation={null}
          reducedMotion
          scrollWheelZoom={false}
          fallbackView={DELHI}
          onTileStatus={vi.fn()}
          {...props}
        />
      </div>,
    );
  const labelOf = (container: HTMLElement, title: string) =>
    container.querySelector<HTMLElement>(`.leaflet-marker-icon[title="${title}"] [data-salon-label]`);

  it("each single salon shows its name beside the marker; the label is decorative (the marker carries the name)", async () => {
    const { container } = renderWith();
    await waitFor(() => expect(container.querySelectorAll("[data-salon-label]")).toHaveLength(2));
    expect([...container.querySelectorAll("[data-salon-label]")].map((l) => l.textContent).sort()).toEqual(["Salon A", "Salon B"]);
    const label = labelOf(container, "Salon A")!;
    expect(label).toHaveAttribute("aria-hidden", "true");
    const marker = label.closest(".leaflet-marker-icon")!;
    await waitFor(() => expect(marker.getAttribute("aria-label")).toBe("Salon A, Short wait, about 10 minutes"));
    // Well-separated salons are labelled (not hidden).
    expect(marker.classList.contains("label-hidden")).toBe(false);
  });

  it("clicking a label selects that salon; the selected label is highlighted", async () => {
    const onSelect = vi.fn();
    const { container, rerender } = render(
      <div style={{ width: 600, height: 400 }}>
        <SalonMap points={points} selectedId={null} onSelect={onSelect} tileUrl="https://tiles.invalid/{z}/{x}/{y}.png" userLocation={null} reducedMotion scrollWheelZoom={false} fallbackView={DELHI} onTileStatus={vi.fn()} />
      </div>,
    );
    await waitFor(() => expect(labelOf(container, "Salon B")).not.toBeNull());
    fireEvent.click(labelOf(container, "Salon B")!);
    expect(onSelect).toHaveBeenCalledWith("b");
    rerender(
      <div style={{ width: 600, height: 400 }}>
        <SalonMap points={points} selectedId="b" onSelect={onSelect} tileUrl="https://tiles.invalid/{z}/{x}/{y}.png" userLocation={null} reducedMotion scrollWheelZoom={false} fallbackView={DELHI} onTileStatus={vi.fn()} />
      </div>,
    );
    const marker = labelOf(container, "Salon B")!.closest(".leaflet-marker-icon")!;
    await waitFor(() => expect(marker.classList.contains("is-selected")).toBe(true));
    expect(marker.getAttribute("aria-pressed")).toBe("true");
    expect(labelOf(container, "Salon B")!.className).toContain("group-[.is-selected]:bg-primary");
  });

  it("long names are truncated safely; the full name stays in the marker's title and accessible name", async () => {
    const long = "The Extraordinarily Long Named Unisex Hair & Beauty Studio of Preet Vihar";
    const { container } = renderWith({
      points: [{ id: "l", name: long, label: `${long}, Closed now`, position: [28.6, 77.2] }],
    });
    await waitFor(() => expect(container.querySelector("[data-salon-label]")).not.toBeNull());
    const label = container.querySelector<HTMLElement>("[data-salon-label]")!;
    expect(label.textContent).toBe(long);
    expect(label.className).toMatch(/\bmax-w-\[140px\]/);
    expect(label.className).toMatch(/\btruncate\b/);
    const marker = label.closest(".leaflet-marker-icon")!;
    expect(marker.getAttribute("title")).toBe(long);
    await waitFor(() => expect(marker.getAttribute("aria-label")).toBe(`${long}, Closed now`));
  });

  it("salon names are rendered as text, never as HTML", async () => {
    const evil = `<img src=x onerror="window.__pwned=1">Evil & Co`;
    const { container } = renderWith({ points: [{ id: "e", name: evil, label: "Evil, Closed now", position: [28.6, 77.2] }] });
    await waitFor(() => expect(container.querySelector("[data-salon-label]")).not.toBeNull());
    expect(container.querySelector("[data-salon-label]")!.textContent).toBe(evil);
    expect(container.querySelector(".leaflet-marker-pane img")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it("grouped salons keep their identities in the badge; groups carry no single-salon label", async () => {
    const stacked = [
      { id: "a", name: "Sam", label: "Sam, Closed now", position: [28.6, 77.2] as [number, number] },
      { id: "b", name: "The King", label: "The King, Closed now", position: [28.6, 77.2] as [number, number] },
      { id: "far", name: "Soham", label: "Soham, Closed now, demo location", position: [12.97, 77.59] as [number, number] },
    ];
    const { container } = renderWith({ points: stacked });
    await waitFor(() => expect(container.querySelectorAll(".leaflet-marker-icon")).toHaveLength(2));
    const group = [...container.querySelectorAll<HTMLElement>(".leaflet-marker-icon")].find((m) => m.title === "2 salons")!;
    await waitFor(() => expect(group.getAttribute("aria-label")).toBe("2 salons close together: Sam, The King. Show them as a list"));
    expect(group.querySelector("[data-salon-label]")).toBeNull();
    // A demo salon keeps its demo wording in the marker's accessible name.
    const soham = [...container.querySelectorAll<HTMLElement>(".leaflet-marker-icon")].find((m) => m.title === "Soham")!;
    await waitFor(() => expect(soham.getAttribute("aria-label")).toBe("Soham, Closed now, demo location"));
    expect(soham.querySelector("[data-salon-label]")!.textContent).toBe("Soham");
  });

  it("markers centre their dot on the coordinate (Leaflet's display:block is overridden)", async () => {
    const { container } = renderWith();
    await waitFor(() => expect(container.querySelectorAll(SALON_MARKERS)).toHaveLength(2));
    for (const m of container.querySelectorAll(SALON_MARKERS)) expect(m.className).toMatch(/(^|\s)!flex(\s|$)/);
  });
});

describe("SalonMap with real Leaflet — premium styling keeps behaviour", () => {
  const renderWith = (props: Partial<Parameters<typeof SalonMap>[0]> = {}) =>
    render(
      <div style={{ width: 600, height: 400 }}>
        <SalonMap
          points={points}
          selectedId={null}
          onSelect={vi.fn()}
          tileUrl="https://tiles.invalid/{z}/{x}/{y}.png"
          userLocation={null}
          reducedMotion
          scrollWheelZoom={false}
          fallbackView={DELHI}
          onTileStatus={vi.fn()}
          {...props}
        />
      </div>,
    );

  it("salon pins are brand purple; the selected one gets a restrained halo, not a different colour", async () => {
    const { container } = renderWith({ selectedId: "b" });
    await waitFor(() => expect(container.querySelectorAll(SALON_MARKERS)).toHaveLength(2));
    const dot = container.querySelector<HTMLElement>('.leaflet-marker-icon[title="Salon B"] > span')!;
    expect(dot).toHaveClass("bg-primary", "border-white");
    expect(dot.className).toContain("group-[.is-selected]:ring-primary/25");
    await waitFor(() => expect(dot.parentElement!.classList.contains("is-selected")).toBe(true));
  });

  it("cluster badges show a readable count on a deep-purple badge and stay labelled buttons", async () => {
    const stacked = [
      { id: "a", name: "Sam", label: "Sam, Closed now", position: [28.6, 77.2] as [number, number] },
      { id: "b", name: "Looks", label: "Looks, Closed now", position: [28.6, 77.2] as [number, number] },
    ];
    const { container } = renderWith({ points: stacked });
    await waitFor(() => expect(container.querySelectorAll(SALON_MARKERS)).toHaveLength(1));
    const group = container.querySelector<HTMLElement>(SALON_MARKERS)!;
    const badge = group.querySelector("span")!;
    expect(badge.textContent).toBe("2");
    expect(badge).toHaveClass("bg-[#2e1065]", "text-white", "tabular-nums");
    expect(group.getAttribute("role")).toBe("button");
    await waitFor(() => expect(group.getAttribute("aria-label")).toBe("2 salons close together: Sam, Looks. Show them as a list"));
  });

  it("controls share one rounded white shell, with hover, pressed and visible focus states, and labels avoid them", async () => {
    const { container, getByRole } = renderWith();
    await waitFor(() => expect(container.querySelector(".leaflet-container")).not.toBeNull());
    const buttons = ["Zoom in", "Zoom out", "Show all salons on the map"].map((name) => getByRole("button", { name }));
    for (const b of buttons) {
      expect(b).toHaveClass("h-11", "w-11", "bg-white", "[@media(hover:hover)]:hover:text-primary", "active:bg-violet-100", "focus-visible:ring-2");
    }
    expect(getByRole("group", { name: "Zoom" })).toHaveClass("rounded-xl");
    expect(buttons[2]).toHaveClass("rounded-xl");
    expect(buttons[0].closest("[data-map-avoid]")).not.toBeNull();
  });
});

describe("SalonMap with real Leaflet — the customer's location", () => {
  const base = {
    points,
    selectedId: null,
    onSelect: vi.fn(),
    tileUrl: "https://tiles.invalid/{z}/{x}/{y}.png",
    reducedMotion: true,
    scrollWheelZoom: false,
    fallbackView: DELHI,
    onTileStatus: vi.fn(),
  };
  const view = (props: Partial<Parameters<typeof SalonMap>[0]> = {}) => (
    <div style={{ width: 600, height: 400 }}>
      <SalonMap userLocation={null} {...base} {...props} />
    </div>
  );

  it("no position → no customer marker (the map's default view is not 'you')", async () => {
    const { container } = render(view());
    await waitFor(() => expect(container.querySelectorAll(SALON_MARKERS)).toHaveLength(2));
    expect(container.querySelector(".snippr-user-location")).toBeNull();
  });

  it("is blue and named 'Your location', with a 'You are here' label — distinct from purple salon pins", async () => {
    const { container } = render(view({ userLocation: { lat: 28.65, lng: 77.15 } }));
    await waitFor(() => expect(container.querySelector(".snippr-user-location")).not.toBeNull());
    const you = container.querySelector<HTMLElement>(".snippr-user-location")!;
    await waitFor(() => expect(you.getAttribute("aria-label")).toBe("Your location"));
    expect(you.getAttribute("role")).toBe("img");
    expect(you.getAttribute("title")).toBe("Your location");
    expect(you.querySelector("span")).toHaveClass("bg-blue-600", "border-white");
    const label = you.querySelector("[data-user-label]")!;
    expect(label.textContent).toBe("You are here");
    expect(label).toHaveAttribute("aria-hidden", "true");
    // Salon pins stay purple, and are buttons; the customer marker is neither.
    for (const m of container.querySelectorAll<HTMLElement>(SALON_MARKERS)) {
      expect(m.querySelector("span")).toHaveClass("bg-primary");
      expect(m.getAttribute("role")).toBe("button");
    }
    expect(you.querySelector(".bg-primary")).toBeNull();
  });

  it("is never grouped with salons, even at the same spot", async () => {
    const { container } = render(view({ userLocation: { lat: 28.6, lng: 77.2 } })); // on top of Salon A
    await waitFor(() => expect(container.querySelector(".snippr-user-location")).not.toBeNull());
    const titles = [...container.querySelectorAll<HTMLElement>(SALON_MARKERS)].map((m) => m.title).sort();
    expect(titles).toEqual(["Salon A", "Salon B"]); // no "2 salons" badge swallowing anyone
  });

  it("'Show my location' asks the page; while finding, it is busy and ignores presses", async () => {
    const onLocate = vi.fn();
    const { getByRole, rerender, queryByRole } = render(view({ onLocate }));
    await waitFor(() => expect(getByRole("button", { name: "Show my location" })).toBeInTheDocument());
    fireEvent.click(getByRole("button", { name: "Show my location" }));
    expect(onLocate).toHaveBeenCalledTimes(1);
    rerender(view({ onLocate, locating: true }));
    const busy = getByRole("button", { name: "Finding your location…" });
    expect(busy).toHaveAttribute("aria-busy", "true");
    fireEvent.click(busy);
    expect(onLocate).toHaveBeenCalledTimes(1);
    // "Show all salons" is still there, separately.
    expect(getByRole("button", { name: "Show all salons on the map" })).toBeInTheDocument();
    // Without onLocate (other callers) there is no location control.
    rerender(view());
    expect(queryByRole("button", { name: /Show my location|Finding your location/ })).toBeNull();
  });

  it("centres on the customer once when asked, then leaves the view to them", async () => {
    const L = (await import("leaflet")).default;
    const fit = vi.spyOn(L.Map.prototype, "fitBounds");
    const setView = vi.spyOn(L.Map.prototype, "setView");
    const onCentred = vi.fn();
    const you = { lat: 28.66, lng: 77.16 };
    const nearby = [{ ...points[0], nearest: true, distanceText: "1.0 km" }, points[1]];
    const { container, rerender } = render(view({ points: nearby, userLocation: you, centreOnUser: true, onCentred }));
    await waitFor(() => expect(onCentred).toHaveBeenCalledTimes(1));
    // Centred on the customer (a box around them that reaches the nearest salon).
    const bounds = fit.mock.calls.at(-1)![0] as InstanceType<typeof L.LatLngBounds>;
    expect(bounds.getCenter().lat).toBeCloseTo(you.lat, 6);
    expect(bounds.getCenter().lng).toBeCloseTo(you.lng, 6);
    expect(bounds.contains(L.latLng(28.6, 77.2))).toBe(true);
    expect(container.querySelector(".snippr-user-location")).not.toBeNull();

    // The page clears the request; re-renders and a refreshed reading don't move the map.
    const calls = fit.mock.calls.length + setView.mock.calls.length;
    rerender(view({ points: nearby, userLocation: you, centreOnUser: false, onCentred }));
    rerender(view({ points: nearby, userLocation: { lat: 28.661, lng: 77.161 }, centreOnUser: false, onCentred }));
    await new Promise((r) => setTimeout(r, 20));
    expect(fit.mock.calls.length + setView.mock.calls.length).toBe(calls);
    expect(onCentred).toHaveBeenCalledTimes(1);
  });

  it("far from every salon: centres on the customer at street level", async () => {
    const L = (await import("leaflet")).default;
    const setView = vi.spyOn(L.Map.prototype, "setView");
    const onCentred = vi.fn();
    render(view({ userLocation: { lat: 19.07, lng: 72.88 }, centreOnUser: true, onCentred })); // Mumbai; salons in Delhi
    await waitFor(() => expect(onCentred).toHaveBeenCalled());
    const [centre, zoom] = setView.mock.calls.at(-1)!;
    expect(L.latLng(centre as L.LatLngExpression)).toMatchObject({ lat: 19.07, lng: 72.88 });
    expect(zoom).toBeGreaterThanOrEqual(14);
  });

  it("labels carry the distance (and 'Nearest') when known; the name still truncates on its own", async () => {
    const withDistances = [
      { ...points[0], distanceText: "440 m", nearest: true },
      { ...points[1], distanceText: "12.3 km" },
    ];
    const { container } = render(view({ points: withDistances, userLocation: { lat: 28.6, lng: 77.21 } }));
    await waitFor(() => expect(container.querySelectorAll("[data-label-detail]")).toHaveLength(2));
    const labelFor = (title: string) => container.querySelector<HTMLElement>(`.leaflet-marker-icon[title="${title}"] [data-salon-label]`)!;
    expect(labelFor("Salon A").querySelector("[data-label-name]")!.textContent).toBe("Salon A");
    expect(labelFor("Salon A").querySelector("[data-label-detail]")!.textContent).toBe("Nearest · 440 m");
    expect(labelFor("Salon A").querySelector("[data-label-name]")).toHaveClass("truncate", "max-w-[122px]");
    expect(labelFor("Salon B").querySelector("[data-label-detail]")!.textContent).toBe("12.3 km");
    // Decorative: the marker's own name carries everything for screen readers.
    expect(labelFor("Salon A")).toHaveAttribute("aria-hidden", "true");
  });
});
