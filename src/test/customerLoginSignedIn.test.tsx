import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import CustomerLogin from "@/pages/CustomerLogin";

// ---------------------------------------------------------------------------
// /login and /auth for a visitor who is ALREADY signed in (e.g. via the
// marketing site's Sign In). The page checks once, after auth has settled,
// and continues to where a fresh sign-in would go — confirming the session
// with Supabase's stored session first, so a just-signed-out user (whose
// AuthContext still holds the old session for its debounce) is not bounced.
// Supabase and AuthContext are mocked: no network, no real accounts.
// ---------------------------------------------------------------------------
type Listener = (event: string, session: unknown) => void;
type FakeSession = { user: { id: string; user_metadata?: Record<string, unknown> } };

const mocks = vi.hoisted(() => ({
  auth: {
    session: null as FakeSession | null,
    loading: false,
    profile: null as Record<string, unknown> | null,
    profileLoading: false,
  },
  storedSession: null as FakeSession | null,
  getSessionError: false,
  customerProfile: { first_name: "Test", phone: "+919876543210" } as Record<string, unknown> | null,
  listeners: [] as Listener[],
  profileReads: 0,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ ...mocks.auth, user: mocks.auth.session?.user ?? null }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => {
        if (mocks.getSessionError) throw new Error("storage unavailable");
        return { data: { session: mocks.storedSession }, error: null };
      },
      // passwordRecovery.ts subscribes at import time; tests drive it through this.
      onAuthStateChange: (listener: Listener) => {
        mocks.listeners.push(listener);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
    from: () => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.maybeSingle = async () => {
        mocks.profileReads += 1;
        return { data: mocks.customerProfile, error: null };
      };
      return q;
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const CUSTOMER: FakeSession = { user: { id: "user-1" } };
const OWNER_BY_ROLE: FakeSession = { user: { id: "owner-1", user_metadata: { role: "owner" } } };

function LocationProbe() {
  const { pathname, search } = useLocation();
  const type = useNavigationType();
  return <div data-testid="location">{`${pathname}${search}|${type}`}</div>;
}

const tree = (entry: string) => (
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/login" element={<CustomerLogin />} />
      <Route path="/auth" element={<CustomerLogin />} />
      <Route path="*" element={<LocationProbe />} />
    </Routes>
  </MemoryRouter>
);

const renderAt = (entry: string) => {
  const utils = render(tree(entry));
  return { ...utils, rerender: () => utils.rerender(tree(entry)) };
};

/** The signed-in visitor landed on `expected`, replacing the login entry in history. */
const landedOn = (expected: string) =>
  waitFor(() => expect(screen.getByTestId("location").textContent).toBe(`${expected}|REPLACE`));

const formIsShown = () => expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
const noRedirect = () => expect(screen.queryByTestId("location")).toBeNull();
const settle = () => act(async () => {
  await new Promise((r) => setTimeout(r, 20));
});
const saved = () => localStorage.getItem("redirectAfterLogin");

const signIn = (session: FakeSession) => {
  mocks.auth.session = session;
  mocks.storedSession = session;
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.auth.session = null;
  mocks.auth.loading = false;
  mocks.auth.profile = null;
  mocks.auth.profileLoading = false;
  mocks.storedSession = null;
  mocks.getSessionError = false;
  mocks.customerProfile = { first_name: "Test", phone: "+919876543210" };
  mocks.profileReads = 0;
  // Reset passwordRecovery's module state between tests.
  mocks.listeners.forEach((l) => l("SIGNED_OUT", null));
});

describe("signed out", () => {
  it.each(["/login", "/auth"])("%s shows the sign-in form and does not redirect", async (path) => {
    renderAt(path);
    await settle();
    formIsShown();
    noRedirect();
  });
});

describe("signed-in customer", () => {
  it.each(["/login", "/auth"])("%s → /salons by default (history entry replaced)", async (path) => {
    signIn(CUSTOMER);
    renderAt(path);
    await landedOn("/salons");
  });

  it("a valid ?next= is honoured", async () => {
    signIn(CUSTOMER);
    renderAt("/login?next=%2Fbookings");
    await landedOn("/bookings");
  });

  it("the saved return path is used and then cleared", async () => {
    signIn(CUSTOMER);
    localStorage.setItem("redirectAfterLogin", "/my-profile");
    renderAt("/login");
    await landedOn("/my-profile");
    expect(saved()).toBeNull();
  });

  it("?next= wins over an older saved path", async () => {
    signIn(CUSTOMER);
    localStorage.setItem("redirectAfterLogin", "/my-profile");
    renderAt("/auth?next=%2Fbookings");
    await landedOn("/bookings");
  });

  it.each([
    ["an external URL", "https%3A%2F%2Fevil.example%2Fx"],
    ["a protocol-relative URL", "%2F%2Fevil.example"],
    ["a sign-in page (loop)", "%2Flogin"],
    ["/auth (loop)", "%2Fauth"],
  ])("an unsafe ?next= (%s) is ignored → /salons", async (_label, next) => {
    signIn(CUSTOMER);
    renderAt(`/login?next=${next}`);
    await landedOn("/salons");
  });

  it("an unsafe saved path is ignored and cleared → /salons", async () => {
    signIn(CUSTOMER);
    localStorage.setItem("redirectAfterLogin", "https://evil.example/");
    renderAt("/login");
    await landedOn("/salons");
    expect(saved()).toBeNull();
  });

  it("an incomplete profile → /complete-profile carrying next", async () => {
    signIn(CUSTOMER);
    mocks.customerProfile = { first_name: null, phone: null };
    renderAt("/login?next=%2Fbookings");
    await landedOn("/complete-profile?next=%2Fbookings");
  });

  it("shows a spinner, not the form, while it checks", async () => {
    signIn(CUSTOMER);
    renderAt("/login");
    expect(screen.getByRole("status", { name: /checking your session/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/email/i)).toBeNull();
    await landedOn("/salons");
  });
});

describe("signed-in owner", () => {
  it("with an owner profile → /owner-dashboard (no customer profile lookup)", async () => {
    signIn({ user: { id: "owner-1" } });
    mocks.auth.profile = { id: "owner-1", name: "Owner" };
    renderAt("/login");
    await landedOn("/owner-dashboard");
    expect(mocks.profileReads).toBe(0);
  });

  it("with role 'owner' in user metadata → /owner-dashboard", async () => {
    signIn(OWNER_BY_ROLE);
    renderAt("/auth");
    await landedOn("/owner-dashboard");
  });

  it("waits for the owner profile to finish loading before deciding", async () => {
    signIn({ user: { id: "owner-1" } });
    mocks.auth.profileLoading = true;
    const { rerender } = renderAt("/login");
    await settle();
    noRedirect();

    mocks.auth.profile = { id: "owner-1" };
    mocks.auth.profileLoading = false;
    rerender();
    await landedOn("/owner-dashboard");
  });
});

describe("password recovery", () => {
  it("a pending recovery session → /reset-password, never the app (even with ?next=)", async () => {
    signIn(CUSTOMER);
    mocks.listeners.forEach((l) => l("PASSWORD_RECOVERY", CUSTOMER));
    renderAt("/login?next=%2Fbookings");
    await landedOn("/reset-password");
    expect(mocks.profileReads).toBe(0);
  });

  it("a pending recovery wins over owner routing", async () => {
    signIn(OWNER_BY_ROLE);
    mocks.listeners.forEach((l) => l("PASSWORD_RECOVERY", OWNER_BY_ROLE));
    renderAt("/login");
    await landedOn("/reset-password");
  });

  it("is sent to /reset-password only once (acknowledged), then routed normally", async () => {
    signIn(CUSTOMER);
    mocks.listeners.forEach((l) => l("PASSWORD_RECOVERY", CUSTOMER));
    const first = renderAt("/login");
    await landedOn("/reset-password");
    first.unmount();

    renderAt("/login");
    await landedOn("/salons");
  });
});

describe("stale or unconfirmed sessions", () => {
  it("context still holds a session after sign-out, storage has none → form, no redirect", async () => {
    mocks.auth.session = CUSTOMER; // AuthContext's debounced SIGNED_OUT not applied yet
    mocks.storedSession = null;
    renderAt("/login");
    await settle();
    formIsShown();
    noRedirect();
  });

  it("stored session belongs to a different user → form, no redirect", async () => {
    mocks.auth.session = CUSTOMER;
    mocks.storedSession = { user: { id: "someone-else" } };
    renderAt("/auth");
    await settle();
    formIsShown();
    noRedirect();
  });

  it("getSession() fails → form, no redirect", async () => {
    mocks.auth.session = CUSTOMER;
    mocks.getSessionError = true;
    renderAt("/login");
    await settle();
    formIsShown();
    noRedirect();
  });
});

describe("no race with the page's own sign-in", () => {
  it("auth still loading: waits, then redirects once it settles with a session", async () => {
    mocks.auth.loading = true;
    const { rerender } = renderAt("/login");
    await settle();
    noRedirect();

    signIn(CUSTOMER);
    mocks.auth.loading = false;
    rerender();
    await landedOn("/salons");
  });

  it("signed out on arrival: a session appearing later (this page's sign-in) is not auto-redirected", async () => {
    const { rerender } = renderAt("/login");
    await settle();
    formIsShown();

    // The form's own handler would navigate; this check must not run again.
    signIn(CUSTOMER);
    rerender();
    await settle();
    formIsShown();
    noRedirect();
    expect(mocks.profileReads).toBe(0);
  });
});
