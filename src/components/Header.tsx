import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Scissors, LogOut, Settings, Search, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onSignOut?: () => void;
  userName?: string;
  userEmail?: string;
  profileName?: string;
  onAdminToggle?: () => void;
  isAdmin?: boolean;
}

const Header = ({ onSignOut, userName, userEmail, profileName, onAdminToggle, isAdmin }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isPublic = !userName;
  const [profileOpen, setProfileOpen] = useState(false);

  const emailOrName = userEmail || userName || "User";
  const avatarLetter = emailOrName?.[0]?.toUpperCase() || "U";

  useEffect(() => {
    setProfileOpen(false);
  }, [location.pathname]);

  return (
  <header className="sticky top-0 z-50 border-b border-border/70 bg-card/85 backdrop-blur-md">
    <div className="container flex h-16 items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-500 text-primary-foreground shadow-sm">
          <Scissors className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-display text-xl font-bold text-foreground">
          Snippr
        </span>
      </div>

      {isPublic && location.pathname !== "/auth" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => navigate("/salons")} className="hidden sm:flex text-muted-foreground">
            <Search className="mr-2 h-4 w-4" /> Browse Salons
          </Button>
          <Button variant="outline" onClick={() => navigate("/owner-login")} className="gap-2 rounded-xl">
            Owner Login
          </Button>
          <Button variant="outline" onClick={() => navigate("/owner-register")} className="gap-2 rounded-xl">
            Owner Signup
          </Button>
          <Button onClick={() => navigate("/auth?role=customer")} className="gap-2 rounded-xl">
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {userName && onSignOut && (
        <div className="flex items-center gap-2">
          {onAdminToggle && (
            <button
              onClick={onAdminToggle}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-colors ${
                isAdmin ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}
          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 rounded-full px-3 py-2 transition-colors hover:bg-gray-100"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-purple-200 bg-purple-600 text-sm font-bold text-white">
              {avatarLetter}
            </div>
          </button>
        </div>
      )}
    </div>

    {profileOpen ? (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setProfileOpen(false)}
        />

        <div className="fixed right-0 top-0 z-50 flex h-full w-72 animate-[slideIn_0.25s_ease-out] flex-col bg-white shadow-2xl">
          <button
            onClick={() => setProfileOpen(false)}
            className="absolute right-4 top-4 rounded-full p-2 hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>

          <div className="border-b border-gray-100 p-6 pt-8">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full border-2 border-purple-200 bg-purple-100 text-2xl font-bold text-purple-700">
              {avatarLetter}
            </div>
            <p className="text-base font-bold text-gray-900">
              {profileName || userName || (userEmail ? userEmail.split("@")[0] : "User")}
            </p>
            <p className="text-sm text-gray-500">{userEmail || "No email available"}</p>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {[
              { icon: "👤", label: "My Profile", sub: "Edit your details", path: "/bookings" },
              { icon: "📋", label: "My Bookings", sub: "View appointments", path: "/bookings" },
              { icon: "⏳", label: "Live Queue", sub: "Your queue position", path: "/bookings" },
              { icon: "🔐", label: "Change Password", sub: "Update your password", path: "/bookings" },
              { icon: "💬", label: "Support", sub: "Get help", path: "/support" },
            ].map((item) => (
              <button
                key={item.path + item.label}
                onClick={() => {
                  navigate(item.path);
                  setProfileOpen(false);
                }}
                className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-gray-50"
              >
                <span className="w-8 text-center text-xl">{item.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800 group-hover:text-purple-700">
                    {item.label}
                  </p>
                  <p className="text-xs text-gray-400">{item.sub}</p>
                </div>
              </button>
            ))}

            {onAdminToggle ? (
              <button
                onClick={() => {
                  onAdminToggle();
                  setProfileOpen(false);
                }}
                className="mt-2 flex w-full items-center gap-3 rounded-xl border border-purple-100 px-4 py-3 text-left transition-colors hover:bg-purple-50"
              >
                <span className="w-8 text-center text-xl">✂️</span>
                <div>
                  <p className="text-sm font-semibold text-purple-700">Owner Dashboard</p>
                  <p className="text-xs text-gray-400">Manage your salon</p>
                </div>
              </button>
            ) : null}
          </nav>

          <div className="border-t border-gray-100 p-4">
            <button
              onClick={async () => {
                await Promise.resolve(onSignOut());
                setProfileOpen(false);
                navigate("/");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-red-600 transition-colors hover:bg-red-50"
            >
              <span className="w-8 text-center text-xl">🚪</span>
              <span className="text-sm font-semibold">Sign Out</span>
              <LogOut className="ml-auto h-4 w-4" />
            </button>
          </div>
        </div>
      </>
    ) : null}
  </header>
  );
};

export default Header;
