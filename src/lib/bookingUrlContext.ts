/**
 * Booking context carried in the /booking/service URL.
 *
 * startBookingFlow puts the salon and the services chosen on the salon page in
 * the URL, so the login gate's saved return path brings them back even where the
 * tab's sessionStorage draft isn't available (sign-in finished in another tab, an
 * expired draft, blocked storage).
 *
 * URL values are untrusted: only a conservative id shape is accepted here, the
 * salon must still load from Supabase, and BookingFlowProvider selects only
 * services that belong to that salon.
 */

export const BOOKING_SALON_PARAM = "salon";
export const BOOKING_SERVICES_PARAM = "services";

const BOOKING_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * `serviceIds`: the well-formed ids, de-duplicated, in URL order. No count limit on
 * either side — the builder writes every selected id and the parser reads them all;
 * the selection is bounded by the salon's own services when it's applied.
 * `invalidServiceCount`: entries that aren't a well-formed id, so the caller can say
 * that part of the selection couldn't be restored (empty entries aren't counted).
 */
export type BookingUrlContext = { salonId: string; serviceIds: string[]; invalidServiceCount: number };

/** /booking/service carrying the salon and selected service ids. */
export function buildBookingServicePath(salonId: string, serviceIds: string[] = []): string {
  const params = new URLSearchParams({ [BOOKING_SALON_PARAM]: salonId });
  if (serviceIds.length > 0) params.set(BOOKING_SERVICES_PARAM, serviceIds.join(","));
  return `/booking/service?${params.toString()}`;
}

/** The booking context in a /booking/service query string, or null when there's no well-formed salon id. */
export function parseBookingUrlContext(search: string): BookingUrlContext | null {
  const params = new URLSearchParams(search);
  const salonId = params.get(BOOKING_SALON_PARAM);
  if (!salonId || !BOOKING_ID_PATTERN.test(salonId)) return null;
  const entries = (params.get(BOOKING_SERVICES_PARAM) ?? "").split(",").filter((entry) => entry !== "");
  const valid = entries.filter((id) => BOOKING_ID_PATTERN.test(id));
  return { salonId, serviceIds: [...new Set(valid)], invalidServiceCount: entries.length - valid.length };
}
