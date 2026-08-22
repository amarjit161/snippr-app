import { V, DISP, BODY, MONO } from "../../landing/tokens";
import { AppNav } from "./AppNav";
import type { AppTab } from "./types";

export function ProfileScreen({ onTabChange }: { onTabChange?: (t: AppTab) => void }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", paddingTop: 36, fontFamily: BODY }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 16px 12px" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: V, marginBottom: 6,
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16 }}>M</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>Marcus Webb</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>New York, NY</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {[{ v: "12", l: "Visits" }, { v: "4", l: "Salons" }, { v: "'23", l: "Member" }].map(s => (
          <div key={s.l} style={{ padding: "10px 0", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: DISP }}>{s.v}</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)" }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "12px 12px 0", marginBottom: 60 }}>
        <div style={{ fontSize: 8, fontWeight: 500, color: "rgba(255,255,255,0.22)", letterSpacing: "0.14em",
          marginBottom: 8, paddingLeft: 2, fontFamily: MONO }}>FAVORITE STYLISTS</div>
        {[{ n: "James B.", s: "Fade District" }, { n: "Aisha K.", s: "Salon Lumière" }].map(s => (
          <div key={s.n} style={{ borderRadius: 12, padding: "8px 12px", display: "flex",
            alignItems: "center", gap: 8, background: "rgba(255,255,255,0.035)", marginBottom: 5 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: V, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 9 }}>{s.n[0]}</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#fff" }}>{s.n}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)" }}>{s.s}</div>
            </div>
          </div>
        ))}
      </div>
      <AppNav active="Profile" onTabChange={onTabChange} />
    </div>
  );
}
