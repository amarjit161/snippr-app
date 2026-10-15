/**
 * Password-recovery session tracking for /reset-password.
 *
 * Supabase fires PASSWORD_RECOVERY once — while the client starts up (recovery
 * tokens in the URL, or a PKCE recovery code it exchanges itself) and after
 * verifyOtp({ type: 'recovery' }). On a full page load that is usually before
 * /reset-password has mounted, so the page alone would miss it. This module
 * subscribes at import time (it is imported, eagerly, by ResetPassword, which
 * App imports eagerly), which is before the client finishes initialising.
 *
 * Only these documented signals mark a session as a recovery session; an
 * ordinary signed-in session never does. Nothing here logs or stores tokens.
 */
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

let recoveryUserId: string | null = null;
// Set by PASSWORD_RECOVERY; cleared once the user has been routed to (or has
// opened) /reset-password, so entry pages redirect a single time, not on every visit.
let resetPagePending = false;
const recoveryListeners = new Set<() => void>();

export function markRecoverySession(session: Session | null | undefined): void {
  if (session?.user?.id) recoveryUserId = session.user.id;
}

export function clearRecoverySession(): void {
  recoveryUserId = null;
  resetPagePending = false;
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    markRecoverySession(session);
    if (session?.user?.id) {
      resetPagePending = true;
      recoveryListeners.forEach((listener) => listener());
    }
  } else if (event === 'SIGNED_OUT') {
    clearRecoverySession();
  }
});

/** Notified when PASSWORD_RECOVERY arrives. Uses the module listener; adds no Supabase listener. */
export function onRecoverySession(listener: () => void): () => void {
  recoveryListeners.add(listener);
  return () => {
    recoveryListeners.delete(listener);
  };
}

/**
 * Resolves after auth events Supabase has already queued. During start-up it
 * saves a recovery session and queues PASSWORD_RECOVERY with setTimeout(0)
 * before getSession() resolves (which is what releases RootLoadingGuard), so by
 * the time a page has rendered the event is at most one timer away.
 */
export const afterQueuedAuthEvents = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** /reset-password has been reached: entry pages must not send the user there again. */
export function acknowledgeRecoveryRedirect(): void {
  resetPagePending = false;
}

/**
 * For entry pages ("/"): whether the current session is a recovery session
 * that hasn't reached /reset-password yet. Does not consume anything — the
 * caller calls acknowledgeRecoveryRedirect() synchronously when it actually
 * navigates, so a cancelled effect (e.g. React Strict Mode) can't lose it.
 */
export async function hasPendingRecoveryRedirect(): Promise<boolean> {
  if (!resetPagePending) return false;
  const session = await getRecoverySession();
  return Boolean(session) && resetPagePending;
}

/** The current session, if (and only if) it was established through password recovery. */
export async function getRecoverySession(): Promise<Session | null> {
  if (!recoveryUserId) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id === recoveryUserId ? session : null;
}

export const INVALID_LINK_MESSAGE =
  'This password reset link is invalid or has expired. Enter the code from your email, or request a new link.';
const NOT_RECOVERY_LINK_MESSAGE =
  "This link isn't a password reset link. Enter the code from your email, or request a new link.";

/** Supabase redirect errors (e.g. #error_code=otp_expired) or the homepage's ?expired=1. */
export function getRecoveryLinkError(search: URLSearchParams, hash: URLSearchParams): string | null {
  const hasError =
    search.get('expired') === '1' ||
    Boolean(hash.get('error') || hash.get('error_code') || search.get('error') || search.get('error_code'));
  return hasError ? INVALID_LINK_MESSAGE : null;
}

export type RecoveryLinkResult = { status: 'verified' } | { status: 'invalid'; message: string };

// One verification per link: recovery tokens are single-use, so a second call
// (React Strict Mode re-running effects, re-renders, a remount) must reuse the
// first result instead of spending the token again. In-memory only.
const linkAttempts = new Map<string, Promise<RecoveryLinkResult>>();

const once = (key: string, verify: () => Promise<RecoveryLinkResult>): Promise<RecoveryLinkResult> => {
  let attempt = linkAttempts.get(key);
  if (!attempt) {
    attempt = verify().catch((): RecoveryLinkResult => ({ status: 'invalid', message: INVALID_LINK_MESSAGE }));
    linkAttempts.set(key, attempt);
  }
  return attempt;
};

/**
 * Verify a recovery link from the query string with Supabase:
 *   ?token_hash=…&type=recovery → verifyOtp
 *   ?code=…                     → exchangeCodeForSession (must be a recovery code)
 * Returns null when the URL has no recovery link to verify. A token or code is
 * never trusted by its presence alone — only a successful verification counts.
 */
export function verifyRecoveryLink(search: URLSearchParams): Promise<RecoveryLinkResult> | null {
  const tokenHash = search.get('token_hash');
  if (tokenHash && search.get('type') === 'recovery') {
    return once(`token_hash:${tokenHash}`, async () => {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
      if (error || !data.session) return { status: 'invalid', message: INVALID_LINK_MESSAGE };
      markRecoverySession(data.session);
      return { status: 'verified' };
    });
  }

  const code = search.get('code');
  if (code) {
    return once(`code:${code}`, async () => {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.session) return { status: 'invalid', message: INVALID_LINK_MESSAGE };
      // redirectType is returned at runtime (see exchangeCodeForSession's docs) but not in its TS type.
      const { redirectType } = data as typeof data & { redirectType?: string | null };
      if (redirectType !== 'recovery') return { status: 'invalid', message: NOT_RECOVERY_LINK_MESSAGE };
      markRecoverySession(data.session);
      return { status: 'verified' };
    });
  }

  return null;
}

/** Remove recovery tokens/codes from the address bar, keeping e.g. ?email=. */
export function stripRecoveryParamsFromUrl(): void {
  const url = new URL(window.location.href);
  for (const key of ['token_hash', 'type', 'code', 'error', 'error_code', 'error_description']) {
    url.searchParams.delete(key);
  }
  url.hash = '';
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
}
