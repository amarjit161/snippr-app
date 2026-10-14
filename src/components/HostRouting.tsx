import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAppHostRedirect, getHostRole, resolveRootAuthTarget } from "@/lib/domains";

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
 * "/" — the marketing homepage everywhere except the app host, where the
 * product's entry point is salon discovery. Root auth links (Supabase Site URL
 * fallback) are still routed to the callback/reset pages first.
 */
export const HomeRoute = ({ marketing }: { marketing: ReactNode }) => {
  const { search, hash } = useLocation();

  if (getHostRole() !== "app") return <>{marketing}</>;

  return <Navigate to={resolveRootAuthTarget(search, hash) ?? "/salons"} replace />;
};
