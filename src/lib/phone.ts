/**
 * Shared helpers for Indian mobile-number phone auth (login OTP + phone change).
 *
 * Centralized here so MobileOtpAuth.tsx (login), CompleteProfile.tsx, and
 * MyProfile.tsx (change/add number) all validate, normalize, and sync phone
 * numbers the same way instead of duplicating this logic per-component.
 */
import { supabase } from '@/integrations/supabase/client';

/** Strips everything but digits and tolerates an accidentally-pasted "+91"/"91"/"091"
 * prefix so the user can never end up with +91 applied twice. */
export function sanitizeIndianPhoneInput(raw: string): string {
  let digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly.length > 10 && digitsOnly.startsWith('91')) {
    digitsOnly = digitsOnly.slice(digitsOnly.length - 10);
  }
  return digitsOnly.slice(0, 10);
}

export function isValidIndianMobile(tenDigits: string): boolean {
  return /^[6-9]\d{9}$/.test(tenDigits);
}

export function toE164India(tenDigits: string): string {
  return `+91${tenDigits}`;
}

/** Supabase Auth's `user.phone` is stored without a leading "+". Normalizes either
 * form to E.164 (e.g. "919876543210" or "+919876543210" -> "+919876543210") so it
 * can be safely compared against a customer_profiles.phone value. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

/**
 * Reads the current Supabase Auth user and, only if Auth reports a verified
 * phone (user.phone + phone_confirmed_at both set), writes it into
 * customer_profiles.phone — the single existing source of truth column for a
 * customer's phone (no separate "verified" column/table exists or is created).
 *
 * No-ops (no DB write) when:
 * - Auth has no phone, or the phone is not yet confirmed.
 * - The profile's phone already matches (avoids unnecessary overwrites).
 *
 * This never sends an OTP — it only persists a phone Supabase Auth has already
 * verified via signInWithOtp/verifyOtp or the authenticated-user phone-change flow.
 */
export async function syncVerifiedPhoneToProfile(userId: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.phone || !user.phone_confirmed_at) return null;

  const verifiedPhone = normalizePhone(user.phone);
  if (!verifiedPhone) return null;

  const { data: existing } = await supabase
    .from('customer_profiles')
    .select('phone')
    .eq('id', userId)
    .maybeSingle();

  if (normalizePhone(existing?.phone) === verifiedPhone) {
    return verifiedPhone; // Already in sync — nothing to write.
  }

  // Upsert only touches the `phone` column (Postgres ON CONFLICT DO UPDATE of the
  // given columns) — it will not clobber first_name/last_name/email/gender, and
  // creates the row if a customer_profiles entry doesn't exist yet.
  const { error } = await supabase
    .from('customer_profiles')
    .upsert({ id: userId, phone: verifiedPhone });

  if (error && import.meta.env.DEV) {
    console.error('syncVerifiedPhoneToProfile: failed to persist phone', error.message);
  }

  return verifiedPhone;
}

interface OtpErrorLike {
  message?: string;
  code?: string;
  status?: number;
}

/**
 * Maps a raw Supabase Auth / SMS-provider error (which can include a Twilio
 * trial-account message like "unverified... Trial accounts cannot send
 * messages to unverified numbers...") into a clean, user-facing message.
 * Never surfaces the raw provider/internal error text.
 */
export function getFriendlyPhoneOtpError(error: OtpErrorLike | null | undefined): string {
  const GENERIC = 'Unable to send the verification code right now. Please try again later.';
  if (!error) return GENERIC;

  const code = (error.code || '').toLowerCase();
  const message = (error.message || '').toLowerCase();

  const looksLikeTwilioTrialRestriction =
    message.includes('unverified') && (message.includes('trial') || message.includes('twilio'));

  if (looksLikeTwilioTrialRestriction || (code === 'sms_send_failed' && looksLikeTwilioTrialRestriction)) {
    const base = 'SMS verification is currently available only for verified numbers while Snippr is using a trial SMS account.';
    return import.meta.env.DEV ? `${base} Please use a phone number verified in the Twilio trial account.` : base;
  }

  if (code === 'sms_send_failed') {
    return GENERIC;
  }

  if (code === 'over_sms_send_rate_limit' || code === 'over_request_rate_limit' || error.status === 429) {
    return 'Too many attempts. Please wait a bit before requesting another code.';
  }

  // Deliberately never echo provider text that claims the number is "invalid" —
  // our own validation already checked the format, so blaming the user's input
  // here would be misleading.
  return GENERIC;
}

/** Friendly mapping for verifyOtp() failures (wrong/expired code, etc.). These
 * messages are already user-safe from Supabase, but normalized here for a
 * consistent tone and to avoid ever leaking a raw provider error string. */
export function getFriendlyOtpVerifyError(error: OtpErrorLike | null | undefined): string {
  const GENERIC = 'Invalid or expired code. Please try again.';
  if (!error) return GENERIC;

  const message = (error.message || '').toLowerCase();

  if (message.includes('expired')) return 'This code has expired. Please request a new one.';
  if (message.includes('rate limit') || error.status === 429) {
    return 'Too many attempts. Please wait a bit before trying again.';
  }

  return GENERIC;
}
