import { V, BODY } from "../../landing/tokens";
import { formatINR } from "../../../lib/currency";
import { AppNav } from "./AppNav";
import type { AppTab } from "./types";

export function BookScreen({ onTabChange }: { onTabChange?: (t: AppTab) => void }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", paddingTop: 36, fontFamily: BODY }}>
      <div style={{ padding: "6px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)" }}>The Fade Room · Lajpat Nagar</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>Book Appointment</div>
      </div>
      <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5, marginBottom: 60 }}>
        {[
          { n: "Haircut",         p: 350,  t: "30 min", a: true  },
          { n: "Beard Trim",      p: 150,  t: "15 min", a: false },
          { n: "Shape Up",        p: 200,  t: "20 min", a: false },
          { n: "Color Treatment", p: 800,  t: "60 min", a: false },
        ].map(s => (
          <div key={s.n} style={{ borderRadius: 12, padding: "9px 12px", display: "flex",
            alignItems: "center", justifyContent: "space-between",
            background: s.a ? `${V}16` : "rgba(255,255,255,0.03)",
            border: `1px solid ${s.a ? `${V}32` : "rgba(255,255,255,0.05)"}` }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#fff" }}>{s.n}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>{s.t}</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: s.a ? V : "rgba(255,255,255,0.28)" }}>{formatINR(s.p)}</div>
          </div>
        ))}
        <button style={{ width: "100%", borderRadius: 12, padding: "10px 0", fontSize: 11,
          fontWeight: 600, color: "#fff", background: V, border: "none", cursor: "pointer", marginTop: 4 }}>
          Select Time Slot →
        </button>
      </div>
      <AppNav active="Book" onTabChange={onTabChange} />
    </div>
  );
}
