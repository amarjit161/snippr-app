import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Apple, ShoppingBag, ChevronRight } from "lucide-react";
import { V, VA, BG, DISP, MONO } from "./tokens";
import { RippleLink } from "@/components/design/RippleLink";
import { PhoneFrame } from "@/components/design/PhoneFrame";
import { JourneyScreen } from "@/components/design/phone/JourneyScreen";

export function CTA() {
  const navigate = useNavigate();
  const ctaRef   = useRef<HTMLElement>(null);
  const [showNotif,  setShowNotif]  = useState(false);
  const [email,      setEmail]      = useState("");
  const [emailSent,  setEmailSent]  = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setTimeout(() => setShowNotif(true), 800);
    }, { threshold: 0.4 });
    if (ctaRef.current) obs.observe(ctaRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section data-landing-cta ref={ctaRef} className="py-28 px-6 relative overflow-hidden" style={{ background: BG }}
      aria-labelledby="cta-heading">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
      <div aria-hidden="true" className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${V}1E, transparent 65%)`, filter: "blur(60px)" }} />

      <div className="max-w-6xl mx-auto grid md:grid-cols-[1fr_auto] gap-16 items-center relative z-10">
        <div className="text-center md:text-left">
          <div className="text-[10px] font-semibold tracking-[0.18em] uppercase mb-4"
            style={{ color: VA, fontFamily: MONO }}>Snippr, coming soon</div>
          <h2 id="cta-heading" className="text-white font-extrabold tracking-tight leading-[0.93] mb-5"
            style={{ fontFamily: DISP, fontSize: "clamp(3rem, 8vw, 5.5rem)", letterSpacing: "-0.03em" }}>
            Ready to skip<br />
            <span style={{ color: V }}>the wait?</span>
          </h2>
          <p className="text-lg mb-2 max-w-sm mx-auto md:mx-0" style={{ color: "rgba(255,255,255,0.38)" }}>
            We're building something iconic for your next salon run.
          </p>
          <p className="text-xs mb-8" style={{ color: "rgba(255,255,255,0.22)", fontFamily: MONO }}>
            Free forever for customers · No credit card required
          </p>

          {/* Email waitlist */}
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mb-6 mx-auto md:mx-0"
            aria-label="Email waitlist signup"
            onSubmit={(e) => { e.preventDefault(); if (email.trim()) setEmailSent(true); }}>
            <label htmlFor="cta-email" className="sr-only">Email address</label>
            <input id="cta-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email" required={!emailSent}
              className="flex-1 px-4 py-3.5 rounded-xl text-sm border outline-none transition-colors"
              style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#fff" }} />
            <button type="submit"
              className="px-5 py-3.5 rounded-xl font-semibold text-sm text-white whitespace-nowrap"
              style={{ background: emailSent ? "#10B981" : V, transition: "background 0.3s ease" }}>
              {emailSent ? "✓ You're in!" : "Join Waitlist"}
            </button>
          </form>

          <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start mb-7">
            <button disabled aria-label="App Store — coming soon"
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-sm border cursor-not-allowed opacity-90"
              style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff", background: "rgba(255,255,255,0.04)" }}>
              <Apple className="w-4 h-4" aria-hidden="true" /> App Store — Soon
            </button>
            <button disabled aria-label="Google Play — coming soon"
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-sm border cursor-not-allowed opacity-90"
              style={{ borderColor: "rgba(255,255,255,0.12)", color: "#fff", background: "rgba(255,255,255,0.04)" }}>
              <ShoppingBag className="w-4 h-4" aria-hidden="true" /> Google Play — Soon
            </button>
          </div>
          <button onClick={() => navigate("/owner-login")} className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: VA }}>
            Salon owner? Get started free <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Floating success phone */}
        <div className="hidden md:block flex-shrink-0 breathe">
          <div style={{ position: "relative" }}>
            <div aria-hidden="true" style={{ position: "absolute", inset: -30, borderRadius: "50%", pointerEvents: "none",
              background: "radial-gradient(ellipse, #10B98118, transparent 70%)", filter: "blur(30px)" }} />
            <PhoneFrame w={188} h={385} ariaLabel="Success state: Chair is ready">
              <JourneyScreen step={7} />
            </PhoneFrame>
          </div>
        </div>
      </div>
    </section>
  );
}
