import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import CustomerLogin from "@/pages/CustomerLogin";
import AuthCallback from "@/pages/AuthCallback";
import CompleteProfile from "@/pages/CompleteProfile";

// ---------------------------------------------------------------------------
// Supabase mock: no network, no real accounts. Each test sets what the auth
// calls return and which customer profile the `customer_profiles` read yields.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  upsert: vi.fn(),
  profile: null as Record<string, unknown> | null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithOAuth: mocks.signInWithOAuth,
      signInWithPassword: mocks.signInWithPassword,
      signInWithOtp: mocks.signInWithOtp,
      verifyOtp: mocks.verifyOtp,
      getSession: mocks.getSession,
      getUser: mocks.getUser,
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.profile, error: null }) }) }),
      upsert: mocks.upsert,
    }),
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/phone", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/phone")>()),
  syncVerifiedPhoneToProfile: vi.fn(async () => undefined),
}));

const USER = { id: "user-1", email: "customer@example.invalid", user_metadata: {}, phone: null, phone_confirmed_at: null };
const COMPLETE_PROFILE = { first_name: "Amarjit", last_name: "Sharma", phone: "+919876543210", gender: null };

/** Renders the current router location so tests assert where the user actually lands. */
function LocationProbe() {
  const { pathname, search, hash } = useLocation();
  return <div data-testid="location">{`${pathname}${search}${hash}`}</div>;
}

const renderAt = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/auth" element={<CustomerLogin />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

const landedOn = async (expected: string) =>
  waitFor(() => expect(screen.getByTestId("location").textContent).toBe(expected));

const saved = () => localStorage.getItem("redirectAfterLogin");

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  mocks.profile = null;
  mocks.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.getSession.mockResolvedValue({ data: { session: { user: USER } } });
  mocks.getUser.mockResolvedValue({ data: { user: USER } });
});

// ---------------------------------------------------------------------------
describe("Google sign-in carries the saved destination", () => {
  const googleRedirectTo = async () => {
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalledTimes(1));
    return mocks.signInWithOAuth.mock.calls[0][0].options.redirectTo as string;
  };

  it("uses the current origin and an encoded next=/bookings", async () => {
    localStorage.setItem("redirectAfterLogin", "/bookings");
    renderAt("/auth");
    expect(await googleRedirectTo()).toBe(`${window.location.origin}/auth/callback?next=%2Fbookings`);
    expect(mocks.signInWithOAuth.mock.calls[0][0].provider).toBe("google");
    // Not cleared yet — the user may still cancel at Google.
    expect(saved()).toBe("/bookings");
  });

  it("preserves query and hash, safely encoded", async () => {
    localStorage.setItem("redirectAfterLogin", "/booking/confirm?x=1#details");
    renderAt("/auth");
    expect(await googleRedirectTo()).toBe(
      `${window.location.origin}/auth/callback?next=${encodeURIComponent("/booking/confirm?x=1#details")}`,
    );
  });

  it.each([
    ["nothing saved", null],
    ["external URL", "https://evil.com/bookings"],
    ["protocol-relative", "//evil.com"],
    ["javascript: URL", "javascript:alert(1)"],
    ["auth loop", "/auth/callback?next=/bookings"],
  ])("falls back to /salons when %s", async (_label, value) => {
    if (value !== null) localStorage.setItem("redirectAfterLogin", value);
    renderAt("/auth");
    expect(await googleRedirectTo()).toBe(`${window.location.origin}/auth/callback?next=%2Fsalons`);
  });

  it("never reads the old, never-set sessionStorage.returnTo", async () => {
    sessionStorage.setItem("returnTo", "/my-profile");
    renderAt("/auth");
    expect(await googleRedirectTo()).toBe(`${window.location.origin}/auth/callback?next=%2Fsalons`);
  });
});

// ---------------------------------------------------------------------------
describe("AuthCallback validates next", () => {
  beforeEach(() => {
    mocks.profile = COMPLETE_PROFILE;
  });

  it("follows a safe next and clears any saved path", async () => {
    localStorage.setItem("redirectAfterLogin", "/stale-page");
    renderAt("/auth/callback?next=%2Fbookings");
    await landedOn("/bookings");
    expect(saved()).toBeNull();
  });

  it("keeps the query and hash of a safe next", async () => {
    renderAt(`/auth/callback?next=${encodeURIComponent("/booking/confirm?x=1#details")}`);
    await landedOn("/booking/confirm?x=1#details");
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com/bookings",
    "javascript:alert(1)",
    "/auth/callback",
    "/login",
  ])("rejects unsafe next %p and goes to /salons", async (next) => {
    renderAt(`/auth/callback?next=${encodeURIComponent(next)}`);
    await landedOn("/salons");
  });

  it("falls back to the saved path when next is unsafe, then clears it", async () => {
    localStorage.setItem("redirectAfterLogin", "/bookings");
    renderAt(`/auth/callback?next=${encodeURIComponent("https://evil.com")}`);
    await landedOn("/bookings");
    expect(saved()).toBeNull();
  });

  it("defaults to /salons with no next and nothing saved", async () => {
    renderAt("/auth/callback");
    await landedOn("/salons");
  });

  it("sends a missing session to /login without touching the saved path", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    localStorage.setItem("redirectAfterLogin", "/bookings");
    renderAt("/auth/callback?next=%2Fbookings");
    await landedOn("/login");
    expect(saved()).toBe("/bookings");
  });
});

// ---------------------------------------------------------------------------
describe("profile completion preserves the destination", () => {
  const fillAndSave = async () => {
    await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "Amarjit" } });
    fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Sharma" } });
    fireEvent.click(screen.getByRole("button", { name: /save & continue/i }));
  };

  it("AuthCallback hands the safe destination to /complete-profile and keeps the saved path", async () => {
    mocks.profile = null; // incomplete profile
    localStorage.setItem("redirectAfterLogin", "/booking/confirm?x=1#details");
    render(
      <MemoryRouter initialEntries={[`/auth/callback?next=${encodeURIComponent("/booking/confirm?x=1#details")}`]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    await landedOn(`/complete-profile?next=${encodeURIComponent("/booking/confirm?x=1#details")}`);
    expect(saved()).toBe("/booking/confirm?x=1#details");
  });

  it("an unsafe next is not passed on to /complete-profile", async () => {
    mocks.profile = null;
    render(
      <MemoryRouter initialEntries={[`/auth/callback?next=${encodeURIComponent("//evil.com")}`]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    await landedOn("/complete-profile?next=%2Fsalons");
  });

  it("Google → callback → profile completion → original page, then the saved path is gone", async () => {
    mocks.profile = null;
    localStorage.setItem("redirectAfterLogin", "/bookings");
    renderAt("/auth/callback?next=%2Fbookings");
    await screen.findByRole("button", { name: /save & continue/i });
    await fillAndSave();
    await landedOn("/bookings");
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(saved()).toBeNull();
  });

  it("uses the saved path when /complete-profile has no next (e.g. email sign-in)", async () => {
    localStorage.setItem("redirectAfterLogin", "/my-profile");
    renderAt("/complete-profile");
    await fillAndSave();
    await landedOn("/my-profile");
    expect(saved()).toBeNull();
  });

  it("rejects an unsafe next on /complete-profile and clears the saved path", async () => {
    localStorage.setItem("redirectAfterLogin", "javascript:alert(1)");
    renderAt(`/complete-profile?next=${encodeURIComponent("https://evil.com")}`);
    await fillAndSave();
    await landedOn("/salons");
    expect(saved()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("email/password sign-in", () => {
  const signIn = () => {
    fireEvent.change(screen.getByPlaceholderText("your@email.com"), { target: { value: "customer@example.invalid" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "correct-horse" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
  };

  beforeEach(() => {
    mocks.signInWithPassword.mockResolvedValue({ data: { user: USER }, error: null });
  });

  it("returns to the saved path and clears it", async () => {
    mocks.profile = COMPLETE_PROFILE;
    localStorage.setItem("redirectAfterLogin", "/booking/confirm?x=1#details");
    renderAt("/auth");
    signIn();
    await landedOn("/booking/confirm?x=1#details");
    expect(saved()).toBeNull();
  });

  it("ignores and clears an unsafe saved path", async () => {
    mocks.profile = COMPLETE_PROFILE;
    localStorage.setItem("redirectAfterLogin", "//evil.com");
    renderAt("/auth");
    signIn();
    await landedOn("/salons");
    expect(saved()).toBeNull();
  });

  it("incomplete profile → /complete-profile, saved path kept for after completion", async () => {
    mocks.profile = null;
    localStorage.setItem("redirectAfterLogin", "/bookings");
    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <Routes>
          <Route path="/auth" element={<CustomerLogin />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    signIn();
    await landedOn("/complete-profile");
    expect(saved()).toBe("/bookings");
  });
});

// ---------------------------------------------------------------------------
describe("phone OTP sign-in (MobileOtpAuth)", () => {
  const signInWithPhone = async () => {
    fireEvent.click(screen.getByRole("button", { name: /continue with mobile/i }));
    fireEvent.change(screen.getByLabelText("10-digit mobile number"), { target: { value: "9876543210" } });
    fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
    await screen.findByLabelText("Digit 1 of 6");
    "123456".split("").forEach((d, i) => fireEvent.change(screen.getByLabelText(`Digit ${i + 1} of 6`), { target: { value: d } }));
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
  };

  beforeEach(() => {
    mocks.profile = COMPLETE_PROFILE;
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    mocks.verifyOtp.mockResolvedValue({ data: { user: USER, session: { user: USER } }, error: null });
  });

  it("returns to the saved path and clears it", async () => {
    localStorage.setItem("redirectAfterLogin", "/bookings");
    renderAt("/auth");
    await signInWithPhone();
    await landedOn("/bookings");
    expect(saved()).toBeNull();
  });

  it("ignores and clears an external saved path", async () => {
    localStorage.setItem("redirectAfterLogin", "https://evil.com");
    renderAt("/auth");
    await signInWithPhone();
    await landedOn("/salons");
    expect(saved()).toBeNull();
  });

  it("preserves the query and hash of a saved path", async () => {
    localStorage.setItem("redirectAfterLogin", "/booking/confirm?x=1#details");
    renderAt("/auth");
    await signInWithPhone();
    await landedOn("/booking/confirm?x=1#details");
    expect(saved()).toBeNull();
  });

  it("falls back to /salons when nothing is saved", async () => {
    renderAt("/auth");
    await signInWithPhone();
    await landedOn("/salons");
    expect(saved()).toBeNull();
  });

  it.each([
    ["protocol-relative", "//evil.com"],
    ["protocol-relative with path", "//evil.com/bookings"],
    ["backslash", "/\\evil.com"],
    ["absolute http", "http://evil.com/bookings"],
    ["javascript: URL", "javascript:alert(1)"],
    ["data: URL", "data:text/html,<script>alert(1)</script>"],
    ["relative (no leading slash)", "bookings"],
    ["empty", ""],
    ["control character", "/\t/evil.com"],
    ["sign-in loop", "/login"],
    ["callback loop", "/auth/callback?next=/bookings"],
  ])("rejects a %s saved path, goes to /salons and clears it", async (_label, value) => {
    localStorage.setItem("redirectAfterLogin", value);
    renderAt("/auth");
    await signInWithPhone();
    await landedOn("/salons");
    expect(saved()).toBeNull();
  });

  it("incomplete profile → /complete-profile, saved path kept for after completion", async () => {
    mocks.profile = null;
    localStorage.setItem("redirectAfterLogin", "/bookings");
    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <Routes>
          <Route path="/auth" element={<CustomerLogin />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    await signInWithPhone();
    await landedOn("/complete-profile");
    expect(saved()).toBe("/bookings");
  });

  it("no user after verification → /salons (unchanged)", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    localStorage.setItem("redirectAfterLogin", "/bookings");
    renderAt("/auth");
    await signInWithPhone();
    await landedOn("/salons");
  });

  it("OTP send and verify calls are unchanged", async () => {
    renderAt("/auth");
    await signInWithPhone();
    await landedOn("/salons");
    expect(mocks.signInWithOtp).toHaveBeenCalledTimes(1);
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({ phone: "+919876543210" });
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ phone: "+919876543210", token: "123456", type: "sms" });
  });

  it("a failed verification stays on the code step and does not navigate or touch the saved path", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { message: "Token has expired or is invalid", code: "otp_expired" } });
    localStorage.setItem("redirectAfterLogin", "/bookings");
    renderAt("/auth");
    await signInWithPhone();
    await waitFor(() => expect(mocks.verifyOtp).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId("location")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Digit 1 of 6")).toBeInTheDocument();
    expect(saved()).toBe("/bookings");
  });
});
