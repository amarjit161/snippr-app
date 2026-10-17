import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import QueueTracker from "@/components/QueueTracker";

// ---------------------------------------------------------------------------
// QueueTracker renders on public pages such as /salons. It only needs the
// device position for an active entry's travel-time hint, so it must not ask
// the browser for location until such an entry exists. Supabase is mocked.
// ---------------------------------------------------------------------------
type Result = { data: unknown; error: { code?: string; message: string } | null };

const mocks = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  myBooking: { data: null, error: null } as Result,
  geoOptions: [] as ({ enabled?: boolean } | undefined)[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    const q: Record<string, unknown> = {
      select: () => q,
      update: () => q,
      maybeSingle: async () => (table === "bookings" ? mocks.myBooking : { data: null, error: null }),
      then: (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve, reject),
    };
    for (const method of ["eq", "in", "order", "limit"]) q[method] = () => q;
    return q;
  };
  return {
    supabase: {
      from,
      channel: () => {
        const channel = { on: () => channel, subscribe: () => channel };
        return channel;
      },
      removeChannel: vi.fn(),
    },
  };
});

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/hooks/useGeolocation", () => ({
  useGeolocation: (options?: { enabled?: boolean }) => {
    mocks.geoOptions.push(options);
    return { location: null, status: "idle", error: null, request: () => {} };
  },
  estimateTravelMinutes: () => 10,
}));
vi.mock("@/services/emailService", () => ({ sendBookingEmail: vi.fn(async () => undefined) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn(), error: vi.fn() }) }));

const ACTIVE_BOOKING = {
  id: "booking-1",
  salon_id: "salon-1",
  customer_id: "user-1",
  service_id: "svc-a",
  position: 1,
  status: "waiting",
  created_at: "2026-10-16T10:00:00Z",
  booking_date: "2026-10-16",
  booking_time: "10:30:00",
  services: { id: "svc-a", name: "Haircut", price: 300, duration: 30 },
  salons: { id: "salon-1", name: "Salon One", latitude: null, longitude: null, address: "Somewhere", location: null, owner_id: "owner-1" },
};

const lastEnabled = () => mocks.geoOptions[mocks.geoOptions.length - 1]?.enabled;

beforeEach(() => {
  mocks.user = null;
  mocks.myBooking = { data: null, error: null };
  mocks.geoOptions = [];
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("QueueTracker location lookup", () => {
  it("signed out (e.g. a /salons visitor): location is never enabled", async () => {
    render(<QueueTracker />);
    await act(async () => {});
    expect(mocks.geoOptions.length).toBeGreaterThan(0);
    expect(mocks.geoOptions.every((o) => o?.enabled === false)).toBe(true);
  });

  it("signed in without an active entry: still not enabled", async () => {
    mocks.user = { id: "user-1", email: "customer@example.invalid" };
    render(<QueueTracker />);
    await act(async () => {});
    expect(mocks.geoOptions.every((o) => o?.enabled === false)).toBe(true);
  });

  it("with an active entry: enabled, so the travel-time hint keeps working", async () => {
    mocks.user = { id: "user-1", email: "customer@example.invalid" };
    mocks.myBooking = { data: ACTIVE_BOOKING, error: null };
    render(<QueueTracker />);
    await waitFor(() => expect(lastEnabled()).toBe(true));
    expect(mocks.geoOptions[0]?.enabled).toBe(false); // nothing before the entry loaded
  });
});
