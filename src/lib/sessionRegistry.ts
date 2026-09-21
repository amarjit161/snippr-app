/**
 * Active login session registry.
 *
 * Supabase Auth does not expose a client-safe way to list a user's other
 * active sessions/devices — there is no such endpoint in either the public
 * or admin JS API. What it DOES put on every access-token JWT is a stable
 * `session_id` claim, unique per login and unchanged across token refreshes
 * within that login. This module uses that claim as the identity of "one
 * device", and keeps a small, user-owned table (`snippr_user_sessions`,
 * public schema, RLS-protected — see the matching migration) mapping
 * session_id -> coarse device/browser metadata + a last-seen heartbeat.
 *
 * Never stores passwords, access tokens, refresh tokens, or any other auth
 * secret — only a session_id (itself not a secret; it identifies a session,
 * it does not authenticate one) and display metadata already visible in
 * every request's User-Agent header.
 */
import { supabase } from "@/integrations/supabase/client";
import { debug } from "@/lib/debug";

export interface UserSessionRow {
  id: string;
  session_id: string;
  device_name: string | null;
  browser: string | null;
  platform: string | null;
  last_seen_at: string;
  created_at: string;
}

const TABLE = "snippr_user_sessions";

// Untyped access: this table isn't in the generated Database types yet (they
// can only be regenerated from the live schema after the migration is
// actually applied there). Matches the existing `as any` pattern already
// used elsewhere in this codebase for the same reason.
const sessionsTable = () => supabase.from(TABLE) as any;

/**
 * Reads the `session_id` claim off the current access token via the
 * supported `getClaims()` API. For symmetric-secret projects this validates
 * the JWT against the server (like `getUser()`); for asymmetric/JWKS
 * projects it verifies locally. Either way the returned session_id can be
 * trusted — it is not taken from an unverified client-side JWT decode.
 */
export async function getCurrentSessionId(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data) return null;
    const claims = data.claims as { session_id?: string } | undefined;
    return claims?.session_id ?? null;
  } catch (err) {
    debug.error("SESSION_REGISTRY: getCurrentSessionId failed", err);
    return null;
  }
}

async function detectBrowser(ua: string): Promise<string> {
  // Brave deliberately reports as Chrome in the UA string for privacy, but
  // exposes a real, documented navigator.brave.isBrave() feature-detection
  // API — safe, no fingerprinting, standard practice for this one case.
  try {
    const nav = navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } };
    if (typeof nav.brave?.isBrave === "function") {
      const isBrave = await nav.brave.isBrave();
      if (isBrave) return "Brave";
    }
  } catch {
    // ignore — fall through to UA parsing
  }

  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return "Opera";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\/|CriOS\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return "Safari";
  return "Browser";
}

function detectPlatform(ua: string): string {
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  if (uaData?.platform) return uaData.platform;

  if (/Windows/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown device";
}

async function currentDeviceMetadata(): Promise<{ browser: string; platform: string; deviceName: string }> {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const browser = await detectBrowser(ua);
  const platform = detectPlatform(ua);
  return { browser, platform, deviceName: `${browser} · ${platform}` };
}

/** Called once per newly-established session (sign-in / initial load). */
export async function registerCurrentSession(userId: string): Promise<void> {
  const sessionId = await getCurrentSessionId();
  if (!sessionId) return;

  const { browser, platform, deviceName } = await currentDeviceMetadata();

  const { error } = await sessionsTable().upsert(
    {
      user_id: userId,
      session_id: sessionId,
      browser,
      platform,
      device_name: deviceName,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,session_id" }
  );

  if (error) debug.error("SESSION_REGISTRY: register failed", error);
}

/** Lightweight heartbeat — just bumps last_seen_at for the current session_id. */
export async function touchCurrentSession(userId: string): Promise<void> {
  const sessionId = await getCurrentSessionId();
  if (!sessionId) return;

  const { error } = await sessionsTable()
    .update({ last_seen_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("session_id", sessionId);

  if (error) debug.error("SESSION_REGISTRY: heartbeat failed", error);
}

export async function listUserSessions(userId: string): Promise<UserSessionRow[]> {
  const { data, error } = await sessionsTable()
    .select("id, session_id, device_name, browser, platform, last_seen_at, created_at")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false });

  if (error) {
    debug.error("SESSION_REGISTRY: list failed", error);
    return [];
  }
  return (data || []) as UserSessionRow[];
}

/** Removes one registry row (bookkeeping only — see MyProfile's "Remove" action). */
export async function removeSessionRecord(userId: string, rowId: string): Promise<{ error: string | null }> {
  const { error } = await sessionsTable().delete().eq("id", rowId).eq("user_id", userId);
  return { error: error?.message ?? null };
}

/** Best-effort cleanup of this device's own row on a normal (local-scope) sign-out. */
export async function removeCurrentSessionRecord(userId: string): Promise<void> {
  const sessionId = await getCurrentSessionId();
  if (!sessionId) return;
  const { error } = await sessionsTable().delete().eq("user_id", userId).eq("session_id", sessionId);
  if (error) debug.error("SESSION_REGISTRY: remove current failed", error);
}

/** Call BEFORE supabase.auth.signOut({scope:'others'}) while still authenticated. */
export async function clearOtherSessionRecords(userId: string): Promise<void> {
  const sessionId = await getCurrentSessionId();
  if (!sessionId) return;
  const { error } = await sessionsTable().delete().eq("user_id", userId).neq("session_id", sessionId);
  if (error) debug.error("SESSION_REGISTRY: clear others failed", error);
}

/** Call BEFORE supabase.auth.signOut({scope:'global'}) — this device loses its session too. */
export async function clearAllSessionRecords(userId: string): Promise<void> {
  const { error } = await sessionsTable().delete().eq("user_id", userId);
  if (error) debug.error("SESSION_REGISTRY: clear all failed", error);
}
