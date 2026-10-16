import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// ---------------------------------------------------------------------------
// Marketing (www) → app (app.snippr.in) sign-in hand-off.
//
// The domain split is configured per test through env stubs; with
// VITE_MARKETING_ORIGIN set to this jsdom page's origin, the page *is* the
// marketing host, so getHostRole()/appHref() run their real logic.
// ---------------------------------------------------------------------------
const APP = "https://app.snippr.in";

const mocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  profile: null as Record<string, unknown> | null,
  user: null as { id: string } | null,
  hrefs: [] as string[],
  openUrl: vi.fn(),
}));

vi.mock("@/lib/hardNavigate", () => ({ hardNavigate: vi.fn(), openUrl: mocks.openUrl }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithOAuth: mocks.signInWithOAuth,
      signInWithPassword: mocks.signInWithPassword,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: async () => ({ data: { session: null } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.profile, error: null }) }) }),
    }),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user, profile: null, session: null, loading: false, profileLoading: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The real hook turns the path into appHref(path) and, when that is absolute,
// calls window.location.assign (which jsdom can't perform). Keep the real
// path → URL mapping and record the URL instead of navigating.
// Registered in withEnv() so each test's fresh domains module (and env) is used.
const mockAppNavigate = () =>
  vi.doMock("@/components/landing/useAppNavigate", async () => {
    const { appHref } = await import("@/lib/domains");
    return {
      useAppNavigate: () => (path: string) => {
        mocks.hrefs.push(appHref(path));
      },
    };
  });

// Homepage sections not under test.
for (const [path, name] of [
  ["@/components/landing/Hero", "Hero"],
  ["@/components/landing/ExploreSalons", "ExploreSalons"],
  ["@/components/landing/Problem", "Problem"],
  ["@/components/landing/Solution", "Solution"],
  ["@/components/landing/JourneySection", "JourneySection"],
  ["@/components/landing/MarketingDashboard", "MarketingDashboard"],
  ["@/components/landing/AppScreens", "AppScreens"],
  ["@/components/landing/Trust", "Trust"],
  ["@/components/landing/CTA", "CTA"],
  ["@/components/landing/Footer", "Footer"],
] as const) {
  vi.doMock(path, () => ({ [name]: () => null }));
}

const SPLIT_ON_HERE_MARKETING = { VITE_APP_ORIGIN: APP, VITE_MARKETING_ORIGIN: window.location.origin };
const SPLIT_ON_HERE_APP = { VITE_APP_ORIGIN: window.location.origin, VITE_MARKETING_ORIGIN: "https://www.snippr.in" };
const SPLIT_OFF = { VITE_APP_ORIGIN: undefined, VITE_MARKETING_ORIGIN: undefined };

const withEnv = (env: Record<string, string | undefined>) => {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value ?? "");
  mockAppNavigate();
};

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{`${pathname}${search}`}</div>;
}

const saved = () => localStorage.getItem("redirectAfterLogin");

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.hrefs.length = 0;
  mocks.profile = null;
  mocks.user = null;
  mocks.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllEnvs();
  window.history.replaceState(null, "", "/");
});

// ---------------------------------------------------------------------------
describe("returnPath helpers", () => {
  it("withReturnPath adds a validated, encoded ?next=", async () => {
    const { withReturnPath } = await import("@/lib/returnPath");
    expect(withReturnPath("/login", "/my-profile")).toBe("/login?next=%2Fmy-profile");
    expect(withReturnPath("/login", "/salon/abc?tab=queue")).toBe("/login?next=%2Fsalon%2Fabc%3Ftab%3Dqueue");
    expect(withReturnPath("/login", null)).toBe("/login");
  });

  it.each(["https://evil.example/x", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/login", "/auth/callback", "salons"])(
    "withReturnPath drops the unsafe destination %s",
    async (value) => {
      const { withReturnPath } = await import("@/lib/returnPath");
      expect(withReturnPath("/login", value)).toBe("/login");
    },
  );

  it("rememberReturnPathFromQuery saves only a safe ?next=", async () => {
    const { rememberReturnPathFromQuery } = await import("@/lib/returnPath");
    expect(rememberReturnPathFromQuery("?next=%2Fbookings")).toBe("/bookings");
    expect(saved()).toBe("/bookings");

    localStorage.clear();
    for (const bad of ["?next=https%3A%2F%2Fevil.example", "?next=%2F%2Fevil.example", "?next=%2Flogin", "?next=javascript%3Ax", ""]) {
      expect(rememberReturnPathFromQuery(bad)).toBeNull();
    }
    expect(saved()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("authRedirectOrigin (Google OAuth return origin)", () => {
  it("split off: the current origin (local dev, previews, today's production)", async () => {
    withEnv(SPLIT_OFF);
    const { authRedirectOrigin } = await import("@/lib/domains");
    expect(authRedirectOrigin()).toBe(window.location.origin);
  });

  it("split on, on the marketing host: the app origin", async () => {
    withEnv(SPLIT_ON_HERE_MARKETING);
    const { authRedirectOrigin } = await import("@/lib/domains");
    expect(authRedirectOrigin()).toBe(APP);
  });

  it("split on, on the app host: the app origin", async () => {
    withEnv(SPLIT_ON_HERE_APP);
    const { authRedirectOrigin } = await import("@/lib/domains");
    expect(authRedirectOrigin()).toBe(window.location.origin);
  });
});

// ---------------------------------------------------------------------------
describe("marketing host: routing to the app", () => {
  it("www /login and /register (with ?next=) are forwarded to the app with the query intact", async () => {
    withEnv({ VITE_APP_ORIGIN: APP, VITE_MARKETING_ORIGIN: "https://www.snippr.in" });
    const { getAppHostRedirect } = await import("@/lib/domains");
    const at = (url: string) => {
      const u = new URL(url);
      return { origin: u.origin, host: u.host, pathname: u.pathname, search: u.search, hash: u.hash };
    };
    expect(getAppHostRedirect(at("https://www.snippr.in/login"))).toBe(`${APP}/login`);
    expect(getAppHostRedirect(at("https://www.snippr.in/login?next=%2Fbookings"))).toBe(`${APP}/login?next=%2Fbookings`);
    expect(getAppHostRedirect(at("https://www.snippr.in/register"))).toBe(`${APP}/register`);
    expect(getAppHostRedirect(at("https://www.snippr.in/register?next=%2Fmy-profile"))).toBe(`${APP}/register?next=%2Fmy-profile`);
    expect(getAppHostRedirect(at("https://www.snippr.in/auth/callback?next=%2Fsalons"))).toBe(`${APP}/auth/callback?next=%2Fsalons`);
  });

  it.each(["/", "/how-it-works", "/careers", "/support", "/privacy", "/?utm_source=x"])(
    "marketing page %s stays public on www",
    async (path) => {
      withEnv({ VITE_APP_ORIGIN: APP, VITE_MARKETING_ORIGIN: "https://www.snippr.in" });
      const { getAppHostRedirect } = await import("@/lib/domains");
      const u = new URL(`https://www.snippr.in${path}`);
      expect(getAppHostRedirect({ origin: u.origin, host: u.host, pathname: u.pathname, search: u.search, hash: u.hash })).toBeNull();
    },
  );

  const renderNavbar = async () => {
    const { LandingNavbar } = await import("@/components/landing/LandingNavbar");
    render(
      <MemoryRouter>
        <LandingNavbar onBookings={() => {}} />
      </MemoryRouter>,
    );
  };

  it("navbar Sign In goes to app.snippr.in/login", async () => {
    withEnv(SPLIT_ON_HERE_MARKETING);
    await renderNavbar();
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(mocks.hrefs).toEqual([`${APP}/login`]);
  });

  it("navbar Get Started goes to app.snippr.in/register", async () => {
    withEnv(SPLIT_ON_HERE_MARKETING);
    await renderNavbar();
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
    expect(mocks.hrefs).toEqual([`${APP}/register`]);
  });

  it("mobile menu Sign In goes to app.snippr.in/login", async () => {
    withEnv(SPLIT_ON_HERE_MARKETING);
    await renderNavbar();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const signIns = screen.getAllByRole("button", { name: "Sign In" });
    fireEvent.click(signIns[signIns.length - 1]);
    expect(mocks.hrefs).toEqual([`${APP}/login`]);
  });

  it("split off: the same buttons stay relative (unchanged behaviour)", async () => {
    withEnv(SPLIT_OFF);
    await renderNavbar();
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
    expect(mocks.hrefs).toEqual(["/login", "/register"]);
  });

  const renderHome = async () => {
    const { default: Index } = await import("@/pages/Index");
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it("the homepage renders on www without sending the visitor to the app", async () => {
    withEnv(SPLIT_ON_HERE_MARKETING);
    await renderHome();
    expect(screen.getByRole("button", { name: /profile/i })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
    expect(mocks.hrefs).toEqual([]);
  });

  // www can't see the app session, so Profile always goes to the app's
  // /my-profile; the app's login gate handles signed-out visitors.
  it.each([
    ["signed out", null],
    ["with a (stale) www session", { id: "u1" }],
  ])("homepage Profile on www (%s) → app.snippr.in/my-profile", async (_label, user) => {
    mocks.user = user;
    withEnv(SPLIT_ON_HERE_MARKETING);
    await renderHome();
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));
    expect(mocks.hrefs).toEqual([`${APP}/my-profile`]);
  });

  it("homepage Profile with the split off → /my-profile on this origin", async () => {
    withEnv(SPLIT_OFF);
    await renderHome();
    fireEvent.click(screen.getByRole("button", { name: /profile/i }));
    expect(mocks.hrefs).toEqual(["/my-profile"]);
  });
});

// ---------------------------------------------------------------------------
describe("app host: sign-in pages honour ?next=", () => {
  const renderLogin = async (entry: string) => {
    withEnv(SPLIT_ON_HERE_APP);
    const { default: CustomerLogin } = await import("@/pages/CustomerLogin");
    const { default: CustomerRegister } = await import("@/pages/CustomerRegister");
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<CustomerLogin />} />
          <Route path="/register" element={<CustomerRegister />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  const googleRedirectTo = async () => {
    fireEvent.click(screen.getByRole("button", { name: /google/i }));
    await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalledTimes(1));
    return mocks.signInWithOAuth.mock.calls[0][0].options.redirectTo as string;
  };

  it("Google OAuth returns to the app origin's /auth/callback with the requested next", async () => {
    await renderLogin("/login?next=%2Fbookings");
    expect(await googleRedirectTo()).toBe(`${window.location.origin}/auth/callback?next=%2Fbookings`);
    expect(saved()).toBe("/bookings"); // also kept for OTP / profile completion
  });

  it("no ?next= → default /salons", async () => {
    await renderLogin("/login");
    expect(await googleRedirectTo()).toBe(`${window.location.origin}/auth/callback?next=%2Fsalons`);
    expect(saved()).toBeNull();
  });

  it.each(["https%3A%2F%2Fevil.example%2Fx", "%2F%2Fevil.example", "%2Flogin"])(
    "an unsafe ?next=%s is ignored (default destination, nothing saved)",
    async (next) => {
      await renderLogin(`/login?next=${next}`);
      expect(await googleRedirectTo()).toBe(`${window.location.origin}/auth/callback?next=%2Fsalons`);
      expect(saved()).toBeNull();
    },
  );

  it("a ?next= takes priority over an older saved destination", async () => {
    localStorage.setItem("redirectAfterLogin", "/salon/old");
    await renderLogin("/login?next=%2Fmy-profile");
    expect(await googleRedirectTo()).toContain("next=%2Fmy-profile");
  });

  const emailSignIn = () => {
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: "person@example.invalid" } });
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: "not-a-real-password" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
  };

  it("email sign-in, complete profile → the requested page", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mocks.profile = { first_name: "Test", phone: null };
    await renderLogin("/login?next=%2Fbookings");
    emailSignIn();
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/bookings"));
    expect(saved()).toBeNull(); // consumed
  });

  it("email sign-in, incomplete profile → /complete-profile carrying next", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mocks.profile = null;
    await renderLogin("/login?next=%2Fbookings");
    emailSignIn();
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/complete-profile?next=%2Fbookings"));
  });

  it("Create account keeps the destination; register's Sign In link brings it back", async () => {
    await renderLogin("/login?next=%2Fmy-profile");
    fireEvent.click(screen.getByRole("link", { name: "Create account" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/login?next=%2Fmy-profile"));
  });

  it("register page with an unsafe ?next= links to plain /login", async () => {
    await renderLogin("/register?next=https%3A%2F%2Fevil.example");
    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute("href", "/login");
    expect(saved()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("login page Back to website", () => {
  const renderLoginAt = async (env: Record<string, string | undefined>) => {
    withEnv(env);
    const { default: CustomerLogin } = await import("@/pages/CustomerLogin");
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<CustomerLogin />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /back to website/i }));
  };

  it("split on (app host) → full page load of https://www.snippr.in/", async () => {
    await renderLoginAt(SPLIT_ON_HERE_APP);
    expect(mocks.openUrl).toHaveBeenCalledTimes(1);
    expect(mocks.openUrl).toHaveBeenCalledWith("https://www.snippr.in/");
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });

  it("split off (local dev, previews) → in-app navigation to /", async () => {
    await renderLoginAt(SPLIT_OFF);
    expect(screen.getByTestId("location").textContent).toBe("/");
    expect(mocks.openUrl).not.toHaveBeenCalled();
  });

  it("split on but on another host (e.g. a preview) → in-app navigation to /", async () => {
    await renderLoginAt({ VITE_APP_ORIGIN: APP, VITE_MARKETING_ORIGIN: "https://www.snippr.in" });
    expect(screen.getByTestId("location").textContent).toBe("/");
    expect(mocks.openUrl).not.toHaveBeenCalled();
  });
});
