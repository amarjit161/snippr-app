import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, useLocation, createRoutesFromChildren } from "react-router-dom";
import { collectRoutePatterns, editDistance, recoverPathname } from "@/lib/routeRecovery";

// Logged-out auth state so guard behaviour can be asserted on recovered routes.
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, session: null, profile: null, loading: false, profileLoading: false }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/hooks/useTawkTo", () => ({ useTawkTo: () => {} }));

const { appRouteTree } = await import("@/App");
const patterns = collectRoutePatterns(createRoutesFromChildren(appRouteTree));

describe("collectRoutePatterns (real App routes)", () => {
  it("includes static and dynamic registered routes, excludes the splat", () => {
    for (const p of ["/", "/salons", "/salon/:id", "/q/:quickBookingCode", "/bookings", "/booking", "/booking/:id", "/booking/service", "/dashboard", "/my-profile"]) {
      expect(patterns).toContain(p);
    }
    expect(patterns).not.toContain("*");
  });
});

describe("editDistance", () => {
  it("counts adjacent transpositions as one edit", () => {
    expect(editDistance("tema", "team")).toBe(1);
    expect(editDistance("slloons", "salons")).toBe(2);
  });
});

describe("recoverPathname", () => {
  it.each([
    ["/slloons", "/salons"],
    ["/bokings", "/bookings"],
    ["/BOKINGS", "/bookings"],
    ["/salon", "/salons"],
    ["/dashbord", "/dashboard"],
    ["/my-profle", "/my-profile"],
    ["/servies", "/services"],
    ["//salons", "/salons"],
  ])("recovers %s → %s", (input, expected) => {
    expect(recoverPathname(input, patterns)).toBe(expected);
  });

  it.each([
    "/random-page",
    "/abcdef123456",
    "/adminxyz",
    "/profle", // no /profile route is registered (profile lives at /my-profile)
    "/x/33KUUis9", // single-char static segments must match exactly
    "/salons/extra", // must not be read as salon ID "extra"
    "/salom/AbC123", // dynamic routes are never fuzzy-recovered
  ])("does not guess for %s", (input) => {
    expect(recoverPathname(input, patterns)).toBeNull();
  });

  it("refuses ambiguous matches", () => {
    expect(recoverPathname("/cat", ["/car", "/bat"])).toBeNull();
    expect(recoverPathname("/bookng", ["/bookings", "/booking"])).toBe("/booking");
    expect(recoverPathname("/abcde", ["/abcdx", "/abcdy"])).toBeNull();
  });
});

const LocationProbe = () => {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname + l.search + l.hash}</div>;
};

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>{appRouteTree}</Routes>
      <LocationProbe />
    </MemoryRouter>,
  );

describe("routing integration", () => {
  it("replaces a typo URL keeping query string and hash", async () => {
    renderAt("/bokings?status=completed#top");
    // /bookings is customer-protected; logged-out users are still bounced by ProtectedRoute.
    await waitFor(() => expect(screen.getByTestId("loc").textContent).not.toContain("bokings"));
    expect(screen.queryByText("Oops! Page not found")).toBeNull();
  });

  it("owner route typo still goes through OwnerProtectedRoute", async () => {
    renderAt("/dashbord");
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/owner-login"));
  });

  it("shows the existing 404 for unknown URLs", async () => {
    renderAt("/random-page");
    expect(await screen.findByText("Oops! Page not found")).toBeInTheDocument();
    expect(screen.getByTestId("loc").textContent).toBe("/random-page");
  });

  it("does not treat valid dynamic URLs as unknown", () => {
    renderAt("/q/33KUUis9");
    expect(screen.queryByText("Oops! Page not found")).toBeNull();
    expect(screen.getByTestId("loc").textContent).toBe("/q/33KUUis9");
  });
});
