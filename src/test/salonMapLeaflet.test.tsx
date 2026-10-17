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
  it("shows the given user position as a non-interactive dot (no SVG renderer needed)", async () => {
    const { container } = renderMap();
    await waitFor(() => expect(container.querySelector(".snippr-user-location")).not.toBeNull());
    const dot = container.querySelector<HTMLElement>(".snippr-user-location")!;
    expect(dot.getAttribute("role")).toBeNull();
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
