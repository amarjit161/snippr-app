import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SalonCard from "@/components/SalonCard";
import type { Tables } from "@/integrations/supabase/types";

// /salons row cards: a salon's own photo when it has one; otherwise (or if it
// fails to load) the app's default image with the honest "Representative photo"
// label. No invented images.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://storage.invalid/salon-images/${p}` } }) }) },
  },
}));

const salon = (image_url: string | null) =>
  ({
    id: "s-1", name: "Photo Salon", location: "Janpath", image_url,
    open_time: null, close_time: null, is_manual_closed: false, queueCount: 0, waitTime: 5,
  }) as unknown as Tables<"salons"> & { queueCount: number; waitTime: number };

const renderRow = (image_url: string | null) => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  const view = render(<SalonCard layout="row" salon={salon(image_url)} index={1} onSelect={vi.fn()} />);
  return { view, img: view.container.querySelector("img")! };
};

describe("SalonCard row photo", () => {
  it("uses the salon's own photo (absolute URL) with no representative label", () => {
    const { img } = renderRow("https://photos.invalid/salon.jpg");
    expect(img.getAttribute("src")).toBe("https://photos.invalid/salon.jpg");
    expect(screen.queryByText("Representative photo")).toBeNull();
  });

  it("resolves a storage path through the salon-images bucket", () => {
    const { img } = renderRow("owner-1/front.jpg");
    expect(img.getAttribute("src")).toBe("https://storage.invalid/salon-images/owner-1/front.jpg");
    expect(screen.queryByText("Representative photo")).toBeNull();
  });

  it("no photo → the default image, labelled 'Representative photo'", () => {
    const { img } = renderRow(null);
    expect(img.getAttribute("src")).toBe("/default-salon.jpg");
    expect(screen.getByText("Representative photo")).toBeInTheDocument();
  });

  it("a photo that fails to load falls back to the default image and gains the label", () => {
    const { img } = renderRow("https://photos.invalid/broken.jpg");
    fireEvent.error(img);
    expect(img.getAttribute("src")).toBe("/default-salon.jpg");
    expect(screen.getByText("Representative photo")).toBeInTheDocument();
  });

  it("image frame size doesn't depend on whether the photo is real (same classes)", () => {
    const own = renderRow("https://photos.invalid/salon.jpg").img.parentElement!.className;
    const fallback = renderRow(null).img.parentElement!.className;
    expect(own).toBe(fallback);
  });
});
