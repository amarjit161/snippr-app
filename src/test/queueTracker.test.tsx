import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import QueueTracker from "@/components/QueueTracker";

// ---------------------------------------------------------------------------
// QueueTracker's "my active booking" lookup. It used to select
// customer_first_name / customer_last_name, which don't exist on `bookings`,
// so PostgREST rejected every request with HTTP 400 and the error was ignored.
// Supabase is mocked: no network, no real bookings.
// ---------------------------------------------------------------------------
type Result = { data: unknown; error: { code?: string; message: string } | null };
type Call = { table: string; select?: string; filters: [string, ...unknown[]][] };

const mocks = vi.hoisted(() => ({
  user: { id: "user-1", email: "customer@example.invalid" } as { id: string; email: string } | null,
  myBooking: { data: null, error: null } as Result,
  salonQueue: { data: [], error: null } as Result,
  calls: [] as Call[],
  realtime: null as null | ((payload: unknown) => void),
  sendBookingEmail: vi.fn(async () => undefined),
  toast: Object.assign(vi.fn(), { success: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    const call: Call = { table, filters: [] };
    mocks.calls.push(call);
    const q: Record<string, unknown> = {
      select: (columns: string) => {
        call.select = columns;
        return q;
      },
      update: () => q,
      maybeSingle: async () =>
        table === "bookings" ? mocks.myBooking : { data: { email: "owner@example.invalid" }, error: null },
      // Awaited directly: the salon queue list and the cancel update.
      then: (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(mocks.salonQueue).then(resolve, reject),
    };
    for (const method of ["eq", "in", "order", "limit"]) {
      q[method] = (...args: unknown[]) => {
        call.filters.push([method, ...args]);
        return q;
      };
    }
    return q;
  };
  return {
    supabase: {
      from,
      channel: () => {
        const channel = {
          on: (_event: string, _filter: unknown, callback: (payload: unknown) => void) => {
            mocks.realtime = callback;
            return channel;
          },
          subscribe: () => channel,
        };
        return channel;
      },
      removeChannel: vi.fn(),
    },
  };
});

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/hooks/useGeolocation", () => ({ useGeolocation: () => ({ location: null }), estimateTravelMinutes: () => 10 }));
vi.mock("@/services/emailService", () => ({ sendBookingEmail: mocks.sendBookingEmail }));
vi.mock("sonner", () => ({ toast: mocks.toast }));

const BOOKING = {
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

/** The fetchMyQueue request: the `bookings` read filtered by customer. */
const myQueueCalls = () =>
  mocks.calls.filter((c) => c.table === "bookings" && c.filters.some(([m, col]) => m === "eq" && col === "customer_id") && c.select);

/** Top-level columns of a PostgREST select (embedded relations excluded). */
const topLevelColumns = (select: string) =>
  select
    .replace(/\w+\s*\([^)]*\)/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** The `bookings` Row columns from the generated Supabase types. */
const bookingsRowColumns = () => {
  const types = readFileSync(path.resolve(__dirname, "../integrations/supabase/types.ts"), "utf8");
  const row = types.match(/\n {6}bookings: \{\s*\n {8}Row: \{([\s\S]*?)\n {8}\}/);
  if (!row) throw new Error("bookings Row not found in generated types");
  return [...row[1].matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);
};

const flush = () => act(async () => {});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: "user-1", email: "customer@example.invalid" };
  mocks.myBooking = { data: null, error: null };
  mocks.salonQueue = { data: [], error: null };
  mocks.calls.length = 0;
  mocks.realtime = null;
});

describe("QueueTracker: my active booking query", () => {
  it("requests no customer name columns (they don't exist on bookings)", async () => {
    render(<QueueTracker />);
    await flush();
    const [call] = myQueueCalls();
    expect(call.select).not.toMatch(/customer_first_name|customer_last_name/);
  });

  it("requests only columns that exist on bookings, per the generated types", async () => {
    render(<QueueTracker />);
    await flush();
    const columns = topLevelColumns(myQueueCalls()[0].select!);
    const known = bookingsRowColumns();
    expect(known.length).toBeGreaterThan(5); // the Row was really parsed
    expect(columns.filter((c) => !known.includes(c))).toEqual([]);
  });

  it("keeps every other field, the filters, ordering and limit", async () => {
    render(<QueueTracker />);
    await flush();
    const [call] = myQueueCalls();
    expect(topLevelColumns(call.select!)).toEqual([
      "id", "salon_id", "customer_id", "service_id", "position", "status", "created_at", "booking_date", "booking_time",
    ]);
    expect(call.select).toMatch(/services\s*\(id, name, price, duration\)/);
    expect(call.select).toMatch(/salons\s*\(id, name, latitude, longitude, address, location, owner_id\)/);
    expect(call.filters).toEqual([
      ["eq", "customer_id", "user-1"],
      ["in", "status", ["pending", "waiting", "in_progress"]],
      ["order", "created_at", { ascending: false }],
      ["limit", 1],
    ]);
  });
});

describe("QueueTracker: results", () => {
  it("an active booking shows the tracker", async () => {
    mocks.myBooking = { data: BOOKING, error: null };
    render(<QueueTracker />);
    expect(await screen.findByText("Salon One")).toBeInTheDocument();
    expect(screen.getByText("Haircut")).toBeInTheDocument();
  });

  it("no active booking: renders nothing and logs nothing (unchanged)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<QueueTracker />);
    await flush();
    expect(container).toBeEmptyDOMElement();
    expect(warn).not.toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("a query error is logged (code and message only), not treated as 'no booking'", async () => {
    mocks.myBooking = { data: null, error: { code: "42703", message: "column does not exist" } };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<QueueTracker />);
    await flush();

    expect(warn).toHaveBeenCalledWith("QUEUE_TRACKER_FETCH_FAILED", { code: "42703", message: "column does not exist" });
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain("user-1");
    expect(logged).not.toContain("customer@example.invalid");
    expect(container).toBeEmptyDOMElement();
    expect(mocks.toast.success).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("an error on a later refresh keeps the tracker and doesn't announce a completed service", async () => {
    mocks.myBooking = { data: { ...BOOKING, status: "in_progress" }, error: null };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<QueueTracker />);
    expect(await screen.findByText("In Progress ✂️")).toBeInTheDocument();

    mocks.myBooking = { data: null, error: { code: "PGRST000", message: "network" } };
    await act(async () => {
      mocks.realtime?.({ eventType: "UPDATE", new: { id: "other-booking", status: "waiting" } });
    });
    await flush();

    expect(warn).toHaveBeenCalledWith("QUEUE_TRACKER_FETCH_FAILED", { code: "PGRST000", message: "network" });
    expect(screen.getByText("In Progress ✂️")).toBeInTheDocument();
    expect(mocks.toast.success).not.toHaveBeenCalledWith(expect.stringMatching(/Service completed/), expect.anything());
    warn.mockRestore();
  });

  it("the booking finishing (no record, no error) still clears the tracker as before", async () => {
    mocks.myBooking = { data: { ...BOOKING, status: "in_progress" }, error: null };
    const { container } = render(<QueueTracker />);
    expect(await screen.findByText("In Progress ✂️")).toBeInTheDocument();

    mocks.myBooking = { data: null, error: null };
    await act(async () => {
      mocks.realtime?.({ eventType: "UPDATE", new: { id: "other-booking", status: "waiting" } });
    });
    await flush();

    expect(container).toBeEmptyDOMElement();
    expect(mocks.toast.success).toHaveBeenCalledWith(expect.stringMatching(/Service completed/), expect.anything());
  });
});

describe("QueueTracker: cancellation email", () => {
  it("uses the 'Customer' fallback name (no dependency on missing name columns)", async () => {
    mocks.myBooking = { data: BOOKING, error: null };
    render(<QueueTracker />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel Booking" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, Cancel" }));
    await waitFor(() => expect(mocks.sendBookingEmail).toHaveBeenCalledTimes(1));
    expect(mocks.sendBookingEmail).toHaveBeenCalledWith(
      "booking_cancelled",
      expect.objectContaining({ customerName: "Customer", bookingId: "booking-1", serviceName: "Haircut" }),
    );
  });
});
