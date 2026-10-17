import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BookingFlowProvider, startBookingFlow, useBookingDraft } from "@/contexts/BookingDraftContext";
import { buildBookingServicePath, parseBookingUrlContext } from "@/lib/bookingUrlContext";
import CustomerLogin from "@/pages/CustomerLogin";
import CustomerRegister from "@/pages/CustomerRegister";
import AuthCallback from "@/pages/AuthCallback";
import CompleteProfile from "@/pages/CompleteProfile";
import type { Tables } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// Booking → sign-in → booking. A signed-out customer picks services on a salon
// page, is sent to /auth, and must come back to the same salon and services —
// in the same tab (sessionStorage draft) or another one (URL context only).
// No network: Supabase is mocked; no real accounts or bookings.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  profile: null as Record<string, unknown> | null,
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signUp: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  upsert: vi.fn(),
}));

// Salons and their services, as the public (anonymous) client would return them.
const db = vi.hoisted(() => ({
  salons: {
    "salon-1": { id: "salon-1", name: "Salon One", image_url: null },
    "salon-2": { id: "salon-2", name: "Salon Two", image_url: null },
    "salon-3": { id: "salon-3", name: "Salon Three", image_url: null },
  } as Record<string, Record<string, unknown>>,
  services: [
    { id: "svc-a", salon_id: "salon-1", name: "Haircut", price: 300, duration: 30 },
    { id: "svc-b", salon_id: "salon-1", name: "Shave", price: 150, duration: 20 },
    { id: "svc-x", salon_id: "salon-2", name: "Facial", price: 900, duration: 60 },
    // A salon offering more services than the old 20-id URL cap.
    ...Array.from({ length: 25 }, (_, i) => ({
      id: `svc-${String(i + 1).padStart(2, "0")}`,
      salon_id: "salon-3",
      name: `Service ${String(i + 1).padStart(2, "0")}`,
      price: 100,
      duration: 15,
    })),
  ],
  servicesError: false,
}));

vi.mock("@/integrations/supabase/publicClient", () => ({
  publicSupabase: {
    from: (table: string) => ({
      select: () => ({
        eq: (_column: string, value: string) => ({
          maybeSingle: async () => ({ data: table === "salons" ? db.salons[value] ?? null : null, error: null }),
          // Scoped to the salon, like the real `.eq("salon_id", salon.id)` query.
          order: async () =>
            table === "services" && db.servicesError
              ? { data: null, error: { message: "services unavailable" } }
              : {
                  data:
                    table === "services"
                      ? db.services.filter((s) => s.salon_id === value).map(({ id, name, price, duration }) => ({ id, name, price, duration }))
                      : [],
                  error: null,
                },
        }),
      }),
    }),
  },
}));

vi.mock("@/integrations/supabase/client", () => {
  // Chainable query stub: customer_profiles reads return the test's profile, anything else nothing.
  const query = (table: string) => {
    const q: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "order", "limit", "update"]) q[method] = () => q;
    q.maybeSingle = async () => ({ data: table === "customer_profiles" ? mocks.profile : null, error: null });
    q.upsert = mocks.upsert;
    return q;
  };
  return {
    supabase: {
      auth: {
        signInWithPassword: mocks.signInWithPassword,
        signInWithOAuth: mocks.signInWithOAuth,
        signInWithOtp: mocks.signInWithOtp,
        verifyOtp: mocks.verifyOtp,
        signUp: mocks.signUp,
        getSession: mocks.getSession,
        getUser: mocks.getUser,
        // passwordRecovery (imported by CustomerLogin) subscribes at import time.
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      from: query,
      channel: () => ({ on: function () { return this; }, subscribe: function () { return this; } }),
      removeChannel: vi.fn(),
      storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
    },
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: mocks.session, user: mocks.session?.user ?? null, profile: null, loading: false, profileLoading: false }),
}));
vi.mock("@/hooks/useErrorHandler", () => ({ useErrorHandler: () => ({ handleBookingError: vi.fn() }) }));
vi.mock("@/hooks/useSmartBarberAssignment", () => ({
  useSmartBarberAssignment: () => ({ assignBestBarber: vi.fn(), isAssigning: false, error: null, result: null, allBarbers: [] }),
}));
vi.mock("@/lib/phone", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/phone")>()),
  syncVerifiedPhoneToProfile: vi.fn(async () => undefined),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const USER = { id: "user-1", email: "customer@example.invalid", user_metadata: {}, phone: null, phone_confirmed_at: null };
const COMPLETE_PROFILE = { first_name: "Test", last_name: "Customer", phone: "+919876543210", gender: null };
const BOOKING = buildBookingServicePath("salon-1", ["svc-a", "svc-b"]);
const SALON_KEY = "snippr_booking_salon_id";
const DRAFT_KEY = "snippr_booking_draft";

function LocationProbe() {
  const { pathname, search, hash } = useLocation();
  return <div data-testid="location">{`${pathname}${search}${hash}`}</div>;
}

/** What the booking flow restored: "<salon id>|<selected service ids>". */
function BookingProbe() {
  const { salon, selectedServices, loadingSalon } = useBookingDraft();
  return <div data-testid="booking">{loadingSalon ? "loading" : `${salon?.id}|${selectedServices.map((s) => s.id).join(",")}`}</div>;
}

const renderApp = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/auth" element={<CustomerLogin />} />
        <Route path="/register" element={<CustomerRegister />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<BookingFlowProvider />}>
            <Route path="/booking/service" element={<BookingProbe />} />
          </Route>
          <Route path="/bookings" element={<div data-testid="bookings" />} />
        </Route>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

const landedOn = (expected: string) => waitFor(() => expect(screen.getByTestId("location").textContent).toBe(expected));
const restored = (expected: string) => waitFor(() => expect(screen.getByTestId("booking").textContent).toBe(expected));
const authUrlFor = (destination: string) => `/auth?next=${encodeURIComponent(destination)}`;
const saved = () => localStorage.getItem("redirectAfterLogin");

const draftFor = (salonId: string, serviceIds: string[], savedAt = Date.now()) =>
  JSON.stringify({
    salonId,
    savedAt,
    source: "app",
    selectedServices: serviceIds.map((id) => db.services.find((s) => s.id === id)),
  });

const blockStorage = () => {
  const fail = () => {
    throw new Error("storage blocked");
  };
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(fail);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(fail);
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(fail);
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mocks.session = { user: USER };
  mocks.profile = COMPLETE_PROFILE;
  db.servicesError = false;
  mocks.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  // Supabase's stored session matches the context's: signed-out tests are signed out in both.
  mocks.getSession.mockImplementation(async () => ({ data: { session: mocks.session } }));
  mocks.getUser.mockResolvedValue({ data: { user: USER } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
describe("booking URL context", () => {
  it("round-trips the salon and service ids", () => {
    expect(BOOKING).toBe("/booking/service?salon=salon-1&services=svc-a%2Csvc-b");
    expect(parseBookingUrlContext(BOOKING.split("?")[1])).toEqual({
      salonId: "salon-1",
      serviceIds: ["svc-a", "svc-b"],
      invalidServiceCount: 0,
    });
    expect(buildBookingServicePath("salon-1")).toBe("/booking/service?salon=salon-1");
  });

  it.each(["", "?services=svc-a", "?salon=", "?salon=../admin", "?salon=%3Cscript%3E", `?salon=${"a".repeat(65)}`])(
    "no context for a missing or malformed salon (%s)",
    (search) => {
      expect(parseBookingUrlContext(search)).toBeNull();
    },
  );

  it("counts malformed service ids instead of silently dropping them; empty entries and duplicates aren't selections", () => {
    expect(parseBookingUrlContext("?salon=salon-1&services=svc-a,,svc-a,bad%20id,svc-b,%3Cx%3E,")).toEqual({
      salonId: "salon-1",
      serviceIds: ["svc-a", "svc-b"],
      invalidServiceCount: 2,
    });
    expect(parseBookingUrlContext("?salon=salon-1&services=,,")).toEqual({ salonId: "salon-1", serviceIds: [], invalidServiceCount: 0 });
  });

  it("builder and parser agree on any number of services (no cap on either side)", () => {
    const ids = Array.from({ length: 25 }, (_, i) => `svc-${String(i + 1).padStart(2, "0")}`);
    const path = buildBookingServicePath("salon-3", ids);
    expect(parseBookingUrlContext(path.split("?")[1])).toEqual({ salonId: "salon-3", serviceIds: ids, invalidServiceCount: 0 });
  });
});

// ---------------------------------------------------------------------------
describe("startBookingFlow", () => {
  const services = db.services.filter((s) => s.salon_id === "salon-1") as unknown as Tables<"services">[];

  it("navigates with the salon and selected service ids and seeds this tab's draft", () => {
    const navigate = vi.fn();
    startBookingFlow("salon-1", navigate, services);
    expect(navigate).toHaveBeenCalledWith(BOOKING);
    expect(sessionStorage.getItem(SALON_KEY)).toBe("salon-1");
    const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY)!);
    expect(draft).toMatchObject({ salonId: "salon-1", source: "app" });
    expect(draft.selectedServices.map((s: { id: string }) => s.id)).toEqual(["svc-a", "svc-b"]);
  });

  it("QR entry with no preselected service: salon only, source qr kept in the draft", () => {
    const navigate = vi.fn();
    startBookingFlow("salon-1", navigate, undefined, "qr");
    expect(navigate).toHaveBeenCalledWith("/booking/service?salon=salon-1");
    expect(JSON.parse(sessionStorage.getItem(DRAFT_KEY)!)).toMatchObject({ salonId: "salon-1", source: "qr" });
  });

  it("still navigates with the booking context when storage is blocked", () => {
    blockStorage();
    const navigate = vi.fn();
    expect(() => startBookingFlow("salon-1", navigate, services)).not.toThrow();
    expect(navigate).toHaveBeenCalledWith(BOOKING);
  });
});

// ---------------------------------------------------------------------------
describe("ProtectedRoute", () => {
  it("signed out: saves the full booking destination and passes it to /auth as ?next=", async () => {
    mocks.session = null;
    renderApp(`${BOOKING}#top`);
    // /auth renders the sign-in page; its Create account link shows the ?next= it received.
    expect(await screen.findByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      `/register?next=${encodeURIComponent(`${BOOKING}#top`)}`,
    );
    expect(saved()).toBe(`${BOOKING}#top`);
  });

  it("signed out with storage blocked: the destination still reaches the sign-in page", async () => {
    mocks.session = null;
    blockStorage();
    renderApp(BOOKING);
    expect(await screen.findByRole("link", { name: "Create account" })).toHaveAttribute("href", `/register?next=${encodeURIComponent(BOOKING)}`);
  });

  it("signed out on another protected page keeps today's behaviour, plus ?next=", async () => {
    mocks.session = null;
    render(
      <MemoryRouter initialEntries={["/bookings?tab=upcoming"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/bookings" element={<div data-testid="bookings" />} />
          </Route>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    await landedOn(authUrlFor("/bookings?tab=upcoming"));
    expect(saved()).toBe("/bookings?tab=upcoming");
  });

  it("signed in: renders the protected page", async () => {
    renderApp("/bookings");
    expect(await screen.findByTestId("bookings")).toBeInTheDocument();
    expect(saved()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("BookingFlowProvider restores the booking", () => {
  it("same tab: this tab's fresh draft wins (unchanged behaviour)", async () => {
    sessionStorage.setItem(SALON_KEY, "salon-1");
    sessionStorage.setItem(DRAFT_KEY, draftFor("salon-1", ["svc-b"]));
    renderApp(buildBookingServicePath("salon-1", ["svc-a"]));
    await restored("salon-1|svc-b");
    await new Promise((r) => setTimeout(r, 20)); // services load must not override the draft
    expect(screen.getByTestId("booking").textContent).toBe("salon-1|svc-b");
  });

  it("no URL context: falls back to the salon and draft this tab saved (unchanged behaviour)", async () => {
    sessionStorage.setItem(SALON_KEY, "salon-1");
    sessionStorage.setItem(DRAFT_KEY, draftFor("salon-1", ["svc-a"]));
    renderApp("/booking/service");
    await restored("salon-1|svc-a");
  });

  it("another tab (no sessionStorage): rebuilds salon and services from the URL", async () => {
    renderApp(BOOKING);
    await restored("salon-1|svc-a,svc-b");
    expect(sessionStorage.getItem(SALON_KEY)).toBe("salon-1"); // later steps and refreshes keep working
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("expired draft: the URL selection is used instead", async () => {
    sessionStorage.setItem(SALON_KEY, "salon-1");
    sessionStorage.setItem(DRAFT_KEY, draftFor("salon-1", ["svc-b"], Date.now() - 3 * 60 * 60 * 1000));
    renderApp(buildBookingServicePath("salon-1", ["svc-a"]));
    await restored("salon-1|svc-a");
  });

  it("draft for a different salon: discarded; the URL's salon and services are used", async () => {
    sessionStorage.setItem(SALON_KEY, "salon-2");
    sessionStorage.setItem(DRAFT_KEY, draftFor("salon-2", ["svc-x"]));
    renderApp(buildBookingServicePath("salon-1", ["svc-a"]));
    await restored("salon-1|svc-a");
    expect(sessionStorage.getItem(SALON_KEY)).toBe("salon-1");
  });

  it("storage blocked: rebuilds from the URL without crashing", async () => {
    blockStorage();
    renderApp(BOOKING);
    await restored("salon-1|svc-a,svc-b");
  });

  it("a service from another salon is never selected, and the customer is told", async () => {
    renderApp(buildBookingServicePath("salon-1", ["svc-a", "svc-x"]));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/aren't available/)));
    expect(screen.getByTestId("booking").textContent).toBe("salon-1|svc-a");
  });

  it("only unknown services: nothing is selected", async () => {
    renderApp(buildBookingServicePath("salon-1", ["svc-x", "nope"]));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/aren't available/)));
    expect(screen.getByTestId("booking").textContent).toBe("salon-1|");
  });

  it("more than 20 selected services: all of them are restored in another tab", async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `svc-${String(i + 1).padStart(2, "0")}`);
    const navigate = vi.fn();
    startBookingFlow("salon-3", navigate, ids.map((id) => db.services.find((s) => s.id === id)) as unknown as Tables<"services">[]);
    sessionStorage.clear(); // the other tab has none of this
    renderApp(navigate.mock.calls[0][0]);
    await restored(`salon-3|${ids.join(",")}`);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("services query fails while URL services are pending: the customer is told, nothing is selected", async () => {
    db.servicesError = true;
    renderApp(BOOKING);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("We couldn't load this salon's services. Please choose your services again."));
    expect(screen.getByTestId("booking").textContent).toBe("salon-1|");
  });

  it("services query fails with no URL services pending: no extra message (unchanged behaviour)", async () => {
    db.servicesError = true;
    sessionStorage.setItem(SALON_KEY, "salon-1");
    sessionStorage.setItem(DRAFT_KEY, draftFor("salon-1", ["svc-a"]));
    renderApp("/booking/service");
    await restored("salon-1|svc-a");
    await new Promise((r) => setTimeout(r, 20));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("a malformed service id: the valid ones are selected and the customer is told", async () => {
    renderApp("/booking/service?salon=salon-1&services=svc-a,bad%20id");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/aren't available/)));
    expect(screen.getByTestId("booking").textContent).toBe("salon-1|svc-a");
  });

  it("only malformed service ids: nothing is selected and the customer is told", async () => {
    renderApp("/booking/service?salon=salon-1&services=bad%20id,%3Cx%3E");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/aren't available/)));
    expect(screen.getByTestId("booking").textContent).toBe("salon-1|");
  });

  it("empty entries and duplicates in the URL are not reported as unavailable", async () => {
    renderApp("/booking/service?salon=salon-1&services=svc-a,,svc-a,");
    await restored("salon-1|svc-a");
    await new Promise((r) => setTimeout(r, 20));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("a fresh same-tab draft still wins over malformed URL services (no message)", async () => {
    sessionStorage.setItem(SALON_KEY, "salon-1");
    sessionStorage.setItem(DRAFT_KEY, draftFor("salon-1", ["svc-b"]));
    renderApp("/booking/service?salon=salon-1&services=bad%20id");
    await restored("salon-1|svc-b");
    await new Promise((r) => setTimeout(r, 20));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("unknown salon: existing 'could not load' handling → /salons", async () => {
    renderApp(buildBookingServicePath("salon-404", ["svc-a"]));
    await landedOn("/salons");
    expect(toast.error).toHaveBeenCalledWith("Could not load salon details.");
  });

  it("malformed salon and nothing saved: existing 'start from a salon page' handling → /salons", async () => {
    renderApp("/booking/service?salon=..%2Fadmin&services=svc-a");
    await landedOn("/salons");
    expect(toast.error).toHaveBeenCalledWith("Start a booking from a salon page first.");
  });
});

// ---------------------------------------------------------------------------
describe("sign-in methods return to the booking", () => {
  const BOOK_A = buildBookingServicePath("salon-1", ["svc-a"]);

  const emailSignIn = () => {
    fireEvent.change(screen.getByPlaceholderText("your@email.com"), { target: { value: "customer@example.invalid" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "correct-horse" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
  };

  beforeEach(() => {
    mocks.session = null;
    mocks.signInWithPassword.mockImplementation(async () => {
      mocks.session = { user: USER };
      return { data: { user: USER }, error: null };
    });
  });

  it("email/password, same tab: booking URL → /auth → back with the services", async () => {
    startBookingFlow("salon-1", vi.fn(), db.services.slice(0, 1) as unknown as Tables<"services">[]);
    renderApp(BOOK_A);
    await screen.findByPlaceholderText("your@email.com"); // the gate redirects once it finds no stored session
    emailSignIn();
    await restored("salon-1|svc-a");
    expect(saved()).toBeNull(); // consumed
  });

  it("email/password, other tab: only the sign-in URL survives, the booking is rebuilt", async () => {
    renderApp(authUrlFor(BOOK_A)); // fresh tab: no sessionStorage, nothing saved
    emailSignIn();
    await restored("salon-1|svc-a");
  });

  it("email/password, incomplete profile: via /complete-profile, then the booking", async () => {
    mocks.profile = null;
    renderApp(authUrlFor(BOOK_A));
    emailSignIn();
    await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
    fireEvent.change(await screen.findByPlaceholderText("John"), { target: { value: "Test" } });
    fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Customer" } });
    fireEvent.click(screen.getByRole("button", { name: /save & continue/i }));
    await restored("salon-1|svc-a");
  });

  it("Google: the OAuth callback URL carries the booking destination", async () => {
    renderApp(authUrlFor(BOOK_A));
    fireEvent.click(screen.getByRole("button", { name: /google/i }));
    await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(mocks.signInWithOAuth.mock.calls[0][0].options.redirectTo).toBe(
      `${window.location.origin}/auth/callback?next=${encodeURIComponent(BOOK_A)}`,
    );
  });

  it("/auth/callback with a booking ?next= in another tab (the Google return URL): back to the booking", async () => {
    mocks.session = { user: USER };
    renderApp(`/auth/callback?next=${encodeURIComponent(BOOK_A)}`);
    await restored("salon-1|svc-a");
  });

  it("Google callback, new user: /complete-profile carries the booking destination", async () => {
    mocks.session = { user: USER };
    mocks.profile = null;
    renderApp(`/auth/callback?next=${encodeURIComponent(BOOK_A)}`);
    await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
    fireEvent.change(await screen.findByPlaceholderText("John"), { target: { value: "Test" } });
    fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Customer" } });
    fireEvent.click(screen.getByRole("button", { name: /save & continue/i }));
    await restored("salon-1|svc-a");
  });

  it("phone OTP: back to the booking", async () => {
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    mocks.verifyOtp.mockImplementation(async () => {
      mocks.session = { user: USER };
      return { data: { user: USER, session: { user: USER } }, error: null };
    });
    renderApp(authUrlFor(BOOK_A));
    fireEvent.click(screen.getByRole("button", { name: /continue with mobile/i }));
    fireEvent.change(screen.getByLabelText("10-digit mobile number"), { target: { value: "9876543210" } });
    fireEvent.click(screen.getByRole("button", { name: /send otp/i }));
    await screen.findByLabelText("Digit 1 of 6");
    "123456".split("").forEach((d, i) => fireEvent.change(screen.getByLabelText(`Digit ${i + 1} of 6`), { target: { value: d } }));
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await restored("salon-1|svc-a");
  });

  it("an unsafe ?next= on /auth is ignored (no open redirect)", async () => {
    renderApp(`/auth?next=${encodeURIComponent("https://evil.example/booking/service?salon=salon-1")}`);
    emailSignIn();
    await landedOn("/salons");
  });
});

// ---------------------------------------------------------------------------
describe("registration keeps the booking destination", () => {
  const BOOK_A = buildBookingServicePath("salon-1", ["svc-a"]);

  const register = () => {
    fireEvent.change(screen.getByPlaceholderText("John"), { target: { value: "Test" } });
    fireEvent.change(screen.getByPlaceholderText("Doe"), { target: { value: "Customer" } });
    fireEvent.change(screen.getByPlaceholderText("john.doe@example.com"), { target: { value: "customer@example.invalid" } });
    for (const input of screen.getAllByPlaceholderText("••••••••")) fireEvent.change(input, { target: { value: "long-enough-pw" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
  };

  beforeEach(() => {
    mocks.session = null;
    mocks.signUp.mockResolvedValue({ data: { user: USER }, error: null });
  });

  it("the confirmation link returns through /auth/callback with the booking destination", async () => {
    renderApp(`/register?next=${encodeURIComponent(BOOK_A)}`);
    register();
    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledTimes(1));
    expect(mocks.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(
      `${window.location.origin}/auth/callback?next=${encodeURIComponent(BOOK_A)}`,
    );
    // …and the "please sign in" step still carries it.
    await landedOn(`/login?next=${encodeURIComponent(BOOK_A)}`);
  });

  const DEFAULT_LINK = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/salons")}`;

  it("an older saved path is never put in the email link; the safe default is used", async () => {
    localStorage.setItem("redirectAfterLogin", "/my-profile"); // e.g. left over from days ago
    renderApp("/register");
    register();
    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledTimes(1));
    expect(mocks.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(DEFAULT_LINK);
  });

  it("no destination at all: the safe default", async () => {
    renderApp("/register");
    register();
    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledTimes(1));
    expect(mocks.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(DEFAULT_LINK);
  });

  it.each(["https://evil.example/", "//evil.example", "/login"])(
    "an unsafe ?next=%s is never put in the email link (safe default instead)",
    async (next) => {
      localStorage.setItem("redirectAfterLogin", BOOK_A);
      renderApp(`/register?next=${encodeURIComponent(next)}`);
      register();
      await waitFor(() => expect(mocks.signUp).toHaveBeenCalledTimes(1));
      expect(mocks.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(DEFAULT_LINK);
    },
  );

  it("an explicit ?next= wins over an older saved path", async () => {
    localStorage.setItem("redirectAfterLogin", "/my-profile");
    renderApp(`/register?next=${encodeURIComponent(BOOK_A)}`);
    register();
    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledTimes(1));
    expect(mocks.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(
      `${window.location.origin}/auth/callback?next=${encodeURIComponent(BOOK_A)}`,
    );
  });
});
