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
        className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around px-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 md:hidden"
        style={{ background: "rgba(5,5,7,0.9)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {TABS.map(({ key, label, icon: Icon, to, state }) => {
          const active = activeKey === key;
          return (
            <button
              key={key}
              className="flex flex-col items-center justify-center rounded-2xl px-4 py-2 transition-colors"
              style={active ? { background: "#7C3AED", color: "#fff" } : { color: "rgba(255,255,255,0.4)" }}
              onClick={() => navigate(key === "profile" && !user ? "/login" : to, state ? { state } : undefined)}
            >
              <Icon className="h-5 w-5" />
              <span className="mt-1 text-[10px] font-bold uppercase tracking-widest">{label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
