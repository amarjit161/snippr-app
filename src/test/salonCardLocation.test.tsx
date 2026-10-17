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
    expect(screen.getByText("≈ 3 km")).toHaveAttribute("title", "Approximate distance");
    expect(screen.getByText("Approximate test location")).toBeInTheDocument();
  });

  it("local demo fixture: no location label (clean UI), distance still rounded", () => {
    renderRow({ distance: 2.6, distanceApproximate: true, locationQuality: "demo" });
    expect(screen.getByText("≈ 3 km")).toBeInTheDocument();
    expect(screen.queryByText(/Approximate test location|Location unavailable|verified/i)).toBeNull();
  });

  it("coordinates on file: precise distance, no label (never 'verified')", () => {
    renderRow({ distance: 1.24, locationQuality: "on-file" });
    expect(screen.getByText("1.2 km")).toBeInTheDocument();
    expect(screen.queryByText(/Approximate|verified|Location unavailable/i)).toBeNull();
  });

  it("missing coordinates: 'Location unavailable' only when distances are expected", () => {
    const { unmount } = renderRow({ locationQuality: "missing", flagMissingLocation: true });
    expect(screen.getByText("Location unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/ km$/)).toBeNull();
    unmount();
    renderRow({ locationQuality: "missing", flagMissingLocation: false });
    expect(screen.queryByText("Location unavailable")).toBeNull();
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
