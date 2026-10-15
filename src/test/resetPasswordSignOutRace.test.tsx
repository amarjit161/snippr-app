import { StrictMode, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// ---------------------------------------------------------------------------
// Auth provider stand-in. The real AuthContext applies auth events after a
// 300ms debounce, so `user` stays set for a moment after signOut(). Tests
// control exactly when (or whether) the sign-out reaches the provider.
// ---------------------------------------------------------------------------
type AuthState = {
  session: { user: { id: string; email: string; email_confirmed_at: string } } | null;
  user: { id: string; email: string; email_confirmed_at: string } | null;
  profile: null;
  loading: boolean;
  profileLoading: boolean;
};

const auth = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const store = {
    state: null as unknown as AuthState,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    set(next: Partial<AuthState>) {
      store.state = { ...store.state, ...next };
      listeners.forEach((l) => l());
    },
  };
  return store;
});

vi.mock("@/contexts/AuthContext", async () => {
  const React = await import("react");
  return { useAuth: () => React.useSyncExternalStore(auth.subscribe, () => auth.state) };
});

// ---------------------------------------------------------------------------
// Supabase mocked: no emails, no real accounts. `signOutNotifies` decides how
// the provider hears about the sign-out ("debounced" 300ms, a later delay, or never).
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  signOutNotifies: { mode: "debounced" as "debounced" | "never", delayMs: 300 },
  updateUser: vi.fn(),
  ownerRow: null as unknown,
  hardNavigate: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: async () => ({ data: { session: null } }),
      setSession: async () => ({ data: { session: null }, error: null }),
      verifyOtp: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      updateUser: (...args: unknown[]) => {
        mocks.calls.push("updateUser");
        return mocks.updateUser(...args);
      },
      signOut: async () => {
        mocks.calls.push("signOut");
        if (mocks.signOutNotifies.mode === "debounced") {
          setTimeout(() => act(() => auth.set({ session: null, user: null })), mocks.signOutNotifies.delayMs);
        }
        return { error: null };
      },
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            mocks.calls.push(`lookup:${table}`);
            return { data: mocks.ownerRow, error: null };
          },
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/hardNavigate", () => ({ hardNavigate: mocks.hardNavigate }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: vi.fn() } }));
// Irrelevant to routing and need a real browser.
vi.mock("@/components/TurnstileCaptcha", async () => {
  const React = await import("react");
  return { default: React.forwardRef<HTMLDivElement>((_props, ref) => <div ref={ref} data-testid="turnstile" />) };
});
vi.mock("gsap", () => {
  const chain = { to: () => chain, fromTo: () => chain, set: () => chain, kill: () => chain };
  return { default: { to: () => chain, fromTo: () => chain, set: () => chain, timeline: () => chain, context: () => ({ revert: () => {} }) } };
});

import ResetPassword from "@/pages/ResetPassword";
import OwnerLogin from "@/pages/OwnerLogin";

const USER = { id: "user-1", email: "person@example.invalid", email_confirmed_at: "2026-01-01T00:00:00Z" };

/** Every distinct location visited, to prove no bounce through /owner-register or /owner-signup. */
let visited: string[] = [];
function LocationLog() {
  const { key, pathname } = useLocation();
  useEffect(() => {
    const entry = `${key}|${pathname}`;
    if (!visited.includes(entry)) visited.push(entry);
  }, [key, pathname]);
  return null;
}
const paths = () => visited.map((v) => v.split("|")[1]);

function Probe({ name }: { name: string }) {
  return <div data-testid="landed">{name}</div>;
}

const renderFlow = ({ strict = false } = {}) => {
  // Recovery session from a link: the page verifies the hash tokens and shows the form.
  window.history.replaceState(null, "", "/reset-password#access_token=a&refresh_token=b&type=recovery");
  const tree = (
    <MemoryRouter initialEntries={["/reset-password"]}>
      <LocationLog />
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/owner-login" element={<OwnerLogin />} />
        <Route path="/owner-register" element={<Probe name="owner-register" />} />
        <Route path="/owner-signup" element={<Probe name="owner-signup" />} />
        <Route path="/owner-dashboard" element={<Probe name="owner-dashboard" />} />
        <Route path="/login" element={<Probe name="login" />} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

const submitNewPassword = async () => {
  await screen.findByText("Set new password");
  fireEvent.change(screen.getByPlaceholderText("Minimum 8 characters"), { target: { value: "new-password-123" } });
  fireEvent.change(screen.getByPlaceholderText("Re-enter password"), { target: { value: "new-password-123" } });
  fireEvent.click(screen.getByRole("button", { name: /update password/i }));
};

const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

beforeEach(() => {
  vi.clearAllMocks();
  visited = [];
  mocks.calls.length = 0;
  mocks.ownerRow = null;
  mocks.signOutNotifies = { mode: "debounced", delayMs: 300 };
  mocks.updateUser.mockResolvedValue({ data: { user: USER }, error: null });
  localStorage.clear();
  // Signed in with the recovery session, as the provider sees it before sign-out.
  auth.state = { session: { user: USER }, user: USER, profile: null, loading: false, profileLoading: false };
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("password reset → login page, after sign-out has reached AuthContext", () => {
  it("1. owner ends at /owner-login, never /owner-register or /owner-signup", async () => {
    mocks.ownerRow = { id: USER.id };
    renderFlow();
    await submitNewPassword();
    await waitFor(() => expect(paths()).toContain("/owner-login"));
    await wait(400); // give OwnerLogin's auto-redirect every chance to misfire
    expect(paths()).toEqual(["/reset-password", "/owner-login"]);
    expect(screen.queryByTestId("landed")).not.toBeInTheDocument(); // the real OwnerLogin form is showing
    expect(screen.getByText("Owner Login")).toBeInTheDocument();
    expect(mocks.calls).toEqual(["updateUser", "lookup:owners", "signOut"]);
    expect(mocks.hardNavigate).not.toHaveBeenCalled();
  });

  it("2. customer ends at /login", async () => {
    renderFlow();
    await submitNewPassword();
    await waitFor(() => expect(screen.getByTestId("landed")).toHaveTextContent("login"));
    expect(paths()).toEqual(["/reset-password", "/login"]);
    expect(mocks.hardNavigate).not.toHaveBeenCalled();
  });

  it("3. stays on the reset page while the provider still shows the stale signed-in user", async () => {
    mocks.ownerRow = { id: USER.id };
    renderFlow();
    await submitNewPassword();
    await waitFor(() => expect(mocks.calls).toContain("signOut"));
    await wait(150); // sign-out done, provider not yet updated (300ms debounce)
    expect(paths()).toEqual(["/reset-password"]);
    expect(screen.getByRole("button", { name: /updating/i })).toBeDisabled();
    await waitFor(() => expect(paths()).toEqual(["/reset-password", "/owner-login"]));
  });

  it("4a. a delayed notification (1.2s) still ends with one in-app navigation", async () => {
    mocks.ownerRow = { id: USER.id };
    mocks.signOutNotifies = { mode: "debounced", delayMs: 1200 };
    renderFlow();
    await submitNewPassword();
    await wait(600);
    expect(paths()).toEqual(["/reset-password"]);
    await waitFor(() => expect(paths()).toEqual(["/reset-password", "/owner-login"]), { timeout: 3000 });
    expect(mocks.hardNavigate).not.toHaveBeenCalled();
  }, 10_000);

  it("4b. no notification at all → one full page load to the destination after the bounded fallback", async () => {
    mocks.ownerRow = { id: USER.id };
    mocks.signOutNotifies = { mode: "never", delayMs: 0 };
    renderFlow();
    await submitNewPassword();
    await waitFor(() => expect(mocks.hardNavigate).toHaveBeenCalledWith("/owner-login"), { timeout: 4500 });
    expect(mocks.hardNavigate).toHaveBeenCalledTimes(1);
    // The router never showed /owner-login with the stale user (no bounce possible).
    expect(paths()).toEqual(["/reset-password"]);
    // A notification arriving afterwards must not cause a second navigation.
    act(() => auth.set({ session: null, user: null }));
    await wait(50);
    expect(paths()).toEqual(["/reset-password"]);
    expect(mocks.hardNavigate).toHaveBeenCalledTimes(1);
  }, 10_000);

  it("4c. customer fallback goes to /login", async () => {
    mocks.signOutNotifies = { mode: "never", delayMs: 0 };
    renderFlow();
    await submitNewPassword();
    await waitFor(() => expect(mocks.hardNavigate).toHaveBeenCalledWith("/login"), { timeout: 4500 });
    expect(mocks.hardNavigate).toHaveBeenCalledTimes(1);
  }, 10_000);

  it("5. a failed password update neither signs out nor navigates", async () => {
    mocks.updateUser.mockResolvedValue({ data: { user: null }, error: { message: "Password should be at least 8 characters." } });
    renderFlow();
    await submitNewPassword();
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Password should be at least 8 characters."));
    await wait(400);
    expect(mocks.calls).toEqual(["updateUser"]);
    expect(paths()).toEqual(["/reset-password"]);
    expect(mocks.hardNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /update password/i })).toBeInTheDocument(); // can retry
  });

  it("6. React Strict Mode: exactly one navigation", async () => {
    mocks.ownerRow = { id: USER.id };
    renderFlow({ strict: true });
    await submitNewPassword();
    await waitFor(() => expect(paths()).toContain("/owner-login"));
    await wait(400);
    expect(paths()).toEqual(["/reset-password", "/owner-login"]);
    expect(mocks.hardNavigate).not.toHaveBeenCalled();
  });

  it("leaving the reset page before sign-out is reflected cancels the fallback", async () => {
    mocks.ownerRow = { id: USER.id };
    mocks.signOutNotifies = { mode: "never", delayMs: 0 };
    const view = renderFlow();
    await submitNewPassword();
    await waitFor(() => expect(mocks.calls).toContain("signOut"));
    view.unmount();
    await wait(3300);
    expect(mocks.hardNavigate).not.toHaveBeenCalled();
  }, 10_000);
});
