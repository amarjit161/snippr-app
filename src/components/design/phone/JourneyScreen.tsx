import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCircle, Scissors } from "lucide-react";
import { V, VA, G, DISP, BODY, MONO } from "../../landing/tokens";
import { easeOut } from "../../../lib/animations";
import { J_STEPS } from "../../../data/journey";

export function JourneyScreen({ step }: { step: number }) {
  const s   = J_STEPS[Math.min(step, 7)];
  const pct = s.done ? 100 : Math.round(((7 - s.pos) / 7) * 100);
  const [bannerVisible, setBannerVisible] = useState(false);

  useEffect(() => {
    if (s.notify) {
      setBannerVisible(true);
      const t = setTimeout(() => setBannerVisible(false), 3500);
      return () => clearTimeout(t);
    } else {
      setBannerVisible(false);
    }
  }, [s.notify, step]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", paddingTop: 36, fontFamily: BODY, position: "relative" }}>
      {/* Notification banner */}
      <AnimatePresence>
        {bannerVisible && (
          <motion.div
            initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            aria-live="polite"
            style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 50,
              padding: "12px 14px", background: "rgba(18,18,24,0.97)",
              backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: V, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Scissors style={{ width: 14, height: 14, color: "#fff" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>Snippr</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>You're up next — walk to Fade District now</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ padding: "6px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginBottom: 2 }}>Fade District · Atlanta</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>Queue Tracker</div>
      </div>

      <div style={{ flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Position with rolling animation */}
        <div style={{ textAlign: "center", paddingTop: 2 }}>
          <AnimatePresence mode="wait">
            {s.done ? (
              <motion.div key="done"
                initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 22 }}>
                <div className="success-g" style={{ borderRadius: 20, paddingTop: 2 }}>
                  <div style={{ width: 60, height: 60, borderRadius: "50%", background: `${G}18`,
                    display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                    <CheckCircle style={{ width: 30, height: 30, color: G }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: G, letterSpacing: "0.03em", marginBottom: 6 }}>
                    Your stylist is ready
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: DISP, letterSpacing: "-0.02em" }}>
                    Chair 4
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6, fontWeight: 500 }}>Walk in now</div>
                </div>
              </motion.div>
            ) : (
              <motion.div key={`pos-${s.pos}`}
                initial={{ y: 30, opacity: 0, filter: "blur(4px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                exit={{ y: -30, opacity: 0, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}>
                <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1, fontFamily: DISP, color: V }}>
                  #{s.pos}
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginTop: 4 }}>Your Position</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stats */}
        {!s.done && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.035)",
              border: "1px solid rgba(255,255,255,0.06)", padding: "8px 10px", overflow: "hidden" }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", marginBottom: 3 }}>Wait time</div>
              <AnimatePresence mode="wait">
                <motion.div key={`wt-${s.wait}`}
                  initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.28 }}
                  style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  ~{s.wait} min
                </motion.div>
              </AnimatePresence>
            </div>
            <div style={{ borderRadius: 12, background: "rgba(255,255,255,0.035)",
              border: "1px solid rgba(255,255,255,0.06)", padding: "8px 10px" }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", marginBottom: 3 }}>Time</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: MONO }}>{s.time}</div>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {!s.done && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8,
              color: "rgba(255,255,255,0.22)", marginBottom: 5 }}>
              <span>Progress</span><span>{pct}%</span>
            </div>
            <div style={{ height: 3, borderRadius: 99, background: "rgba(255,255,255,0.07)" }}>
              <motion.div animate={{ width: `${pct}%` }}
                transition={{ duration: 0.9, ease: easeOut }}
                style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${V}, ${VA})` }} />
            </div>
          </div>
        )}

        {/* Notification at pos=1 */}
        {s.notify && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            style={{ borderRadius: 12, padding: "9px 12px", display: "flex", alignItems: "flex-start", gap: 8,
              background: `${V}16`, border: `1px solid ${V}32` }}>
            <Bell style={{ width: 13, height: 13, color: V, flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#fff" }}>You're up next!</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>Head to the salon now</div>
            </div>
          </motion.div>
        )}

        {/* Done confirmation */}
        {s.done && (
          <div style={{ borderRadius: 12, padding: "10px 12px", textAlign: "center",
            background: `${G}0C`, border: `1px solid ${G}25` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: G }}>Marcus B. — Shape Up</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>Confirmed · {s.time}</div>
          </div>
        )}

        {!s.done && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: G }} aria-hidden="true" />
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.32)" }}>Live tracking active</div>
          </div>
        )}
      </div>

      <div aria-hidden="true" style={{ paddingBottom: 10, display: "flex", justifyContent: "center" }}>
        <div style={{ width: 80, height: 2, borderRadius: 99, background: "rgba(255,255,255,0.13)" }} />
      </div>
    </div>
  );
}
