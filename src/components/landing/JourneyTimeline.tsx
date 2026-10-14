import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { V, VA, MONO } from "./tokens";
import { easeOut } from "@/lib/animations";
import { J_STAGES } from "@/data/journey";

export function JourneyTimeline({ stage }: { stage: number }) {
  return (
    <ol aria-label="Queue journey progress" style={{ display: "flex", flexDirection: "column", listStyle: "none", margin: 0, padding: 0 }}>
      {J_STAGES.map((s, i) => {
        const done   = stage > i;
        const active = stage === i;
        return (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14, position: "relative" }}
            aria-current={active ? "step" : undefined}>
            {i < J_STAGES.length - 1 && (
              <div aria-hidden="true" style={{ position: "absolute", left: 13, top: 28, width: 2, height: 44,
                background: done ? V : "rgba(255,255,255,0.06)", transition: "background 0.5s ease" }} />
            )}
            <div aria-hidden="true" style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, zIndex: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: active ? V : done ? `${V}20` : "rgba(255,255,255,0.05)",
              border: active ? `2px solid ${VA}` : done ? `1px solid ${V}38` : "1px solid rgba(255,255,255,0.08)",
              transition: "all 0.4s ease",
              fontSize: 9, fontWeight: 700, fontFamily: MONO,
              color: active ? "#fff" : done ? VA : "rgba(255,255,255,0.2)" }}>
              {done ? <CheckCircle style={{ width: 12, height: 12 }} /> : s.n}
            </div>
            <div style={{ paddingBottom: 44, display: "flex", flexDirection: "column" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, lineHeight: "28px", transition: "color 0.4s ease", margin: 0,
                color: active ? "#FAFAFA" : done ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.15)" }}>
                {s.title}
              </h3>
              <AnimatePresence>
                {active && (
                  <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: easeOut }}
                    style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.65,
                      marginTop: 5, maxWidth: 290, margin: "5px 0 0 0" }}>
                    {s.body}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
