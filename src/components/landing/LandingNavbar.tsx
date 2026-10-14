import { useEffect, useState } from "react";
import { Scissors, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { DISP, V } from "./tokens";
import { AppLink } from "./AppLink";

const SECTIONS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "For salon owners", href: "#owners" },
  { label: "FAQ", href: "#faq" },
];

export function LandingNavbar() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Only reachable in single-origin mode: on www.snippr.in the session lives on
  // app.snippr.in, so the marketing site always shows "Sign in".
  const account = user
    ? { to: "/bookings", label: "My bookings" }
    : { to: "/login", label: "Sign in" };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-200 ${
        scrolled || mobileOpen ? "border-b border-white/[0.07] bg-[#050507]/85 backdrop-blur-xl" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400" aria-label="Snippr home">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: V }} aria-hidden="true">
            <Scissors className="h-4 w-4 text-white" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-white" style={{ fontFamily: DISP }}>Snippr</span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
          {SECTIONS.map((s) => (
            <a key={s.href} href={s.href} className="text-sm text-white/70 transition-colors hover:text-white">
              {s.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <AppLink to={account.to}
            className="hidden rounded-lg px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white sm:inline-flex">
            {account.label}
          </AppLink>
          <AppLink to="/salons"
            className="inline-flex rounded-lg px-4 py-2 text-sm font-semibold text-white transition-[filter] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
            style={{ background: V }}>
            Find a Salon
          </AppLink>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/[0.06] lg:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="landing-mobile-menu"
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav id="landing-mobile-menu" aria-label="Mobile" className="border-t border-white/[0.07] px-4 pb-5 pt-2 lg:hidden">
          {SECTIONS.map((s) => (
            <a key={s.href} href={s.href} onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-2 py-3 text-base text-white/80 hover:bg-white/[0.04]">
              {s.label}
            </a>
          ))}
          <AppLink to={account.to} className="mt-2 block rounded-lg border border-white/10 px-2 py-3 text-center text-base font-medium text-white">
            {account.label}
          </AppLink>
        </nav>
      )}
    </header>
  );
}
