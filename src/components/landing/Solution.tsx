import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Users, Bell } from "lucide-react";
import { V, BG, DISP, MONO } from "./tokens";
import { easeOut } from "@/lib/animations";
import { Reveal, Label } from "@/components/design/Reveal";
import { PhoneFrame } from "@/components/design/PhoneFrame";
import { HomeScreen } from "@/components/design/phone/HomeScreen";
import { BookScreen } from "@/components/design/phone/BookScreen";
import { QueueScreen } from "@/components/design/phone/QueueScreen";
import type { AppTab } from "@/components/design/phone/types";

export function Solution() {
  const solRef  = useRef<HTMLElement>(null);
  const [solStep, setSolStep] = useState(0);
  const [, setAppTab]  = useState<AppTab>("Home");

  useEffect(() => {
    let vis = false;
    const obs = new IntersectionObserver(([e]) => { vis = e.isIntersecting; }, { threshold: 0.3 });
    if (solRef.current) obs.observe(solRef.current);
    const id = setInterval(() => { if (vis) setSolStep(s => (s + 1) % 3); }, 2200);
    return () => { obs.disconnect(); clearInterval(id); };
  }, []);

  const SOL_SCREENS: Record<number, React.ReactNode> = {
    0: <HomeScreen onTabChange={setAppTab} />,
    1: <BookScreen onTabChange={setAppTab} />,
    2: <QueueScreen onTabChange={setAppTab} />,
  };

  return (
    <section ref={solRef} className="py-24 px-6" style={{ background: BG }} aria-labelledby="solution-heading">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-14 items-center">
        <Reveal>
          <Label text="The Solution" />
          <h2 id="solution-heading" className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-[1.04] text-white"
            style={{ fontFamily: DISP, letterSpacing: "-0.025em" }}>
            Snippr makes<br />queues digital.
          </h2>
          <p className="text-lg leading-relaxed mb-10" style={{ color: "rgba(255,255,255,0.4)" }}>
            Join from anywhere. Get live updates. Walk in at the exact right moment.
          </p>
          <ol className="space-y-6 list-none" aria-label="How Snippr works">
            {[
              { icon: MapPin, n: "01", t: "Find your salon",  b: "Browse nearby salons with live queue lengths and wait times." },
              { icon: Users,  n: "02", t: "Join the queue",   b: "Add yourself instantly. Your position is confirmed in real time." },
              { icon: Bell,   n: "03", t: "Walk in on cue",   b: "Snippr alerts you 5 minutes before your turn. Arrive ready." },
            ].map(({ icon: Icon, n, t, b }, i) => (
              <li key={n} className="flex items-start gap-4"
                style={{ opacity: solStep === i ? 1 : 0.4, transition: "opacity 0.3s ease" }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: solStep === i ? `${V}28` : `${V}10` }} aria-hidden="true">
                  <Icon className="w-4 h-4" style={{ color: V }} />
                </div>
                <div>
                  <div className="text-[9px] font-medium mb-0.5" style={{ color: "rgba(255,255,255,0.22)", fontFamily: MONO }}>{n}</div>
                  <h3 className="font-semibold text-white text-sm mb-1">{t}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>{b}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal delay={0.15} className="flex justify-center">
          <PhoneFrame ariaLabel="Snippr app showing solution screens">
            <AnimatePresence mode="wait">
              <motion.div key={solStep}
                initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.28, ease: easeOut }}
                style={{ height: "100%" }}>
                {SOL_SCREENS[solStep]}
              </motion.div>
            </AnimatePresence>
          </PhoneFrame>
        </Reveal>
      </div>
    </section>
  );
}
