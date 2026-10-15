import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// ---------------------------------------------------------------------------
// Supabase mocked: no emails, no real accounts, no password changes. Every
// onAuthStateChange registration is recorded so tests can emit auth events and
// check that listeners are unsubscribed.
// ---------------------------------------------------------------------------
type Listener = { callback: (event: string, session: unknown) => void; unsubscribe: ReturnType<typeof vi.fn> };

const mocks = vi.hoisted(() => ({
  listeners: [] as Listener[],
  getSession: vi.fn(),
  setSession: vi.fn(),
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  ownerRow: null as unknown,
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: Listener["callback"]) => {
        const listener: Listener = { callback, unsubscribe: vi.fn() };
        mocks.listeners.push(listener);
        return { data: { subscription: { unsubscribe: listener.unsubscribe } } };
      },
      getSession: mocks.getSession,
      setSession: mocks.setSession,
      verifyOtp: mocks.verifyOtp,
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.ownerRow, error: null }) }) }) }),
  },
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));

const USER = { id: "user-1", email: "person@example.invalid" };
const SESSION = { user: USER, access_token: "session-access", refresh_token: "session-refresh" };
const TOKEN_HASH = "secret-token-hash-123";
const PKCE_CODE = "secret-pkce-code-456";

/** Emit an auth event to every listener still subscribed (module-level and page-level). */
const emit = (event: string, session: unknown = SESSION) =>
  act(() => {
    for (const l of mocks.listeners) if (!l.unsubscribe.mock.calls.length) l.callback(event, session);
  });

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

/** Fresh module state per test: the recovery marker and the verify-once cache start empty. */
const loadPage = async () => {
  vi.resetModules();
  const recovery = await import("@/lib/passwordRecovery");
  const { default: ResetPassword } = await import("@/pages/ResetPassword");
  return { ResetPassword, recovery };
};

const renderAt = (ResetPassword: React.ComponentType, url: string, { strict = false } = {}) => {
  window.history.replaceState(null, "", url); // the page reads the real window location
  const tree = (
    <MemoryRouter initialEntries={["/reset-password"]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

const passwordForm = () => screen.findByText("Set new password");
const codeForm = () => screen.findByText("Enter reset code");
const settle = () => act(() => new Promise((r) => setTimeout(r, 30)));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listeners.length = 0;
  mocks.ownerRow = null;
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  mocks.updateUser.mockResolvedValue({ data: { user: USER }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

// ---------------------------------------------------------------------------
describe("1. recovery session already established when the page mounts", () => {
  it("PASSWORD_RECOVERY during start-up (before mount) → password form, no link verification", async () => {
    const { ResetPassword } = await loadPage();
    // The module-level listener exists as soon as the app's code loads.
    emit("PASSWORD_RECOVERY");
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    renderAt(ResetPassword, "/reset-password");
    await passwordForm();
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("an ordinary signed-in session (no recovery event) does NOT unlock the password form", async () => {
    const { ResetPassword } = await loadPage();
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    renderAt(ResetPassword, "/reset-password");
    await codeForm();
    await settle();
    expect(screen.queryByText("Set new password")).not.toBeInTheDocument();
  });

  it("a recovery event for a different user than the current session does not count", async () => {
    const { ResetPassword } = await loadPage();
    emit("PASSWORD_RECOVERY", { user: { id: "someone-else" } });
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    renderAt(ResetPassword, "/reset-password");
    await codeForm();
    await settle();
    expect(screen.queryByText("Set new password")).not.toBeInTheDocument();
  });

  it("SIGNED_OUT clears the recovery marker", async () => {
    const { ResetPassword } = await loadPage();
    emit("PASSWORD_RECOVERY");
    emit("SIGNED_OUT", null);
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    renderAt(ResetPassword, "/reset-password");
    await codeForm();
    await settle();
    expect(screen.queryByText("Set new password")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe("2. PASSWORD_RECOVERY while the page is initialising", () => {
  it("event after mount → password form", async () => {
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, "/reset-password");
    await codeForm();
    emit("PASSWORD_RECOVERY");
    await passwordForm();
  });

  it("other auth events (SIGNED_IN, TOKEN_REFRESHED) do not unlock the form", async () => {
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, "/reset-password");
    await codeForm();
    emit("SIGNED_IN");
    emit("TOKEN_REFRESHED");
    await settle();
    expect(screen.queryByText("Set new password")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe("3. ?token_hash=…&type=recovery", () => {
  it("verifies with verifyOtp, then shows the password form and cleans the URL", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: SESSION, user: USER }, error: null });
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, `/reset-password?email=person%40example.invalid&token_hash=${TOKEN_HASH}&type=recovery`);
    await passwordForm();
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: TOKEN_HASH, type: "recovery" });
    expect(window.location.search).toBe("?email=person%40example.invalid");
    expect(window.location.href).not.toContain(TOKEN_HASH);
  });

  it("token_hash without type=recovery is not treated as a recovery link", async () => {
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, `/reset-password?token_hash=${TOKEN_HASH}&type=signup`);
    await codeForm();
    await settle();
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(screen.queryByText("Set new password")).not.toBeInTheDocument();
  });

  it("verifyOtp success without a session does not unlock the form", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: null });
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, `/reset-password?token_hash=${TOKEN_HASH}&type=recovery`);
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid or has expired/i);
    expect(screen.queryByText("Set new password")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe("4. PKCE ?code=…", () => {
  it("exchanges a recovery code, then shows the password form", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: SESSION, user: USER, redirectType: "recovery" }, error: null });
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, `/reset-password?code=${PKCE_CODE}`);
    await passwordForm();
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith(PKCE_CODE);
    expect(window.location.href).not.toContain(PKCE_CODE);
  });

  it("a code that signs in but is not a recovery code does not unlock the form", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: SESSION, user: USER, redirectType: null }, error: null });
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, `/reset-password?code=${PKCE_CODE}`);
    expect(await screen.findByRole("alert")).toHaveTextContent(/isn't a password reset link/i);
    expect(screen.queryByText("Set new password")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe("5. invalid and expired links", () => {
  it("rejected token_hash → clear error, code form stays available", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: { message: "Email link is invalid or has expired" } });
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, `/reset-password?token_hash=${TOKEN_HASH}&type=recovery`);
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid or has expired/i);
    expect(screen.getByText("Enter reset code")).toBeInTheDocument();
  });

  it("rejected PKCE code (e.g. no code verifier in this browser) → clear error", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: null, user: null }, error: { message: "invalid request: both auth code and code verifier should be non-empty" } });
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, `/reset-password?code=${PKCE_CODE}`);
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid or has expired/i);
  });

  it("a verification call that throws → clear error, no password form", async () => {
    mocks.verifyOtp.mockRejectedValue(new Error("network down"));
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, `/reset-password?token_hash=${TOKEN_HASH}&type=recovery`);
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid or has expired/i);
    expect(screen.queryByText("Set new password")).not.toBeInTheDocument();
  });

  it.each([
    ["Supabase hash error", "/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"],
    ["homepage expired flag", "/reset-password?expired=1"],
    ["query error", "/reset-password?error=access_denied&error_code=otp_expired"],
  ])("%s → clear error without calling Supabase", async (_label, url) => {
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, url);
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid or has expired/i);
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it("rejected hash tokens → clear error", async () => {
    mocks.setSession.mockResolvedValue({ data: { session: null }, error: { message: "Invalid Refresh Token" } });
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, "/reset-password#access_token=bad&refresh_token=bad&type=recovery");
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid or has expired/i);
  });
});

// ---------------------------------------------------------------------------
describe("6. duplicate processing", () => {
  it("React Strict Mode verifies a token_hash exactly once and still shows the form", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: SESSION, user: USER }, error: null });
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, `/reset-password?token_hash=${TOKEN_HASH}&type=recovery`, { strict: true });
    await passwordForm();
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
  });

  it("React Strict Mode exchanges a PKCE code exactly once", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: SESSION, user: USER, redirectType: "recovery" }, error: null });
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, `/reset-password?code=${PKCE_CODE}`, { strict: true });
    await passwordForm();
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it("calling verifyRecoveryLink repeatedly for the same link reuses one verification", async () => {
    let resolve!: (v: unknown) => void;
    mocks.verifyOtp.mockReturnValue(new Promise((r) => (resolve = r)));
    const { recovery } = await loadPage();
    const params = new URLSearchParams(`token_hash=${TOKEN_HASH}&type=recovery`);
    const a = recovery.verifyRecoveryLink(params);
    const b = recovery.verifyRecoveryLink(params);
    expect(a).toBe(b);
    resolve({ data: { session: SESSION, user: USER }, error: null });
    await expect(a).resolves.toEqual({ status: "verified" });
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
  });

  it("a remount with the same link does not verify it again", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: SESSION, user: USER }, error: null });
    const { ResetPassword } = await loadPage();
    const first = renderAt(ResetPassword, `/reset-password?token_hash=${TOKEN_HASH}&type=recovery`);
    await passwordForm();
    first.unmount();
    renderAt(ResetPassword, `/reset-password?token_hash=${TOKEN_HASH}&type=recovery`);
    await passwordForm();
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
describe("7. email + code fallback (unchanged)", () => {
  const enterCode = (email: string, code: string) => {
    fireEvent.change(screen.getByPlaceholderText("your@email.com"), { target: { value: email } });
    fireEvent.change(screen.getByPlaceholderText("Enter 8-digit OTP"), { target: { value: code } });
    fireEvent.click(screen.getByRole("button", { name: /verify otp/i }));
  };

  it("valid code → password form", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: SESSION, user: USER }, error: null });
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, "/reset-password");
    await codeForm();
    enterCode("person@example.invalid", "12345678");
    await passwordForm();
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ email: "person@example.invalid", token: "12345678", type: "recovery" });
  });

  it("wrong code → stays on the code form with the existing error toast", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: { message: "Token has expired or is invalid" } });
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, "/reset-password");
    await codeForm();
    enterCode("person@example.invalid", "00000000");
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("OTP expired or invalid. Please request a new reset link."));
    expect(screen.getByText("Enter reset code")).toBeInTheDocument();
  });

  it("the code form still works after an expired-link error", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: SESSION, user: USER }, error: null });
    const { ResetPassword } = await loadPage();
    renderAt(ResetPassword, "/reset-password?expired=1");
    await screen.findByRole("alert");
    enterCode("person@example.invalid", "12345678");
    await passwordForm();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe("8. customer and owner destinations after recovery", () => {
  const setPassword = () => {
    fireEvent.change(screen.getByPlaceholderText("Minimum 8 characters"), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByPlaceholderText("Re-enter password"), { target: { value: "new-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
  };

  it.each([
    ["customer", null, "/login"],
    ["owner", { id: USER.id }, "/owner-login"],
  ])("%s → %s… after a token_hash recovery", async (_label, ownerRow, expected) => {
    mocks.ownerRow = ownerRow;
    mocks.verifyOtp.mockResolvedValue({ data: { session: SESSION, user: USER }, error: null });
    const { ResetPassword, recovery } = await loadPage();
    renderAt(ResetPassword, `/reset-password?token_hash=${TOKEN_HASH}&type=recovery`);
    await passwordForm();
    setPassword();
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe(expected));
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "new-password-123" });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    // The recovery marker is cleared once the password is changed.
    mocks.getSession.mockResolvedValue({ data: { session: SESSION } });
    await expect(recovery.getRecoverySession()).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("9. listener cleanup", () => {
  it("unsubscribes the page's listener on unmount; later events are ignored safely", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { ResetPassword } = await loadPage();
    const moduleListeners = mocks.listeners.length; // the app-lifetime module listener
    const view = renderAt(ResetPassword, "/reset-password");
    await codeForm();
    const pageListeners = mocks.listeners.slice(moduleListeners);
    expect(pageListeners).toHaveLength(1);
    view.unmount();
    expect(pageListeners[0].unsubscribe).toHaveBeenCalledTimes(1);
    emit("PASSWORD_RECOVERY");
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("an in-flight verification that finishes after unmount does not update state", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let resolve!: (v: unknown) => void;
    mocks.verifyOtp.mockReturnValue(new Promise((r) => (resolve = r)));
    const { ResetPassword } = await loadPage();
    const view = renderAt(ResetPassword, `/reset-password?token_hash=${TOKEN_HASH}&type=recovery`);
    await codeForm();
    view.unmount();
    await act(async () => resolve({ data: { session: SESSION, user: USER }, error: null }));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

// ---------------------------------------------------------------------------
describe("no tokens in logs", () => {
  it("never logs the token_hash or code", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    mocks.verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: { message: "invalid" } });
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: null, user: null }, error: { message: "invalid" } });
    let { ResetPassword } = await loadPage();
    renderAt(ResetPassword, `/reset-password?token_hash=${TOKEN_HASH}&type=recovery`);
    await screen.findByRole("alert");
    ({ ResetPassword } = await loadPage());
    renderAt(ResetPassword, `/reset-password?code=${PKCE_CODE}`);
    await waitFor(() => expect(mocks.exchangeCodeForSession).toHaveBeenCalled());
    await settle();
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).not.toContain(TOKEN_HASH);
    expect(logged).not.toContain(PKCE_CODE);
    spies.forEach((s) => s.mockRestore());
  });
});
