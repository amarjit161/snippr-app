import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Clock3, Scissors, Users, Store, UserCircle2, Plus, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarItem } from "./SidebarItem";

type OwnerShellProps = {
  children: ReactNode;
  onLogout: () => void;
};

const navItems = [
  { key: "dashboard", label: "Dashboard", path: "/owner-dashboard", icon: LayoutDashboard },
  { key: "queue", label: "Live Queue", path: "/queue", icon: Clock3 },
  { key: "services", label: "Services", path: "/services", icon: Scissors },
  { key: "team", label: "Team", path: "/team", icon: Users },
  { key: "salon", label: "Salon Profile", path: "/salon-profile", icon: Store },
  { key: "settings", label: "Settings", path: "/settings", icon: UserCircle2 },
];

export function OwnerShell({ children, onLogout }: OwnerShellProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#faf9fc] text-[#1a1c1e]">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col space-y-2 border-r border-[#e3e2e5] bg-slate-50 p-4 md:flex">
        <div className="mb-8 px-4 pt-1">
          <h1 className="font-display text-xl font-extrabold text-violet-900">snippr</h1>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Salon Concierge</p>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <SidebarItem
              key={item.key}
              icon={item.icon}
              label={item.label}
              isActive={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            />
          ))}
        </nav>

        <Button className="mb-4 mt-3 h-12 w-full rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm" onClick={() => navigate("/salons")}>
          <Plus className="mr-2 h-4 w-4" /> Add New Booking
        </Button>

        <div className="space-y-1 border-t border-[#e3e2e5] pt-3">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-100"
            onClick={() => navigate("/salons")}
          >
            <Sparkles className="h-4 w-4" />
            Support
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-100"
            onClick={onLogout}
          >
            <ArrowRight className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <main className="min-h-screen p-6 md:ml-64 md:p-10">{children}</main>
    </div>
  );
}
