import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import Header from "@/components/Header";

// The signed-in account (for its provider name / photo). Null unless a test sets it.
const authMocks = vi.hoisted(() => ({ user: null as null | { email?: string; user_metadata?: Record<string, unknown> } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: authMocks.user }) }));

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
  authMocks.user = null;
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
  const trigger = () => screen.getByRole("button", { name: "Open account menu" });
  // Radix opens the menu on Enter / Space / ArrowDown, or a primary-button pointer press.
  const openWithKey = (key = "Enter") => fireEvent.keyDown(trigger(), { key });
  const openWithPointer = () => fireEvent.pointerDown(trigger(), { button: 0, ctrlKey: false, pointerType: "mouse" });
  const menu = () => screen.getByRole("menu", { name: "Account menu" });

  beforeAll(() => {
    // jsdom has no PointerEvent: without it a pointer press carries no "button", and
    // Radix (rightly) only opens on a primary-button press.
    if (!("PointerEvent" in window)) {
      vi.stubGlobal(
        "PointerEvent",
        class extends MouseEvent {
          pointerType: string;
          constructor(type: string, init: PointerEventInit = {}) {
            super(type, init);
            this.pointerType = init.pointerType ?? "mouse";
          }
        },
      );
    }
    // Radix measures the trigger/content; jsdom has no ResizeObserver.
    if (!("ResizeObserver" in window)) {
      vi.stubGlobal(
        "ResizeObserver",
        class {
          observe() {}
          unobserve() {}
          disconnect() {}
        },
      );
    }
  });

  it("shows the avatar trigger (no public actions) with the account's initial and a menu popup", () => {
    renderAt("/bookings", signedIn());
    expect(screen.queryByRole("button", { name: /Get Started/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign In" })).toBeNull();
    expect(trigger()).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger().textContent).toBe("A");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it.each([["Enter"], [" "], ["ArrowDown"]])("%j opens the menu, focuses the first item and marks the trigger open", (key) => {
    renderAt("/bookings", signedIn());
    openWithKey(key);
    expect(menu()).toBeInTheDocument();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(trigger()).toHaveAttribute("data-state", "open");
    expect(document.activeElement).toBe(within(menu()).getAllByRole("menuitem")[0]);
  });

  it("a pointer press opens it too; the menu shows the real name and email only", () => {
    renderAt("/bookings", signedIn());
    openWithPointer();
    const m = menu();
    expect(within(m).getByText("Asha")).toBeInTheDocument();
    expect(within(m).getByText("asha@example.com")).toBeInTheDocument();
    expect(within(m).getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "My Profile",
      "My Bookings",
      "Live Queue",
      "Favorites",
      "Notifications",
      "Support",
      "Sign Out",
    ]);
  });

  it("arrow keys move between items and wrap around", async () => {
    renderAt("/bookings", signedIn());
    openWithKey("Enter");
    const items = within(menu()).getAllByRole("menuitem");
    // Radix moves focus on the next tick.
    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    await waitFor(() => expect(document.activeElement).toBe(items[items.length - 1])); // wraps to Sign Out
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    await waitFor(() => expect(document.activeElement).toBe(items[items.length - 1]));
  });

  it.each([
    ["My Profile", "/my-profile"],
    ["My Bookings", "/bookings"],
    ["Live Queue", '/bookings {"initialTab":"upcoming"}'],
    ["Favorites", "/favorites"],
    ["Notifications", "/notifications"],
    ["Support", "/support"],
  ])("account item %s → %s (unchanged), then the menu closes", (label, expected) => {
    renderAt("/salons", signedIn());
    openWithKey();
    fireEvent.click(within(menu()).getByRole("menuitem", { name: label }));
    expect(where()).toBe(expected);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Enter on an item activates it", () => {
    renderAt("/salons", signedIn());
    openWithKey();
    fireEvent.keyDown(within(menu()).getByRole("menuitem", { name: "My Profile" }), { key: "Enter" });
    expect(where()).toBe("/my-profile");
  });

  it("Escape closes the menu and returns focus to the avatar", async () => {
    renderAt("/bookings", signedIn());
    openWithKey();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("a click outside closes the menu without taking an action", async () => {
    renderAt("/bookings", signedIn());
    openWithPointer();
    expect(menu()).toBeInTheDocument();
    // Radix starts listening for outside presses on the next tick (so the opening
    // press itself can't close the menu).
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    fireEvent.pointerDown(document.body, { button: 0 });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(where()).toBe("/bookings");
  });

  it("Sign Out calls onSignOut, then goes to /", async () => {
    const props = signedIn();
    renderAt("/favorites", props);
    openWithKey();
    fireEvent.click(within(menu()).getByRole("menuitem", { name: "Sign Out" }));
    await waitFor(() => expect(where()).toBe("/"));
    expect(props.onSignOut).toHaveBeenCalledTimes(1);
  });

  it("Sign Out still leaves the account area if signing out fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const props = signedIn({ onSignOut: vi.fn().mockRejectedValue(new Error("network")) });
    renderAt("/favorites", props);
    openWithKey();
    fireEvent.click(within(menu()).getByRole("menuitem", { name: "Sign Out" }));
    await waitFor(() => expect(where()).toBe("/"));
  });

  it("Sign Out is set apart (its own group, red) from ordinary navigation", () => {
    renderAt("/favorites", signedIn());
    openWithKey();
    const signOut = within(menu()).getByRole("menuitem", { name: "Sign Out" });
    expect(signOut.className).toContain("text-red-400");
    expect(signOut.previousElementSibling).toHaveAttribute("role", "separator");
  });

  it("role action: Admin toggle and Owner Dashboard call onAdminToggle; the active state is shown", () => {
    const onAdminToggle = vi.fn();
    renderAt("/bookings", signedIn({ onAdminToggle, isAdmin: true }));
    const admin = screen.getByRole("button", { name: "Admin" });
    expect(admin.className).toContain("bg-primary");
    fireEvent.click(admin);
    openWithKey();
    fireEvent.click(within(menu()).getByRole("menuitem", { name: /Owner Dashboard/ }));
    expect(onAdminToggle).toHaveBeenCalledTimes(2);
  });

  it("without onAdminToggle there is no Admin action or Owner Dashboard item", () => {
    renderAt("/favorites", signedIn());
    expect(screen.queryByRole("button", { name: "Admin" })).toBeNull();
    openWithKey();
    expect(within(menu()).queryByRole("menuitem", { name: /Owner Dashboard/ })).toBeNull();
  });

  it("no invented details: without a name the email leads; without email or name, no placeholder text", () => {
    renderAt("/bookings", signedIn({ profileName: undefined }));
    openWithKey();
    const m = menu();
    expect(within(m).getAllByText("asha@example.com")).toHaveLength(1);
    expect(within(m).queryByText(/No email available|^User$/)).toBeNull();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  });

  it("a phone-only account shows the phone, and its avatar falls back to an icon (no fake letter)", () => {
    renderAt("/bookings", { onSignOut: vi.fn(), userName: "+919876543210" });
    expect(trigger().textContent).toBe("");
    expect(trigger().querySelector("svg")).not.toBeNull();
    openWithKey();
    expect(within(menu()).getByText("+919876543210")).toBeInTheDocument();
    expect(within(menu()).queryByText(/No email available/)).toBeNull();
  });

  it("an avatar photo is used when given, and falls back to the initial if it fails to load", () => {
    renderAt("/bookings", signedIn({ avatarUrl: "https://images.invalid/asha.jpg" }));
    const img = trigger().querySelector("img")!;
    expect(img).toHaveAttribute("src", "https://images.invalid/asha.jpg");
    expect(img).toHaveAttribute("alt", "");
    fireEvent.error(img);
    expect(trigger().querySelector("img")).toBeNull();
    expect(trigger().textContent).toBe("A");
  });

  it("uses the signed-in account's own name and photo from its sign-in provider (e.g. Google)", () => {
    authMocks.user = {
      email: "asha@example.com",
      user_metadata: { full_name: "Asha Verma", avatar_url: "https://lh3.googleusercontent.invalid/a.jpg" },
    };
    renderAt("/bookings", signedIn({ profileName: undefined }));
    expect(trigger().querySelector("img")).toHaveAttribute("src", "https://lh3.googleusercontent.invalid/a.jpg");
    openWithKey();
    expect(within(menu()).getByText("Asha Verma")).toBeInTheDocument();
    expect(within(menu()).getByText("asha@example.com")).toBeInTheDocument();
  });

  it("never shows another account's name or photo", () => {
    authMocks.user = { email: "someone-else@example.com", user_metadata: { full_name: "Someone Else", picture: "https://x.invalid/p.jpg" } };
    renderAt("/bookings", signedIn({ profileName: undefined }));
    expect(trigger().querySelector("img")).toBeNull();
    openWithKey();
    expect(within(menu()).queryByText("Someone Else")).toBeNull();
  });

  it("non-https photo URLs are ignored", () => {
    renderAt("/bookings", signedIn({ avatarUrl: "javascript:alert(1)" }));
    expect(trigger().querySelector("img")).toBeNull();
  });

  it("motion is opt-in: hover tilt and menu animation only apply without reduced motion", () => {
    renderAt("/bookings", signedIn());
    const tilt = trigger().firstElementChild as HTMLElement;
    expect(tilt.className).toMatch(/motion-safe:group-hover\/acct:\[transform:/);
    expect(tilt.className).not.toMatch(/(^|\s)group-hover\/acct:\[transform:/);
    openWithKey();
    expect(menu().className).toMatch(/motion-safe:data-\[state=open\]:animate-\[accountMenuIn/);
    expect(menu().className).not.toMatch(/(^|\s)data-\[state=open\]:animate-/);
  });

  it("the menu stays inside small screens", () => {
    renderAt("/bookings", signedIn());
    openWithKey();
    expect(menu().className).toContain("w-[min(18rem,calc(100vw-1.5rem))]");
  });
});

describe("Header — owner pages (name without sign-out)", () => {
  it("shows only the logo, as before", () => {
    renderAt("/register-salon", { userName: "Owner" });
    expect(screen.getByText("Snippr")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
