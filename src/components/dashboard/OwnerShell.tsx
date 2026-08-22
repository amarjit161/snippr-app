import { ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Clock3,
  Scissors,
  Users,
  Store,
  Settings as SettingsIcon,
  Plus,
  Sparkles,
  LogOut,
  Menu,
  X,
  Bell,
  Sun,
  Moon,
  Search,
  CalendarDays,
  UsersRound,
  BarChart3,
  Star,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type OwnerShellProps = {
  children: ReactNode;
  onLogout: () => void;
};

const V = "#7C3AED";

const manageNavItems = [
  { key: "dashboard", label: "Overview", path: "/owner-dashboard", icon: LayoutDashboard },
  { key: "queue", label: "Live Queue", path: "/queue", icon: Clock3 },
  { key: "calendar", label: "Calendar", path: "/calendar", icon: CalendarDays },
  { key: "customers", label: "Customers", path: "/customers", icon: UsersRound },
  { key: "services", label: "Services", path: "/services", icon: Scissors },
  { key: "team", label: "Staff", path: "/team", icon: Users },
];

const moreNavItems = [
  { key: "analytics", label: "Analytics", path: "/analytics", icon: BarChart3 },
  { key: "reviews", label: "Reviews", path: "/reviews", icon: Star },
  { key: "owner-notifications", label: "Notifications", path: "/owner-notifications", icon: Bell },
  { key: "salon", label: "Salon Profile", path: "/salon-profile", icon: Store },
  { key: "settings", label: "Settings", path: "/settings", icon: SettingsIcon },
];


function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem("snippr_theme");
    if (stored) return stored === "dark";
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    window.localStorage.setItem("snippr_theme", isDark ? "dark" : "light");
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((d) => !d) };
}

function SidebarContent({ onNavigate, onLogout }: { onNavigate?: () => void; onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#0B0B0F] text-white">
      <div className="flex items-center gap-2 px-5 pb-6 pt-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: V }}>
          <Scissors className="h-4 w-4 text-white" />
        </div>
        <span className="font-display text-lg font-extrabold tracking-tight">snippr</span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: `${V}28`, color: "#C4B5FD" }}
        >
          Pro
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Manage</p>
        {manageNavItems.map((item) => {
          const active = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                navigate(item.path);
                onNavigate?.();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
              style={
                active
                  ? { background: `${V}1E`, border: `1px solid ${V}35`, color: "#E0D0FF" }
                  : { border: "1px solid transparent", color: "rgba(255,255,255,0.55)" }
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}

        <p className="px-2 pb-2 pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">More</p>
        {moreNavItems.map((item) => {
          const active = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                navigate(item.path);
                onNavigate?.();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
              style={
                active
                  ? { background: `${V}1E`, border: `1px solid ${V}35`, color: "#E0D0FF" }
                  : { border: "1px solid transparent", color: "rgba(255,255,255,0.55)" }
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="space-y-3 px-3 pb-4">
        <button
          type="button"
          onClick={() => {
            navigate("/salons");
            onNavigate?.();
          }}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-sm"
          style={{ background: `linear-gradient(135deg, ${V}, #A855F7)` }}
        >
          <Plus className="h-4 w-4" /> Add New Booking
        </button>

        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
          style={{ background: "rgba(16,185,129,0.12)", color: "#34D399" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current live-dot" />
          Salon Open
        </div>

        <div className="space-y-1 border-t border-white/[0.08] pt-3">
          <button
            type="button"
            onClick={() => navigate("/support")}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-white/50 transition-colors hover:bg-white/5"
          >
            <Sparkles className="h-4 w-4" />
            Support
          </button>
        </div>

        <div className="flex items-center gap-2.5 border-t border-white/[0.08] px-3 pt-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${V}, #A855F7)` }}
          >
            {(profile?.name || profile?.email || "O").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white/80">{profile?.name || "Owner"}</p>
            <p className="truncate text-[11px] text-white/35">{profile?.email}</p>
          </div>
          <button type="button" onClick={onLogout} className="shrink-0 text-white/35 hover:text-white/70" aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

const PATH_LABELS: Record<string, string> = {
  "/owner-dashboard": "Overview",
  "/queue": "Live Queue",
  "/calendar": "Calendar",
  "/customers": "Customers",
  "/services": "Services",
  "/team": "Staff",
  "/analytics": "Analytics",
  "/reviews": "Reviews",
  "/owner-notifications": "Notifications",
  "/salon-profile": "Salon Profile",
  "/settings": "Settings",
};

export function OwnerShell({ children, onLogout }: OwnerShellProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { isDark, toggle } = useDarkMode();

  const currentLabel = PATH_LABELS[location.pathname] ?? "Dashboard";

  return (
    <div className="min-h-screen bg-[#faf9fc] text-[#1a1c1e] dark:bg-[#0B0B0F] dark:text-white">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[230px] overflow-hidden lg:flex">
        <SidebarContent onLogout={onLogout} />
      </aside>

      {/* Mobile off-canvas drawer */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className="absolute inset-0 bg-black/50 transition-opacity"
          style={{ opacity: mobileOpen ? 1 : 0 }}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className="absolute left-0 top-0 h-full w-[260px] shadow-2xl transition-transform duration-300"
          style={{ transform: mobileOpen ? "translateX(0)" : "translateX(-100%)" }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-white/50 hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
          <SidebarContent onNavigate={() => setMobileOpen(false)} onLogout={onLogout} />
        </div>
      </div>

      {/* Topbar */}
      <header className="sticky top-0 z-30 flex h-[52px] items-center gap-3 border-b border-black/[0.06] bg-white/80 px-4 backdrop-filter backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#0B0B0F]/80 lg:pl-[230px]">
        <button
          type="button"
          className="rounded-lg p-1.5 text-current/60 lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <p className="text-sm font-medium text-muted-foreground">
          <span className="opacity-50">Snippr /</span> {currentLabel}
        </p>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex items-center">
            {searchOpen ? (
              <input
                autoFocus
                placeholder="Search…"
                onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
                onBlur={() => setSearchOpen(false)}
                className="h-8 w-40 rounded-lg border border-black/10 bg-black/[0.03] px-3 text-sm outline-none dark:border-white/10 dark:bg-white/5"
              />
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="rounded-lg p-1.5 text-current/60 hover:bg-black/5 dark:hover:bg-white/5"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={toggle}
            className="rounded-lg p-1.5 text-current/60 hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-current/60 hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="min-h-screen p-6 lg:ml-[230px] lg:p-10">{children}</main>
    </div>
  );
}
