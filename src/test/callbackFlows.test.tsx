import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AuthCallback from "@/pages/AuthCallback";
import Index from "@/pages/Index";

// ---------------------------------------------------------------------------
// Supabase mocked per table. `queries` records every table read so tests can
// assert e.g. that recovery never touches sign-in routing at all.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  queries: [] as string[],
  tables: {} as Record<string, unknown>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: mocks.getSession },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            mocks.queries.push(table);
            const value = mocks.tables[table];
            if (value instanceof Error) throw value;
            return { data: value ?? null, error: null };
          },
        }),
      }),
    }),
  },
}));

// Index renders the full landing page; only its recovery-link effect matters here.
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, profile: null, loading: false }) }));
vi.mock("@/components/landing/LandingNavbar", () => ({ LandingNavbar: () => null }));
vi.mock("@/components/landing/Hero", () => ({ Hero: () => null }));
vi.mock("@/components/landing/ExploreSalons", () => ({ ExploreSalons: () => null }));
vi.mock("@/components/landing/Problem", () => ({ Problem: () => null }));
vi.mock("@/components/landing/Solution", () => ({ Solution: () => null }));
vi.mock("@/components/landing/JourneySection", () => ({ JourneySection: () => null }));
vi.mock("@/components/landing/MarketingDashboard", () => ({ MarketingDashboard: () => null }));
vi.mock("@/components/landing/AppScreens", () => ({ AppScreens: () => null }));
vi.mock("@/components/landing/Trust", () => ({ Trust: () => null }));
vi.mock("@/components/landing/CTA", () => ({ CTA: () => null }));
vi.mock("@/components/landing/Footer", () => ({ Footer: () => null }));

type UserShape = { id: string; email: string; user_metadata: Record<string, unknown> };
const customer: UserShape = { id: "cust-1", email: "c@example.invalid", user_metadata: {} };
const ownerWithRole: UserShape = { id: "owner-1", email: "o@example.invalid", user_metadata: { role: "owner" } };
const ownerWithoutRole: UserShape = { id: "owner-2", email: "o2@example.invalid", user_metadata: {} };
const EMPTY_CUSTOMER_PROFILE = { first_name: "", profile_complete_pct: 20 };
const COMPLETE_CUSTOMER_PROFILE = { first_name: "Amarjit", profile_complete_pct: 100 };

function LocationProbe() {
  const { pathname, search, hash } = useLocation();
  return <div data-testid="location">{`${pathname}${search}${hash}`}</div>;
}

const renderCallback = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

const landedOn = (expected: string) =>
  waitFor(() => expect(screen.getByTestId("location").textContent).toBe(expected));

const signedInAs = (user: UserShape) => mocks.getSession.mockResolvedValue({ data: { session: { user } } });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.queries.length = 0;
  mocks.tables = {};
});

// ---------------------------------------------------------------------------
describe("AuthCallback — flow=recovery", () => {
  it("goes to /reset-password keeping the query and hash tokens", async () => {
    signedInAs(customer);
    renderCallback("/auth/callback?flow=recovery&email=a%40b.c#access_token=x&refresh_token=y&type=recovery");
    await landedOn("/reset-password?email=a%40b.c#access_token=x&refresh_token=y&type=recovery");
  });

  it("never runs sign-in routing (no session check, no profile/owner lookups)", async () => {
    signedInAs(ownerWithRole);
    renderCallback("/auth/callback?flow=recovery");
    await landedOn("/reset-password");
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.queries).toEqual([]);
  });

  it("works for owners and customers alike, even with an empty customer profile", async () => {
    signedInAs(ownerWithoutRole);
    mocks.tables.customer_profiles = EMPTY_CUSTOMER_PROFILE;
    renderCallback("/auth/callback?flow=recovery#access_token=x&refresh_token=y&type=recovery");
    await landedOn("/reset-password#access_token=x&refresh_token=y&type=recovery");
  });
});

// ---------------------------------------------------------------------------
describe("AuthCallback — owner flow=signup", () => {
  it("owner (role metadata) goes to /onboarding even with an empty customer profile", async () => {
    signedInAs(ownerWithRole);
    mocks.tables.customer_profiles = EMPTY_CUSTOMER_PROFILE;
    renderCallback("/auth/callback?next=/onboarding&flow=signup");
    await landedOn("/onboarding");
    expect(mocks.queries).not.toContain("customer_profiles");
  });

  it("owner identified by an owners row (no role metadata) goes to /onboarding", async () => {
    signedInAs(ownerWithoutRole);
    mocks.tables.owners = { id: ownerWithoutRole.id };
    mocks.tables.customer_profiles = EMPTY_CUSTOMER_PROFILE;
    renderCallback("/auth/callback?next=/onboarding&flow=signup");
    await landedOn("/onboarding");
    expect(mocks.queries).toEqual(["owners"]);
  });

  it.each([
    ["/owner-dashboard", "/owner-dashboard"],
    ["/register-salon?step=2", "/register-salon?step=2"],
    ["/Onboarding", "/Onboarding"],
  ])("allowed owner next %p is followed", async (next, expected) => {
    signedInAs(ownerWithRole);
    renderCallback(`/auth/callback?flow=signup&next=${encodeURIComponent(next)}`);
    await landedOn(expected);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com/onboarding",
    "javascript:alert(1)",
    "/auth/callback?next=/onboarding",
    "/login",
    "/salons",
    "/bookings",
    "/admin",
    "/onboarding-fake",
  ])("unsafe or non-owner next %p falls back to /onboarding", async (next) => {
    signedInAs(ownerWithRole);
    renderCallback(`/auth/callback?flow=signup&next=${encodeURIComponent(next)}`);
    await landedOn("/onboarding");
  });

  it("missing next defaults to /onboarding", async () => {
    signedInAs(ownerWithRole);
    renderCallback("/auth/callback?flow=signup");
    await landedOn("/onboarding");
  });

  it("flow=signup for a non-owner keeps the normal customer flow", async () => {
    signedInAs(customer);
    mocks.tables.owners = null;
    mocks.tables.customer_profiles = EMPTY_CUSTOMER_PROFILE;
    renderCallback("/auth/callback?flow=signup&next=/onboarding");
    // /onboarding is a safe local path, so the customer flow carries it on unchanged.
    await landedOn("/complete-profile?next=%2Fonboarding");
  });

  it("an owners lookup that throws falls back to the customer flow", async () => {
    signedInAs(ownerWithoutRole);
    mocks.tables.owners = new Error("network down");
    mocks.tables.customer_profiles = COMPLETE_CUSTOMER_PROFILE;
    renderCallback("/auth/callback?flow=signup");
    await landedOn("/salons");
  });
});

// ---------------------------------------------------------------------------
describe("AuthCallback — customer behaviour unchanged", () => {
  it("complete profile + safe next → next, without any owners lookup", async () => {
    signedInAs(customer);
    mocks.tables.customer_profiles = COMPLETE_CUSTOMER_PROFILE;
    renderCallback("/auth/callback?next=%2Fbookings");
    await landedOn("/bookings");
    expect(mocks.queries).toEqual(["customer_profiles"]);
  });

  it("even an owner without flow=signup gets the customer routing", async () => {
    signedInAs(ownerWithRole);
    mocks.tables.customer_profiles = COMPLETE_CUSTOMER_PROFILE;
    renderCallback("/auth/callback?next=%2Fbookings");
    await landedOn("/bookings");
    expect(mocks.queries).toEqual(["customer_profiles"]);
  });

  it("incomplete profile → /complete-profile with the safe destination", async () => {
    signedInAs(customer);
    mocks.tables.customer_profiles = EMPTY_CUSTOMER_PROFILE;
    renderCallback("/auth/callback?next=%2Fbookings");
    await landedOn("/complete-profile?next=%2Fbookings");
  });

  it("unsafe next → /salons", async () => {
    signedInAs(customer);
    mocks.tables.customer_profiles = COMPLETE_CUSTOMER_PROFILE;
    renderCallback(`/auth/callback?next=${encodeURIComponent("//evil.com")}`);
    await landedOn("/salons");
  });

  it("no session → /login", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    renderCallback("/auth/callback?flow=signup&next=/onboarding");
    await landedOn("/login");
  });
});

// ---------------------------------------------------------------------------
describe("homepage recovery links (Index)", () => {
  const renderHomepage = (url: string) => {
    window.history.replaceState(null, "", url); // Index reads the real window location
    return render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  afterEach(() => window.history.replaceState(null, "", "/"));

  it("query recovery link → /reset-password with the query", async () => {
    renderHomepage("/?type=recovery&token_hash=abc");
    await landedOn("/reset-password?type=recovery&token_hash=abc");
  });

  it("hash recovery link → /reset-password with the tokens", async () => {
    renderHomepage("/#access_token=x&refresh_token=y&type=recovery");
    await landedOn("/reset-password#access_token=x&refresh_token=y&type=recovery");
  });

  it("expired link → /reset-password?expired=1", async () => {
    renderHomepage("/#error=access_denied&error_code=otp_expired");
    await landedOn("/reset-password?expired=1");
  });

  it("an ordinary homepage visit stays on the homepage", async () => {
    renderHomepage("/?utm_source=flyer");
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe("app-host / (HomeRoute) recovery links", () => {
  const loadHomeRoute = async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ORIGIN", window.location.origin); // this test page *is* the app host
    vi.stubEnv("VITE_MARKETING_ORIGIN", "https://www.snippr.in");
    return (await import("@/components/HostRouting")).HomeRoute;
  };

  afterEach(() => vi.unstubAllEnvs());

  const renderAppRoot = (HomeRoute: Awaited<ReturnType<typeof loadHomeRoute>>, entry: string) =>
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/" element={<HomeRoute marketing={<div>marketing</div>} />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

  it("recovery link on the app root → /reset-password", async () => {
    const HomeRoute = await loadHomeRoute();
    renderAppRoot(HomeRoute, "/?type=recovery&token_hash=abc");
    await landedOn("/reset-password?type=recovery&token_hash=abc");
  });

  it("plain app root → /salons", async () => {
    const HomeRoute = await loadHomeRoute();
    renderAppRoot(HomeRoute, "/");
    await landedOn("/salons");
  });
});
