import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { appHref } from "@/lib/domains";

/**
 * Navigate to a booking-app route from the marketing homepage. Client-side when
 * the app is on the same origin; a full navigation to app.snippr.in when the
 * domain split is active (router state can't cross origins, so it's dropped).
 */
export function useAppNavigate() {
  const navigate = useNavigate();
  return useCallback(
    (path: string, state?: Record<string, unknown>) => {
      const href = appHref(path);
      if (/^https?:\/\//.test(href)) {
        window.location.assign(href);
        return;
      }
      navigate(path, state ? { state } : undefined);
    },
    [navigate],
  );
}
