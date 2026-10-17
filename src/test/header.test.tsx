import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import Header from "@/components/Header";

// The shared app Header, restyled after the landing-page navbar. Destinations,
// auth states, role actions and sign-out must behave exactly as before.

function LocationProbe() {
  const location = useLocation();
  return (
    <p data-testid="location">
      {location.pathname + location.search}
      {location.state ? ` ${JSON.stringify(location.state)}` : ""}
    </p>
  );
}

const renderAt = (path: string, props: Parameters<typeof Header>[0] = {}) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Header {...props} />
      <LocationProbe />
    </MemoryRouter>,
  );

const where = () => screen.getByTestId("location").textContent;

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("Header — signed out", () => {
  it("shows the landing-style actions and the public links", () => {
    renderAt("/");
    const main = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(main).getAllByRole("button").map((b) => b.textContent)).toEqual(["Browse Salons", "Owner Login", "Owner Signup"]);
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Get Started/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open account menu" })).toBeNull();
  });

  it("keeps the brand treatment: violet logo tile and display-font wordmark", () => {
    renderAt("/");
    const header = screen.getByRole("banner");
    expect(header.className).toContain("sticky");
    expect(within(header).getByText("Snippr").className).toContain("font-display");
    expect(header.querySelector(".bg-primary.rounded-lg")).not.toBeNull();
    // One compact row: no wrapping container.
    expect(header.firstElementChild!.className).toContain("h-16");
    expect(header.firstElementChild!.className).not.toContain("flex-wrap");
  });

  it.each([
    ["Browse Salons", "/salons"],
    ["Owner Login", "/owner-login"],
    ["Owner Signup", "/owner-register"],
  ])("%s → %s (unchanged destination)", (label, path) => {
    renderAt("/bookings");
    fireEvent.click(within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole("button", { name: label }));
    expect(where()).toBe(path);
  });

  it("Get Started keeps its app destination; Sign In goes to the customer login (as on the landing page)", () => {
    const first = renderAt("/salon/s-1");
    fireEvent.click(screen.getByRole("button", { name: /Get Started/ }));
    expect(where()).toBe("/auth?role=customer");
    first.unmount();
    renderAt("/salon/s-1");
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(where()).toBe("/login");
  });

  it("on /salons there is no 'Browse Salons' (bar or menu)", () => {
    renderAt("/salons");
    expect(screen.queryByRole("button", { name: "Browse Salons" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(within(screen.getByRole("navigation", { name: "Mobile navigation" })).queryByText("Browse Salons")).toBeNull();
    expect(screen.getByRole("button", { name: /Get Started/ })).toBeInTheDocument();
  });

  it("on /auth the public actions are hidden (as before)", () => {
    renderAt("/auth");
    expect(screen.queryByRole("button", { name: /Get Started/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open menu" })).toBeNull();
  });

  it("desktop vs mobile: inline links from lg, a menu button below lg, Sign In inline from md", () => {
    renderAt("/");
    expect(screen.getByRole("navigation", { name: "Main navigation" }).className).toMatch(/\bhidden\b.*\blg:flex\b/);
    expect(screen.getByRole("button", { name: "Open menu" }).className).toContain("lg:hidden");
    expect(screen.getByRole("button", { name: "Sign In" }).className).toMatch(/\bhidden\b.*\bmd:block\b/);
  });
});

describe("Header — mobile menu", () => {
  it("opens and closes with an accessible toggle; links navigate and close it", () => {
    renderAt("/");
    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "header-menu");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(within(menu).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Browse Salons",
      "Owner Login",
      "Owner Signup",
      "Sign In",
    ]);
    fireEvent.click(within(menu).getByRole("button", { name: "Owner Signup" }));
    expect(where()).toBe("/owner-register");
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).toBeNull();
  });

  it("Escape closes the menu and returns focus to the toggle", () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open menu" }));
  });

  it("the menu is part of the sticky header (pushes nothing, overlaps no bottom nav)", () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const menu = document.getElementById("header-menu")!;
    expect(screen.getByRole("banner").contains(menu)).toBe(true);
    expect(menu.className).not.toMatch(/\bfixed\b/);
  });
});

describe("Header — signed in", () => {
  const signedIn = (extra: Partial<Parameters<typeof Header>[0]> = {}) => ({
    onSignOut: vi.fn(),
    userName: "asha@example.com",
    userEmail: "asha@example.com",
    profileName: "Asha",
    ...extra,
  });

  it("shows the avatar (no public actions) and opens the account dialog with focus on close", () => {
    renderAt("/bookings", signedIn());
    expect(screen.queryByRole("button", { name: /Get Started/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign In" })).toBeNull();
    const avatar = screen.getByRole("button", { name: "Open account menu" });
    expect(avatar.textContent).toBe("A");
    fireEvent.click(avatar);
    const dialog = screen.getByRole("dialog", { name: "Account menu" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText("Asha")).toBeInTheDocument();
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close account menu" }));
  });

  it.each([
    ["My Profile", "/my-profile"],
    ["My Bookings", "/bookings"],
    ["Live Queue", '/bookings {"initialTab":"upcoming"}'],
    ["Favorites", "/favorites"],
    ["Notifications", "/notifications"],
    ["Support", "/support"],
  ])("account item %s → %s (unchanged)", (label, expected) => {
    renderAt("/salons", signedIn());
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: new RegExp(`^${label}`) }));
    expect(where()).toBe(expected);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Escape closes the account dialog and returns focus to the avatar", () => {
    renderAt("/bookings", signedIn());
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open account menu" }));
  });

  it("Sign Out calls onSignOut, then goes to /", async () => {
    const props = signedIn();
    renderAt("/favorites", props);
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    await waitFor(() => expect(where()).toBe("/"));
    expect(props.onSignOut).toHaveBeenCalledTimes(1);
  });

  it("Sign Out still leaves the account area if signing out fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const props = signedIn({ onSignOut: vi.fn().mockRejectedValue(new Error("network")) });
    renderAt("/favorites", props);
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    await waitFor(() => expect(where()).toBe("/"));
  });

  it("role action: Admin toggle and Owner Dashboard call onAdminToggle; the active state is shown", () => {
    const onAdminToggle = vi.fn();
    renderAt("/bookings", signedIn({ onAdminToggle, isAdmin: true }));
    const admin = screen.getByRole("button", { name: "Admin" });
    expect(admin.className).toContain("bg-primary");
    fireEvent.click(admin);
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    fireEvent.click(screen.getByRole("button", { name: /Owner Dashboard/ }));
    expect(onAdminToggle).toHaveBeenCalledTimes(2);
  });

  it("without onAdminToggle there is no Admin action or Owner Dashboard item", () => {
    renderAt("/favorites", signedIn());
    expect(screen.queryByRole("button", { name: "Admin" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    expect(screen.queryByRole("button", { name: /Owner Dashboard/ })).toBeNull();
  });
});

describe("Header — owner pages (name without sign-out)", () => {
  it("shows only the logo, as before", () => {
    renderAt("/register-salon", { userName: "Owner" });
    expect(screen.getByText("Snippr")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
