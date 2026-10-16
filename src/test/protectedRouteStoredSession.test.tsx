import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { OwnerProtectedRoute } from "@/components/OwnerProtectedRoute";

// ---------------------------------------------------------------------------
// ProtectedRoute while AuthContext lags behind Supabase. AuthContext applies auth
// events after a 300ms debounce, so right after a sign-in the context can still
// have no session although Supabase has stored one. The gate must wait for the
// context (bounded) instead of sending the customer back to /auth.
// The context is mocked so each test controls exactly when it "catches up".
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  auth: {
    session: null as { user: { id: string } } | null,
    loading: false,
    profile: null as Record<string, unknown> | null,
    profileLoading: false,
  },
  getSession: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ ...mocks.auth, user: mocks.auth.session?.user ?? null }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const q: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) q[method] = () => q;
  q.maybeSingle = async () => ({ data: { phone: "+919876543210", gender: null }, error: null });
  return { supabase: { auth: { getSession: mocks.getSession }, from: () => q } };
});

const USER = { id: "user-1" };
const GRACE_MS = 3000; // ProtectedRoute's STORED_SESSION_GRACE_MS
const DESTINATION = "/bookings?tab=upcoming";

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{`${pathname}${search}`}</div>;
}

const tree = (entry: string) => (
  <MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/bookings" element={<div data-testid="page" />} />
      </Route>
      <Route
        path="/owner-dashboard"
        element={
          <OwnerProtectedRoute>
            <div data-testid="owner-page" />
          </OwnerProtectedRoute>
        }
      />
      <Route path="*" element={<LocationProbe />} />
    </Routes>
  </MemoryRouter>
);

/** Renders the tree; rerender() re-reads the (mutated) mocked context, keeping router state. */
const renderAt = (entry: string) => {
  const utils = render(tree(entry));
  return { ...utils, rerender: () => utils.rerender(tree(entry)) };
};

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const page = () => screen.queryByTestId("page");
const location = () => screen.queryByTestId("location")?.textContent ?? null;
const saved = () => localStorage.getItem("redirectAfterLogin");
const authUrl = `/auth?next=${encodeURIComponent(DESTINATION)}`;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  mocks.auth.session = null;
  mocks.auth.loading = false;
  mocks.auth.profile = null;
  mocks.auth.profileLoading = false;
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
describe("ProtectedRoute: context has no session yet", () => {
  it("Supabase has a stored session: waits (no redirect) and renders once the context catches up", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: USER } } });
    const { rerender } = renderAt(DESTINATION);

    await advance(0);
    await advance(GRACE_MS - 100); // well past AuthContext's 300ms debounce
    expect(location()).toBeNull(); // not sent to /auth
    expect(page()).toBeNull(); // spinner, not the page
    expect(saved()).toBeNull(); // no return path written for a signed-in customer

    mocks.auth.session = { user: USER }; // AuthContext applies the debounced SIGNED_IN
    rerender();
    await advance(0);
    expect(page()).toBeInTheDocument();

    await advance(GRACE_MS * 2); // the grace timer was cleared: no late redirect
    expect(page()).toBeInTheDocument();
    expect(location()).toBeNull();
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
  });

  it("no stored session: the normal redirect to /auth?next=, without waiting for the timeout", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    renderAt(DESTINATION);
    await advance(0);
    expect(location()).toBe(authUrl);
    expect(saved()).toBe(DESTINATION);
  });

  it("stored session but the context never catches up: redirects after the bounded wait, not stuck", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: USER } } });
    renderAt(DESTINATION);

    await advance(GRACE_MS - 1);
    expect(location()).toBeNull();
    expect(page()).toBeNull();

    await advance(1);
    expect(location()).toBe(authUrl);
    expect(saved()).toBe(DESTINATION);
  });

  it("getSession() rejects: safe redirect", async () => {
    mocks.getSession.mockRejectedValue(new Error("storage unavailable"));
    renderAt(DESTINATION);
    await advance(0);
    expect(location()).toBe(authUrl);
  });

  it("getSession() throws synchronously: safe redirect", async () => {
    mocks.getSession.mockImplementation(() => {
      throw new Error("boom");
    });
    renderAt(DESTINATION);
    await advance(0);
    expect(location()).toBe(authUrl);
  });

  it("getSession() never settles: redirects after the bounded wait", async () => {
    mocks.getSession.mockReturnValue(new Promise(() => {}));
    renderAt(DESTINATION);
    await advance(GRACE_MS - 1);
    expect(location()).toBeNull();
    await advance(1);
    expect(location()).toBe(authUrl);
  });
});

describe("ProtectedRoute: cleanup", () => {
  it("unmounting while the check is in flight clears the timer and ignores the late result", async () => {
    let resolve!: (value: unknown) => void;
    mocks.getSession.mockReturnValue(new Promise((r) => (resolve = r)));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = renderAt(DESTINATION);
    await advance(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
    resolve({ data: { session: null } });
    await advance(GRACE_MS);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("the context session arriving while the check is pending: the late 'no session' result is ignored", async () => {
    let resolve!: (value: unknown) => void;
    mocks.getSession.mockReturnValue(new Promise((r) => (resolve = r)));
    const { rerender } = renderAt(DESTINATION);
    await advance(0);

    mocks.auth.session = { user: USER };
    rerender();
    await advance(0);
    expect(page()).toBeInTheDocument();

    resolve({ data: { session: null } }); // stale answer from the cancelled check
    await advance(GRACE_MS * 2);
    expect(page()).toBeInTheDocument();
    expect(location()).toBeNull();
  });
});

describe("ProtectedRoute: unchanged cases", () => {
  it("context already has a session: renders without consulting getSession()", async () => {
    mocks.auth.session = { user: USER };
    renderAt(DESTINATION);
    await advance(0);
    expect(page()).toBeInTheDocument();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("context still loading: spinner, no getSession() call, no redirect", async () => {
    mocks.auth.loading = true;
    renderAt(DESTINATION);
    await advance(GRACE_MS * 2);
    expect(page()).toBeNull();
    expect(location()).toBeNull();
    expect(mocks.getSession).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe("OwnerProtectedRoute is unchanged", () => {
  it("signed out: straight to /owner-login (no stored-session wait)", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: USER } } });
    renderAt("/owner-dashboard");
    expect(location()).toBe("/owner-login");
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("signed in with an owner profile: renders the owner page", async () => {
    mocks.auth.session = { user: USER };
    mocks.auth.profile = { id: USER.id };
    renderAt("/owner-dashboard");
    expect(screen.getByTestId("owner-page")).toBeInTheDocument();
  });

  it("signed in without an owner profile: /owner-register", async () => {
    mocks.auth.session = { user: USER };
    renderAt("/owner-dashboard");
    expect(location()).toBe("/owner-register");
  });

  it("profile still loading: spinner", async () => {
    mocks.auth.session = { user: USER };
    mocks.auth.profileLoading = true;
    renderAt("/owner-dashboard");
    expect(screen.queryByTestId("owner-page")).toBeNull();
    expect(location()).toBeNull();
  });
});
