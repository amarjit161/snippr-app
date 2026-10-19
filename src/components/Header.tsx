import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  Heart,
  Hourglass,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Scissors,
  Settings,
  User,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  onSignOut?: () => void;
  userName?: string;
  userEmail?: string;
  profileName?: string;
  onAdminToggle?: () => void;
  isAdmin?: boolean;
  /** A profile photo URL; defaults to the signed-in account's own (e.g. from Google sign-in). */
  avatarUrl?: string | null;
}

// Account menu destinations (unchanged).
const ACCOUNT_LINKS = [
  { icon: User, label: "My Profile", sub: "Edit your details", path: "/my-profile" },
  { icon: CalendarDays, label: "My Bookings", sub: "View appointments", path: "/bookings" },
  { icon: Hourglass, label: "Live Queue", sub: "Your queue position", path: "/bookings", state: { initialTab: "upcoming" } },
  { icon: Heart, label: "Favorites", sub: "Your saved salons", path: "/favorites" },
  { icon: Bell, label: "Notifications", sub: "Updates on your bookings", path: "/notifications" },
  { icon: LifeBuoy, label: "Support", sub: "Get help", path: "/support" },
] as const;

const isPhotoUrl = (v: unknown): v is string => typeof v === "string" && /^https:\/\//i.test(v.trim());

/**
 * Round avatar: the account's photo when there is one, otherwise its initial (or a
 * person icon when there's nothing to take an initial from) on a violet gradient
 * with a soft top highlight and layered shadow — a light, CSS-only 3D look.
 */
function AccountAvatar({ src, initial, size }: { src: string | null; initial: string | null; size: "sm" | "lg" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const box = size === "sm" ? "h-8 w-8 text-[13px]" : "h-10 w-10 text-[15px]";
  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ${box} bg-[linear-gradient(150deg,#b794ff_0%,#7c3aed_48%,#4c1d95_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-3px_6px_rgba(46,16,101,0.5),0_6px_14px_-4px_rgba(124,58,237,0.6),0_0_0_1px_rgba(255,255,255,0.12)]`}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : initial ? (
        initial
      ) : (
        <User className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
      )}
      {/* Gloss: a soft highlight across the top half (not drawn over a real photo). */}
      {src && !failed ? null : (
        <span className="pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-full bg-gradient-to-b from-white/35 to-transparent" />
      )}
    </span>
  );
}

/**
 * The app's shared header, styled after the landing-page navbar (its scrolled
 * state): near-black, nearly opaque so it reads the same over light app pages, a violet
 * logo tile, quiet text links and two compact actions. One 64px row at every width.
 */
const Header = ({ onSignOut, userName, userEmail, profileName, onAdminToggle, isAdmin, avatarUrl }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isPublic = !userName;
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Real account details only — nothing invented. A name when there is one, then the
  // email (or phone) as given; "User" is the callers' placeholder, not a name.
  const email = userEmail?.trim() || null;
  const givenName = userName?.trim() && userName.trim() !== "User" && userName.trim() !== email ? userName.trim() : null;
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const isThisAccount = !!user && (!email || user.email === email);
  // A real name from the sign-in provider (e.g. Google's full_name) when the page has none.
  const accountName = isThisAccount ? [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim().length > 0)?.trim() ?? null : null;
  const displayName = profileName?.trim() || (givenName && !givenName.includes("@") ? givenName : null) || accountName;
  const primaryLine = displayName ?? email ?? givenName;
  const secondaryLine = displayName ? email : null;
  const initialSource = displayName ?? email ?? givenName;
  const initial = initialSource && /[\p{L}\p{N}]/u.test(initialSource[0]) ? initialSource[0].toUpperCase() : null;
  // The signed-in account's own photo (e.g. Google), only when this header shows that account.
  const ownPhoto = isThisAccount ? [meta.avatar_url, meta.picture].find(isPhotoUrl) ?? null : null;
  const photo = isPhotoUrl(avatarUrl) ? avatarUrl : avatarUrl === null ? null : ownPhoto;

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

  // Escape closes the mobile menu and returns focus to its toggle. (The account menu
  // handles Escape, outside clicks and focus itself.)
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const go = (to: string) => {
    setMenuOpen(false);
    navigate(to);
  };

  const signOut = async () => {
    if (!onSignOut) return;
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
  };

  const navLinkClass =
    "rounded-md text-sm text-white/60 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  // Rows: 44px on touch screens, 40px from lg; the radius nests inside the menu's
  // (16px corner − 6px padding). Highlight = hover or keyboard focus; active = pressed.
  const menuRowClass =
    "group/item flex min-h-11 w-full cursor-pointer select-none items-center gap-3 rounded-[10px] px-3 text-sm font-medium outline-none transition-colors lg:min-h-10";
  const menuItemClass = `${menuRowClass} text-white/80 data-[highlighted]:bg-white/[0.07] data-[highlighted]:text-white active:bg-white/[0.1]`;
  // Every icon sits in the same 20px column, so all labels start at the same x.
  const iconSlot = "flex h-5 w-5 shrink-0 items-center justify-center";
  const menuIconClass = "h-4 w-4 text-white/45 transition-colors group-data-[highlighted]/item:text-violet-300";
  const separatorClass = "-mx-1.5 my-1.5 h-px bg-white/[0.08]";

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

          {/* Account menu: Radix gives menu semantics, keyboard support (Enter / Space /
              arrows / Escape), outside-click closing, focus return and viewport-aware placement. */}
          <DropdownMenu.Root open={profileOpen} onOpenChange={setProfileOpen} modal={false}>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Open account menu"
                className="group/acct flex h-11 items-center gap-1 rounded-full py-1 pl-1 pr-2 outline-none transition-colors [perspective:500px] hover:bg-white/[0.06] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] active:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#050507] data-[state=open]:bg-white/[0.09] data-[state=open]:shadow-[inset_0_0_0_1px_rgba(167,139,250,0.35)] sm:h-10"
              >
                <span className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:group-hover/acct:[transform:translateY(-1px)_rotateX(10deg)_rotateY(-10deg)_scale(1.05)] motion-safe:group-active/acct:[transform:scale(0.95)] motion-safe:group-data-[state=open]/acct:[transform:scale(0.97)]">
                  <AccountAvatar src={photo} initial={initial} size="sm" />
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-white/55 transition-colors group-hover/acct:text-white/80 group-data-[state=open]/acct:rotate-180 group-data-[state=open]/acct:text-white motion-safe:transition-transform motion-safe:duration-200"
                />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                // Opens just below the 64px header at every size (the trigger is 40–44px tall).
                sideOffset={14}
                collisionPadding={12}
                loop
                // Named "Account menu" (Radix would otherwise name it after the trigger's label).
                aria-label="Account menu"
                aria-labelledby={undefined}
                className="z-[60] max-h-[min(var(--radix-dropdown-menu-content-available-height),32rem)] w-[min(18rem,calc(100vw-1.5rem))] origin-[var(--radix-dropdown-menu-content-transform-origin)] overflow-y-auto rounded-2xl border border-white/10 bg-[#111117] p-1.5 text-white shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65),0_8px_16px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.05)] outline-none motion-safe:data-[state=open]:animate-[accountMenuIn_170ms_cubic-bezier(0.16,1,0.3,1)] motion-safe:data-[state=closed]:animate-[accountMenuOut_110ms_ease-in]"
              >
                <div className="flex items-center gap-3 px-3 pb-2.5 pt-2">
                  <AccountAvatar src={photo} initial={initial} size="lg" />
                  <div className="min-w-0 flex-1">
                    {displayName ? (
                      <>
                        <p className="truncate text-sm font-semibold tracking-tight text-white" title={displayName}>
                          {displayName}
                        </p>
                        {secondaryLine ? (
                          <p className="mt-0.5 truncate text-xs text-white/50" title={secondaryLine}>
                            {secondaryLine}
                          </p>
                        ) : null}
                      </>
                    ) : primaryLine ? (
                      <>
                        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/40">Signed in as</p>
                        <p className="mt-0.5 truncate text-sm font-medium text-white" title={primaryLine}>
                          {primaryLine}
                        </p>
                      </>
                    ) : null}
                  </div>
                </div>

                <DropdownMenu.Separator className={separatorClass} />

                <DropdownMenu.Group>
                  {ACCOUNT_LINKS.map((item) => (
                    <DropdownMenu.Item
                      key={item.path + item.label}
                      onSelect={() => navigate(item.path, "state" in item ? { state: item.state } : undefined)}
                      className={menuItemClass}
                    >
                      <span className={iconSlot} aria-hidden="true">
                        <item.icon className={menuIconClass} />
                      </span>
                      {item.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Group>

                {onAdminToggle ? (
                  <>
                    <DropdownMenu.Separator className={separatorClass} />
                    <DropdownMenu.Item onSelect={() => onAdminToggle()} className={menuItemClass}>
                      <span className={iconSlot} aria-hidden="true">
                        <LayoutDashboard className="h-4 w-4 text-violet-300" />
                      </span>
                      <span className="text-violet-200 group-data-[highlighted]/item:text-white">Owner Dashboard</span>
                    </DropdownMenu.Item>
                  </>
                ) : null}

                <DropdownMenu.Separator className={separatorClass} />
                <DropdownMenu.Item
                  onSelect={() => void signOut()}
                  className={`${menuRowClass} text-red-400 data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-300 active:bg-red-500/15`}
                >
                  <span className={iconSlot} aria-hidden="true">
                    <LogOut className="h-4 w-4" />
                  </span>
                  Sign Out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
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
  </header>
  );
};

export default Header;
