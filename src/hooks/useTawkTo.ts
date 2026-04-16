import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const TAWK_VISIBLE_PATHS = ["/", "/salons", "/support"];

export const useTawkTo = () => {
  const location = useLocation();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (typeof window === "undefined") return;
      const tawk = (window as any).Tawk_API;
      if (!tawk) return;

      const shouldShow =
        TAWK_VISIBLE_PATHS.some((path) => location.pathname === path) ||
        location.pathname.startsWith("/salon/");

      if (shouldShow) {
        tawk.showWidget?.();
      } else {
        tawk.hideWidget?.();
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [location.pathname]);
};
