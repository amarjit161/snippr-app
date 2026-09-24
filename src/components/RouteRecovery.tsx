import { useMemo, type ReactNode } from "react";
import { Navigate, createRoutesFromChildren, useLocation } from "react-router-dom";
import { collectRoutePatterns, recoverPathname } from "@/lib/routeRecovery";

interface RouteRecoveryProps {
  /** The app's <Route> tree — patterns are derived from it, not duplicated. */
  routes: () => ReactNode;
  /** Rendered when no single high-confidence match exists (the existing 404). */
  fallback: ReactNode;
}

/**
 * Catch-all route element. Runs only after React Router found no match, then
 * either replaces the URL with the one clear intended route (query + hash kept)
 * or renders the fallback. The recovered route goes through its normal guards
 * (ProtectedRoute / OwnerProtectedRoute) exactly like direct navigation.
 */
export const RouteRecovery = ({ routes, fallback }: RouteRecoveryProps) => {
  const { pathname, search, hash } = useLocation();

  const recovered = useMemo(
    () => recoverPathname(pathname, collectRoutePatterns(createRoutesFromChildren(routes()))),
    [pathname, routes],
  );

  if (recovered) {
    if (import.meta.env.DEV) console.info("ROUTE_RECOVERY:", pathname, "→", recovered);
    return <Navigate to={{ pathname: recovered, search, hash }} replace />;
  }

  return <>{fallback}</>;
};
