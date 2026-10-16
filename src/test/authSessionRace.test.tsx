import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import CustomerLogin from "@/pages/CustomerLogin";

// ---------------------------------------------------------------------------
// The real-browser race, reproduced with the REAL AuthProvider (and its real
// 300ms debounce on auth events). Supabase is mocked the way the real client
// behaves: sign-in stores the session, then notifies listeners, then resolves.
// The customer signs in on /auth?next=<protected page>; CustomerLogin navigates
// before AuthContext has applied the session. ProtectedRoute must not bounce
// them back to /auth.
// ---------------------------------------------------------------------------
type Listener = (event: string, session: unknown) => unknown;

const store = vi.hoisted(() => ({
  session: null as { user: { id: string; email: string } } | null,
  listeners: [] as Listener[],
  profile: { first_name: "Test", phone: "+919876543210" } as Record<string, unknown> | null,
}));

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => {
  const query = (table: string) => {
    const q: Record<string, unknown> = {};
    for (const method of ["select", "eq", "insert", "update"]) q[method] = () => q;
    q.maybeSingle = async () => ({ data: table === "customer_profiles" ? store.profile : null, error: null });
    return q;
  };
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: store.session }, error: null }),
        getUser: async () => ({ data: { user: store.session?.user ?? null }, error: null }),
        onAuthStateChange: (listener: Listener) => {
          store.listeners.push(listener);
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
        signInWithPassword: auth.signInWithPassword,
        signInWithOtp: auth.signInWithOtp,
        verifyOtp: auth.verifyOtp,
        signInWithOAuth: vi.fn(),
      },
      from: query,
    },
  };
});

vi.mock("@/lib/sessionRegistry", () => ({
  clearAllSessionRecords: vi.fn(async () => undefined),
  clearOtherSessionRecords: vi.fn(async () => undefined),
  registerCurrentSession: vi.fn(async () => undefined),
  removeCurrentSessionRecord: vi.fn(async () => undefined),
  touchCurrentSession: vi.fn(async () => undefined),
}));
vi.mock("@/lib/phone", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/phone")>()),
  syncVerifiedPhoneToProfile: vi.fn(async () => undefined),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const USER = { id: "user-1", email: "customer@example.invalid" };
const SESSION = { user: USER, access_token: "token" };
const DESTINATION = "/bookings";

/** What the real Supabase client does on a successful sign-in: store, notify listeners, resolve. */
const supabaseSignsIn = async () => {
  store.session = SESSION;
  await Promise.all(store.listeners.map((listener) => listener("SIGNED_IN", SESSION)));
};

const visited: string[] = [];
function Probes() {
  const { session } = useAuth();
  const { pathname, search } = useLocation();
  useEffect(() => {
    visited.push(`${pathname}${search}`);
  }, [pathname, search]);
  return (
    <>
      <div data-testid="context-session">{session ? "in" : "out"}</div>
      <div data-testid="location">{`${pathname}${search}`}</div>
    </>
  );
}

const renderApp = () =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[DESTINATION]}>
        <Probes />
        <Routes>
          <Route path="/auth" element={<CustomerLogin />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/bookings" element={<div data-testid="page" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );

/** Let pending promise chains settle without moving the clock. */
const flush = async () => {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }
};
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const location = () => screen.getByTestId("location").textContent;
const contextSession = () => screen.getByTestId("context-session").textContent;
const page = () => screen.queryByTestId("page");
const AUTH_URL = `/auth?next=${encodeURIComponent(DESTINATION)}`;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  store.session = null;
  store.listeners.length = 0;
  visited.length = 0;
  auth.signInWithPassword.mockImplementation(async () => {
    await supabaseSignsIn();
    return { data: { user: USER, session: SESSION }, error: null };
  });
  auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
  auth.verifyOtp.mockImplementation(async () => {
    await supabaseSignsIn();
    return { data: { user: USER, session: SESSION }, error: null };
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Signed out → gate → /auth?next=…; returns the index in `visited` where sign-in starts. */
const reachSignInPage = async () => {
  renderApp();
  await flush();
  expect(location()).toBe(AUTH_URL);
  return visited.length;
};

/** After sign-in: lands on the page with the context still behind, then the context catches up. */
const expectNoBounce = async (signInStartedAt: number) => {
  await flush();
  // The race is really exercised: we're on the protected page, but AuthContext
  // hasn't applied the session yet (its 300ms debounce hasn't fired).
  expect(location()).toBe(DESTINATION);
  expect(contextSession()).toBe("out");
  expect(page()).toBeNull(); // spinner, not a redirect

  await advance(300);
  await flush();
  expect(contextSession()).toBe("in");
  expect(page()).toBeInTheDocument();
  expect(location()).toBe(DESTINATION);
  // Never sent back to the sign-in page after signing in.
  expect(visited.slice(signInStartedAt).some((path) => path.startsWith("/auth"))).toBe(false);
};

describe("sign-in while AuthContext is still applying the session (real AuthProvider)", () => {
  it("email/password: lands on the protected page, not back on /auth", async () => {
    const startedAt = await reachSignInPage();
    fireEvent.change(screen.getByPlaceholderText("your@email.com"), { target: { value: USER.email } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "correct-horse" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await expectNoBounce(startedAt);
  });

  it("phone OTP: lands on the protected page, not back on /auth", async () => {
    const startedAt = await reachSignInPage();
    fireEvent.click(screen.getByRole("button", { name: /continue with mobile/i }));
    fireEvent.change(screen.getByLabelText("10-digit mobile number"), { target: { value: "9876543210" } });
    fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
    await flush();
    "123456".split("").forEach((d, i) => fireEvent.change(screen.getByLabelText(`Digit ${i + 1} of 6`), { target: { value: d } }));
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await expectNoBounce(startedAt);
  });

  it("still signed out (wrong password): stays on /auth, nothing waits", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: { message: "Invalid login credentials" } });
    await reachSignInPage();
    fireEvent.change(screen.getByPlaceholderText("your@email.com"), { target: { value: USER.email } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await flush();
    await advance(3000);
    expect(location()).toBe(AUTH_URL);
    expect(contextSession()).toBe("out");
  });
});
