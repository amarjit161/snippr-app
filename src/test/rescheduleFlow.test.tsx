/* eslint-disable @typescript-eslint/no-explicit-any -- chainable Supabase query-builder fake; row shapes are intentionally loose */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ---------------------------------------------------------------------------
// In-memory stand-in for the bookings table + reschedule RPC, so the flow is
// exercised end to end: Dashboard -> modal -> RPC -> refetch -> list.
// ---------------------------------------------------------------------------
type Row = Record<string, any>;
const db: { bookings: Row[] } = { bookings: [] };
const rpcBehaviour: { next: null | ((args: any) => { data: any; error: any }) } = { next: null };
const rpcCalls: any[] = [];

const CUSTOMER_ID = "cust-1";

const defaultRpc = (args: any) => {
  const row = db.bookings.find((b) => b.id === args.p_booking_id && b.customer_id === CUSTOMER_ID);
  if (!row) return { data: null, error: { code: "P0002", message: "booking_not_found" } };
  if (!["pending", "waiting"].includes(row.status)) {
    return { data: null, error: { code: "P0001", message: "booking_not_reschedulable" } };
  }
  const clash = db.bookings.some(
    (b) =>
      b.id !== row.id &&
      b.stylist_id === row.stylist_id &&
      b.booking_date === args.p_new_date &&
      b.booking_time === args.p_new_time &&
      ["pending", "waiting", "confirmed", "accepted", "in_progress"].includes(b.status),
  );
  if (clash) return { data: null, error: { code: "23505", message: "slot_unavailable" } };
  row.booking_date = args.p_new_date;
  row.booking_time = args.p_new_time;
  return {
    data: { rescheduled_id: row.id, new_booking_date: args.p_new_date, new_booking_time: args.p_new_time },
    error: null,
  };
};

const makeQuery = (resolve: (state: { select: string; filters: Record<string, any> }) => { data: any; error: any }) => {
  const state = { select: "", filters: {} as Record<string, any> };
  const q: any = {};
  q.select = (cols: string) => ((state.select = cols), q);
  for (const m of ["eq", "neq", "in", "gte", "lte", "not"]) {
    q[m] = (col: string, val: any) => ((state.filters[`${m}:${col}`] = val), q);
  }
  q.order = () => q;
  q.limit = () => q;
  q.maybeSingle = () => Promise.resolve(resolve(state));
  q.single = () => Promise.resolve(resolve(state));
  q.then = (res: any, rej: any) => Promise.resolve(resolve(state)).then(res, rej);
  return q;
};

const fakeSupabase = {
  auth: {
    getUser: () => Promise.resolve({ data: { user: { id: CUSTOMER_ID } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  channel: () => {
    const ch: any = { on: () => ch, subscribe: () => ch, unsubscribe: () => {} };
    return ch;
  },
  removeChannel: () => {},
  from: (table: string) =>
    makeQuery(({ select, filters }) => {
      if (table === "bookings" && select.includes("customer_profiles")) {
        return { data: db.bookings.filter((b) => b.customer_id === filters["eq:customer_id"]).map((b) => ({ ...b })), error: null };
      }
      if (table === "bookings") {
        // RescheduleModal's same-stylist overlap lookup
        const rows = db.bookings.filter(
          (b) =>
            b.id !== filters["neq:id"] &&
            b.stylist_id === filters["eq:stylist_id"] &&
            b.booking_date === filters["eq:booking_date"] &&
            (filters["in:status"] as string[]).includes(b.status),
        );
        return { data: rows.map((b) => ({ id: b.id, booking_time: b.booking_time, services: b.services })), error: null };
      }
      return { data: table === "owners" ? { email: "owner@example.com" } : [], error: null };
    }),
  rpc: (name: string, args: any) => {
    rpcCalls.push({ name, args });
    const run = rpcBehaviour.next || defaultRpc;
    return { maybeSingle: () => Promise.resolve(run(args)) };
  },
};

vi.mock("@/integrations/supabase/client", () => ({ supabase: fakeSupabase }));
vi.mock("@/integrations/supabase/publicClient", () => ({ publicSupabase: fakeSupabase }));

// Real salon hours are 09:00-12:00 in these tests; the booking's own slot is
// reported taken by the (real) exact-slot rule, like useSlotAvailability does.
vi.mock("@/hooks/useSlotAvailability", () => ({
  useSlotAvailability: (salonId: string, date: string, barberId?: string) => {
    const times = ["09:00:00", "09:30:00", "10:00:00", "10:30:00", "11:00:00", "11:30:00"];
    const slots = !salonId || !date
      ? []
      : times.map((timeValue) => ({
          timeValue,
          time: timeValue,
          available: !db.bookings.some(
            (b) =>
              b.stylist_id === barberId &&
              b.booking_date === date &&
              b.booking_time === timeValue &&
              ["pending", "waiting", "confirmed", "in_progress"].includes(b.status),
          ),
          bookedCount: 0,
          totalBarbers: 1,
        }));
    return { slots, loading: false, availableCount: 0, totalCount: slots.length, holidayInfo: null, lastUpdated: null, error: null, refresh: vi.fn() };
  },
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const sendBookingEmail = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/services/emailService", () => ({ sendBookingEmail }));

vi.mock("@/components/Header", () => ({ default: () => null }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: CUSTOMER_ID, email: "cust@example.com" }, signOut: vi.fn(), profile: null }),
}));

const { default: Dashboard } = await import("@/pages/Dashboard");

const baseBooking = (overrides: Row = {}): Row => ({
  id: "bk-1",
  salon_id: "salon-1",
  customer_id: CUSTOMER_ID,
  service_id: "svc-1",
  stylist_id: "barber-1",
  status: "pending",
  created_at: "2026-09-20T10:00:00Z",
  booking_date: "2026-09-28",
  booking_time: "10:00:00",
  otp: "1234",
  services: { id: "svc-1", name: "Haircut", price: 300, duration: 30 },
  salons: { id: "salon-1", name: "Snip Studio", owner_id: "owner-1", address: "MG Road" },
  barbers: { id: "barber-1", name: "Ravi" },
  customer_profiles: { first_name: "Asha", last_name: "K", phone: "9999999999", email: "cust@example.com" },
  ...overrides,
});

const renderDashboard = () =>
  render(
    <MemoryRouter initialEntries={["/bookings"]}>
      <Dashboard />
    </MemoryRouter>,
  );

const openReschedule = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Manage" }));
  return screen.findByRole("dialog");
};

describe("Reschedule flow (Dashboard -> modal -> RPC)", () => {
  beforeEach(() => {
    // 28 Sep 2026, 08:00 IST
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T02:30:00Z"));
    db.bookings = [baseBooking()];
    rpcBehaviour.next = null;
    rpcCalls.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the current booking, reschedules to a real free slot and refreshes the list", async () => {
    renderDashboard();
    expect(await screen.findByText(/10:00 AM/)).toBeInTheDocument();

    const dialog = await openReschedule();
    expect(within(dialog).getByTestId("current-date")).toHaveTextContent(/Mon.*28.*Sep/);
    expect(within(dialog).getByTestId("current-time")).toHaveTextContent("10:00 AM");

    // The current slot is shown but can't be picked; same-day 11:00 is free
    // even though this booking itself is at 10:00 (no self-conflict).
    expect(await within(dialog).findByRole("button", { name: /10:00 AM, your current slot/ })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: /^Tuesday,? 29 September/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: /^Monday,? 28 September/ }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "11:00 AM" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm reschedule" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Booking rescheduled successfully!"));
    expect(rpcCalls).toEqual([
      { name: "reschedule_customer_booking", args: { p_booking_id: "bk-1", p_new_date: "2026-09-28", p_new_time: "11:00:00" } },
    ]);
    expect(db.bookings[0]).toMatchObject({ booking_date: "2026-09-28", booking_time: "11:00:00" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText(/11:00 AM/)).toBeInTheDocument();
    expect(screen.queryByText(/10:00 AM/)).not.toBeInTheDocument();

    expect(sendBookingEmail).toHaveBeenCalledTimes(1);
    expect(sendBookingEmail).toHaveBeenCalledWith(
      "booking_rescheduled",
      expect.objectContaining({
        bookingId: "bk-1",
        bookingDate: "2026-09-28",
        timeSlot: "11:00 AM",
        oldDate: "2026-09-28",
        oldTime: "10:00 AM",
        salonName: "Snip Studio",
        serviceName: "Haircut",
        barberName: "Ravi",
      }),
    );
  });

  it("moves to another day and stores the exact YYYY-MM-DD the customer tapped", async () => {
    renderDashboard();
    const dialog = await openReschedule();
    fireEvent.click(within(dialog).getByRole("button", { name: /^Tuesday,? 29 September/ }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "10:00 AM" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm reschedule" }));
    await waitFor(() => expect(db.bookings[0].booking_date).toBe("2026-09-29"));
    expect(db.bookings[0].booking_time).toBe("10:00:00");
  });

  it("hides slots already taken by another booking of the same stylist, including its service duration", async () => {
    db.bookings.push(
      baseBooking({
        id: "bk-other",
        customer_id: "cust-2",
        booking_time: "11:00:00",
        services: { id: "svc-2", name: "Colour", price: 900, duration: 60 },
      }),
    );
    renderDashboard();
    const dialog = await openReschedule();
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "11:00 AM, unavailable" })).toBeDisabled());
    expect(within(dialog).getByRole("button", { name: "11:30 AM, unavailable" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "10:30 AM" })).toBeEnabled();
  });

  it("rejects a slot taken between viewing and confirming, and keeps the modal open", async () => {
    renderDashboard();
    const dialog = await openReschedule();
    fireEvent.click(within(dialog).getByRole("button", { name: /^Tuesday,? 29 September/ }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "11:00 AM" }));
    rpcBehaviour.next = () => ({ data: null, error: { code: "23505", message: "slot_unavailable" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm reschedule" }));

    expect(await within(dialog).findByText(/no longer available/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm reschedule" })).toBeDisabled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(sendBookingEmail).not.toHaveBeenCalled();
    expect(db.bookings[0]).toMatchObject({ booking_date: "2026-09-28", booking_time: "10:00:00" });
  });

  it("never shows success when the database update fails, and allows retry", async () => {
    renderDashboard();
    const dialog = await openReschedule();
    fireEvent.click(within(dialog).getByRole("button", { name: /^Tuesday,? 29 September/ }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "11:00 AM" }));
    rpcBehaviour.next = () => ({ data: null, error: { code: "PGRST000", message: "connection reset" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm reschedule" }));

    expect(await within(dialog).findByText(/original booking is unchanged/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    expect(sendBookingEmail).not.toHaveBeenCalled();
    expect(screen.getByText(/10:00 AM/, { selector: "span" })).toBeInTheDocument();

    // Retry with the same selection succeeds.
    rpcBehaviour.next = null;
    const confirm = within(dialog).getByRole("button", { name: "Confirm reschedule" });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Booking rescheduled successfully!"));
    expect(db.bookings[0]).toMatchObject({ booking_date: "2026-09-29", booking_time: "11:00:00" });
  });

  it("does not let a customer reschedule a booking the barber has accepted", async () => {
    db.bookings = [baseBooking({ status: "accepted" })];
    renderDashboard();
    expect(await screen.findByRole("button", { name: "Locked" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Manage" })).not.toBeInTheDocument();
  });

  it("does not offer reschedule on cancelled or completed bookings", async () => {
    db.bookings = [
      baseBooking({ id: "bk-c", status: "cancelled" }),
      baseBooking({ id: "bk-d", status: "completed", booking_date: "2026-09-20" }),
    ];
    renderDashboard();
    await waitFor(() => expect(screen.queryByText(/Snip Studio/)).toBeNull());
    expect(screen.queryByRole("button", { name: "Manage" })).not.toBeInTheDocument();
    expect(rpcCalls).toHaveLength(0);
  });

  it("surfaces a server refusal for another customer's booking without success", async () => {
    renderDashboard();
    const dialog = await openReschedule();
    fireEvent.click(within(dialog).getByRole("button", { name: /^Tuesday,? 29 September/ }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "11:00 AM" }));
    // e.g. the row changed owner / was never ours — the RPC reports not found.
    db.bookings[0].customer_id = "cust-2";
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm reschedule" }));
    expect(await within(dialog).findByText(/couldn't find this booking on your account/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    expect(db.bookings[0]).toMatchObject({ booking_date: "2026-09-28", booking_time: "10:00:00" });
  });
});
