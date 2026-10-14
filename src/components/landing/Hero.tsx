import { motion } from "framer-motion";
import { ArrowRight, Clock3, KeyRound, Smartphone } from "lucide-react";
import { DISP, MONO, V, VA } from "./tokens";
import { AppLink } from "./AppLink";
import { PhoneShell, TrackScreen } from "./Mockups";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden px-4 pb-20 pt-28 sm:px-6 md:pb-28 md:pt-36">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "64px 64px", maskImage: "radial-gradient(ellipse at 50% 30%, black 30%, transparent 75%)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full"
        style={{ background: `radial-gradient(ellipse, ${V}38, transparent 65%)`, filter: "blur(40px)" }} />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.1fr_auto]">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: `${V}55`, background: `${V}14`, color: "#C4B5FD", fontFamily: MONO }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: VA }} aria-hidden="true" />
            Salon booking with a live queue
          </p>

          <h1 className="mb-6 font-extrabold tracking-tight text-white"
            style={{ fontFamily: DISP, fontSize: "clamp(2.6rem, 7vw, 5rem)", lineHeight: 1, letterSpacing: "-0.03em" }}>
            Book your chair.
            <span className="block" style={{ color: VA }}>Skip the waiting room.</span>
          </h1>

          <p className="mb-9 max-w-xl text-lg leading-relaxed text-white/70">
            Find a salon, pick your services and stylist, choose a time, then follow the live
            queue on your phone — so you arrive when your chair is actually ready.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <AppLink to="/salons"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold text-white shadow-[0_12px_40px_-10px_rgba(124,58,237,0.8)] transition-[filter] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
              style={{ background: V }}>
              Find a Salon <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </AppLink>
            <a href="#owners"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-6 py-3.5 text-base font-semibold text-white/90 transition-colors hover:bg-white/[0.06]">
              For Salon Owners
            </a>
          </div>

          <ul className="mt-10 grid max-w-xl gap-3 text-sm text-white/70 sm:grid-cols-3">
            {[
              { icon: Smartphone, t: "Works in your browser" },
              { icon: Clock3, t: "Live queue position" },
              { icon: KeyRound, t: "Arrival code check-in" },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0" style={{ color: VA }} aria-hidden="true" /> {t}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.figure initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease }} className="mx-auto">
          <PhoneShell label="Illustration of a Snippr booking showing queue position and arrival code">
            <TrackScreen />
          </PhoneShell>
          <figcaption className="mt-4 text-center text-xs text-white/50">Illustrative preview of the Snippr app</figcaption>
        </motion.figure>
      </div>
    </section>
  );
}
