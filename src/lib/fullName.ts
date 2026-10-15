/**
 * Booking customer name helpers. The confirm page collects one "Full name"
 * field but the booking stores first_name / last_name separately.
 */

/** First word → firstName, the rest (whitespace collapsed) → lastName. Ends are trimmed. */
export function splitFullName(value: string): { firstName: string; lastName: string } {
  const [firstName = "", ...rest] = value.trim().split(/\s+/).filter(Boolean);
  return { firstName, lastName: rest.join(" ") };
}

/** Stored names → one display string. */
export function formatFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}
