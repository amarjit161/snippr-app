import { Link } from "react-router-dom";
import { Scissors } from "lucide-react";
import { DISP, V } from "./tokens";
import { AppLink } from "./AppLink";

const linkClass = "text-sm text-white/60 transition-colors hover:text-white";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.07] px-4 pb-10 pt-14 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <a href="#top" className="mb-3 flex items-center gap-2" aria-label="Snippr home">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: V }} aria-hidden="true">
                <Scissors className="h-3.5 w-3.5 text-white" />
              </span>
              <span className="font-bold text-white" style={{ fontFamily: DISP }}>Snippr</span>
            </a>
            <p className="text-sm leading-relaxed text-white/60">
              Salon booking with a live queue, for customers and salon owners.
            </p>
            <a href="mailto:support@snippr.in" className={`${linkClass} mt-4 inline-block`}>support@snippr.in</a>
          </div>

          <nav aria-label="Customers">
            <p className="mb-4 text-sm font-semibold text-white">Customers</p>
            <ul className="space-y-3">
              <li><AppLink to="/salons" className={linkClass}>Find a salon</AppLink></li>
              <li><AppLink to="/bookings" className={linkClass}>My bookings</AppLink></li>
              <li><AppLink to="/login" className={linkClass}>Sign in</AppLink></li>
            </ul>
          </nav>

          <nav aria-label="Salon owners">
            <p className="mb-4 text-sm font-semibold text-white">Salon owners</p>
            <ul className="space-y-3">
              <li><AppLink to="/owner-signup" className={linkClass}>List your salon</AppLink></li>
              <li><AppLink to="/owner-login" className={linkClass}>Owner sign in</AppLink></li>
            </ul>
          </nav>

          <nav aria-label="Company">
            <p className="mb-4 text-sm font-semibold text-white">Company</p>
            <ul className="space-y-3">
              <li><Link to="/how-it-works" className={linkClass}>How it works</Link></li>
              <li><Link to="/careers" className={linkClass}>Careers</Link></li>
              <li><Link to="/support" className={linkClass}>Support</Link></li>
              <li><Link to="/privacy" className={linkClass}>Privacy</Link></li>
            </ul>
          </nav>
        </div>

        <p className="mt-12 border-t border-white/[0.07] pt-6 text-xs text-white/50">
          © {new Date().getFullYear()} Snippr. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
