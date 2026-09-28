// Only bookings nobody has acted on yet can move. This is the complement of
// Dashboard's RESCHEDULE_LOCKED_STATUSES (accepted, confirmed, in_progress,
// done, completed) within the active statuses, and it excludes the terminal
// cancelled / rejected states. reschedule_customer_booking() enforces the
// same set server-side.
export const RESCHEDULABLE_STATUSES = new Set(["pending", "waiting"]);

// Statuses that still occupy a stylist's time — the union of what the
// booking flow, useSlotAvailability and the RPC treat as "taken".
export const SLOT_BLOCKING_STATUSES = ["pending", "waiting", "confirmed", "accepted", "in_progress"];

// Same window as BookingDraftContext getMinDate/getMaxDate (today .. +30).
export const RESCHEDULE_WINDOW_DAYS = 30;

export const DEFAULT_SLOT_MINUTES = 30;

export const normalizeBookingStatus = (status?: string | null) => {
  const normalized = String(status || "").trim().toLowerCase().replace(/\s+/g, "_");
  return normalized === "canceled" ? "cancelled" : normalized;
};

export const canRescheduleStatus = (status?: string | null) =>
  RESCHEDULABLE_STATUSES.has(normalizeBookingStatus(status));

/** Today's calendar date in India, as YYYY-MM-DD, regardless of device timezone. */
export const getISTDateISO = (now: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

/** Pure calendar arithmetic on YYYY-MM-DD strings (UTC-based, so no DST/offset drift). */
export const addDaysISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

export const buildRescheduleDates = (todayISO: string, windowDays = RESCHEDULE_WINDOW_DAYS) =>
  Array.from({ length: windowDays + 1 }, (_, i) => addDaysISO(todayISO, i));

/** Formats a YYYY-MM-DD string as the same calendar day on every device. */
export const formatISODate = (iso: string, options: Intl.DateTimeFormatOptions) => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { ...options, timeZone: "UTC" });
};

export const toMinutes = (time?: string | null) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(time || "").trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

export const formatTimeLabel = (time?: string | null) => {
  const minutes = toMinutes(time);
  if (minutes === null) return time || "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
};

export const sameSlotTime = (a?: string | null, b?: string | null) => {
  const am = toMinutes(a);
  return am !== null && am === toMinutes(b);
};

export interface OccupiedInterval {
  id: string;
  booking_time: string | null;
  duration: number | null;
}

/**
 * True when [slot, slot + duration) overlaps any other active booking of the
 * same stylist. The booking being rescheduled is excluded by id, so moving
 * 10:00 -> 10:30 is never blocked by the 10:00 booking itself.
 */
export const overlapsExisting = (
  slotTime: string,
  durationMinutes: number,
  occupied: OccupiedInterval[],
  selfId: string,
) => {
  const start = toMinutes(slotTime);
  if (start === null) return true;
  const end = start + Math.max(durationMinutes || DEFAULT_SLOT_MINUTES, 1);
  return occupied.some((other) => {
    if (other.id === selfId) return false;
    const otherStart = toMinutes(other.booking_time);
    if (otherStart === null) return false;
    const otherEnd = otherStart + Math.max(other.duration || DEFAULT_SLOT_MINUTES, 1);
    return otherStart < end && start < otherEnd;
  });
};

export type RescheduleFailureReason =
  | "slot_unavailable"
  | "not_reschedulable"
  | "not_found"
  | "invalid_selection"
  | "same_slot"
  | "not_authenticated"
  | "unknown";

export type RescheduleResult =
  | { ok: true; bookingId: string; bookingDate: string; bookingTime: string }
  | { ok: false; reason: RescheduleFailureReason; message: string };

const FAILURE_MESSAGES: Record<RescheduleFailureReason, string> = {
  slot_unavailable: "That slot is no longer available. Please choose another time.",
  not_reschedulable: "This booking can no longer be rescheduled.",
  not_found: "We couldn't find this booking on your account. Please refresh and try again.",
  invalid_selection: "That date or time isn't available at this salon. Please choose another slot.",
  same_slot: "That's your current slot. Please pick a different date or time.",
  not_authenticated: "Your session has expired. Please log in again.",
  unknown: "Unable to reschedule booking. Your original booking is unchanged — please try again.",
};

export const mapRescheduleError = (error: { code?: string; message?: string } | null | undefined): RescheduleFailureReason => {
  const key = String(error?.message || "").trim();
  switch (key) {
    case "slot_unavailable":
      return "slot_unavailable";
    case "booking_not_reschedulable":
      return "not_reschedulable";
    case "booking_not_found":
      return "not_found";
    case "invalid_date":
    case "invalid_time":
    case "time_in_past":
    case "salon_closed":
    case "missing_parameters":
      return "invalid_selection";
    case "same_slot":
      return "same_slot";
    case "not_authenticated":
      return "not_authenticated";
  }
  if (error?.code === "23505") return "slot_unavailable";
  if (error?.code === "28000") return "not_authenticated";
  return "unknown";
};

// The generated Database types don't include this RPC yet (they're produced
// from the live schema), so only the slice of the client used here is typed.
export interface RescheduleRpcClient {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => { maybeSingle: () => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> };
}

/**
 * Moves the caller's own booking via the reschedule_customer_booking RPC.
 * Resolves ok only when the database confirms the update.
 */
export async function rescheduleBooking(
  client: RescheduleRpcClient,
  params: { bookingId: string; date: string; time: string },
): Promise<RescheduleResult> {
  const time = /^\d{2}:\d{2}$/.test(params.time) ? `${params.time}:00` : params.time;
  try {
    const { data, error } = await client
      .rpc("reschedule_customer_booking", {
        p_booking_id: params.bookingId,
        p_new_date: params.date,
        p_new_time: time,
      })
      .maybeSingle();

    if (error || !data) {
      const reason = error ? mapRescheduleError(error) : "unknown";
      return { ok: false, reason, message: FAILURE_MESSAGES[reason] };
    }

    const row = data as { rescheduled_id: string; new_booking_date: string; new_booking_time: string };
    if (row.rescheduled_id !== params.bookingId) {
      return { ok: false, reason: "unknown", message: FAILURE_MESSAGES.unknown };
    }
    return { ok: true, bookingId: row.rescheduled_id, bookingDate: row.new_booking_date, bookingTime: row.new_booking_time };
  } catch {
    return { ok: false, reason: "unknown", message: FAILURE_MESSAGES.unknown };
  }
}
