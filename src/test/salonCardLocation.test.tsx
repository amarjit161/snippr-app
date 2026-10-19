import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SalonCard from "@/components/SalonCard";
import type { Tables } from "@/integrations/supabase/types";
import { toMapPoints } from "@/lib/salonMapPoints";

// Location honesty on cards and map points: approximate vs on-file vs missing.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "" } }) }) } },
}));

const salon = (extra: Record<string, unknown>) =>
  ({
    id: "s-1", name: "Card Salon", location: "Preet Vihar", image_url: null,
    open_time: null, close_time: null, is_manual_closed: false, queueCount: 0, waitTime: 5,
    ...extra,
  }) as unknown as Tables<"salons"> & { queueCount: number; waitTime: number };

const renderRow = (extra: Record<string, unknown>) => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  return render(<SalonCard layout="row" salon={salon(extra)} index={1} onSelect={vi.fn()} />);
};

describe("SalonCard location labels", () => {
  it("approximate test location: '≈' rounded distance and an unobtrusive label", () => {
    renderRow({ distance: 2.6, distanceApproximate: true, locationQuality: "approximate" });
    // Straight-line, approximate — said in the tooltip and to screen readers.
    expect(screen.getByText("≈ 3 km").parentElement).toHaveAttribute("title", "About 3 km away in a straight line (not by road)");
    expect(screen.getByText("About 3 km away in a straight line (not by road)")).toHaveClass("sr-only");
    expect(screen.getByText("Approximate test location")).toBeInTheDocument();
  });

  it("local demo fixture: no location label (clean UI), distance still rounded", () => {
    renderRow({ distance: 2.6, distanceApproximate: true, locationQuality: "demo" });
    expect(screen.getByText("≈ 3 km")).toBeInTheDocument();
    expect(screen.queryByText(/Approximate test location|Distance unavailable|verified/i)).toBeNull();
  });

  it("coordinates on file: precise distance, no label (never 'verified')", () => {
    renderRow({ distance: 1.24, locationQuality: "on-file" });
    expect(screen.getByText("1.2 km")).toBeInTheDocument();
    expect(screen.queryByText(/Approximate|verified|Distance unavailable/i)).toBeNull();
  });

  it("missing coordinates: 'Distance unavailable' only when distances are expected — never a made-up distance", () => {
    const { unmount } = renderRow({ locationQuality: "missing", flagMissingLocation: true });
    expect(screen.getByText("Distance unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/ (k?m)$/)).toBeNull();
    unmount();
    renderRow({ locationQuality: "missing", flagMissingLocation: false });
    expect(screen.queryByText("Distance unavailable")).toBeNull();
  });

  it("under 1 km a precise distance is in metres; straight-line wording for screen readers", () => {
    renderRow({ distance: 0.437, locationQuality: "on-file" });
    expect(screen.getByText("440 m")).toBeInTheDocument();
    expect(screen.getByText("440 m away in a straight line (not by road)")).toHaveClass("sr-only");
  });

  it("the nearest salon is marked; a demo-location nearest says so", () => {
    const { unmount } = renderRow({ distance: 1.24, locationQuality: "on-file", isNearest: true });
    expect(screen.getByTestId("nearest-badge")).toHaveTextContent(/^Nearest$/);
    unmount();
    renderRow({ distance: 1.24, locationQuality: "demo", distanceApproximate: true, isNearest: true, locationDemo: { source: "test" } });
    expect(screen.getByTestId("nearest-badge")).toHaveTextContent("Nearest (demo location)");
  });

  it("no badge unless marked nearest", () => {
    renderRow({ distance: 1.24, locationQuality: "on-file" });
    expect(screen.queryByTestId("nearest-badge")).toBeNull();
  });
});

describe("toMapPoints marks approximate locations", () => {
  it("approximate points carry the flag and say so in their accessible label", () => {
    const now = new Date(2026, 9, 17, 12, 0);
    const [approx, onFile] = toMapPoints(
      [
        { id: "a", name: "Approx", open_time: null, close_time: null, is_manual_closed: false, waitTime: 0, latitude: 28.6, longitude: 77.2, locationApproximate: true },
        { id: "b", name: "On file", open_time: null, close_time: null, is_manual_closed: false, waitTime: 0, latitude: 28.7, longitude: 77.1 },
      ],
      now,
    );
    expect(approx).toMatchObject({ approximate: true, label: "Approx, No wait, walk in now, approximate test location" });
    expect(onFile.approximate).toBeUndefined();
    expect(onFile.label).toBe("On file, No wait, walk in now");
  });
});
