import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAppHostRedirect, getHostRole, resolveRootAuthTarget } from "@/lib/domains";
import {
  acknowledgeRecoveryRedirect,
  afterQueuedAuthEvents,
  hasPendingRecoveryRedirect,
} from "@/lib/passwordRecovery";

/**
 * Catches client-side navigations on the marketing host that leave the marketing
 * pages (main.tsx already handles full page loads). Same rules, same target.
 */
export const MarketingHostGate = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const redirect = getHostRole() === "marketing"
    ? getAppHostRedirect({
        origin: window.location.origin,
        host: window.location.host,
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      })
    : null;

  useEffect(() => {
    if (redirect) window.location.replace(redirect);
  }, [redirect]);

  return redirect ? null : <>{children}</>;
};

/**
 * App-host "/": recovery links (still in the URL, or already turned into a
 * recovery session by Supabase during start-up) go to /reset-password;
 * everyone else goes to salon discovery.
 */
const AppRoot = () => {
  const { search, hash } = useLocation();
  const urlTarget = resolveRootAuthTarget(search, hash);
  const [sessionTarget, setSessionTarget] = useState<string | null>(null);

  useEffect(() => {
    if (urlTarget) return;
    let active = true;
    void afterQueuedAuthEvents()
      .then(hasPendingRecoveryRedirect)
      .catch(() => false)
      .then((pending) => {
        if (!active) return;
        if (pending) acknowledgeRecoveryRedirect();
        setSessionTarget(pending ? "/reset-password" : "/salons");
      });
    return () => {
      active = false;
    };
  }, [urlTarget]);

  const destination = urlTarget ?? sessionTarget;
  return destination ? <Navigate to={destination} replace /> : null;
};

/**
 * "/" — the marketing homepage everywhere except the app host, where the
 * product's entry point is salon discovery. Root auth links (Supabase Site URL
 * fallback) are still routed to the callback/reset pages first.
 */
export const HomeRoute = ({ marketing }: { marketing: ReactNode }) =>
  getHostRole() === "app" ? <AppRoot /> : <>{marketing}</>;
