import { useState, useEffect } from "react";

interface PhoneFrameProps {
  children: React.ReactNode;
  w?: number;
  h?: number;
  liveTime?: boolean;
  role?: string;
  ariaLabel?: string;
}

// Device-bezel colors below are intentionally fixed hex values (a hardware
// mockup, not a themeable surface) — not ported to design tokens.
export function PhoneFrame({ children, w = 230, h = 468, liveTime = false, role = "img", ariaLabel = "Snippr app interface" }: PhoneFrameProps) {
  const [time, setTime] = useState("9:41");
  const [signal, setSignal] = useState(4);

  useEffect(() => {
    if (!liveTime) return;
    const upd = () => {
      const n = new Date();
      setTime(`${n.getHours()}:${String(n.getMinutes()).padStart(2, "0")}`);
    };
    upd();
    const id = setInterval(upd, 1000);
    return () => clearInterval(id);
  }, [liveTime]);

  useEffect(() => {
    if (!liveTime) return;
    const id = setInterval(() => setSignal(Math.random() > 0.85 ? 3 : 4), 5000);
    return () => clearInterval(id);
  }, [liveTime]);

  return (
    <div role={role} aria-label={ariaLabel}
      style={{ width: w, height: h, borderRadius: 40, background: "#0E0E14", flexShrink: 0,
        position: "relative", overflow: "hidden",
        boxShadow: "0 28px 70px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.09)" }}>
      {/* Notch */}
      <div aria-hidden="true" style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
        width: 52, height: 14, borderRadius: 999, background: "#000", zIndex: 10 }} />
      {/* Status bar */}
      <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "11px 16px 0", zIndex: 10 }}>
        <span className="font-mono" style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>{time}</span>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2.5 }}>
          <span className="font-mono" style={{ fontSize: 7, color: "rgba(255,255,255,0.4)", marginRight: 2 }}>5G</span>
          {[5, 8, 11, 14].map((barH, i) => (
            <div key={i} style={{ width: 2.5, height: barH, borderRadius: 1.5,
              background: i < signal ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.18)",
              transition: "background 0.4s ease" }} />
          ))}
          <div style={{ width: 17, height: 8, border: "1px solid rgba(255,255,255,0.28)", borderRadius: 2.5,
            display: "flex", alignItems: "center", padding: "0 1.5px", marginLeft: 3 }}>
            <div style={{ width: "72%", height: 4, background: "rgba(255,255,255,0.62)", borderRadius: 1 }} />
          </div>
        </div>
      </div>
      {/* Screen */}
      <div style={{ position: "absolute", inset: 2, borderRadius: 38, overflow: "hidden", background: "#050507" }}>
        {children}
      </div>
      {/* Glass sheen */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: 40, pointerEvents: "none", zIndex: 20,
        background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 42%)" }} />
    </div>
  );
}
