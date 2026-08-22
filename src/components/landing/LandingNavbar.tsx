import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Scissors, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { V, DISP } from "./tokens";

export function LandingNavbar({ onBookings }: { onBookings: () => void }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const userLabel = profile?.name?.trim() || user?.email || user?.phone || "U";
  const avatarInitial = userLabel.charAt(0).toUpperCase();

  const navLinks = [
    { label: "Explore", onClick: () => navigate("/salons") },
    { label: "Bookings", onClick: onBookings },
    { label: "Live Queue", onClick: () => navigate("/queue") },
  ];

  return (
    <header data-landing-header className="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
      style={{
        background: scrolled ? "rgba(5,5,7,0.88)" : "transparent",
        backdropFilter: scrolled ? "blur(22px) saturate(180%)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
      }}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5 flex-shrink-0" aria-label="Snippr home">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: V }} aria-hidden="true">
            <Scissors className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-[17px] tracking-tight text-white" style={{ fontFamily: DISP }}>Snippr</span>
        </button>

        <nav className="hidden md:flex items-center gap-7" aria-label="Main navigation">
          {navLinks.map(l => (
            <button key={l.label} onClick={l.onClick} className="text-sm transition-colors"
              style={{ color: "rgba(255,255,255,0.55)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}>
              {l.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <button onClick={onBookings} aria-label="Your bookings"
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: V }}>
              {avatarInitial}
            </button>
          ) : (
            <>
              <button onClick={() => navigate("/login")}
                className="hidden md:block text-sm px-4 py-2 rounded-lg border transition-colors"
                style={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
                Sign In
              </button>
              <button onClick={() => navigate("/login")}
                className="text-sm px-4 py-2 rounded-lg font-semibold text-white" style={{ background: V }}>
                Get Started
              </button>
            </>
          )}
          <button className="md:hidden text-white" onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen}>
            {mobileOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-b px-6 py-4 space-y-3"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(5,5,7,0.96)", backdropFilter: "blur(20px)" }}>
          {navLinks.map(l => (
            <button key={l.label} onClick={() => { l.onClick(); setMobileOpen(false); }}
              className="block text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
              {l.label}
            </button>
          ))}
          {!user && (
            <button onClick={() => { navigate("/login"); setMobileOpen(false); }}
              className="block text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
              Sign In
            </button>
          )}
        </div>
      )}
    </header>
  );
}
