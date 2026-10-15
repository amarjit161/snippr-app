import { Navigate, useLocation } from "react-router-dom";

/**
 * Retired owner reset page, kept as a route so old links still work.
 *
 * Since commit 070a18d (2026-04-18) owners and customers share /reset-password,
 * which verifies the recovery link/session and then sends owners to
 * /owner-login and customers to /login. This route only forwards there,
 * carrying the query string and hash (Supabase recovery parameters) unchanged.
 *
 * It deliberately reads no tokens and makes no Supabase calls, so it never
 * spends a one-time link or registers another auth listener. The destination
 * path is fixed and same-origin: nothing in the URL can change where it goes.
 */
export default function OwnerResetPassword() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: "/reset-password", search, hash }} replace />;
}
