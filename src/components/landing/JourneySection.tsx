import { useRef, useEffect, useState } from "react";
import { motion, useScroll } from "framer-motion";
import { V, VA, BG, MONO } from "./tokens";
import { J_STEPS } from "@/data/journey";
import { PhoneFrame } from "@/components/design/PhoneFrame";
import { JourneyScreen } from "@/components/design/phone/JourneyScreen";
import { JourneyTimeline } from "./JourneyTimeline";

export function JourneySection() {
  const journeyRef = useRef<HTMLElement>(null);
  const [jStep,    setJStep]    = useState(0);
  const [jVibrate, setJVibrate] = useState(false);
  const { scrollYProgress: journeyProg } = useScroll({ target: journeyRef, offset: ["start start", "end end"] });
  const jStage = jStep <= 1 ? 0 : jStep <= 3 ? 1 : jStep === 4 ? 2 : jStep <= 6 ? 3 : 4;

  useEffect(() => {
    return journeyProg.on("change", (v) => {
      const s = Math.min(7, Math.floor(v * 8));
      setJStep(prev => {
        if (prev !== s) {
          setJVibrate(true);
          setTimeout(() => setJVibrate(false), 450);
          return s;
        }
        return prev;
      });
    });
  }, [journeyProg]);

  return (
    <section ref={journeyRef} style={{ height: "800vh", position: "relative" }} aria-label="Live queue journey experience">
      <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", background: BG }}>
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.014) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px)", backgroundSize: "64px 64px" }} />

        <div className="absolute top-7 left-1/2 -translate-x-1/2 z-10">
          <p className="text-[9px] font-medium tracking-[0.18em] uppercase text-center"
            style={{ color: VA, fontFamily: MONO }}>
            Live Queue Journey — Scroll to experience
          </p>
        </div>

        <div className="h-full flex items-center max-w-6xl mx-auto px-6 gap-16">
          <div className="flex-1 min-w-0">
            <JourneyTimeline stage={jStage} />
          </div>

          <div className="hidden md:block flex-shrink-0">
            <div className={`${jStep === 7 ? "success-g" : ""} ${jVibrate ? "vibrate" : ""}`}
              style={{ borderRadius: 40, transition: "box-shadow 0.8s ease" }}>
              <PhoneFrame ariaLabel={`Queue position ${J_STEPS[jStep].done ? "ready" : `#${J_STEPS[jStep].pos}`}`}>
                <JourneyScreen step={jStep} />
              </PhoneFrame>
            </div>
          </div>
        </div>

        <div aria-hidden="true" className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{ background: "rgba(255,255,255,0.04)" }}>
          <motion.div style={{ scaleX: journeyProg, transformOrigin: "left", height: "100%",
            background: `linear-gradient(90deg, ${V}, ${VA})` }} />
        </div>
      </div>
    </section>
  );
}
