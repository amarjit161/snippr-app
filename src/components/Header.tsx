import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Heart,
  Hourglass,
  LifeBuoy,
  LogOut,
  Menu,
  Scissors,
  Settings,
  User,
  X,
} from "lucide-react";

interface HeaderProps {
  onSignOut?: () => void;
  userName?: string;
  userEmail?: string;
  profileName?: string;
  onAdminToggle?: () => void;
  isAdmin?: boolean;
}

// Account drawer destinations (unchanged).
const ACCOUNT_LINKS = [
  { icon: User, label: "My Profile", sub: "Edit your details", path: "/my-profile" },
  { icon: CalendarDays, label: "My Bookings", sub: "View appointments", path: "/bookings" },
  { icon: Hourglass, label: "Live Queue", sub: "Your queue position", path: "/bookings", state: { initialTab: "upcoming" } },
  { icon: Heart, label: "Favorites", sub: "Your saved salons", path: "/favorites" },
  { icon: Bell, label: "Notifications", sub: "Updates on your bookings", path: "/notifications" },
  { icon: LifeBuoy, label: "Support", sub: "Get help", path: "/support" },
] as const;

/**
 * The app's shared header, styled after the landing-page navbar (its scrolled
 * state): near-black, nearly opaque so it reads the same over light app pages, a violet
 * logo tile, quiet text links and two compact actions. One 64px row at every width.
 */
const Header = ({ onSignOut, userName, userEmail, profileName, onAdminToggle, isAdmin }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isPublic = !userName;
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

  const emailOrName = userEmail || userName || "User";
  const avatarLetter = emailOrName?.[0]?.toUpperCase() || "U";

  // Public actions are hidden on /auth (as before); "Browse Salons" is hidden on /salons.
  const showPublicActions = isPublic && location.pathname !== "/auth";
  const publicLinks = [
    ...(location.pathname !== "/salons" ? [{ label: "Browse Salons", to: "/salons" }] : []),
    { label: "Owner Login", to: "/owner-login" },
    { label: "Owner Signup", to: "/owner-register" },
  ];

  useEffect(() => {
    setProfileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  // Escape closes whichever menu is open and returns focus to the button that opened it.
  useEffect(() => {
    if (!menuOpen && !profileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (menuOpen) {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
      if (profileOpen) {
        setProfileOpen(false);
        avatarButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, profileOpen]);

  useEffect(() => {
    if (profileOpen) drawerCloseRef.current?.focus();
  }, [profileOpen]);

  const go = (to: string) => {
    setMenuOpen(false);
    navigate(to);
  };

  const navLinkClass =
    "rounded-md text-sm text-white/60 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
  <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[rgba(5,5,7,0.97)] text-white backdrop-blur-xl">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
      <div className="flex shrink-0 items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary" aria-hidden="true">
          <Scissors className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="font-display text-[17px] font-semibold tracking-tight text-white">Snippr</span>
      </div>

      {showPublicActions && (
        <div className="flex min-w-0 items-center gap-6">
          <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex">
            {publicLinks.map((link) => (
              <button key={link.to} type="button" onClick={() => go(link.to)} className={navLinkClass}>
                {link.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go("/login")}
              className="hidden rounded-lg border border-white/[0.12] px-4 py-2 text-sm text-white/70 transition-colors hover:border-white/25 hover:text-white md:block"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => go("/auth?role=customer")}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
            >
              Get Started
              <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden="true" />
            </button>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="header-menu"
              className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white lg:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      )}

      {userName && onSignOut && (
        <div className="flex items-center gap-2">
          {onAdminToggle && (
            <button
              type="button"
              onClick={onAdminToggle}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                isAdmin
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/[0.12] text-white/70 hover:border-white/25 hover:text-white"
              }`}
            >
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}
          <button
            ref={avatarButtonRef}
            type="button"
            onClick={() => setProfileOpen(true)}
            aria-label="Open account menu"
            aria-haspopup="dialog"
            aria-expanded={profileOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#050507]"
          >
            {avatarLetter}
          </button>
        </div>
      )}
    </div>

    {showPublicActions && menuOpen ? (
      <div id="header-menu" className="border-t border-white/[0.06] lg:hidden">
        <nav aria-label="Mobile navigation" className="mx-auto flex max-w-7xl flex-col px-4 py-2 sm:px-6">
          {publicLinks.map((link) => (
            <button key={link.to} type="button" onClick={() => go(link.to)} className={`py-2.5 text-left ${navLinkClass}`}>
              {link.label}
            </button>
          ))}
          <button type="button" onClick={() => go("/login")} className={`py-2.5 text-left md:hidden ${navLinkClass}`}>
            Sign In
          </button>
        </nav>
      </div>
    ) : null}

    {profileOpen ? (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setProfileOpen(false)}
          aria-hidden="true"
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Account menu"
          className="fixed right-0 top-0 z-50 flex h-full w-[88vw] max-w-72 animate-[slideIn_0.14s_cubic-bezier(0.16,1,0.3,1)] flex-col border-l border-border bg-card text-foreground shadow-lg sm:w-72"
        >
          <button
            ref={drawerCloseRef}
            type="button"
            onClick={() => {
              setProfileOpen(false);
              avatarButtonRef.current?.focus();
            }}
            aria-label="Close account menu"
            className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="border-b border-border p-6 pt-8">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
              {avatarLetter}
            </div>
            <p className="font-display text-base font-semibold tracking-tight text-foreground">
              {profileName || userName || (userEmail ? userEmail.split("@")[0] : "User")}
            </p>
            <p className="text-sm text-muted-foreground">{userEmail || "No email available"}</p>
          </div>

          <nav aria-label="Account" className="flex-1 space-y-0.5 overflow-y-auto p-3">
            {ACCOUNT_LINKS.map((item) => (
              <button
                key={item.path + item.label}
                type="button"
                onClick={() => {
                  navigate(item.path, "state" in item ? { state: item.state } : undefined);
                  setProfileOpen(false);
                }}
                className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
              >
                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold text-foreground group-hover:text-primary">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.sub}</span>
                </span>
              </button>
            ))}

            {onAdminToggle ? (
              <button
                type="button"
                onClick={() => {
                  onAdminToggle();
                  setProfileOpen(false);
                }}
                className="mt-2 flex w-full items-center gap-3 rounded-lg border border-primary/20 px-3 py-2.5 text-left transition-colors hover:bg-primary/5"
              >
                <Scissors className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold text-primary">Owner Dashboard</span>
                  <span className="block text-xs text-muted-foreground">Manage your salon</span>
                </span>
              </button>
            ) : null}
          </nav>

          <div className="border-t border-border p-3">
            <button
              type="button"
              onClick={async () => {
                console.log("🚪 LOGOUT_BUTTON_CLICKED");
                try {
                  await Promise.resolve(onSignOut());
                  console.log("✅ LOGOUT_CALLBACK_COMPLETE");
                  setProfileOpen(false);
                  navigate("/", { replace: true });
                } catch (err) {
                  console.error("❌ LOGOUT_FAILED", err);
                  setProfileOpen(false);
                  navigate("/", { replace: true });
                }
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="text-sm font-semibold">Sign Out</span>
            </button>
          </div>
        </div>
      </>
    ) : null}
  </header>
  );
};

export default Header;
