import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { CustomerAppShell } from "@/components/customer/CustomerAppShell";

// The fixed bottom navigation of the customer pages (phones only).

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname} ${JSON.stringify(location.state)}`}</p>;
}

const renderShell = (path = "/salons") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<CustomerAppShell />}>
          <Route path="/salons" element={<Where />} />
          <Route path="/bookings" element={<Where />} />
        </Route>
        <Route path="/login" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe("CustomerAppShell bottom navigation", () => {
  it("five tabs share the bar's width, so all fit on a 320px screen (no fixed side padding)", () => {
    renderShell();
    const nav = screen.getByRole("navigation");
    const tabs = within(nav).getAllByRole("button");
    expect(tabs.map((t) => t.textContent)).toEqual(["Home", "Search", "Queue", "Bookings", "Profile"]);
    for (const tab of tabs) {
      expect(tab).toHaveClass("flex-1", "min-w-0");
      expect(tab).not.toHaveClass("px-4");
      // A label that still can't fit is truncated rather than pushing the bar wider.
      expect(tab.querySelector("span")).toHaveClass("truncate", "max-w-full");
    }
    expect(nav).toHaveClass("md:hidden");
  });

  it("Search goes to /salons and asks the page to focus its search box", () => {
    renderShell("/bookings");
    fireEvent.click(within(screen.getByRole("navigation")).getByRole("button", { name: "Search" }));
    expect(screen.getByTestId("where").textContent).toBe('/salons {"focusSearch":true}');
  });

  it("Profile sends a signed-out visitor to sign in", () => {
    renderShell();
    fireEvent.click(within(screen.getByRole("navigation")).getByRole("button", { name: "Profile" }));
    expect(screen.getByTestId("where").textContent).toBe("/login null");
  });
});
