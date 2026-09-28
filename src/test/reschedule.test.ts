import { describe, it, expect, vi } from "vitest";
import {
  addDaysISO,
  buildRescheduleDates,
  canRescheduleStatus,
  formatISODate,
  getISTDateISO,
  mapRescheduleError,
  overlapsExisting,
  rescheduleBooking,
  type RescheduleRpcClient,
} from "@/lib/reschedule";

describe("IST date handling", () => {
  it("uses the India calendar day, not the device/UTC day", () => {
    // 20:00 UTC on 27 Sep is 01:30 IST on 28 Sep.
    expect(getISTDateISO(new Date("2026-09-27T20:00:00Z"))).toBe("2026-09-28");
    // 18:00 UTC on 28 Sep is still 23:30 IST on 28 Sep.
    expect(getISTDateISO(new Date("2026-09-28T18:00:00Z"))).toBe("2026-09-28");
  });

  it("adds days without shifting across month boundaries", () => {
    expect(addDaysISO("2026-09-28", 0)).toBe("2026-09-28");
    expect(addDaysISO("2026-09-28", 3)).toBe("2026-10-01");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("formats Monday 28 September as Monday 28 September", () => {
    expect(formatISODate("2026-09-28", { weekday: "long", day: "numeric", month: "long" })).toMatch(/Monday.*28.*September/);
  });

  it("builds today .. today+30 inclusive, matching the booking flow window", () => {
    const dates = buildRescheduleDates("2026-09-28");
    expect(dates[0]).toBe("2026-09-28");
    expect(dates).toHaveLength(31);
    expect(dates[30]).toBe("2026-10-28");
    expect(dates.every((d) => d >= "2026-09-28")).toBe(true);
  });
});

describe("status rules", () => {
  it.each(["pending", "waiting", "Pending", " waiting "])("allows %s", (status) => {
    expect(canRescheduleStatus(status)).toBe(true);
  });

  it.each(["cancelled", "canceled", "rejected", "completed", "done", "accepted", "confirmed", "in_progress", "", null])(
    "refuses %s",
    (status) => {
      expect(canRescheduleStatus(status as string | null)).toBe(false);
    },
  );
});

describe("overlapsExisting", () => {
  const self = { id: "self", booking_time: "10:00:00", duration: 60 };

  it("never conflicts with the booking being rescheduled", () => {
    expect(overlapsExisting("10:30:00", 60, [self], "self")).toBe(false);
    expect(overlapsExisting("11:00:00", 60, [self], "self")).toBe(false);
  });

  it("rejects an exact-slot clash with another booking", () => {
    expect(overlapsExisting("11:00:00", 30, [self, { id: "b", booking_time: "11:00:00", duration: 30 }], "self")).toBe(true);
  });

  it("rejects a slot that runs into another booking's service duration", () => {
    const other = { id: "b", booking_time: "11:00:00", duration: 60 };
    expect(overlapsExisting("11:30:00", 30, [other], "self")).toBe(true); // inside 11:00-12:00
    expect(overlapsExisting("10:30:00", 60, [other], "self")).toBe(true); // 10:30-11:30 hits 11:00
    expect(overlapsExisting("10:30:00", 30, [other], "self")).toBe(false); // ends exactly at 11:00
    expect(overlapsExisting("12:00:00", 30, [other], "self")).toBe(false);
  });

  it("defaults missing durations to one 30-minute slot", () => {
    const other = { id: "b", booking_time: "11:00", duration: null };
    expect(overlapsExisting("11:00:00", 30, [other], "self")).toBe(true);
    expect(overlapsExisting("11:30:00", 30, [other], "self")).toBe(false);
  });
});

type RpcResponse = { data: unknown; error: { code?: string; message?: string } | null };

const rpcClient = (response: RpcResponse | Error) => {
  const maybeSingle = vi.fn((): Promise<RpcResponse> => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)));
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => ({ maybeSingle }));
  const client: RescheduleRpcClient = { rpc };
  return { client, rpc };
};

describe("rescheduleBooking", () => {
  it("calls the RPC for the exact booking id with HH:MM:SS time and returns the committed values", async () => {
    const { client, rpc } = rpcClient({
      data: { rescheduled_id: "bk-1", new_booking_date: "2026-09-29", new_booking_time: "11:00:00" },
      error: null,
    });
    const result = await rescheduleBooking(client, { bookingId: "bk-1", date: "2026-09-29", time: "11:00" });
    expect(rpc).toHaveBeenCalledWith("reschedule_customer_booking", {
      p_booking_id: "bk-1",
      p_new_date: "2026-09-29",
      p_new_time: "11:00:00",
    });
    expect(result).toEqual({ ok: true, bookingId: "bk-1", bookingDate: "2026-09-29", bookingTime: "11:00:00" });
  });

  it("reports a conflicting slot as slot_unavailable", async () => {
    const { client } = rpcClient({ data: null, error: { code: "23505", message: "slot_unavailable" } });
    const result = await rescheduleBooking(client, { bookingId: "bk-1", date: "2026-09-29", time: "11:00:00" });
    expect(result).toMatchObject({ ok: false, reason: "slot_unavailable" });
  });

  it("treats another customer's booking as not found (no success)", async () => {
    const { client } = rpcClient({ data: null, error: { code: "P0002", message: "booking_not_found" } });
    const result = await rescheduleBooking(client, { bookingId: "someone-else", date: "2026-09-29", time: "11:00:00" });
    expect(result).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("refuses cancelled/completed bookings reported by the server", async () => {
    const { client } = rpcClient({ data: null, error: { code: "P0001", message: "booking_not_reschedulable" } });
    const result = await rescheduleBooking(client, { bookingId: "bk-1", date: "2026-09-29", time: "11:00:00" });
    expect(result).toMatchObject({ ok: false, reason: "not_reschedulable" });
  });

  it("never reports success on a database/network failure", async () => {
    const { client } = rpcClient({ data: null, error: { code: "PGRST000", message: "connection error" } });
    expect(await rescheduleBooking(client, { bookingId: "bk-1", date: "2026-09-29", time: "11:00:00" })).toMatchObject({
      ok: false,
      reason: "unknown",
    });

    const thrown = rpcClient(new Error("network down"));
    expect(await rescheduleBooking(thrown.client, { bookingId: "bk-1", date: "2026-09-29", time: "11:00:00" })).toMatchObject({
      ok: false,
    });

    const empty = rpcClient({ data: null, error: null });
    expect(await rescheduleBooking(empty.client, { bookingId: "bk-1", date: "2026-09-29", time: "11:00:00" })).toMatchObject({
      ok: false,
    });
  });

  it("rejects a response for a different booking id", async () => {
    const { client } = rpcClient({
      data: { rescheduled_id: "other", new_booking_date: "2026-09-29", new_booking_time: "11:00:00" },
      error: null,
    });
    expect(await rescheduleBooking(client, { bookingId: "bk-1", date: "2026-09-29", time: "11:00:00" })).toMatchObject({ ok: false });
  });

  it("maps the server's validation keys", () => {
    expect(mapRescheduleError({ message: "salon_closed" })).toBe("invalid_selection");
    expect(mapRescheduleError({ message: "time_in_past" })).toBe("invalid_selection");
    expect(mapRescheduleError({ message: "same_slot" })).toBe("same_slot");
    expect(mapRescheduleError({ code: "28000", message: "not_authenticated" })).toBe("not_authenticated");
  });
});
