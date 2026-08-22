import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { V, BG, DISP, MONO } from "./tokens";
import { mag } from "@/lib/design-constants";
import { fadeUp, stagger, heroLine, easeOut } from "@/lib/animations";
import { useMagnetic } from "@/hooks/useMagnetic";
import { PhoneFrame } from "@/components/design/PhoneFrame";
import { RippleLink } from "@/components/design/RippleLink";
import { JourneyScreen } from "@/components/design/phone/JourneyScreen";

export function Hero({ onBookings }: { onBookings: () => void }) {
  const navigate = useNavigate();
  const [heroLoaded, setHeroLoaded] = useState(false);
  const heroBtn1 = useMagnetic(0.28) as React.RefObject<HTMLAnchorElement>;
  const heroBtn2 = useMagnetic(0.28) as React.RefObject<HTMLButtonElement>;
  const phoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setHeroLoaded(true), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = phoneRef.current;
    if (!el) return;
    const fn = (e: MouseEvent) => {
      const rx = (0.5 - e.clientY / window.innerHeight) * 16;
      const ry = (e.clientX / window.innerWidth - 0.5) * 22;
      el.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    };
    window.addEventListener("mousemove", fn, { passive: true });
    return () => window.removeEventListener("mousemove", fn);
  }, []);

  return (
    <section data-landing-hero className="min-h-screen flex items-center pt-16 px-6 relative" style={{ background: BG }}>
      {/* Grid */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
      {/* One-time light sweep */}
      {heroLoaded && (
        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: "none", overflow: "hidden", zIndex: 2 }}>
          <div style={{ position: "absolute", inset: 0, width: "35%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.025), transparent)",
            animation: "heroSweep 2s ease forwards" }} />
        </div>
      )}

      <div className="max-w-6xl mx-auto w-full grid md:grid-cols-[1fr_auto] gap-16 items-center py-16 relative z-10">
        <div>
          <motion.div variants={stagger} initial="hidden" animate="visible">
            <motion.div variants={fadeUp}
              className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border mb-7"
              style={{ borderColor: `${V}38`, color: "#A855F7", background: `${V}0C`, fontFamily: MONO }}>
              <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: "#10B981" }} aria-hidden="true" />
              Real-time queue management · 40+ cities
            </motion.div>

            <motion.h1 variants={stagger} initial="hidden" animate="visible"
              className="font-extrabold tracking-tight mb-7"
              style={{ fontFamily: DISP, fontSize: "clamp(3.5rem, 9vw, 7rem)", letterSpacing: "-0.028em", lineHeight: 0.93 }}>
              <motion.span variants={heroLine} style={{ display: "block", color: "#FAFAFA" }}>Skip the Wait.</motion.span>
              <motion.span variants={heroLine} style={{ display: "block", color: V }}>Get the Chair.</motion.span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg leading-relaxed mb-9 max-w-[390px]"
              style={{ color: "rgba(255,255,255,0.42)", letterSpacing: "-0.01em" }}>
              Track your queue position in real time.
              Walk in exactly when your stylist is ready.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
              <RippleLink ref={heroBtn1} href="#" onClick={(e) => { e.preventDefault(); onBookings(); }}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm text-white"
                style={{ background: V, ...mag }}>
                Join Queue <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </RippleLink>
              <button ref={heroBtn2} onClick={() => navigate("/how-it-works")}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm border"
                style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", ...mag }}>
                How it works
              </button>
            </motion.div>

            <motion.div variants={fadeUp} className="flex items-center gap-6 mt-8">
              {[{ v: "50K+", l: "Customers" }, { v: "2M+", l: "Bookings" }, { v: "1,200+", l: "Salons" }].map(({ v: val, l }) => (
                <div key={l}>
                  <span className="font-bold text-white text-sm" style={{ fontFamily: DISP }}>{val}</span>
                  <span className="text-xs ml-1.5" style={{ color: "rgba(255,255,255,0.22)", fontFamily: MONO }}>{l}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        {/* 3D phone */}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.45, ease: easeOut }}
          className="hidden md:flex justify-center">
          <div ref={phoneRef} style={{ transition: "transform 0.22s ease", willChange: "transform" }}>
            <div className="breathe" style={{ position: "relative" }}>
              <div aria-hidden="true" style={{ position: "absolute", inset: -40, borderRadius: "50%", pointerEvents: "none",
                background: `radial-gradient(ellipse, ${V}25, transparent 70%)`, filter: "blur(35px)" }} />
              <div aria-hidden="true" style={{ position: "absolute", bottom: -28, left: "15%", right: "15%", height: 28,
                background: "rgba(124,58,237,0.22)", filter: "blur(20px)", borderRadius: "50%" }} />
              <PhoneFrame liveTime={true} ariaLabel="Snippr queue tracker showing position #3">
                <JourneyScreen step={2} />
              </PhoneFrame>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
