import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Search, Home, Clock, CalendarDays, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type TabKey = "home" | "search" | "queue" | "bookings" | "profile";

const TABS: { key: TabKey; label: string; icon: typeof Home; to: string; state?: Record<string, unknown> }[] = [
  { key: "home", label: "Home", icon: Home, to: "/salons" },
  { key: "search", label: "Search", icon: Search, to: "/salons", state: { focusSearch: true } },
  { key: "queue", label: "Queue", icon: Clock, to: "/bookings", state: { initialTab: "upcoming" } },
  { key: "bookings", label: "Bookings", icon: CalendarDays, to: "/bookings", state: { initialTab: "past" } },
  { key: "profile", label: "Profile", icon: User, to: "/my-profile" },
];

export function CustomerAppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const activeKey: TabKey | null = (() => {
    if (location.pathname === "/salons" || location.pathname.startsWith("/salon/")) {
      return (location.state as { focusSearch?: boolean } | null)?.focusSearch ? "search" : "home";
    }
    if (location.pathname === "/bookings" || location.pathname.startsWith("/booking/")) {
      const initialTab = (location.state as { initialTab?: string } | null)?.initialTab;
      return initialTab === "past" ? "bookings" : "queue";
    }
    if (location.pathname === "/my-profile") return "profile";
    return null;
  })();

  return (
    <>
      <div className="pb-20 md:pb-0">
        <Outlet />
      </div>

      <nav
        // Five tabs share the width (no fixed padding), so all of them fit on 320px screens.
        className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around gap-0.5 px-1 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 min-[360px]:gap-1 min-[360px]:px-2 md:hidden"
        style={{ background: "rgba(5,5,7,0.9)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {TABS.map(({ key, label, icon: Icon, to, state }) => {
          const active = activeKey === key;
          return (
            <button
              key={key}
              className="flex min-w-0 max-w-[5.5rem] flex-1 flex-col items-center justify-center rounded-2xl px-0.5 py-2 transition-colors min-[360px]:px-1"
              style={active ? { background: "#7C3AED", color: "#fff" } : { color: "rgba(255,255,255,0.4)" }}
              onClick={() => navigate(key === "profile" && !user ? "/login" : to, state ? { state } : undefined)}
            >
              <Icon className="h-5 w-5" />
              <span className="mt-1 max-w-full truncate text-[10px] font-bold uppercase tracking-normal min-[360px]:tracking-wider">{label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
