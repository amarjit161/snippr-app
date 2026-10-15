import { StrictMode, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// ---------------------------------------------------------------------------
// Supabase mocked: listeners are recorded so tests can emit auth events the way
// the real client does during start-up (PASSWORD_RECOVERY via setTimeout(0)).
// ---------------------------------------------------------------------------
type Listener = { callback: (event: string, session: unknown) => void; unsubscribed: boolean };
const mocks = vi.hoisted(() => ({
  listeners: [] as Listener[],
  getSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: Listener["callback"]) => {
        const listener: Listener = { callback, unsubscribed: false };
        mocks.listeners.push(listener);
        return { data: { subscription: { unsubscribe: () => (listener.unsubscribed = true) } } };
      },
      getSession: mocks.getSession,
      setSession: vi.fn(),
      verifyOtp: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  },
}));

// The homepage's visual sections are irrelevant here.
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

const USER = { id: "user-1" };
const SESSION = { user: USER };

const emit = (event: string, session: unknown = SESSION) =>
  act(() => {
    for (const l of mocks.listeners) if (!l.unsubscribed) l.callback(event, session);
  });

/** Every distinct location the router visited (by history key), for loop/duplicate checks. */
let visits: string[] = [];
function LocationLog() {
  const { key, pathname, search, hash } = useLocation();
  useEffect(() => {
    const entry = `${key}|${pathname}${search}${hash}`;
    if (!visits.includes(entry)) visits.push(entry);
  }, [key, pathname, search, hash]);
  return null;
}
const pathsVisited = () => visits.map((v) => v.split("|")[1]);

function Probe() {
  const { pathname, search, hash } = useLocation();
  return <div data-testid="location">{`${pathname}${search}${hash}`}</div>;
}

const renderTree = (home: React.ReactNode, initial = "/", { strict = false } = {}) => {
  const tree = (
    <MemoryRouter initialEntries={[initial]}>
      <LocationLog />
      <Routes>
        <Route path="/" element={home} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

const landedOn = (expected: string) =>
  waitFor(() => expect(screen.getByTestId("location").textContent).toBe(expected));

/** Long enough for the deferred start-up check and any navigation to settle. */
const settle = () => act(() => new Promise((r) => setTimeout(r, 40)));

/** Fresh module state per test (recovery marker, pending redirect). */
const loadMarketingHome = async () => {
  vi.resetModules();
  const recovery = await import("@/lib/passwordRecovery");
  const { default: Index } = await import("@/pages/Index");
  return { Index, recovery };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listeners.length = 0;
  visits = [];
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  window.history.replaceState(null, "", "/"); // Index reads the real window location
});

afterEach(() => {
  vi.unstubAllEnvs();
  window.history.replaceState(null, "", "/");
});

// ---------------------------------------------------------------------------
describe("marketing homepage (Index)", () => {
  it("1. recovery session established before the homepage renders → /reset-password", async () => {
    const { Index } = await loadMarketingHome();
    emit("PASSWORD_RECOVERY"); // Supabase consumed the link's hash during start-up
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    renderTree(<Index />);
    await landedOn("/reset-password");
  });

  it("recovery event queued just after the homepage mounted → /reset-password", async () => {
    const { Index } = await loadMarketingHome();
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    renderTree(<Index />);
    setTimeout(() => emit("PASSWORD_RECOVERY"), 0); // same timer the real client uses
    await landedOn("/reset-password");
  });

  it("recovery event arriving later while the homepage is open → /reset-password", async () => {
    const { Index } = await loadMarketingHome();
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    renderTree(<Index />);
    await settle();
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
    emit("PASSWORD_RECOVERY");
    await landedOn("/reset-password");
  });

  it("2. an ordinary signed-in session does not trigger recovery routing", async () => {
    const { Index } = await loadMarketingHome();
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    renderTree(<Index />);
    emit("SIGNED_IN");
    emit("TOKEN_REFRESHED");
    await settle();
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
    expect(pathsVisited()).toEqual(["/"]);
  });

  it("3. a signed-out visitor stays on the homepage", async () => {
    const { Index } = await loadMarketingHome();
    renderTree(<Index />);
    await settle();
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
    expect(mocks.getSession).not.toHaveBeenCalled(); // nothing pending → no session lookup at all
  });

  it("a recovery event for a different user than the current session does not count", async () => {
    const { Index } = await loadMarketingHome();
    emit("PASSWORD_RECOVERY", { user: { id: "someone-else" } });
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    renderTree(<Index />);
    await settle();
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });

  it("6a. redirects once: a later homepage visit in the same recovery session stays put", async () => {
    const { Index } = await loadMarketingHome();
    emit("PASSWORD_RECOVERY");
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    const first = renderTree(<Index />);
    await landedOn("/reset-password");
    first.unmount();
    visits = [];
    renderTree(<Index />);
    await settle();
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
    expect(pathsVisited()).toEqual(["/"]);
  });

  it("6b. opening /reset-password acknowledges the recovery, so the homepage won't bounce back", async () => {
    const { Index, recovery } = await loadMarketingHome();
    emit("PASSWORD_RECOVERY");
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    recovery.acknowledgeRecoveryRedirect(); // what ResetPassword does when it opens
    renderTree(<Index />);
    await settle();
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });

  it("6c. React Strict Mode: exactly one navigation to /reset-password, no loop", async () => {
    const { Index } = await loadMarketingHome();
    emit("PASSWORD_RECOVERY");
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    renderTree(<Index />, "/", { strict: true });
    await landedOn("/reset-password");
    await settle();
    expect(pathsVisited()).toEqual(["/", "/reset-password"]);
  });

  it("listeners are cleaned up when the homepage unmounts", async () => {
    const { Index } = await loadMarketingHome();
    const view = renderTree(<Index />);
    await settle();
    view.unmount();
    // A late event must not navigate (and must not throw) after unmount.
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    emit("PASSWORD_RECOVERY");
    await settle();
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });

  describe("5. URL-based handling unchanged", () => {
    it.each([
      ["/?type=recovery&token_hash=abc", "/reset-password?type=recovery&token_hash=abc"],
      ["/#access_token=x&refresh_token=y&type=recovery", "/reset-password#access_token=x&refresh_token=y&type=recovery"],
      ["/#error=access_denied&error_code=otp_expired", "/reset-password?expired=1"],
    ])("%s → %s", async (url, expected) => {
      window.history.replaceState(null, "", url);
      const { Index } = await loadMarketingHome();
      renderTree(<Index />);
      await landedOn(expected);
    });

    it("an expired link wins over a pending recovery session", async () => {
      window.history.replaceState(null, "", "/#error=access_denied&error_code=otp_expired");
      const { Index } = await loadMarketingHome();
      emit("PASSWORD_RECOVERY");
      mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
      renderTree(<Index />);
      await landedOn("/reset-password?expired=1");
      await settle();
      expect(pathsVisited()).toEqual(["/", "/reset-password?expired=1"]);
    });
  });
});

// ---------------------------------------------------------------------------
describe("4. app-domain / (HomeRoute)", () => {
  const loadAppRoot = async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ORIGIN", window.location.origin); // this test page *is* the app host
    vi.stubEnv("VITE_MARKETING_ORIGIN", "https://www.snippr.in");
    const recovery = await import("@/lib/passwordRecovery");
    const { HomeRoute } = await import("@/components/HostRouting");
    return { HomeRoute, recovery };
  };

  it("recovery session → /reset-password (not /salons)", async () => {
    const { HomeRoute } = await loadAppRoot();
    emit("PASSWORD_RECOVERY");
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    renderTree(<HomeRoute marketing={<div>marketing</div>} />);
    await landedOn("/reset-password");
    expect(pathsVisited()).toEqual(["/", "/reset-password"]);
  });

  it("recovery event queued just after mount → /reset-password", async () => {
    const { HomeRoute } = await loadAppRoot();
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    setTimeout(() => emit("PASSWORD_RECOVERY"), 0); // queued before the page's deferred check
    renderTree(<HomeRoute marketing={<div>marketing</div>} />);
    await landedOn("/reset-password");
  });

  it("ordinary session → /salons", async () => {
    const { HomeRoute } = await loadAppRoot();
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    renderTree(<HomeRoute marketing={<div>marketing</div>} />);
    await landedOn("/salons");
  });

  it("signed out → /salons", async () => {
    const { HomeRoute } = await loadAppRoot();
    renderTree(<HomeRoute marketing={<div>marketing</div>} />);
    await landedOn("/salons");
  });

  it("after the reset page was reached, / goes to /salons again", async () => {
    const { HomeRoute, recovery } = await loadAppRoot();
    emit("PASSWORD_RECOVERY");
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    recovery.acknowledgeRecoveryRedirect();
    renderTree(<HomeRoute marketing={<div>marketing</div>} />);
    await landedOn("/salons");
  });

  it("React Strict Mode: a single navigation", async () => {
    const { HomeRoute } = await loadAppRoot();
    emit("PASSWORD_RECOVERY");
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    renderTree(<HomeRoute marketing={<div>marketing</div>} />, "/", { strict: true });
    await landedOn("/reset-password");
    await settle();
    expect(pathsVisited()).toEqual(["/", "/reset-password"]);
  });

  it.each([
    ["/?type=recovery&token_hash=abc", "/reset-password?type=recovery&token_hash=abc"],
    ["/#error=access_denied&error_code=otp_expired", "/reset-password?expired=1"],
  ])("URL link %s still → %s", async (url, expected) => {
    const { HomeRoute } = await loadAppRoot();
    renderTree(<HomeRoute marketing={<div>marketing</div>} />, url);
    await landedOn(expected);
  });

  it("on a non-app host, HomeRoute still renders the marketing homepage", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_APP_ORIGIN", "");
    const { HomeRoute } = await import("@/components/HostRouting");
    renderTree(<HomeRoute marketing={<div>marketing page</div>} />);
    expect(screen.getByText("marketing page")).toBeInTheDocument();
    await settle();
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe("ResetPassword acknowledges the recovery when it opens", () => {
  it("after /reset-password opens, the homepage no longer redirects", async () => {
    vi.resetModules();
    const recovery = await import("@/lib/passwordRecovery");
    const { default: ResetPassword } = await import("@/pages/ResetPassword");
    const { default: Index } = await import("@/pages/Index");
    emit("PASSWORD_RECOVERY");
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    window.history.replaceState(null, "", "/reset-password");
    const view = render(
      <MemoryRouter initialEntries={["/reset-password"]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("Set new password");
    await expect(recovery.hasPendingRecoveryRedirect()).resolves.toBe(false);
    view.unmount();
    window.history.replaceState(null, "", "/");
    renderTree(<Index />);
    await settle();
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
  });
});
